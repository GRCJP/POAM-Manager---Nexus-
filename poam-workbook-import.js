async function poamWorkbookImportXlsx(file, systemId) {
  if (!file) throw new Error('No file provided');
  if (!systemId) throw new Error('No system selected');

  if (typeof XLSX === 'undefined') {
    throw new Error('XLSX library not loaded');
  }

  if (!window.poamWorkbookDB) {
    throw new Error('Workbook DB not available');
  }

  const wb = await file.arrayBuffer().then(buf => XLSX.read(buf, { type: 'array', cellDates: true }));
  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw new Error('Workbook has no sheets');

  const ws = wb.Sheets[sheetName];

  // Read as matrix so we can normalize headers rather than requiring exact matches.
  const matrix = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false });
  if (!Array.isArray(matrix) || matrix.length < 2) {
    throw new Error('No rows found in workbook');
  }

  const headerRow = matrix[0].map(v => String(v || ''));
  const dataRows = matrix.slice(1);

  const normalizeHeader = (h) => String(h || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n/g, ' ')
    .replace(/"/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^a-z0-9 /]/g, '')
    .replace(/\s*\/\s*/g, '/');

  const headerAliases = new Map([
    ['poam id', 'Item number'],
    ['poam number', 'Item number'],
    ['id', 'Item number'],
    ['item', 'Item number'],
    ['item number', 'Item number'],
    ['item #', 'Item number'],
    ['item no', 'Item number'],
    ['poam', 'Item number'],
    ['affected components urls', 'Affected Components/URLs'],
    ['affected components/urls', 'Affected Components/URLs'],
    ['affected components urls ', 'Affected Components/URLs'],
    ['affected components', 'Affected Components/URLs'],
    ['urls', 'Affected Components/URLs'],
    ['identifying detecting source', 'Identifying Detecting Source'],
    ['identifying/detecting source', 'Identifying Detecting Source'],
    ['detecting source', 'Identifying Detecting Source'],
    ['vulnerability', 'Vulnerability Name'],
    ['vulnerability name', 'Vulnerability Name'],
    ['vulnerability description', 'Vulnerability Description'],
    ['description', 'Vulnerability Description'],
    ['poc', 'POC Name'],
    ['poc name', 'POC Name'],
    ['office', 'Office/Org'],
    ['org', 'Office/Org'],
    ['office/org', 'Office/Org'],
    ['severity', 'Severity Value'],
    ['severity value', 'Severity Value'],
    ['scheduled completion', 'Scheduled Completion Date'],
    ['scheduled completion date', 'Scheduled Completion Date'],
    ['completion date', 'Scheduled Completion Date'],
    ['detection date', 'Detection Date']
  ]);

  const requiredHeaders = window.POAM_WORKBOOK_COLUMNS || [];
  const canonicalByNorm = new Map(requiredHeaders.map(h => [normalizeHeader(h), h]));
  for (const [k, v] of headerAliases.entries()) {
    canonicalByNorm.set(normalizeHeader(k), v);
  }
  const headerIndexToCanonical = new Map();

  for (let i = 0; i < headerRow.length; i++) {
    const norm = normalizeHeader(headerRow[i]);
    const canonical = canonicalByNorm.get(norm);
    if (canonical) {
      headerIndexToCanonical.set(i, canonical);
    }
  }

  // Do not require exact headers; proceed best-effort.
  if (headerIndexToCanonical.size === 0) {
    const rawHeaders = headerRow
      .map(h => String(h || '').replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .slice(0, 30);
    throw new Error(`No recognizable columns found in workbook header row. First headers: ${rawHeaders.join(' | ')}`);
  }

  // Diagnostics for partial mapping (used for error messages later)
  const mappingDiagnostics = headerRow
    .map((h, idx) => {
      const raw = String(h || '').replace(/\s+/g, ' ').trim();
      const norm = normalizeHeader(h);
      const mapped = canonicalByNorm.get(norm) || null;
      return { idx, raw, mapped };
    })
    .filter(x => x.raw);

  const enums = window.POAM_WORKBOOK_ENUMS || {};
  const invalidRows = [];

  const normalizeDate = (v) => {
    if (!v) return '';
    if (v instanceof Date) return v.toISOString().split('T')[0];
    const d = new Date(v);
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
    return String(v);
  };

  const parsedRows = [];
  for (let i = 0; i < dataRows.length; i++) {
    const rowArr = dataRows[i];
    const r = {};

    for (let c = 0; c < rowArr.length; c++) {
      const canonical = headerIndexToCanonical.get(c);
      if (!canonical) continue;
      r[canonical] = rowArr[c];
    }

    // Skip fully empty rows
    const anyVal = Object.values(r).some(v => String(v || '').trim() !== '');
    if (!anyVal) continue;

    const severity = String(r['Severity Value'] || '').trim();
    if (severity && !enums.severityValues.includes(severity)) {
      invalidRows.push({ row: i + 2, field: 'Severity Value', value: severity });
    }

    const status = String(r['Status'] || '').trim();
    if (status && !enums.statusValues.includes(status)) {
      invalidRows.push({ row: i + 2, field: 'Status', value: status });
    }

    const src = String(r['Identifying Detecting Source'] || '').trim();
    if (src && !enums.detectingSources.includes(src)) {
      invalidRows.push({ row: i + 2, field: 'Identifying Detecting Source', value: src });
    }

    r['Detection Date'] = normalizeDate(r['Detection Date']);
    r['Scheduled Completion Date'] = normalizeDate(r['Scheduled Completion Date']);

    const rawAffected = String(r['Affected Components/URLs'] || '');
    const parsed = poamWorkbookExtractAssetsImpacted(rawAffected);

    parsedRows.push({ rowIndex: i + 2, row: r, assets: parsed });
  }

  if (invalidRows.length > 0) {
    const sample = invalidRows.slice(0, 10)
      .map(e => `Row ${e.row}: ${e.field}=${e.value}`)
      .join('; ');
    throw new Error(`Invalid enum values found. ${sample}${invalidRows.length > 10 ? '…' : ''}`);
  }

  const formatItemNumber = async (n) => {
    try {
      const fmt = await window.poamWorkbookDB.getLookup('poamIdFormat');
      const year = String(new Date().getFullYear());
      const replaceN = (template) => template
        .replace(/\{n:(\d+)\}/g, (_, width) => String(n).padStart(parseInt(width, 10) || 0, '0'))
        .replace(/\{n\}/g, String(n));
      return replaceN(String(fmt || 'POAM-{system}-{n:4}'))
        .replace(/\{system\}/g, systemId)
        .replace(/\{year\}/g, year);
    } catch (e) {
      return n;
    }
  };

  // Persist (upsert by systemId + Item number where possible)
  let saved = 0;
  let updated = 0;
  for (const entry of parsedRows) {
    const r = entry.row;
    const itemNumberRaw = r['Item number'];
    const n = parseInt(String(itemNumberRaw || '').replace(/[^0-9]/g, ''), 10);

    const data = {
      ...pickWorkbookColumns(r),
      [window.POAM_WORKBOOK_INTERNAL_FIELDS.assetsImpacted]: entry.assets.assetsImpacted
    };
    data['Affected Components/URLs'] = entry.assets.affectedComponents;

    if (Number.isFinite(n) && n > 0 && typeof window.poamWorkbookDB.upsertItemBySystemAndItemNumber === 'function') {
      data['Item number'] = String(itemNumberRaw || n);
      const result = await window.poamWorkbookDB.upsertItemBySystemAndItemNumber(systemId, n, data);
      if (result.created) saved++; else updated++;
      continue;
    }

    // Fallback: create a new item number
    const nextNum = await window.poamWorkbookDB.getNextItemNumber(systemId);
    const item = {
      id: `WB-${systemId}-${Date.now()}-${saved}-${updated}`,
      systemId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...data
    };
    item['Item number'] = await formatItemNumber(nextNum);
    await window.poamWorkbookDB.saveItem(item);
    saved++;
  }

  if (typeof window.poamWorkbookNotifyMutation === 'function') {
    window.poamWorkbookNotifyMutation();
  }

  return { saved, updated };
}

function pickWorkbookColumns(row) {
  const out = {};
  const cols = window.POAM_WORKBOOK_COLUMNS || [];
  for (const c of cols) {
    out[c] = row[c] ?? '';
  }
  return out;
}

function poamWorkbookExtractAssetsImpacted(affectedComponentsCell) {
  const text = String(affectedComponentsCell || '');
  const marker = 'Assets Impacted:';
  const idx = text.indexOf(marker);
  if (idx === -1) {
    return { affectedComponents: text, assetsImpacted: '' };
  }

  const affected = text.slice(0, idx).trim();
  const assets = text.slice(idx + marker.length).trim();
  return {
    affectedComponents: affected,
    assetsImpacted: assets
  };
}
