'use strict';

const crypto = require('crypto');
const { parseQualysCSV } = require('../parsers/qualys-csv-parser');
const { normalizeFinding } = require('./normalizer');
const { deriveIdentityKey, generateDisplayName } = require('./identity-resolver');
const { buildAssetSnapshot, compareSnapshots, calculateProgress } = require('./asset-ledger');
const { calculatePriorityScore } = require('./priority-scorer');
const { resolveStatus, calculateDueDate } = require('./status-resolver');
const { generateDeltaSummary } = require('./delta-summary');
const { getKevSet } = require('../integrations/kev-catalog');

/**
 * Assign a NIST 800-53 control family based on the solution text.
 * @param {{ solution: string }} finding
 * @returns {string}
 */
function assignControlFamily(finding) {
  const sol = (finding.solution || '').toLowerCase();
  if (/patch|update|upgrade/.test(sol)) return 'SI';
  if (/configure|disable/.test(sol)) return 'CM';
  if (/access|permission/.test(sol)) return 'AC';
  if (/ssh|ssl|tls/.test(sol)) return 'SC';
  return 'SI';
}

/**
 * Assign a point-of-contact team based on the OS field.
 * @param {string} os
 * @returns {string}
 */
function assignPOC(os) {
  const lower = (os || '').toLowerCase();
  if (lower.includes('windows')) return 'Windows Systems Team';
  if (lower.includes('linux') || lower.includes('redhat') || lower.includes('red hat') ||
      lower.includes('centos') || lower.includes('amazon linux')) return 'Linux Systems Team';
  return 'Security Operations Team';
}

/**
 * Pick the "most severe" RTI string from a list.
 * Rank: actively exploited > known exploit > public exploit > easy exploit > anything else
 */
function bestRTI(rtiValues) {
  const rank = (rti) => {
    const l = (rti || '').toLowerCase();
    if (l.includes('actively exploited')) return 5;
    if (l.includes('known exploit')) return 4;
    if (l.includes('public exploit')) return 3;
    if (l.includes('easy exploit')) return 2;
    return 1;
  };
  let best = rtiValues[0] || '';
  let bestRank = rank(best);
  for (const rti of rtiValues) {
    const r = rank(rti);
    if (r > bestRank) { best = rti; bestRank = r; }
  }
  return best;
}

/**
 * Run the 6-step import pipeline.
 *
 * @param {string} filePath - path to Qualys CSV file
 * @param {Object} store - MemoryStore (or any store implementing the interface)
 * @param {Object} [options]
 * @param {string} [options.source] - e.g. 'qualys'
 * @param {string} [options.filename] - original filename
 * @param {Date}   [options.today] - override "now" for testing
 * @param {Function} [options.progressCallback] - (step, detail) => void
 * @returns {Promise<{summary: Object, scanId: string}>}
 */
