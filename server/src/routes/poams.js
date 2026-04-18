'use strict';

const express = require('express');
const router = express.Router();

// GET /api/poams — list all identities with optional filters
router.get('/', async (req, res, next) => {
  try {
    const store = req.app.get('store');
    const { status, tier, severity } = req.query;

    let identities = await store.getAllIdentities();

    // Apply optional filters
    if (status) {
      identities = identities.filter(id => id.status === status);
    }
    if (tier) {
      identities = identities.filter(id => id.priorityTier === tier);
    }
    if (severity) {
      identities = identities.filter(id => String(id.maxSeverity) === String(severity));
    }

    // Sort by priority score descending
    identities.sort((a, b) => {
      const scoreA = (a.priorityScore && a.priorityScore.total) || 0;
      const scoreB = (b.priorityScore && b.priorityScore.total) || 0;
      return scoreB - scoreA;
    });

    res.json({ identities, total: identities.length });
  } catch (err) {
    next(err);
  }
});

// GET /api/poams/:hash — get single identity with asset ledger history
router.get('/:hash', async (req, res, next) => {
  try {
    const store = req.app.get('store');
    const { hash } = req.params;

    const identity = await store.getIdentity(hash);
    if (!identity) {
      return res.status(404).json({ error: 'Identity not found' });
    }

    const ledger = await store.getAssetLedger(hash);

    res.json({ identity, ledger });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
