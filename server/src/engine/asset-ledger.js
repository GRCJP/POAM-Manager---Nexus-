/**
 * Asset Ledger — per-identity asset tracking across scans.
 *
 * Tracks which assets are affected by a given remediation identity,
 * compares snapshots between scans, and calculates remediation progress.
 */

/**
 * Build a deduplicated asset snapshot from an array of normalized findings.
 * Deduplicates by "assetName|assetIp" key, keeping the first occurrence.
 *
 * @param {Object[]} findings - normalized finding records (from normalizer)
 * @returns {Object[]} array of { assetName, assetIp, os, truriskScore }
 */
function buildAssetSnapshot(findings) {
  const seen = new Map();
  for (const f of findings) {
    const key = `${f.assetName}|${f.assetIp}`;
    if (!seen.has(key)) {
      seen.set(key, {
        assetName: f.assetName,
        assetIp: f.assetIp,
        os: f.os,
        truriskScore: f.truriskScore,
      });
    }
  }
  return Array.from(seen.values());
}

/**
 * Compare two asset snapshots to identify remediated, added, and remaining assets.
 *
 * @param {Object[]|null} previous - snapshot from prior scan (null for first scan)
 * @param {Object[]} current - snapshot from current scan
 * @returns {{ remediated: Object[], added: Object[], remaining: Object[] }}
 */
function compareSnapshots(previous, current) {
  if (previous === null) {
    return {
      remediated: [],
      added: [...current],
      remaining: [],
    };
  }

  const prevKeys = new Map();
  for (const asset of previous) {
    prevKeys.set(`${asset.assetName}|${asset.assetIp}`, asset);
  }

  const currKeys = new Map();
  for (const asset of current) {
    currKeys.set(`${asset.assetName}|${asset.assetIp}`, asset);
  }

  const remediated = [];
  const remaining = [];
  const added = [];

  for (const [key, asset] of prevKeys) {
    if (currKeys.has(key)) {
      remaining.push(currKeys.get(key));
    } else {
      remediated.push(asset);
    }
  }

  for (const [key, asset] of currKeys) {
    if (!prevKeys.has(key)) {
      added.push(asset);
    }
  }

  return { remediated, added, remaining };
}

/**
 * Calculate remediation progress from scan history entries.
 *
 * @param {Object[]} history - array of { total, remediated, added? } per scan
 * @param {number} baselineTotal - total assets from baseline (first) scan
 * @returns {{ cumulativeRemediated: number, remediationPercent: number, velocity: number, regressing: boolean }}
 */
function calculateProgress(history, baselineTotal) {
  let cumulativeRemediated = 0;
  const nonZeroRemediated = [];

  for (const entry of history) {
    cumulativeRemediated += entry.remediated;
    if (entry.remediated > 0) {
      nonZeroRemediated.push(entry.remediated);
    }
  }

  const remediationPercent = baselineTotal > 0
    ? Math.round((cumulativeRemediated / baselineTotal) * 100)
    : 0;

  const velocity = nonZeroRemediated.length > 0
    ? nonZeroRemediated.reduce((a, b) => a + b, 0) / nonZeroRemediated.length
    : 0;

  const latest = history[history.length - 1];
  const regressing = latest
    ? (latest.added || 0) > 0 && latest.remediated === 0
    : false;

  return { cumulativeRemediated, remediationPercent, velocity, regressing };
}

module.exports = { buildAssetSnapshot, compareSnapshots, calculateProgress };
