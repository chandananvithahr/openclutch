'use strict';

// File analysis route — PDF and Excel upload → AI analysis
// Pattern: upload → extract text → send to OpenAI → return structured response
//
// POST /api/files/analyze   — upload + analyze in one shot
// GET  /api/files/supported — list supported file types

const express  = require('express');
const multer   = require('multer');
const fs       = require('fs');
const path     = require('path');
const pdfParse = require('pdf-parse');
const xlsx     = require('xlsx');
const { chat } = require('../lib/ai');
const { asyncHandler, HTTPError } = require('../middleware/errors');
const logger   = require('../lib/logger');

const router = express.Router();

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
]);
const MAX_TEXT_FOR_AI = 12_000; // chars — keep within context budget

const upload = multer({
  dest: 'uploads/',
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.has(file.mimetype)) return cb(null, true);
    // Also allow by extension for files where mimetype detection is unreliable
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.pdf', '.xls', '.xlsx', '.csv'].includes(ext)) return cb(null, true);
    cb(new Error('Only PDF, Excel (.xls/.xlsx), and CSV files are supported.'));
  },
});

// Extract text from uploaded file — returns { text, summary, pageCount? }
async function extractText(filePath, mimetype, originalName) {
  const ext = path.extname(originalName).toLowerCase();
  const buffer = await fs.promises.readFile(filePath);

  if (mimetype === 'application/pdf' || ext === '.pdf') {
    const parsed = await pdfParse(buffer);
    return {
      text: parsed.text,
      pageCount: parsed.numpages,
      type: 'pdf',
    };
  }

  if (['.xls', '.xlsx'].includes(ext) ||
      mimetype === 'application/vnd.ms-excel' ||
      mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
    const workbook = xlsx.read(buffer, { type: 'buffer' });
    const sheets = workbook.SheetNames.map(name => {
      const sheet = workbook.Sheets[name];
      const csv   = xlsx.utils.sheet_to_csv(sheet);
      return `--- Sheet: ${name} ---\n${csv}`;
    });
    return {
      text: sheets.join('\n\n'),
      sheetCount: workbook.SheetNames.length,
      sheetNames: workbook.SheetNames,
      type: 'excel',
    };
  }

  if (ext === '.csv' || mimetype === 'text/csv') {
    return {
      text: buffer.toString('utf-8'),
      type: 'csv',
    };
  }

  throw new HTTPError(400, 'Unsupported file type');
}

// GET /api/files/supported
router.get('/supported', (_req, res) => {
  res.json({
    types: ['PDF', 'Excel (.xls, .xlsx)', 'CSV'],
    maxSizeMB: MAX_FILE_SIZE / (1024 * 1024),
    examples: [
      'Bank statements (PDF)',
      'Portfolio exports (Excel)',
      'Expense reports (Excel/CSV)',
      'Salary slips (PDF)',
      'MF statements (PDF)',
      'Tax documents (PDF)',
    ],
  });
});

// POST /api/files/analyze
// Body: multipart/form-data — file + optional { question, tone }
router.post('/analyze', upload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new HTTPError(400, 'No file uploaded. Send file as multipart/form-data with field name "file".');
  }

  const { tone = 'pro' } = req.body;
  // Cap question length to prevent prompt inflation attacks
  const question = typeof req.body.question === 'string'
    ? req.body.question.slice(0, 500)
    : undefined;
  const { path: filePath, mimetype, originalname } = req.file;

  let extracted;
  try {
    extracted = await extractText(filePath, mimetype, originalname);
  } finally {
    // Always delete the temp file — don't store user documents on disk
    fs.unlink(filePath, () => {});
  }

  const text = extracted.text.trim();
  if (!text) {
    throw new HTTPError(422, 'Could not extract any text from this file. It may be scanned or image-only.');
  }

  // Truncate to keep within AI context budget
  const truncated = text.length > MAX_TEXT_FOR_AI;
  const textForAI  = truncated ? text.slice(0, MAX_TEXT_FOR_AI) : text;

  // Build meta string for context
  const metaParts = [`File: ${originalname}`];
  if (extracted.pageCount) metaParts.push(`Pages: ${extracted.pageCount}`);
  if (extracted.sheetCount) metaParts.push(`Sheets: ${extracted.sheetNames.join(', ')}`);
  if (truncated) metaParts.push(`Note: File was large — showing first ${MAX_TEXT_FOR_AI} characters`);

  const userPrompt = question
    ? `${question}\n\n[Document content]\n${textForAI}`
    : `Analyze this document and give me a clear, useful summary with the most important numbers, insights, and anything I should pay attention to.\n\n[Document content]\n${textForAI}`;

  const aiMessage = await chat({
    messages: [{ role: 'user', content: userPrompt }],
    tools: [],
    tone,
    connectedServices: [],
    systemExtra: `The user has uploaded a document. ${metaParts.join('. ')}. Extract key information, highlight important numbers, flag anything unusual. Be specific — mention exact amounts, dates, names.`,
  });

  logger.info('File analyzed', {
    file: originalname,
    type: extracted.type,
    textLength: text.length,
    truncated,
  });

  res.json({
    reply:     aiMessage.content,
    fileMeta: {
      name:      originalname,
      type:      extracted.type,
      truncated,
      ...(extracted.pageCount  && { pages:  extracted.pageCount }),
      ...(extracted.sheetNames && { sheets: extracted.sheetNames }),
    },
  });
}));

module.exports = router;
