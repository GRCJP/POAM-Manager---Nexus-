const { calculatePriorityScore, getPriorityTier, calculateExploitabilityScore } = require('../../src/engine/priority-scorer');

describe('calculateExploitabilityScore', () => {
  test('KEV or Actively Exploited = 100', () => {
    expect(calculateExploitabilityScore('Known Exploit,Actively Exploited', [])).toBe(100);
  });

  test('Public Exploit = 80', () => {
    expect(calculateExploitabilityScore('Public Exploit', [])).toBe(80);
  });

  test('Easy Exploit = 60', () => {
    expect(calculateExploitabilityScore('Easy Exploit', [])).toBe(60);
  });

  test('no exploit info = 10', () => {
    expect(calculateExploitabilityScore('', [])).toBe(10);
  });

  test('CVE on KEV list overrides RTI to 100', () => {
    const kevList = new Set(['CVE-2024-12345']);
    expect(calculateExploitabilityScore('', ['CVE-2024-12345'], kevList)).toBe(100);
  });
});

describe('calculatePriorityScore', () => {
  test('critical KEV finding with many assets scores P1', () => {
    const score = calculatePriorityScore({
      severity: 5,
      maxTrurisk: 98,
      rti: 'Known Exploit,Easy Exploit,Public Exploit',
      assetCount: 30,
      firstDetectedDaysAgo: 200,
      cves: [],
    });
    expect(score.total).toBeGreaterThanOrEqual(80);
    expect(score.tier).toBe('P1');
  });

  test('low severity no exploit scores P4', () => {
    const score = calculatePriorityScore({
      severity: 2,
      maxTrurisk: 20,
      rti: '',
      assetCount: 1,
      firstDetectedDaysAgo: 10,
      cves: [],
    });
    expect(score.total).toBeLessThan(40);
    expect(score.tier).toBe('P4');
  });

  test('returns factor breakdown', () => {
    const score = calculatePriorityScore({
      severity: 4,
      maxTrurisk: 72,
      rti: 'Public Exploit',
      assetCount: 15,
      firstDetectedDaysAgo: 90,
      cves: [],
    });
    expect(score).toHaveProperty('factors');
    expect(score.factors).toHaveProperty('exploitability');
    expect(score.factors).toHaveProperty('severity');
    expect(score.factors).toHaveProperty('trurisk');
    expect(score.factors).toHaveProperty('assetCount');
    expect(score.factors).toHaveProperty('detectionAge');
  });

  test('medium severity old finding can escalate to P2 via age', () => {
    const score = calculatePriorityScore({
      severity: 3,
      maxTrurisk: 50,
      rti: 'Easy Exploit',
      assetCount: 50,
      firstDetectedDaysAgo: 400,
      cves: [],
    });
    expect(score.total).toBeGreaterThanOrEqual(60);
    expect(score.tier).toBe('P2');
  });
});

describe('getPriorityTier', () => {
  test('80-100 = P1', () => expect(getPriorityTier(85)).toBe('P1'));
  test('60-79 = P2', () => expect(getPriorityTier(65)).toBe('P2'));
  test('40-59 = P3', () => expect(getPriorityTier(45)).toBe('P3'));
  test('0-39 = P4', () => expect(getPriorityTier(20)).toBe('P4'));
});
