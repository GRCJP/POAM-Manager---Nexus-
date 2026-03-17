async function poamWorkbookExportXlsx({ systemId = null } = {}) {
  if (typeof XLSX === 'undefined') {
    throw new Error('XLSX library not loaded');
  }
  if (!window.poamWorkbookDB) {
    throw new Error('Workbook DB not available');
  }

  const cols = window.POAM_WORKBOOK_COLUMNS || [];

  const items = systemId
    ? await window.poamWorkbookDB.getItemsBySystem(systemId)
    : await window.poamWorkbookDB.getAllItems();

  const rows = items.map(item => {
    const row = {};

    // Start from stored workbook columns
    for (const c of cols) {
      row[c] = item[c] ?? '';
    }

    // Map internal Assets Impacted into Affected Components/URLs (no new column).
    // Rule: Append block "\n\nAssets Impacted:\n<value>" if Assets Impacted is non-empty
    // and the block is not already present.
    const assetsImpacted = String(item[window.POAM_WORKBOOK_INTERNAL_FIELDS.assetsImpacted] || '').trim();
    if (assetsImpacted) {
      const marker = 'Assets Impacted:';
      const current = String(row['Affected Components/URLs'] || '');
      if (!current.includes(marker)) {
        row['Affected Components/URLs'] = (current ? current.trim() + '\n\n' : '') + `${marker}\n${assetsImpacted}`;
      }
    }

    // Normalize date columns to JS Date so XLSX writes real Excel dates
    row['Detection Date'] = toExcelDate(row['Detection Date']);
    row['Scheduled Completion Date'] = toExcelDate(row['Scheduled Completion Date']);

    return row;
  });

  // Build worksheet with explicit header order
  const ws = XLSX.utils.json_to_sheet(rows, { header: cols, skipHeader: false });

  // Ensure header row is exactly our titles
  XLSX.utils.sheet_add_aoa(ws, [cols], { origin: 'A1' });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, systemId ? `System_${systemId}` : 'All_Systems');

  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = systemId ? `POAM_Workbook_${systemId}_${ts}.xlsx` : `POAM_Workbook_All_${ts}.xlsx`;

  XLSX.writeFile(wb, filename);
}

function toExcelDate(v) {
  if (!v) return '';
  if (v instanceof Date) return v;
  const s = String(v).trim();
  if (!s) return '';
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return d;
}
