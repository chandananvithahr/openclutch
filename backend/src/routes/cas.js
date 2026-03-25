const express = require('express');
const router = express.Router();
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const repos = require('../repositories');
const logger = require('../lib/logger');

// Use production key if available, otherwise sandbox
function getCasApiKey() {
  return process.env.CASPARSER_PRODUCTION_KEY && process.env.CASPARSER_PRODUCTION_KEY !== 'paste_your_production_key_here'
    ? process.env.CASPARSER_PRODUCTION_KEY
    : process.env.CASPARSER_API_KEY;
}

// Per-user CAS file cache — keyed by userId → { path, filename }
const casFileCache = new Map();

const MAX_CAS_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB — CAS PDFs are typically < 2 MB
const ALLOWED_MIME_TYPES = new Set(['application/pdf']);

const upload = multer({
  dest: 'uploads/',
  limits: { fileSize: MAX_CAS_SIZE_BYTES },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed for CAS upload'));
    }
  },
});

// Load CAS path from DB for a given user (lazy — called on demand)
async function loadCasFromDB(userId) {
  const { data } = await repos.connectedApps.loadToken(userId, 'cas');

  if (data?.access_token) {
    const meta = JSON.parse(data.access_token);
    if (meta.path && fs.existsSync(meta.path)) {
      casFileCache.set(userId, { path: meta.path, filename: meta.filename });
      logger.info('CAS file path loaded from Supabase', { userId, filename: meta.filename });
    }
  }
}

// POST /api/cas/upload
// Mobile sends PDF file, we store path and persist to Supabase
router.post('/upload', upload.single('pdf'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No PDF file uploaded' });
  }

  const userId = req.userId;
  casFileCache.set(userId, { path: req.file.path, filename: req.file.originalname });

  // Persist to Supabase so path survives server restarts
  await repos.connectedApps.saveMeta(userId, 'cas', {
    path: req.file.path, filename: req.file.originalname,
  });

  res.json({ success: true, message: 'CAS PDF uploaded. Now ask Clutch to show your mutual funds.' });
});

// GET /api/cas/status
router.get('/status', async (req, res) => {
  const userId = req.userId;
  if (!casFileCache.has(userId)) {
    await loadCasFromDB(userId).catch(() => {});
  }

  const userCas = casFileCache.get(userId);
  const apiKey = getCasApiKey();
  const isSandbox = apiKey?.startsWith('sandbox') || false;
  const isProduction = apiKey && !isSandbox;

  // Check if local parser is running
  let localParserRunning = false;
  try {
    const localPort = process.env.CASPARSER_LOCAL_PORT || 3001;
    await axios.get(`http://127.0.0.1:${localPort}/health`, { timeout: 2000 });
    localParserRunning = true;
  } catch {}

  res.json({
    uploaded: !!userCas,
    filename: userCas?.filename || null,
    api_mode: isProduction ? 'production' : isSandbox ? 'sandbox' : 'none',
    local_parser: localParserRunning ? 'running' : 'stopped',
    fallback_available: localParserRunning,
  });
});

// GET /api/cas/clear
router.get('/clear', async (req, res) => {
  const userId = req.userId;
  const userCas = casFileCache.get(userId);

  if (userCas?.path && fs.existsSync(userCas.path)) {
    fs.unlinkSync(userCas.path);
  }
  casFileCache.delete(userId);

  await repos.connectedApps.deleteToken(userId, 'cas');

  res.json({ success: true });
});

// --- CASParserHQ API (primary) ---
async function parseCasAPI(casPath, password) {
  const apiKey = getCasApiKey();
  if (!apiKey) {
    throw new Error('No CASParser API key configured (neither production nor sandbox)');
  }

  const form = new FormData();
  form.append('pdf_file', fs.createReadStream(casPath));
  if (password) form.append('password', password);

  const isSandbox = apiKey.startsWith('sandbox');
  logger.info(`[CAS] Using ${isSandbox ? 'sandbox' : 'production'} API key`);

  const response = await axios.post('https://api.casparser.in/v4/smart/parse', form, {
    headers: {
      'X-API-KEY': apiKey,
      ...form.getHeaders(),
    },
    timeout: 60000,
  });

  const data = response.data;

  if (data.status === 'failed') {
    throw new Error(`CAS parse failed: ${data.msg || 'Unknown error'}`);
  }

  return { ...data, source: 'casparser-api' };
}

