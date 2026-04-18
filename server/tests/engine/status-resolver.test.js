const { resolveStatus, SLA_DAYS, calculateDueDate } = require('../../src/engine/status-resolver');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const BASE_DATE = new Date('2026-01-01');

/** Build a params object with sensible defaults; override with `overrides`. */
function makeParams(overrides = {}) {
  return {
    allIgnored: false,
    remainingCount: 5,
    consecutiveZeroScans: 0,
    velocity: 0,
    scansWithNoMovement: 0,
    hasNewAssets: false,
    severity: 3,
    firstDetected: BASE_DATE,
    today: new Date('2026-02-01'), // 31 days later — within 90-day SLA for sev 3
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// SLA_DAYS values
// ---------------------------------------------------------------------------
describe('SLA_DAYS', () => {
  it('maps critical (5) to 30 days', () => {
    expect(SLA_DAYS[5]).toBe(30);
  });

  it('maps high (4) to 60 days', () => {
    expect(SLA_DAYS[4]).toBe(60);
  });

  it('maps medium (3) to 90 days', () => {
    expect(SLA_DAYS[3]).toBe(90);
  });

  it('maps low (2) to 180 days', () => {
    expect(SLA_DAYS[2]).toBe(180);
  });

  it('maps informational (1) to 180 days', () => {
    expect(SLA_DAYS[1]).toBe(180);
  });
});

// ---------------------------------------------------------------------------
// calculateDueDate
// ---------------------------------------------------------------------------
describe('calculateDueDate', () => {
  it('adds the correct number of days for severity 5', () => {
    const due = calculateDueDate(new Date('2026-01-01'), 5);
    expect(due.toISOString().slice(0, 10)).toBe('2026-01-31');
  });

  it('adds the correct number of days for severity 3', () => {
    const due = calculateDueDate(new Date('2026-01-01'), 3);
    expect(due.toISOString().slice(0, 10)).toBe('2026-03-31');
  });

  it('throws for unknown severity', () => {
    expect(() => calculateDueDate(new Date(), 9)).toThrow('Unknown severity');
  });
});

// ---------------------------------------------------------------------------
// resolveStatus
// ---------------------------------------------------------------------------
describe('resolveStatus', () => {
  // 1. Risk Accepted
  it('returns "Risk Accepted" when allIgnored is true', () => {
    const result = resolveStatus(makeParams({ allIgnored: true }));
    expect(result).toBe('Risk Accepted');
  });

  // 2. Closed
  it('returns "Closed" when remainingCount is 0 for 2+ consecutive scans', () => {
    const result = resolveStatus(makeParams({
      remainingCount: 0,
      consecutiveZeroScans: 2,
    }));
    expect(result).toBe('Closed');
  });

  it('returns "Open" (not "Closed") when remainingCount is 0 for only 1 scan', () => {
    const result = resolveStatus(makeParams({
      remainingCount: 0,
      consecutiveZeroScans: 1,
    }));
    expect(result).toBe('Open');
  });

  // 3. Regressing
  it('returns "Regressing" when new assets appear while remaining > 0', () => {
    const result = resolveStatus(makeParams({ hasNewAssets: true }));
    expect(result).toBe('Regressing');
  });

  // 4. Overdue
  it('returns "Overdue" when past SLA deadline', () => {
    const result = resolveStatus(makeParams({
      severity: 5,
      firstDetected: new Date('2026-01-01'),
      today: new Date('2026-03-01'), // 59 days — well past 30-day SLA
    }));
    expect(result).toBe('Overdue');
  });

  // 5. Delayed
  it('returns "Delayed" when no movement for 2+ scans', () => {
    const result = resolveStatus(makeParams({ scansWithNoMovement: 2 }));
    expect(result).toBe('Delayed');
  });

  // 6. Default — Open
  it('returns "Open" with positive velocity within SLA', () => {
    const result = resolveStatus(makeParams({ velocity: 3 }));
    expect(result).toBe('Open');
  });

  // ---------------------------------------------------------------------------
  // Priority ordering
  // ---------------------------------------------------------------------------
  it('Risk Accepted takes priority over Closed', () => {
    const result = resolveStatus(makeParams({
      allIgnored: true,
      remainingCount: 0,
      consecutiveZeroScans: 3,
    }));
    expect(result).toBe('Risk Accepted');
  });

  it('Regressing takes priority over Overdue', () => {
    const result = resolveStatus(makeParams({
      hasNewAssets: true,
      severity: 5,
      firstDetected: new Date('2025-01-01'),
      today: new Date('2026-03-01'),
    }));
    expect(result).toBe('Regressing');
  });

  it('Overdue takes priority over Delayed', () => {
    const result = resolveStatus(makeParams({
      severity: 5,
      firstDetected: new Date('2026-01-01'),
      today: new Date('2026-03-01'),
      scansWithNoMovement: 5,
    }));
    expect(result).toBe('Overdue');
  });
});
