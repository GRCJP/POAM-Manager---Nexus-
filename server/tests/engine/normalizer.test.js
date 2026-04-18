const { normalizeFinding } = require('../../src/engine/normalizer');

const RAW_QUALYS_ROW = {
  'CVE': 'CVE-2024-11691',
  'Title': 'Mozilla Firefox ESR < 128.5.0 Multiple Vulnerabilities',
  'Solution': 'Mozilla Firefox ESR is installed. Update to Firefox ESR 128.7.0 or later.',
  'QID': 'QID-AB12CD34',
  'Severity': '4',
  'Asset Name': 'WIN-SRV-001',
  'Asset IPV4': '10.1.0.1',
  'First Detected': '6/15/2025 10:00',
  'Last Detected': '1/13/2026 22:51',
  'Status': 'ACTIVE',
  'Ignored': 'No',
  'Operating System': 'Microsoft Windows 10',
  'TruRisk Score': '72',
  'RTI': 'Public Exploit',
};

const IGNORED_ROW = { ...RAW_QUALYS_ROW, 'Ignored': 'Yes' };

const MULTI_CVE_ROW = {
  ...RAW_QUALYS_ROW,
  'CVE': 'CVE-2024-11691,CVE-2024-11692,CVE-2024-11694',
};

const NO_CVE_ROW = { ...RAW_QUALYS_ROW, 'CVE': "'-" };

describe('normalizeFinding', () => {
  test('produces a 14-field normalized record', () => {
    const result = normalizeFinding(RAW_QUALYS_ROW);
    expect(Object.keys(result)).toEqual([
      'qid', 'title', 'solution', 'cves',
      'severity', 'truriskScore', 'rti',
      'assetName', 'assetIp', 'os',
      'firstDetected', 'lastDetected',
      'status', 'ignored',
    ]);
  });

  test('parses severity as integer', () => {
    const result = normalizeFinding(RAW_QUALYS_ROW);
    expect(result.severity).toBe(4);
  });

  test('parses truriskScore as integer', () => {
    const result = normalizeFinding(RAW_QUALYS_ROW);
    expect(result.truriskScore).toBe(72);
  });

  test('parses dates as Date objects', () => {
    const result = normalizeFinding(RAW_QUALYS_ROW);
    expect(result.firstDetected).toBeInstanceOf(Date);
    expect(result.lastDetected).toBeInstanceOf(Date);
    expect(result.firstDetected.getFullYear()).toBe(2025);
    expect(result.lastDetected.getFullYear()).toBe(2026);
  });

  test('ignored=Yes sets ignored to true', () => {
    const result = normalizeFinding(IGNORED_ROW);
    expect(result.ignored).toBe(true);
  });

  test('ignored=No sets ignored to false', () => {
    const result = normalizeFinding(RAW_QUALYS_ROW);
    expect(result.ignored).toBe(false);
  });

  test('parses comma-separated CVEs into array', () => {
    const result = normalizeFinding(MULTI_CVE_ROW);
    expect(result.cves).toEqual(['CVE-2024-11691', 'CVE-2024-11692', 'CVE-2024-11694']);
  });

  test('handles no CVE (dash value)', () => {
    const result = normalizeFinding(NO_CVE_ROW);
    expect(result.cves).toEqual([]);
  });
});
