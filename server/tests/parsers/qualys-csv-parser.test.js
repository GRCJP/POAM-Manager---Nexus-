'use strict';

const path = require('path');
const { parseQualysCSV } = require('../../src/parsers/qualys-csv-parser');

const FIXTURE_PATH = path.join(__dirname, '..', 'fixtures', 'scan-a.csv');

describe('parseQualysCSV', () => {
  let rows;

  beforeAll(async () => {
    rows = await parseQualysCSV(FIXTURE_PATH);
  });

  test('skips ORGDATA rows and finds header on row 4', () => {
    // No row should have ORGDATA values anywhere
    for (const row of rows) {
      expect(row.CVE).not.toMatch(/^ORGDATA/);
    }
  });

  test('parses 900+ data rows from scan-a.csv', () => {
    expect(rows.length).toBeGreaterThan(900);
  });

  test('every row has expected fields', () => {
    const expectedFields = [
      'CVE',
      'Title',
      'Solution',
      'QID',
      'Severity',
      'Asset Name',
      'Asset IPV4',
      'First Detected',
      'Last Detected',
      'Ignored',
      'Operating System',
      'TruRisk Score',
      'RTI',
      'Status',
    ];

    for (const row of rows) {
      for (const field of expectedFields) {
        expect(row).toHaveProperty(field);
      }
    }
  });

  test('no row has ORGDATA values in the Title field', () => {
    for (const row of rows) {
      expect(row.Title).not.toMatch(/ORGDATA/);
    }
  });

  test('severity values are between 1 and 5', () => {
    for (const row of rows) {
      const sev = Number(row.Severity);
      expect(sev).toBeGreaterThanOrEqual(1);
      expect(sev).toBeLessThanOrEqual(5);
    }
  });
});
