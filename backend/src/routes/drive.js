'use strict';

// Google Drive integration — OAuth2 + file listing + file content reading
// Same OAuth pattern as gmail.js and calendar.js
//
// Flow:
//   1. GET /api/drive/login       → redirect to Google OAuth (Drive scope)
//   2. GET /api/drive/callback    → exchange code for tokens, store in Supabase
//   3. GET /api/drive/files       → list recent files (PDF, Excel, CSV, Docs)
//   4. POST /api/drive/analyze    → read a Drive file by ID → AI analysis
//   5. GET /api/drive/status      → { connected: bool }
//   6. POST /api/drive/disconnect → clear tokens

const express    = require('express');
const { google } = require('googleapis');
const axios      = require('axios');
const repos      = require('../repositories');
const logger     = require('../lib/logger');
const { generateState, validateState } = require('../lib/oauthState');
const { chat }   = require('../lib/ai');
const { asyncHandler, HTTPError } = require('../middleware/errors');
const pdfParse   = require('pdf-parse');
const xlsx       = require('xlsx');

const router = express.Router();

const PRODUCTION_REDIRECT = 'https://humble-blessing-production.up.railway.app/api/drive/callback';
function getRedirectUri(req) {
  if (process.env.DRIVE_REDIRECT_URI) return process.env.DRIVE_REDIRECT_URI;
  if (!req) return PRODUCTION_REDIRECT;
  const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000';
  return `${protocol}://${host}/api/drive/callback`;
}

// File types we support reading from Drive
const READABLE_MIME_TYPES = {
  'application/pdf':                                                              'pdf',
  'application/vnd.ms-excel':                                                    'excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':           'excel',
  'text/csv':                                                                     'csv',
  'application/vnd.google-apps.spreadsheet':                                     'gsheet',  // export as xlsx
  'application/vnd.google-apps.document':                                        'gdoc',    // export as plain text
};

const MAX_TEXT_FOR_AI = 12_000;
const MAX_DOWNLOAD_SIZE = 20 * 1024 * 1024; // 20 MB

const { BoundedMap } = require('../lib/bounded-map');
// Per-user token cache — keyed by userId
const tokenCache = new BoundedMap(10_000);

function createOAuthClient(req) {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    getRedirectUri(req),
  );
}

async function loadTokensFromDB(userId) {
  const { data } = await repos.connectedApps.loadToken(userId, 'google_drive');
  if (data?.access_token) {
    tokenCache.set(userId, JSON.parse(data.access_token));
    logger.info('Google Drive tokens loaded from Supabase', { userId });
  }
}

function getDriveClient(userId) {
  const tokens = tokenCache.get(userId);
  if (!tokens) throw new HTTPError(401, 'Google Drive not connected. Visit /api/drive/login first.');
  const oauth2Client = createOAuthClient();
  oauth2Client.setCredentials(tokens);

  oauth2Client.on('tokens', async (newTokens) => {
    const merged = { ...tokens, ...newTokens };
    tokenCache.set(userId, merged);
    await repos.connectedApps.saveToken(userId, 'google_drive', {
      accessToken: JSON.stringify(merged),
    });
  });

  return google.drive({ version: 'v3', auth: oauth2Client });
}

// ── OAuth ────────────────────────────────────────────────────────────────────

// userId passed as query param so it can be embedded in OAuth state
router.get('/login', async (req, res) => {
  const userId = req.userId;
  if (!userId) return res.status(400).json({ error: 'userId required' });

  const oauth2Client = createOAuthClient(req);
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/drive.readonly'],
    prompt: 'consent',
    state: await generateState(userId),
  });
  if (req.query.json === 'true' || req.headers.accept?.includes('application/json')) {
    return res.json({ loginUrl: url });
  }
  res.redirect(url);
});

