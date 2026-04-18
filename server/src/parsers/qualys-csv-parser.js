'use strict';

const fs = require('fs');
const { parse } = require('csv-parse');

/**
 * Parse a Qualys CSV export file into an array of row objects.
 *
 * Qualys CSV format:
 *   Rows 1-3: ORGDATA metadata rows (comma-separated ORGDATA-XXXX values)
 *   Row 4:    Header row (contains CVE, Title, QID, Severity, etc.)
 *   Row 5+:   Data rows
 *
 * @param {string} filePath - Absolute path to the Qualys CSV file
 * @returns {Promise<Object[]>} Array of objects keyed by the header row values
 */
function parseQualysCSV(filePath) {
  return new Promise((resolve, reject) => {
    const rows = [];
    let header = null;

    const parser = parse({
      relax_quotes: true,
      relax_column_count: true,
      skip_empty_lines: true,
      trim: true,
    });

    const stream = fs.createReadStream(filePath);

    stream.on('error', (err) => reject(err));

    parser.on('error', (err) => reject(err));

    parser.on('readable', () => {
      let record;
      while ((record = parser.read()) !== null) {
        // Skip ORGDATA rows — first field starts with "ORGDATA"
        if (record[0] && record[0].startsWith('ORGDATA')) {
          continue;
        }

        // Detect header row: contains CVE, Title, QID, Severity
        if (
          !header &&
          record.includes('CVE') &&
          record.includes('Title') &&
          record.includes('QID') &&
          record.includes('Severity')
        ) {
          // Filter out empty trailing header fields
          header = record.map((v) => v.trim());
          continue;
        }

        // Skip rows before header is found
        if (!header) {
          continue;
        }

        // Skip rows with too few fields
        if (record.length < header.length - 5) {
          continue;
        }

        // Build object from header keys
        const obj = {};
        for (let i = 0; i < header.length; i++) {
          const key = header[i];
          if (key === '') continue; // skip empty header columns
          obj[key] = (record[i] || '').trim();
        }

        // Skip any data row that still looks like ORGDATA
        if (obj.CVE && obj.CVE.startsWith('ORGDATA')) {
          continue;
        }

        rows.push(obj);
      }
    });

    parser.on('end', () => resolve(rows));

    stream.pipe(parser);
  });
}

module.exports = { parseQualysCSV };
