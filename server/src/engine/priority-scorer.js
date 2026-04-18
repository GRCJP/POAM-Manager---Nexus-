const WEIGHTS = {
  exploitability: 0.30,
  severity: 0.20,
  trurisk: 0.20,
  assetCount: 0.15,
  detectionAge: 0.15,
};

/**
 * Calculate exploitability score (0-100) from RTI field and KEV catalog.
 *
 * @param {string} rti - RTI field value from Qualys
 * @param {string[]} cves - CVE list for this finding group
 * @param {Set<string>} [kevSet] - optional Set of CVE IDs on the CISA KEV list
 * @returns {number} 0-100
 */
function calculateExploitabilityScore(rti, cves, kevSet) {
  const rtiLower = (rti || '').toLowerCase();

  // Check KEV catalog first (overrides everything)
  if (kevSet && cves.some(cve => kevSet.has(cve))) {
    return 100;
  }

  if (rtiLower.includes('actively exploited') || rtiLower.includes('known exploit')) {
    return 100;
  }
  if (rtiLower.includes('public exploit')) {
    return 80;
  }
  if (rtiLower.includes('easy exploit')) {
    return 60;
  }
  return 10;
}

/**
 * Scale a value along a curve to 0-100.
 * @param {number} value
 * @param {Array<[number, number]>} breakpoints - [[input, output], ...] sorted ascending
 * @returns {number}
 */
function scaleValue(value, breakpoints) {
  if (value <= breakpoints[0][0]) return breakpoints[0][1];
  if (value >= breakpoints[breakpoints.length - 1][0]) return breakpoints[breakpoints.length - 1][1];

  for (let i = 0; i < breakpoints.length - 1; i++) {
    const [x0, y0] = breakpoints[i];
    const [x1, y1] = breakpoints[i + 1];
    if (value >= x0 && value <= x1) {
      const ratio = (value - x0) / (x1 - x0);
      return Math.round(y0 + ratio * (y1 - y0));
    }
  }
  return breakpoints[breakpoints.length - 1][1];
}

/**
 * Get priority tier string from a composite score.
 * @param {number} score - 0-100
 * @returns {string} P1, P2, P3, or P4
 */
function getPriorityTier(score) {
  if (score >= 80) return 'P1';
  if (score >= 60) return 'P2';
  if (score >= 40) return 'P3';
  return 'P4';
}

/**
 * Calculate composite priority score for a POAM identity group.
 *
 * @param {Object} params
 * @param {number} params.severity - 1-5
 * @param {number} params.maxTrurisk - highest TruRisk across findings in group
 * @param {string} params.rti - RTI field (from highest-risk finding)
 * @param {number} params.assetCount - unique affected assets
 * @param {number} params.firstDetectedDaysAgo - days since earliest first_detected
 * @param {string[]} params.cves - all CVEs in this group
 * @param {Set<string>} [params.kevSet] - optional KEV catalog set
 * @returns {{ total: number, tier: string, factors: Object }}
 */
function calculatePriorityScore(params) {
  const {
    severity, maxTrurisk, rti, assetCount,
    firstDetectedDaysAgo, cves, kevSet,
  } = params;

  const factors = {
    exploitability: calculateExploitabilityScore(rti, cves, kevSet),
    severity: { 5: 100, 4: 80, 3: 60, 2: 40, 1: 20 }[severity] || 20,
    trurisk: Math.min(maxTrurisk, 100),
    assetCount: scaleValue(assetCount, [[1, 10], [10, 40], [50, 70], [100, 100]]),
    detectionAge: scaleValue(firstDetectedDaysAgo, [[30, 20], [90, 50], [180, 80], [365, 100]]),
  };

  const total = Math.round(
    factors.exploitability * WEIGHTS.exploitability +
    factors.severity * WEIGHTS.severity +
    factors.trurisk * WEIGHTS.trurisk +
    factors.assetCount * WEIGHTS.assetCount +
    factors.detectionAge * WEIGHTS.detectionAge
  );

  return {
    total,
    tier: getPriorityTier(total),
    factors,
  };
}

module.exports = { calculatePriorityScore, getPriorityTier, calculateExploitabilityScore };
