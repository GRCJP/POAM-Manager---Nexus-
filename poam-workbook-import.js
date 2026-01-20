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
  const rows = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false });
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error('No rows found in workbook');
  }

  const requiredHeaders = window.POAM_WORKBOOK_COLUMNS || [];
  const firstRow = rows[0];
  const presentHeaders = new Set(Object.keys(firstRow));

  const missing = requiredHeaders.filter(h => !presentHeaders.has(h));
  if (missing.length > 0) {
    throw new Error(`Missing required column(s): ${missing.join(', ')}`);
  }

  const enums = window.POAM_WORKBOOK_ENUMS || {};
  const invalidRows = [];
  const itemsToSave = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];

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

    // Normalize detection / scheduled completion dates to YYYY-MM-DD (string)
    const normalizeDate = (v) => {
      if (!v) return '';
      if (v instanceof Date) return v.toISOString().split('T')[0];
      const d = new Date(v);
      if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
      return String(v);
    };

    r['Detection Date'] = normalizeDate(r['Detection Date']);
    r['Scheduled Completion Date'] = normalizeDate(r['Scheduled Completion Date']);

    const rawAffected = String(r['Affected Components/URLs'] || '');
    const parsed = poamWorkbookExtractAssetsImpacted(rawAffected);

    const item = {
      id: `WB-${systemId}-${Date.now()}-${i}`,
      systemId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...pickWorkbookColumns(r),
      [window.POAM_WORKBOOK_INTERNAL_FIELDS.assetsImpacted]: parsed.assetsImpacted
    };

    // Save cleaned affected components (without embedded assets impacted block)
    item['Affected Components/URLs'] = parsed.affectedComponents;

    itemsToSave.push(item);
  }

  if (invalidRows.length > 0) {
    const sample = invalidRows.slice(0, 10)
      .map(e => `Row ${e.row}: ${e.field}=${e.value}`)
      .join('; ');
    throw new Error(`Invalid enum values found. ${sample}${invalidRows.length > 10 ? '…' : ''}`);
  }

  // Persist
  let saved = 0;
  for (const item of itemsToSave) {
    await window.poamWorkbookDB.saveItem(item);
    saved++;
  }

  if (typeof window.poamWorkbookNotifyMutation === 'function') {
    window.poamWorkbookNotifyMutation();
  }

  return { saved };
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
