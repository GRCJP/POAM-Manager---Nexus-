'use strict';

const express = require('express');
const fs = require('fs');
const readline = require('readline');
const router = express.Router();
const { runImportPipeline } = require('../engine/pipeline');

/**
 * Detect scan source by reading the first few lines of the CSV.
 * Wiz exports have headers like: WizURL, Name, CVEDescription, AssetName, Severity
 * Qualys exports have headers like: CVE, Title, QID, Severity (after ORGDATA rows)
 *
 * @param {string} filePath
 * @returns {Promise<string>} 'wiz' or 'qualys'
 */
async function detectSource(filePath) {
  const stream = fs.createReadStream(filePath, { encoding: 'utf8' });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  let linesRead = 0;
  for await (const line of rl) {
    linesRead++;
    if (line.includes('WizURL') && line.includes('AssetName')) {
      rl.close();
      stream.destroy();
      return 'wiz';
    }
    if (line.includes('QID') && line.includes('Title')) {
      rl.close();
      stream.destroy();
      return 'qualys';
    }
    // Only check first 10 lines (Qualys ORGDATA rows push header down)
    if (linesRead >= 10) break;
  }

  rl.close();
  stream.destroy();
  return 'qualys'; // default fallback
}

// POST /api/imports — accepts multipart/form-data with 'file' field
router.post('/', async (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded. Send multipart/form-data with a "file" field.' });
  }

  const store = req.app.get('store');
  const filePath = req.file.path;

  try {
    const source = await detectSource(filePath);

    const scopeId = req.query.scopeId || req.body?.scopeId || null;

    const { scanId, summary } = await runImportPipeline(filePath, store, {
      source,
      filename: req.file.originalname,
      today: new Date(),
      scopeId,
    });

    res.json({ scanId, summary });
  } catch (err) {
    next(err);
  } finally {
    // Clean up uploaded file
    fs.unlink(filePath, () => {});
  }
});

module.exports = router;
