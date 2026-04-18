'use strict';

const express = require('express');
const fs = require('fs');
const router = express.Router();
const { runImportPipeline } = require('../engine/pipeline');

// POST /api/imports — accepts multipart/form-data with 'file' field
router.post('/', async (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded. Send multipart/form-data with a "file" field.' });
  }

  const store = req.app.get('store');
  const filePath = req.file.path;

  try {
    const { scanId, summary } = await runImportPipeline(filePath, store, {
      source: 'CSV',
      filename: req.file.originalname,
      today: new Date(),
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