// --- Local Python casparser (fallback) ---
async function parseCasLocal(casPath, password) {
  const localPort = process.env.CASPARSER_LOCAL_PORT || 3001;
  const localUrl = `http://127.0.0.1:${localPort}`;

  // Check if local service is running
  try {
    await axios.get(`${localUrl}/health`, { timeout: 3000 });
  } catch {
    throw new Error('Local CASParser not running. Start it: cd casparser-local && python server.py');
  }

  const form = new FormData();
  form.append('pdf_file', fs.createReadStream(casPath));
  if (password) form.append('password', password);

  const response = await axios.post(`${localUrl}/parse`, form, {
    headers: form.getHeaders(),
    timeout: 120000, // local parsing can be slower
  });

  const data = response.data;

  if (data.status === 'failed') {
    throw new Error(`Local parse failed: ${data.msg || 'Unknown error'}`);
  }

  return { ...data, source: 'casparser-local' };
}

// --- Normalize response from either source ---
function normalizeResponse(data) {
  const mfHoldings = (data.mutual_funds || []).map(f => ({
    folio: f.folio,
    scheme: f.scheme,
    amc: f.amc,
    units: f.units,
    nav: f.nav,
    current_value: parseFloat((f.current_value || 0).toFixed(2)),
    xirr: f.xirr || null,
    isin: f.isin || null,
  }));

  const totalMfValue = mfHoldings.reduce((sum, f) => sum + f.current_value, 0);

  return {
    total_mf_value: parseFloat(totalMfValue.toFixed(2)),
    fund_count: mfHoldings.length,
    holdings: mfHoldings,
    xirr_overall: data.summary?.xirr || null,
    investor_name: data.investor?.name || null,
    statement_period: data.meta?.statement_period || null,
    source: data.source || 'unknown',
  };
}

// Core parse function — called by executor (userId required)
// Strategy: try CASParserHQ API first, fallback to local Python parser
async function parseCas(userId, password) {
  if (!casFileCache.has(userId)) {
    await loadCasFromDB(userId).catch(() => {});
  }

  const userCas = casFileCache.get(userId);
  if (!userCas) {
    return { error: 'No CAS PDF uploaded. Upload your CAMS or KFintech CAS PDF first.' };
  }

  const casPath = userCas.path;

  // Try CASParserHQ API first
  try {
    const apiData = await parseCasAPI(casPath, password);
    logger.info('[CAS] Parsed via CASParserHQ API', { userId });
    return normalizeResponse(apiData);
  } catch (apiErr) {
    const status = apiErr.response?.status;
    const isCreditsExhausted = status === 402;
    const isAuthFailed = status === 401;
    const isBadPDF = status === 400;

    // Don't fallback for bad PDF — same file will fail locally too
    if (isBadPDF) {
      return { error: 'Invalid PDF or wrong password. Ensure you uploaded a CAS PDF with correct PAN as password.' };
    }

    // Don't fallback for auth issues unless we also have local parser
    logger.warn(`[CAS] API failed (${apiErr.message}), trying local fallback...`);

    // Try local Python parser as fallback
    try {
      const localData = await parseCasLocal(casPath, password);
      logger.info('[CAS] Parsed via local casparser (fallback)', { userId });
      return normalizeResponse(localData);
    } catch (localErr) {
      // Both failed — return the most useful error
      if (isCreditsExhausted) {
        return {
          error: 'CASParser API credits exhausted and local parser unavailable.',
          action: 'Start the local parser: cd backend/casparser-local && pip install -r requirements.txt && python server.py',
          api_error: apiErr.message,
          local_error: localErr.message,
        };
      }
      if (isAuthFailed) {
        return { error: 'Invalid CASParser API key and local parser unavailable.', local_error: localErr.message };
      }
      return {
        error: `CAS parse failed on both API and local parser.`,
        api_error: apiErr.message,
        local_error: localErr.message,
        action: 'Ensure local parser is running: cd backend/casparser-local && python server.py',
      };
    }
  }
}

function getUploadedCasPath(userId) {
  return casFileCache.get(userId)?.path || null;
}

module.exports = router;
module.exports.parseCas = parseCas;
module.exports.getUploadedCasPath = getUploadedCasPath;
