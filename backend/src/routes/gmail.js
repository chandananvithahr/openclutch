const express = require('express');
const router = express.Router();
const { google } = require('googleapis');
const repos = require('../repositories');
const logger = require('../lib/logger');
const { generateState, validateState } = require('../lib/oauthState');

// Dynamic redirect URI — works on local and Railway automatically
const PRODUCTION_REDIRECT = 'https://humble-blessing-production.up.railway.app/api/gmail/callback';
function getRedirectUri(req) {
  if (process.env.GMAIL_REDIRECT_URI) return process.env.GMAIL_REDIRECT_URI;
  if (!req) return PRODUCTION_REDIRECT;
  const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000';
  return `${protocol}://${host}/api/gmail/callback`;
}

function createOAuthClient(req) {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    getRedirectUri(req)
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

const { BoundedMap } = require('../lib/bounded-map');
// Per-user token cache — keyed by userId
const tokenCache = new BoundedMap(10_000);

async function loadTokensFromDB(userId) {
  const { data } = await repos.connectedApps.loadToken(userId, 'gmail');
  if (data?.access_token) {
    tokenCache.set(userId, JSON.parse(data.access_token));
    logger.info('Gmail tokens loaded from Supabase', { userId });
  }
}

// GET /api/gmail/login — returns JSON for app, redirects for browser
// userId passed as query param so it can be embedded in OAuth state
router.get('/login', async (req, res) => {
  const userId = req.userId;
  if (!userId) return res.status(400).json({ error: 'userId required' });

  const oauth2Client = createOAuthClient(req);
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/gmail.readonly'],
    prompt: 'consent',
    state: await generateState(userId),
  });
  if (req.query.json === 'true' || req.headers.accept?.includes('application/json')) {
    return res.json({ loginUrl: url });
  }
  res.redirect(url);
});

// GET /api/gmail/callback — Google redirects here after login
router.get('/callback', async (req, res) => {
  const { code, state } = req.query;

  const { valid, userId } = await validateState(state);
  if (!valid || !userId) {
    return res.status(403).send('Invalid or expired OAuth state. Please try connecting again.');
  }
  if (!code) return res.status(400).send('Missing code');

  try {
    const oauth2Client = createOAuthClient(req);
    const { tokens } = await oauth2Client.getToken(code);
    tokenCache.set(userId, tokens);

    // Save to Supabase
    await repos.connectedApps.saveToken(userId, 'gmail', {
      accessToken: JSON.stringify(tokens),
    });

    res.send(`
      <html><body style="font-family:sans-serif;text-align:center;padding:40px">
        <h2>✅ Gmail Connected!</h2>
        <p>Clutch can now read your emails.</p>
        <p>Redirecting back to app...</p>
        <script>setTimeout(() => { window.location.href = 'clutch://connected?service=gmail'; }, 1500)</script>
      </body></html>
    `);
  } catch (err) {
    logger.error('Gmail OAuth error:', err.message);
    res.status(500).send(`Auth failed: ${err.message}`);
  }
});

// GET /api/gmail/status
router.get('/status', async (req, res) => {
  const userId = req.userId;
  if (!tokenCache.has(userId)) {
    await loadTokensFromDB(userId).catch(() => {});
  }
  res.json({ connected: tokenCache.has(userId) });
});

// Shared OAuth client with auto-refresh — per-user tokens
function getAuthenticatedClient(userId) {
  const tokens = tokenCache.get(userId);
  if (!tokens) return null;

  const oauth2Client = createOAuthClient();
  oauth2Client.setCredentials(tokens);

  oauth2Client.on('tokens', async (newTokens) => {
    const merged = { ...tokens, ...newTokens };
    tokenCache.set(userId, merged);
    await repos.connectedApps.saveToken(userId, 'gmail', {
      accessToken: JSON.stringify(merged),
    });
  });

  return oauth2Client;
}

// Fetch emails — called by tool executor (userId required)
async function fetchEmails(userId, count = 10) {
  if (!tokenCache.has(userId)) {
    await loadTokensFromDB(userId).catch(() => {});
  }
  if (!tokenCache.has(userId)) return null;

  const oauth2Client = getAuthenticatedClient(userId);
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

async function searchEmails(userId, query, count = 5) {
  if (!tokenCache.has(userId)) {
    await loadTokensFromDB(userId).catch(() => {});
  }
  if (!tokenCache.has(userId)) return null;

  const oauth2Client = getAuthenticatedClient(userId);
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

async function isConnected(userId) {
  if (!tokenCache.has(userId)) {
    await loadTokensFromDB(userId).catch(() => {});
  }
  return tokenCache.has(userId);
}

module.exports = router;
module.exports.fetchEmails = fetchEmails;
module.exports.searchEmails = searchEmails;
module.exports.isConnected = isConnected;