router.get('/callback', asyncHandler(async (req, res) => {
  const { code, state } = req.query;

  const { valid, userId } = validateState(state);
  if (!valid || !userId) {
    return res.status(403).send('Invalid or expired OAuth state. Please try connecting again.');
  }
  if (!code) return res.status(400).send('Missing code');

  const oauth2Client = createOAuthClient(req);
  const { tokens } = await oauth2Client.getToken(code);
  tokenCache.set(userId, tokens);

  await repos.connectedApps.saveToken(userId, 'google_drive', {
    accessToken: JSON.stringify(tokens),
  });

  logger.info('Google Drive connected', { userId });

  res.send(`
    <html><body style="font-family:sans-serif;text-align:center;padding:40px">
      <h2>✅ Google Drive Connected!</h2>
      <p>Clutch can now read your Drive files.</p>
      <p>Redirecting back to app...</p>
      <script>setTimeout(() => { window.location.href = 'clutch://connected?service=drive'; }, 1500)</script>
    </body></html>
  `);
}));

router.get('/status', asyncHandler(async (req, res) => {
  const userId = req.userId;
  if (!tokenCache.has(userId)) {
    await loadTokensFromDB(userId).catch(() => {});
  }
  res.json({ connected: tokenCache.has(userId) });
}));

router.post('/disconnect', asyncHandler(async (req, res) => {
  const userId = req.userId;
  tokenCache.delete(userId);
  await repos.connectedApps.saveToken(userId, 'google_drive', { accessToken: null });
  res.json({ success: true });
}));

// ── File listing ─────────────────────────────────────────────────────────────

// GET /api/drive/files?query=budget&pageSize=20
router.get('/files', asyncHandler(async (req, res) => {
  const userId = req.userId;
  if (!tokenCache.has(userId)) {
    await loadTokensFromDB(userId).catch(() => {});
  }

  const drive    = getDriveClient(userId);
  const pageSize = Math.min(parseInt(req.query.pageSize || '20', 10), 50);
  const query    = req.query.query;

  // Build Drive query — only file types we can read
  const mimeFilter = Object.keys(READABLE_MIME_TYPES)
    .map(m => `mimeType='${m}'`)
    .join(' or ');

  // Escape quotes and backslashes in user query to prevent Drive API query injection
  const safeQuery = query
    ? query.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
    : null;

  const q = safeQuery
    ? `(${mimeFilter}) and name contains '${safeQuery}' and trashed=false`
    : `(${mimeFilter}) and trashed=false`;

  const response = await drive.files.list({
    q,
    pageSize,
    orderBy: 'modifiedTime desc',
    fields: 'files(id,name,mimeType,size,modifiedTime,webViewLink)',
  });

  const files = (response.data.files || []).map(f => ({
    id:           f.id,
    name:         f.name,
    type:         READABLE_MIME_TYPES[f.mimeType] || 'unknown',
    mimeType:     f.mimeType,
    sizeMB:       f.size ? (parseInt(f.size) / (1024 * 1024)).toFixed(2) : null,
    modifiedTime: f.modifiedTime,
    viewLink:     f.webViewLink,
  }));

  res.json({ files, count: files.length });
}));

// ── File reading + AI analysis ────────────────────────────────────────────────

