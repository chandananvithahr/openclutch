const express = require('express');
const router = express.Router();
const { google } = require('googleapis');
const supabase = require('../lib/supabase');
const logger = require('../lib/logger');

const REDIRECT_URI = process.env.GMAIL_REDIRECT_URI || 'http://127.0.0.1:3000/api/gmail/callback';

function createOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    REDIRECT_URI
  );
}

// Extract plain text from Gmail message payload (handles nested parts)
function extractBody(payload) {
  if (!payload) return '';

  // Direct body
  if (payload.body?.data) {
    return Buffer.from(payload.body.data, 'base64').toString('utf-8');
  }

  // Multipart — find text/plain first, fall back to text/html
  if (payload.parts) {
    const plain = payload.parts.find(p => p.mimeType === 'text/plain');
    if (plain?.body?.data) return Buffer.from(plain.body.data, 'base64').toString('utf-8');

    const html = payload.parts.find(p => p.mimeType === 'text/html');
    if (html?.body?.data) {
      // Strip HTML tags for clean text
      return Buffer.from(html.body.data, 'base64').toString('utf-8').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    }

    // Nested multipart (e.g. multipart/alternative inside multipart/mixed)
    for (const part of payload.parts) {
      const nested = extractBody(part);
      if (nested) return nested;
    }
  }

  return '';
}

// Load tokens from Supabase on startup
let gmailTokens = null;

async function loadTokensFromDB() {
  const { data } = await supabase
    .from('connected_apps')
    .select('access_token')
    .eq('user_id', 'default_user')
    .eq('app_name', 'gmail')
    .single();

  if (data?.access_token) {
    gmailTokens = JSON.parse(data.access_token);
    logger.info('Gmail tokens loaded from Supabase');
  }
}

loadTokensFromDB().catch(err => logger.error('Gmail token load failed', { err: err.message }));

// GET /api/gmail/login — returns JSON for app, redirects for browser
router.get('/login', (req, res) => {
  const oauth2Client = createOAuthClient();
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/gmail.readonly'],
    prompt: 'consent',
  });
  if (req.query.json === 'true' || req.headers.accept?.includes('application/json')) {
    return res.json({ loginUrl: url });
  }
  res.redirect(url);
});

// GET /api/gmail/callback — Google redirects here after login
router.get('/callback', async (req, res) => {
  const { code } = req.query;

  if (!code) return res.status(400).send('Missing code');

  try {
    const oauth2Client = createOAuthClient();
    const { tokens } = await oauth2Client.getToken(code);
    gmailTokens = tokens;

    // Save to Supabase
    await supabase
      .from('connected_apps')
      .upsert({
        user_id: 'default_user',
        app_name: 'gmail',
        access_token: JSON.stringify(tokens),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,app_name' });

    res.send(`
      <html><body style="font-family:sans-serif;text-align:center;padding:40px">
        <h2>✅ Gmail Connected!</h2>
        <p>Clutch can now read your emails.</p>
        <p>Close this tab and go back to the chat.</p>
        <script>setTimeout(() => window.close(), 3000)</script>
      </body></html>
    `);
  } catch (err) {
    logger.error('Gmail OAuth error:', err.message);
    res.status(500).send(`Auth failed: ${err.message}`);
  }
});

// GET /api/gmail/status
router.get('/status', (req, res) => {
  res.json({ connected: !!gmailTokens });
});

// Shared OAuth client with auto-refresh — avoids registering listener multiple times
function getAuthenticatedClient() {
  const oauth2Client = createOAuthClient();
  oauth2Client.setCredentials(gmailTokens);

  oauth2Client.on('tokens', async (tokens) => {
    gmailTokens = { ...gmailTokens, ...tokens };
    await supabase
      .from('connected_apps')
      .update({ access_token: JSON.stringify(gmailTokens), updated_at: new Date().toISOString() })
      .eq('user_id', 'default_user')
      .eq('app_name', 'gmail');
  });

  return oauth2Client;
}

// Fetch emails — called by tool executor
async function fetchEmails(count = 10) {
  if (!gmailTokens) return null;

  const oauth2Client = getAuthenticatedClient();
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  // Get list of unread message IDs
  const listRes = await gmail.users.messages.list({
    userId: 'me',
    labelIds: ['INBOX'],
    q: 'is:unread',
    maxResults: count,
  });

  const messageIds = listRes.data.messages || [];
  const totalUnread = listRes.data.resultSizeEstimate || 0;

  // Fetch each message
  const emails = await Promise.all(
    messageIds.map(async ({ id }) => {
      const msg = await gmail.users.messages.get({
        userId: 'me',
        id,
        format: 'metadata',
        metadataHeaders: ['From', 'Subject', 'Date'],
      });

      const headers = msg.data.payload.headers;
      const get = (name) => headers.find(h => h.name === name)?.value || '';

      return {
        from: get('From'),
        subject: get('Subject'),
        date: get('Date'),
        preview: msg.data.snippet || '',
      };
    })
  );

  return { emails, total_unread: totalUnread };
}

async function searchEmails(query, count = 5) {
  if (!gmailTokens) return null;

  const oauth2Client = getAuthenticatedClient();
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  const listRes = await gmail.users.messages.list({
    userId: 'me',
    q: query,
    maxResults: count,
  });

  const messageIds = listRes.data.messages || [];
  if (messageIds.length === 0) return { emails: [], query };

  const emails = await Promise.all(
    messageIds.map(async ({ id }) => {
      const msg = await gmail.users.messages.get({
        userId: 'me',
        id,
        format: 'full',
      });

      const headers = msg.data.payload.headers;
      const get = (name) => headers.find(h => h.name === name)?.value || '';

      // Extract plain text body from the email parts
      const body = extractBody(msg.data.payload);

      return {
        from: get('From'),
        subject: get('Subject'),
        date: get('Date'),
        preview: msg.data.snippet || '',
        body: body ? body.slice(0, 2000) : '', // cap at 2000 chars to avoid token bloat
      };
    })
  );

  return { emails, query };
}

module.exports = router;
module.exports.fetchEmails = fetchEmails;
module.exports.searchEmails = searchEmails;
module.exports.isConnected = () => !!gmailTokens;
