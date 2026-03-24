const express = require('express');
const router = express.Router();
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const supabase = require('../lib/supabase');

// Use production key if available, otherwise sandbox
function getCasApiKey() {
  return process.env.CASPARSER_PRODUCTION_KEY && process.env.CASPARSER_PRODUCTION_KEY !== 'paste_your_production_key_here'
    ? process.env.CASPARSER_PRODUCTION_KEY
    : process.env.CASPARSER_API_KEY;
}

// CAS file path persisted in Supabase connected_apps table — survives server restarts
let uploadedCasPath = null;
let uploadedCasName = null;

const upload = multer({ dest: 'uploads/' });

// Load CAS path from DB on startup
async function loadCasFromDB() {
  const { data } = await supabase
    .from('connected_apps')
    .select('access_token')
    .eq('user_id', 'default_user')
    .eq('app_name', 'cas')
    .single();

  if (data?.access_token) {
    const meta = JSON.parse(data.access_token);
    if (meta.path && fs.existsSync(meta.path)) {
      uploadedCasPath = meta.path;
      uploadedCasName = meta.filename;
      console.log('CAS file path loaded from Supabase:', uploadedCasName);
    }
  }
}

loadCasFromDB().catch(console.error);

// POST /api/cas/upload
// Mobile sends PDF file, we store path and persist to Supabase
router.post('/upload', upload.single('pdf'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No PDF file uploaded' });
  }
  uploadedCasPath = req.file.path;
  uploadedCasName = req.file.originalname;

  // Persist to Supabase so path survives server restarts
  await supabase
    .from('connected_apps')
    .upsert({
      user_id: 'default_user',
      app_name: 'cas',
      access_token: JSON.stringify({ path: uploadedCasPath, filename: uploadedCasName }),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,app_name' });

  res.json({ success: true, message: 'CAS PDF uploaded. Now ask Clutch to show your mutual funds.' });
});

// GET /api/cas/status
router.get('/status', async (req, res) => {
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
    uploaded: !!uploadedCasPath,
    filename: uploadedCasName || null,
    api_mode: isProduction ? 'production' : isSandbox ? 'sandbox' : 'none',
    local_parser: localParserRunning ? 'running' : 'stopped',
    fallback_available: localParserRunning,
  });
});

// GET /api/cas/clear
router.get('/clear', async (req, res) => {
  if (uploadedCasPath && fs.existsSync(uploadedCasPath)) {
    fs.unlinkSync(uploadedCasPath);
  }
  uploadedCasPath = null;
  uploadedCasName = null;

  await supabase
    .from('connected_apps')
    .delete()
    .eq('user_id', 'default_user')
    .eq('app_name', 'cas');

  res.json({ success: true });
});

function getUploadedCasPath() { return uploadedCasPath; }

// --- CASParserHQ API (primary) ---
async function parseCasAPI(password) {
  const apiKey = getCasApiKey();
  if (!apiKey) {
    throw new Error('No CASParser API key configured (neither production nor sandbox)');
  }

  const form = new FormData();
  form.append('pdf_file', fs.createReadStream(uploadedCasPath));
  if (password) form.append('password', password);

  const isSandbox = apiKey.startsWith('sandbox');
  console.log(`[CAS] Using ${isSandbox ? 'sandbox' : 'production'} API key`);

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
async function parseCasLocal(password) {
  const localPort = process.env.CASPARSER_LOCAL_PORT || 3001;
  const localUrl = `http://127.0.0.1:${localPort}`;

  // Check if local service is running
  try {
    await axios.get(`${localUrl}/health`, { timeout: 3000 });
  } catch {
    throw new Error('Local CASParser not running. Start it: cd casparser-local && python server.py');
  }

  const form = new FormData();
  form.append('pdf_file', fs.createReadStream(uploadedCasPath));
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

// Core parse function — called by executor
// Strategy: try CASParserHQ API first, fallback to local Python parser
async function parseCas(password) {
  if (!uploadedCasPath) {
    return { error: 'No CAS PDF uploaded. Upload your CAMS or KFintech CAS PDF first.' };
  }

  // Try CASParserHQ API first
  try {
    const apiData = await parseCasAPI(password);
    console.log('[CAS] Parsed via CASParserHQ API');
    return normalizeResponse(apiData);
  } catch (apiErr) {
    const status = apiErr.response?.status;
    const isCreditsExhausted = status === 402;
    const isDown = !apiErr.response || status >= 500;
    const isAuthFailed = status === 401;
    const isBadPDF = status === 400;

    // Don't fallback for bad PDF — same file will fail locally too
    if (isBadPDF) {
      return { error: 'Invalid PDF or wrong password. Ensure you uploaded a CAS PDF with correct PAN as password.' };
    }

    // Don't fallback for auth issues unless we also have local parser
    console.warn(`[CAS] API failed (${apiErr.message}), trying local fallback...`);

    // Try local Python parser as fallback
    try {
      const localData = await parseCasLocal(password);
      console.log('[CAS] Parsed via local casparser (fallback)');
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

module.exports = router;
module.exports.parseCas = parseCas;
module.exports.getUploadedCasPath = getUploadedCasPath;
