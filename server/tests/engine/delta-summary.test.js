const { generateDeltaSummary } = require('../../src/engine/delta-summary');

describe('generateDeltaSummary', () => {
  test('counts new identities', () => {
    const identities = [
      { id: 'a', previousStatus: null, currentStatus: 'Open', displayName: 'Firefox ESR', assetDiff: { added: [], remediated: [], remaining: [] } },
      { id: 'b', previousStatus: null, currentStatus: 'Open', displayName: 'Apache', assetDiff: { added: [], remediated: [], remaining: [] } },
    ];
    const summary = generateDeltaSummary(identities, { totalParsed: 500, excluded: 50 });
    expect(summary.newPoams).toHaveLength(2);
  });

  test('counts closed identities', () => {
    const identities = [
      { id: 'a', previousStatus: 'Open', currentStatus: 'Closed', displayName: 'Firefox ESR', createdDate: new Date('2025-06-01'), closedDate: new Date('2026-02-10'), severity: 4, assetDiff: { added: [], remediated: [1,2], remaining: [] } },
    ];
    const summary = generateDeltaSummary(identities, { totalParsed: 500, excluded: 50 });
    expect(summary.closedPoams).toHaveLength(1);
    expect(summary.closedPoams[0].daysOpen).toBeGreaterThan(200);
  });

  test('counts regressing identities', () => {
    const identities = [
      { id: 'a', previousStatus: 'Open', currentStatus: 'Regressing', displayName: 'OpenSSH', assetDiff: { added: [{assetName:'NEW-1'}], remediated: [], remaining: [{},{},{}] }, previousAssetCount: 3, currentAssetCount: 4 },
    ];
    const summary = generateDeltaSummary(identities, { totalParsed: 500, excluded: 50 });
    expect(summary.regressingPoams).toHaveLength(1);
  });

  test('counts delayed identities', () => {
    const identities = [
      { id: 'a', previousStatus: 'Open', currentStatus: 'Delayed', displayName: 'TLS Config', scansWithNoMovement: 3, remainingCount: 10, assetDiff: { added: [], remediated: [], remaining: Array(10) } },
    ];
    const summary = generateDeltaSummary(identities, { totalParsed: 500, excluded: 50 });
    expect(summary.delayedPoams).toHaveLength(1);
  });

  test('includes scan metadata', () => {
    const summary = generateDeltaSummary([], { totalParsed: 500, excluded: 50, source: 'CSV', filename: 'scan.csv' });
    expect(summary.metadata.totalParsed).toBe(500);
    expect(summary.metadata.excluded).toBe(50);
    expect(summary.metadata.source).toBe('CSV');
  });

  test('counts priority tier changes', () => {
    const identities = [
      { id: 'a', previousTier: 'P3', currentTier: 'P2', previousStatus: 'Open', currentStatus: 'Open', displayName: 'Java', assetDiff: { added: [], remediated: [], remaining: [] } },
    ];
    const summary = generateDeltaSummary(identities, { totalParsed: 100, excluded: 0 });
    expect(summary.priorityChanges).toHaveLength(1);
    expect(summary.priorityChanges[0]).toEqual({ id: 'a', displayName: 'Java', from: 'P3', to: 'P2' });
  });
});
