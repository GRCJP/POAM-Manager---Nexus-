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
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^a-z0-9 ]/g, '');

  const requiredHeaders = window.POAM_WORKBOOK_COLUMNS || [];
  const canonicalByNorm = new Map(requiredHeaders.map(h => [normalizeHeader(h), h]));
  const headerIndexToCanonical = new Map();

  for (let i = 0; i < headerRow.length; i++) {
    const norm = normalizeHeader(headerRow[i]);
    const canonical = canonicalByNorm.get(norm);
    if (canonical) {
      headerIndexToCanonical.set(i, canonical);
    }
  }

  // Require a minimal set to proceed.
  const requiredMinimum = ['Item number', 'Vulnerability Name'];
  const haveMinimum = requiredMinimum.every(h => Array.from(headerIndexToCanonical.values()).includes(h));
  if (!haveMinimum) {
    throw new Error('Workbook is missing required columns (must include: Item number, Vulnerability Name)');
  }

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
    const anyVal = requiredHeaders.some(h => String(r[h] || '').trim() !== '');
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

  // Persist (upsert by systemId + Item number where possible)
  let saved = 0;
  let updated = 0;
  for (const entry of parsedRows) {
    const r = entry.row;
    const itemNumberRaw = r['Item number'];
    const n = parseInt(String(itemNumberRaw || '').trim(), 10);

    const data = {
      ...pickWorkbookColumns(r),
      [window.POAM_WORKBOOK_INTERNAL_FIELDS.assetsImpacted]: entry.assets.assetsImpacted
    };
    data['Affected Components/URLs'] = entry.assets.affectedComponents;

    if (Number.isFinite(n) && n > 0 && typeof window.poamWorkbookDB.upsertItemBySystemAndItemNumber === 'function') {
      data['Item number'] = n;
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
    item['Item number'] = nextNum;
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
