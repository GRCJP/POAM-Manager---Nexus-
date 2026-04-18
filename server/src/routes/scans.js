'use strict';

const express = require('express');
const router = express.Router();

// GET /api/scans — list all scan records, most recent first
router.get('/', async (req, res, next) => {
  try {
    const store = req.app.get('store');
    const scans = await store.getAllScanRecords();

    // Sort most recent first by timestamp
    scans.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    res.json({ scans, total: scans.length });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
