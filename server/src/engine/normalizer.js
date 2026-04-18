/**
 * Normalize a raw Qualys CSV row into a 14-field finding record.
 * This is the universal record shape used by the entire engine.
 *
 * @param {Object} raw - row object from qualys-csv-parser (keyed by column name)
 * @returns {Object} normalized finding
 */
function normalizeFinding(raw) {
  return {
    qid: raw['QID'] || '',
    title: raw['Title'] || '',
    solution: raw['Solution'] || '',
    cves: parseCVEs(raw['CVE']),
    severity: parseInt(raw['Severity'], 10) || 0,
    truriskScore: parseInt(raw['TruRisk Score'], 10) || 0,
    rti: raw['RTI'] || '',
    assetName: raw['Asset Name'] || '',
    assetIp: raw['Asset IPV4'] || '',
    os: raw['Operating System'] || '',
    firstDetected: parseQualysDate(raw['First Detected']),
    lastDetected: parseQualysDate(raw['Last Detected']),
    status: raw['Status'] || '',
    ignored: (raw['Ignored'] || '').toLowerCase() === 'yes',
  };
}

/**
 * Parse Qualys date format: "1/13/2026 22:51"
 * @param {string} dateStr
 * @returns {Date}
 */
function parseQualysDate(dateStr) {
  if (!dateStr || dateStr === "'-" || dateStr === '-') return new Date(0);
  const [datePart, timePart] = dateStr.split(' ');
  const [month, day, year] = datePart.split('/').map(Number);
  if (timePart) {
    const [hours, minutes] = timePart.split(':').map(Number);
    return new Date(year, month - 1, day, hours, minutes);
  }
  return new Date(year, month - 1, day);
}

/**
 * Parse CVE field which may be comma-separated, empty, or "'-"
 * @param {string} cveStr
 * @returns {string[]}
 */
function parseCVEs(cveStr) {
  if (!cveStr || cveStr === "'-" || cveStr === '-') return [];
  return cveStr.split(',').map(c => c.trim()).filter(c => c.startsWith('CVE-'));
}

module.exports = { normalizeFinding, parseQualysDate, parseCVEs };