// POST /api/drive/analyze   body: { fileId, question?, tone? }
router.post('/analyze', asyncHandler(async (req, res) => {
  const userId = req.userId;
  if (!tokenCache.has(userId)) {
    await loadTokensFromDB(userId).catch(() => {});
  }

  const { fileId, tone = 'pro' } = req.body;
  // Cap question length to prevent prompt inflation attacks
  const question = typeof req.body.question === 'string'
    ? req.body.question.slice(0, 500)
    : undefined;

  if (!fileId || typeof fileId !== 'string') throw new HTTPError(400, 'fileId is required');

  const drive = getDriveClient(userId);

  // Get file metadata first
  const meta = await drive.files.get({
    fileId,
    fields: 'id,name,mimeType,size',
  });

  const { name, mimeType, size } = meta.data;
  const fileType = READABLE_MIME_TYPES[mimeType];

  if (!fileType) {
    throw new HTTPError(422, `File type not supported for analysis: ${mimeType}`);
  }

  if (size && parseInt(size) > MAX_DOWNLOAD_SIZE) {
    throw new HTTPError(413, `File too large (${(parseInt(size) / 1024 / 1024).toFixed(1)} MB). Max ${MAX_DOWNLOAD_SIZE / 1024 / 1024} MB.`);
  }

  // Download / export file content
  let buffer;
  let effectiveMime = mimeType;

  if (mimeType === 'application/vnd.google-apps.spreadsheet') {
    // Export Google Sheet as Excel
    const exported = await drive.files.export(
      { fileId, mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
      { responseType: 'arraybuffer' }
    );
    buffer = Buffer.from(exported.data);
    effectiveMime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  } else if (mimeType === 'application/vnd.google-apps.document') {
    // Export Google Doc as plain text
    const exported = await drive.files.export(
      { fileId, mimeType: 'text/plain' },
      { responseType: 'arraybuffer' }
    );
    buffer = Buffer.from(exported.data);
    effectiveMime = 'text/plain';
  } else {
    // Download binary file (PDF, Excel, CSV)
    const downloaded = await drive.files.get(
      { fileId, alt: 'media' },
      { responseType: 'arraybuffer' }
    );
    buffer = Buffer.from(downloaded.data);
  }

  // Extract text from buffer
  let text = '';
  let metaExtra = {};

  if (effectiveMime === 'application/pdf') {
    const parsed = await pdfParse(buffer);
    text = parsed.text;
    metaExtra.pages = parsed.numpages;
  } else if (effectiveMime === 'text/plain' || effectiveMime === 'text/csv') {
    text = buffer.toString('utf-8');
  } else {
    // Excel
    const workbook = xlsx.read(buffer, { type: 'buffer' });
    const sheets = workbook.SheetNames.map(sheetName => {
      const sheet = workbook.Sheets[sheetName];
      return `--- Sheet: ${sheetName} ---\n${xlsx.utils.sheet_to_csv(sheet)}`;
    });
    text = sheets.join('\n\n');
    metaExtra.sheets = workbook.SheetNames;
  }

  if (!text.trim()) {
    throw new HTTPError(422, 'Could not extract text from this file. It may be image-based or empty.');
  }

  const truncated = text.length > MAX_TEXT_FOR_AI;
  const textForAI = truncated ? text.slice(0, MAX_TEXT_FOR_AI) : text;

  const userPrompt = question
    ? `${question}\n\n[Document: ${name}]\n${textForAI}`
    : `Analyze this document and give me a clear summary with the most important numbers, insights, and anything I should pay attention to.\n\n[Document: ${name}]\n${textForAI}`;

  const metaParts = [`File: ${name}`, `Type: ${fileType}`];
  if (metaExtra.pages)  metaParts.push(`Pages: ${metaExtra.pages}`);
  if (metaExtra.sheets) metaParts.push(`Sheets: ${metaExtra.sheets.join(', ')}`);
  if (truncated) metaParts.push(`Note: File was large — showing first ${MAX_TEXT_FOR_AI} characters`);

  const aiMessage = await chat({
    messages: [{ role: 'user', content: userPrompt }],
    tools: [],
    tone,
    connectedServices: [],
    systemExtra: `The user has shared a file from Google Drive. ${metaParts.join('. ')}. Extract key information, highlight important numbers, flag anything unusual. Be specific — mention exact amounts, dates, names.`,
  });

  logger.info('Drive file analyzed', { fileId, name, type: fileType, truncated, userId });

  res.json({
    reply: aiMessage.content,
    fileMeta: {
      id:        fileId,
      name,
      type:      fileType,
      truncated,
      ...metaExtra,
    },
  });
}));

module.exports = router;
