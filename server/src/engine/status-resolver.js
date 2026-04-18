/**
 * Status Resolver — determines the remediation status of a POAM item
 * based on scan history, SLA deadlines, and asset movement.
 *
 * Exports: resolveStatus, SLA_DAYS, calculateDueDate
 */

/** SLA windows in days, keyed by Qualys severity (1–5). */
const SLA_DAYS = {
  5: 30,   // critical
  4: 60,   // high
  3: 90,   // medium
  2: 180,  // low
  1: 180,  // informational
};

/**
 * Calculate the SLA due date for a finding.
 *
 * @param {Date} firstDetected - date the finding was first seen
 * @param {number} severity    - Qualys severity (1–5)
 * @returns {Date} due date (firstDetected + SLA_DAYS[severity])
 */
function calculateDueDate(firstDetected, severity) {
  const days = SLA_DAYS[severity];
  if (days === undefined) {
    throw new Error(`Unknown severity: ${severity}`);
  }
  const due = new Date(firstDetected);
  due.setDate(due.getDate() + days);
  return due;
}

/**
 * Resolve the current remediation status of a finding/POAM item.
 *
 * Priority order:
 *   1. allIgnored                                        → "Risk Accepted"
 *   2. remainingCount === 0 && consecutiveZeroScans >= 2 → "Closed"
 *   3. hasNewAssets && remainingCount > 0                → "Regressing"
 *   4. remainingCount > 0 && today > dueDate             → "Overdue"
 *   5. remainingCount > 0 && scansWithNoMovement >= 2    → "Delayed"
 *   6. default                                           → "Open"
 *
 * @param {Object} params
 * @param {boolean} params.allIgnored           - every instance is risk-accepted / ignored
 * @param {number}  params.remainingCount       - active (non-remediated) instances
 * @param {number}  params.consecutiveZeroScans - consecutive scans with 0 remaining
 * @param {number}  params.velocity             - remediation velocity (unused in branching but available)
 * @param {number}  params.scansWithNoMovement  - consecutive scans where count didn't change
 * @param {boolean} params.hasNewAssets          - new assets appeared with this finding
 * @param {number}  params.severity             - Qualys severity (1–5)
 * @param {Date}    params.firstDetected        - date first detected
 * @param {Date}    params.today                - current date for evaluation
 * @returns {string} one of: "Risk Accepted", "Closed", "Regressing", "Overdue", "Delayed", "Open"
 */
function resolveStatus(params) {
  const {
    allIgnored,
    remainingCount,
    consecutiveZeroScans,
    scansWithNoMovement,
    hasNewAssets,
    severity,
    firstDetected,
    today,
  } = params;

  // 1. Risk Accepted
  if (allIgnored) {
    return 'Risk Accepted';
  }

  // 2. Closed — confirmed by two consecutive zero-count scans
  if (remainingCount === 0 && consecutiveZeroScans >= 2) {
    return 'Closed';
  }

  // 3. Regressing — new assets appeared while still open
  if (hasNewAssets && remainingCount > 0) {
    return 'Regressing';
  }

  // 4. Overdue — past SLA deadline
  const dueDate = calculateDueDate(firstDetected, severity);
  if (remainingCount > 0 && today > dueDate) {
    return 'Overdue';
  }

  // 5. Delayed — no remediation progress for 2+ scans
  if (remainingCount > 0 && scansWithNoMovement >= 2) {
    return 'Delayed';
  }

  // 6. Default
  return 'Open';
}

module.exports = { resolveStatus, SLA_DAYS, calculateDueDate };
