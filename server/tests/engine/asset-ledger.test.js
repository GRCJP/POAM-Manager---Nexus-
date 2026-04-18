const { buildAssetSnapshot, compareSnapshots, calculateProgress } = require('../../src/engine/asset-ledger');

describe('buildAssetSnapshot', () => {
  it('deduplicates assets by name+ip', () => {
    const findings = [
      { assetName: 'SRV-001', assetIp: '10.0.0.1', os: 'Linux', truriskScore: 80 },
      { assetName: 'SRV-001', assetIp: '10.0.0.1', os: 'Linux', truriskScore: 90 },
      { assetName: 'SRV-002', assetIp: '10.0.0.2', os: 'Linux', truriskScore: 70 },
    ];
    const snapshot = buildAssetSnapshot(findings);
    expect(snapshot).toHaveLength(2);
    // keeps the first occurrence
    expect(snapshot[0].truriskScore).toBe(80);
  });

  it('treats different IPs as different assets even with same name', () => {
    const findings = [
      { assetName: 'SRV-001', assetIp: '10.0.0.1', os: 'Linux', truriskScore: 80 },
      { assetName: 'SRV-001', assetIp: '10.0.0.2', os: 'Linux', truriskScore: 70 },
    ];
    const snapshot = buildAssetSnapshot(findings);
    expect(snapshot).toHaveLength(2);
    expect(snapshot[0].assetIp).toBe('10.0.0.1');
    expect(snapshot[1].assetIp).toBe('10.0.0.2');
  });

  it('returns empty array for empty input', () => {
    expect(buildAssetSnapshot([])).toEqual([]);
  });
});

describe('compareSnapshots', () => {
  const assetA = { assetName: 'SRV-001', assetIp: '10.0.0.1', os: 'Linux', truriskScore: 80 };
  const assetB = { assetName: 'SRV-002', assetIp: '10.0.0.2', os: 'Linux', truriskScore: 70 };
  const assetC = { assetName: 'SRV-003', assetIp: '10.0.0.3', os: 'Windows', truriskScore: 90 };

  it('first scan (null previous): all assets are added', () => {
    const result = compareSnapshots(null, [assetA, assetB]);
    expect(result.added).toHaveLength(2);
    expect(result.remediated).toHaveLength(0);
    expect(result.remaining).toHaveLength(0);
  });

  it('identifies remediated assets (in previous but not current)', () => {
    const result = compareSnapshots([assetA, assetB], [assetB]);
    expect(result.remediated).toHaveLength(1);
    expect(result.remediated[0].assetName).toBe('SRV-001');
  });

  it('identifies new assets (in current but not previous)', () => {
    const result = compareSnapshots([assetA], [assetA, assetC]);
    expect(result.added).toHaveLength(1);
    expect(result.added[0].assetName).toBe('SRV-003');
  });

  it('identifies remaining assets (in both)', () => {
    const result = compareSnapshots([assetA, assetB], [assetA, assetB, assetC]);
    expect(result.remaining).toHaveLength(2);
    expect(result.added).toHaveLength(1);
    expect(result.remediated).toHaveLength(0);
  });

  it('all remediated when current is empty', () => {
    const result = compareSnapshots([assetA, assetB], []);
    expect(result.remediated).toHaveLength(2);
    expect(result.added).toHaveLength(0);
    expect(result.remaining).toHaveLength(0);
  });
});

describe('calculateProgress', () => {
  it('computes cumulative remediation percentage', () => {
    const history = [
      { total: 100, remediated: 10 },
      { total: 95, remediated: 5 },
    ];
    const result = calculateProgress(history, 100);
    expect(result.cumulativeRemediated).toBe(15);
    expect(result.remediationPercent).toBe(15);
  });

  it('rounds remediation percentage', () => {
    const history = [
      { total: 100, remediated: 7 },
    ];
    const result = calculateProgress(history, 30);
    // 7/30 = 23.333... → 23
    expect(result.remediationPercent).toBe(23);
  });

  it('calculates velocity as average of non-zero remediated counts', () => {
    const history = [
      { total: 100, remediated: 10 },
      { total: 90, remediated: 0 },
      { total: 85, remediated: 5 },
    ];
    const result = calculateProgress(history, 100);
    // average of [10, 5] = 7.5
    expect(result.velocity).toBe(7.5);
  });

  it('velocity is 0 when no remediation has occurred', () => {
    const history = [
      { total: 100, remediated: 0 },
    ];
    const result = calculateProgress(history, 100);
    expect(result.velocity).toBe(0);
  });

  it('detects regression when latest entry has added > 0 and remediated === 0', () => {
    const history = [
      { total: 100, remediated: 10 },
      { total: 95, remediated: 0, added: 5 },
    ];
    const result = calculateProgress(history, 100);
    expect(result.regressing).toBe(true);
  });

  it('not regressing when latest has both added and remediated', () => {
    const history = [
      { total: 100, remediated: 5, added: 3 },
    ];
    const result = calculateProgress(history, 100);
    expect(result.regressing).toBe(false);
  });

  it('not regressing when latest has no added', () => {
    const history = [
      { total: 100, remediated: 0 },
    ];
    const result = calculateProgress(history, 100);
    expect(result.regressing).toBe(false);
  });

  it('handles zero baselineTotal without division error', () => {
    const history = [{ total: 0, remediated: 0 }];
    const result = calculateProgress(history, 0);
    expect(result.remediationPercent).toBe(0);
  });
});