async function runImportPipeline(filePath, store, options = {}) {
  const startTime = Date.now();
  const today = options.today || new Date();
  const source = options.source || 'qualys';
  const filename = options.filename || '';
  const progress = options.progressCallback || (() => {});

  const scanId = crypto.randomUUID
    ? crypto.randomUUID()
    : crypto.randomBytes(16).toString('hex');

  // ──────────────────────────────────────────────────────
  // Step 1: Parse & Normalize
  // ──────────────────────────────────────────────────────
  progress('parse', 'Parsing CSV file');
  const rawRows = await parseQualysCSV(filePath);
  const totalParsed = rawRows.length;

  const normalized = rawRows.map(r => normalizeFinding(r));

  // 30-day eligibility gate
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
  const cutoff = new Date(today.getTime() - thirtyDaysMs);

  const eligible = [];
  let excluded = 0;
  for (const f of normalized) {
    if (f.firstDetected > cutoff) {
      excluded++;
    } else {
      eligible.push(f);
    }
  }

  progress('parse', `Parsed ${totalParsed}, eligible ${eligible.length}, excluded ${excluded}`);

  // ──────────────────────────────────────────────────────
  // Step 2: Resolve Identities
  // ──────────────────────────────────────────────────────
  progress('identity', 'Resolving identities');
  const groups = new Map(); // identityKey → { findings[], representative }

  for (const f of eligible) {
    const key = deriveIdentityKey(f);
    if (!groups.has(key)) {
      groups.set(key, { findings: [], representative: f });
    }
    groups.get(key).findings.push(f);
  }

  // Look up existing identities
  const existingIdentities = new Map();
  for (const key of groups.keys()) {
    const existing = await store.getIdentity(key);
    if (existing) existingIdentities.set(key, existing);
  }

  // ──────────────────────────────────────────────────────
  // Step 3: Build Asset Ledger
  // ──────────────────────────────────────────────────────
  progress('ledger', 'Building asset ledger');
  const kevSet = await getKevSet();

  const identityStates = []; // for delta summary
  let newIdentities = 0;
  let updatedIdentities = 0;
  let riskAcceptedCount = 0;

  const processedKeys = new Set();

  for (const [key, group] of groups) {
    processedKeys.add(key);
    const { findings, representative } = group;

    // Build current asset snapshot
    const currentSnapshot = buildAssetSnapshot(findings);

    // Get previous ledger
    const ledger = await store.getAssetLedger(key);
    const previousSnapshot = ledger.length > 0
      ? ledger[ledger.length - 1].snapshot
      : null;

    // Compare snapshots
    const assetDiff = compareSnapshots(previousSnapshot, currentSnapshot);

    // Build history entries for progress calculation
    const historyEntries = ledger.map(e => ({
      total: e.snapshot.length,
      remediated: e.remediatedCount || 0,
      added: e.addedCount || 0,
    }));
    // Add current
    historyEntries.push({
      total: currentSnapshot.length,
      remediated: assetDiff.remediated.length,
      added: assetDiff.added.length,
    });

    const baselineTotal = ledger.length > 0
      ? ledger[0].snapshot.length
      : currentSnapshot.length;
    const progressData = calculateProgress(historyEntries, baselineTotal);

    // ──────────────────────────────────────────────────────
    // Step 4: Score & Status
    // ──────────────────────────────────────────────────────
    const maxSeverity = Math.max(...findings.map(f => f.severity));
    const maxTrurisk = Math.max(...findings.map(f => f.truriskScore));
    const allRTIs = findings.map(f => f.rti);
    const bestRti = bestRTI(allRTIs);
    const allCVEs = [...new Set(findings.flatMap(f => f.cves))];
    const earliestDetected = new Date(Math.min(...findings.map(f => f.firstDetected.getTime())));
    const detectionAgeDays = Math.floor((today - earliestDetected) / 86400000);

    const priorityScore = calculatePriorityScore({
      severity: maxSeverity,
      maxTrurisk,
      rti: bestRti,
      assetCount: currentSnapshot.length,
      firstDetectedDaysAgo: detectionAgeDays,
      cves: allCVEs,
      kevSet,
    });

    const allIgnored = findings.every(f => f.ignored);
    if (allIgnored) riskAcceptedCount++;

    // Consecutive zero scans
    let consecutiveZeroScans = 0;
    if (currentSnapshot.length === 0) {
      consecutiveZeroScans = 1;
      // Check backwards through ledger
      for (let i = ledger.length - 1; i >= 0; i--) {
        if (ledger[i].snapshot.length === 0) {
          consecutiveZeroScans++;
        } else {
          break;
        }
      }
    }

    // Scans with no movement: velocity == 0 and 2+ ledger entries
    const scansWithNoMovement = (progressData.velocity === 0 && ledger.length >= 1) ? ledger.length + 1 : 0;

    // Has new assets (not first scan)
    const hasNewAssets = assetDiff.added.length > 0 && ledger.length > 0;

    const existingIdentity = existingIdentities.get(key);

    const status = resolveStatus({
      allIgnored,
      remainingCount: currentSnapshot.length,
      consecutiveZeroScans,
      velocity: progressData.velocity,
      scansWithNoMovement,
      hasNewAssets,
      severity: maxSeverity,
      firstDetected: earliestDetected,
      today,
    });

    const controlFamily = assignControlFamily(representative);
    const poc = assignPOC(representative.os);
    const displayName = generateDisplayName(representative);

    // Build identity state for delta summary
    const identityState = {
      id: key,
      displayName,
      previousStatus: existingIdentity ? existingIdentity.status : null,
      currentStatus: status,
      previousTier: existingIdentity ? existingIdentity.priorityTier : null,
      currentTier: priorityScore.tier,
      previousAssetCount: previousSnapshot ? previousSnapshot.length : 0,
      currentAssetCount: currentSnapshot.length,
      severity: maxSeverity,
      poc,
      assetDiff,
      scansWithNoMovement,
      remainingCount: currentSnapshot.length,
      createdDate: existingIdentity ? existingIdentity.createdDate : today,
      closedDate: status === 'Closed' ? today : null,
      slaMet: status === 'Closed' ? today <= calculateDueDate(earliestDetected, maxSeverity) : null,
    };
    identityStates.push(identityState);

    // ──────────────────────────────────────────────────────
    // Step 6: Persist (per identity)
    // ──────────────────────────────────────────────────────
    // Append ledger entry
    await store.appendLedgerEntry(key, {
      scanId,
      timestamp: today.toISOString(),
      snapshot: currentSnapshot,
      remediatedCount: assetDiff.remediated.length,
      addedCount: assetDiff.added.length,
      remainingCount: assetDiff.remaining.length,
    });

    if (existingIdentity) {
      updatedIdentities++;
      await store.updateIdentity(key, {
        status,
        priorityScore,
        priorityTier: priorityScore.tier,
        controlFamily,
        poc,
        assetCount: currentSnapshot.length,
        lastScanId: scanId,
        lastScanDate: today.toISOString(),
        cves: allCVEs,
        maxSeverity,
        maxTrurisk,
        rti: bestRti,
        detectionAgeDays,
        progressData,
      });
    } else {
      newIdentities++;
      await store.saveIdentity({
        hash: key,
        displayName,
        status,
        priorityScore,
        priorityTier: priorityScore.tier,
        controlFamily,
        poc,
        assetCount: currentSnapshot.length,
        createdDate: today,
        firstScanId: scanId,
        lastScanId: scanId,
        lastScanDate: today.toISOString(),
        cves: allCVEs,
        maxSeverity,
        maxTrurisk,
        rti: bestRti,
        detectionAgeDays,
        progressData,
        earliestDetected,
      });
    }
  }

  // ──────────────────────────────────────────────────────
  // Step 5 (cont.): Handle identities in store but NOT in this scan
  // ──────────────────────────────────────────────────────
  progress('closing', 'Checking for closing identities');
  const allStored = await store.getAllIdentities();
  for (const stored of allStored) {
    if (processedKeys.has(stored.hash)) continue;
    if (stored.status === 'Closed') continue;

    const key = stored.hash;
    const ledger = await store.getAssetLedger(key);
    const previousSnapshot = ledger.length > 0
      ? ledger[ledger.length - 1].snapshot
      : null;

    // Append zero-asset ledger entry
    const emptySnapshot = [];
    const assetDiff = compareSnapshots(previousSnapshot, emptySnapshot);

    await store.appendLedgerEntry(key, {
      scanId,
      timestamp: today.toISOString(),
      snapshot: emptySnapshot,
      remediatedCount: assetDiff.remediated.length,
      addedCount: 0,
      remainingCount: 0,
    });

    // Count consecutive zero scans
    let consecutiveZeroScans = 1; // current scan is zero
    for (let i = ledger.length - 1; i >= 0; i--) {
      if (ledger[i].snapshot.length === 0) {
        consecutiveZeroScans++;
      } else {
        break;
      }
    }

    const status = resolveStatus({
      allIgnored: false,
      remainingCount: 0,
      consecutiveZeroScans,
      velocity: 0,
      scansWithNoMovement: 0,
      hasNewAssets: false,
      severity: stored.maxSeverity || 3,
      firstDetected: stored.earliestDetected || stored.createdDate || new Date(0),
      today,
    });

    updatedIdentities++;
    await store.updateIdentity(key, {
      status,
      lastScanId: scanId,
      lastScanDate: today.toISOString(),
      assetCount: 0,
    });

    identityStates.push({
      id: key,
      displayName: stored.displayName,
      previousStatus: stored.status,
      currentStatus: status,
      previousTier: stored.priorityTier,
      currentTier: stored.priorityTier || 'P4',
      previousAssetCount: previousSnapshot ? previousSnapshot.length : 0,
      currentAssetCount: 0,
      severity: stored.maxSeverity || 3,
      poc: stored.poc || 'Security Operations Team',
      assetDiff,
      scansWithNoMovement: 0,
      remainingCount: 0,
      createdDate: stored.createdDate,
      closedDate: status === 'Closed' ? today : null,
      slaMet: null,
    });
  }

  // ──────────────────────────────────────────────────────
  // Step 5: Generate Delta Summary
  // ──────────────────────────────────────────────────────
  progress('summary', 'Generating delta summary');
  const processingTimeMs = Date.now() - startTime;

  const summary = generateDeltaSummary(identityStates, {
    totalParsed,
    excluded,
    source,
    filename,
    processingTimeMs,
  });

  // ──────────────────────────────────────────────────────
  // Step 6 (cont.): Save scan record
  // ──────────────────────────────────────────────────────
  await store.saveScanRecord({
    scanId,
    timestamp: today.toISOString(),
    source,
    filename,
    totalParsed,
    excluded,
    identityCount: groups.size,
    newIdentities,
    updatedIdentities,
    riskAcceptedCount,
    processingTimeMs,
    summary,
  });

  return { summary, scanId };
}

module.exports = { runImportPipeline, assignControlFamily, assignPOC };
