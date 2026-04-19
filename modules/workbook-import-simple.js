// Simple direct Excel import for POAM Workbook
// Handles the 17-column POAM format (A-Q) with positional fallback
// and fuzzy header matching. Robust date/null handling.

async function poamWorkbookImportXlsxSimple(file, systemId) {
  console.log('Excel Import STARTED:', { fileName: file?.name, systemId, fileSize: file?.size });

  if (!file) throw new Error('No file provided');
  if (!systemId) throw new Error('No system selected');
  if (typeof XLSX === 'undefined') throw new Error('XLSX library not loaded');
  if (!window.poamWorkbookDB) throw new Error('Workbook DB not available');

  const wb = await file.arrayBuffer().then(buf => XLSX.read(buf, { type: 'array', cellDates: true }));
  if (!wb.SheetNames || wb.SheetNames.length === 0) throw new Error('Workbook has no sheets');

  // Use first sheet by index, not by name
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true, blankrows: true });

  if (!Array.isArray(rows) || rows.length < 2) throw new Error('No data rows found');

  // ── Positional column map (A=0 … Q=16) ──
  const POSITIONAL_MAP = [
    'Item number',                    // A - finding_identifier
    'Impacted Security Controls',     // B - control_family
    'Vulnerability Name',             // C - vulnerability_name
    'Vulnerability Description',      // D - finding_description
    'Affected Components/URLs',       // E - affected_hosts
    'Identifying Detecting Source',    // F - finding_source
    'POC Name',                       // G - poc
    'Resources Required',             // H - resources_required
    'Scheduled Completion Date',      // I - initial_scheduled_completion_date
    'Milestone with Completion Dates',// J - milestones_with_completion_dates
    'Milestone Changes',              // K - changes_to_milestones
    'Updated Scheduled Completion Date', // L - updated_scheduled_completion_date
    'Actual Completion Date',         // M - actual_completion_date
    'Status',                         // N - finding_status
    'Severity Value',                 // O - risk_level
    'Mitigations',                    // P - mitigation
    'Comments'                        // Q - comments
  ];

  // ── Header normalization ──
  const normalizeHeader = (h) => String(h || '')
    .replace(/\u2013|\u2014/g, '-')
    .replace(/\u2018|\u2019|\u201C|\u201D/g, '')
    .replace(/\r\n|\r|\n/g, ' ')
    .replace(/"/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

  // ── Fuzzy header matching ──
  const fuzzyMatch = (norm) => {
    if (!norm) return null;
    const has = (tok) => norm.includes(tok);
    if (has('finding') && has('identifier'))   return 'Item number';
    if (has('item') && has('number'))          return 'Item number';
    if (has('poam') && has('id'))              return 'Item number';
    if (has('poam') && has('number'))          return 'Item number';
    if (has('poam') && has('item'))            return 'Item number';
    if (norm === 'id' || norm === 'no' || norm === 'number') return 'Item number';
    if (has('control') && has('family'))       return 'Impacted Security Controls';
    if (has('security') && has('control'))     return 'Impacted Security Controls';
    if (has('vulnerability') && has('name'))   return 'Vulnerability Name';
    if (has('weakness') && has('name'))        return 'Vulnerability Name';
    if (has('weakness') && !has('desc'))       return 'Vulnerability Name';
    if (has('finding') && has('name'))         return 'Vulnerability Name';
    if (has('finding') && has('title'))        return 'Vulnerability Name';
    if (has('poam') && has('title'))           return 'Vulnerability Name';
    if (norm === 'title' || norm === 'name')   return 'Vulnerability Name';
    if (has('finding') && has('description'))  return 'Vulnerability Description';
    if (has('vulnerability') && has('desc'))   return 'Vulnerability Description';
    if (has('weakness') && has('desc'))        return 'Vulnerability Description';
    if (norm === 'description')                return 'Vulnerability Description';
    if (has('affected') && has('host'))        return 'Affected Components/URLs';
    if (has('host') && has('technical'))       return 'Affected Components/URLs';
    if (has('affected') && has('component'))   return 'Affected Components/URLs';
    if (has('finding') && has('source'))       return 'Identifying Detecting Source';
    if (has('detecting') && has('source'))     return 'Identifying Detecting Source';
    if (has('identifying') && has('source'))   return 'Identifying Detecting Source';
    if (norm === 'poc' || (has('point') && has('contact'))) return 'POC Name';
    if (has('poc') && has('name'))             return 'POC Name';
    if (has('resource') && has('required'))    return 'Resources Required';
    if (has('initial') && has('scheduled') && has('completion')) return 'Scheduled Completion Date';
    if (has('scheduled') && has('completion') && !has('update') && !has('change')) return 'Scheduled Completion Date';
    if (has('milestone') && has('change'))     return 'Milestone Changes';
    if (has('changes') && has('milestone'))    return 'Milestone Changes';
    if (has('milestone') && has('completion')) return 'Milestone with Completion Dates';
    if (has('updated') && has('scheduled'))    return 'Updated Scheduled Completion Date';
    if (has('revised') && has('completion'))   return 'Updated Scheduled Completion Date';
    if (has('actual') && has('completion'))    return 'Actual Completion Date';
    if (has('completion') && has('date') && !has('scheduled') && !has('milestone')) return 'Actual Completion Date';
    if (has('finding') && has('status'))       return 'Status';
    if (norm === 'status')                     return 'Status';
    if (has('poam') && has('status'))          return 'Status';
    if (has('risk') && has('level'))           return 'Severity Value';
    if (norm === 'severity' || norm === 'risk level') return 'Severity Value';
    if (norm === 'risk' || norm === 'priority') return 'Severity Value';
    if (has('severity') && has('value'))       return 'Severity Value';
    if (has('impact') && has('level'))         return 'Severity Value';
    if (has('mitigation'))                     return 'Mitigations';
    if (has('remediation'))                    return 'Mitigations';
    if (has('comment'))                        return 'Comments';
    return null;
  };

  // ── Find header row ──
  let headerRowIdx = -1;
  let columnMap = null; // index → canonical field name
  const warnings = [];

  // Try to find a header row in the first 10 rows
  for (let i = 0; i < Math.min(10, rows.length); i++) {
    const row = rows[i] || [];
    let matchCount = 0;
    const testMap = [];
    for (let c = 0; c < row.length; c++) {
      const match = fuzzyMatch(normalizeHeader(row[c]));
      testMap.push(match);
      if (match) matchCount++;
    }
    if (matchCount >= 5) {
      headerRowIdx = i;
      columnMap = testMap;
      console.log(`Header found at row ${i} (${matchCount} columns matched)`);
      break;
    }
  }

  // Positional fallback for 17-column files with no recognizable header
  if (headerRowIdx === -1) {
    const firstRow = rows[0] || [];
    if (firstRow.length >= 15 && firstRow.length <= 20) {
      // Check if row 0 looks like data (first cell is an ID-like string)
      const firstCell = String(firstRow[0] || '').trim();
      const looksLikeData = firstCell && !/finding|item|poam|control|vulnerability/i.test(firstCell);
      if (looksLikeData) {
        // No header row — use positional mapping, data starts at row 0
        headerRowIdx = -1;
        columnMap = POSITIONAL_MAP.slice(0, firstRow.length);
        warnings.push('No header row detected — using positional column mapping (A-Q)');
        console.log('Using positional mapping, data starts at row 0');
      }
    }
    if (!columnMap) {
      // Last resort: assume row 0 is header, use positional
      headerRowIdx = 0;
      columnMap = POSITIONAL_MAP.slice();
      warnings.push('Weak header match — falling back to positional column mapping');
    }
  }

  // Log full header mapping for debugging
  console.log('Column mapping result:');
  for (let c = 0; c < columnMap.length; c++) {
    const mapped = typeof columnMap[c] === 'string' ? columnMap[c] : null;
    console.log(`  [${c}] ${String.fromCharCode(65 + c)}: → ${mapped || '(unmapped)'}`);
  }

  // Log header mapping
  const headerMismatches = [];
  if (headerRowIdx >= 0 && rows[headerRowIdx]) {
    const headerRow = rows[headerRowIdx];
    for (let c = 0; c < Math.max(headerRow.length, POSITIONAL_MAP.length); c++) {
      const actual = String(headerRow[c] || '').trim();
      const mapped = columnMap[c] || null;
      const expected = POSITIONAL_MAP[c] || null;
      if (mapped) {
        console.log(`  Col ${String.fromCharCode(65 + c)}: "${actual}" → ${mapped}`);
      } else if (actual) {
        headerMismatches.push(`Col ${String.fromCharCode(65 + c)}: "${actual}" — unmapped`);
      }
    }
  }
  if (headerMismatches.length > 0) {
    warnings.push('Unmapped headers: ' + headerMismatches.join('; '));
  }

  // ── N/A normalization ──
  const NA_SENTINELS = new Set(['', 'n/a', 'na', 'none', '-', 'tbd', 'null', 'undefined']);
  const isNA = (val) => NA_SENTINELS.has(String(val || '').trim().toLowerCase());

  // ── Date parsing ──
  const parseDate = (val) => {
    if (val == null) return null;
    if (val instanceof Date) {
      return isNaN(val.getTime()) ? null : val.toISOString().split('T')[0];
    }
    // Excel serial number
    if (typeof val === 'number' && val > 0 && val < 100000) {
      const excelEpoch = new Date(1900, 0, 1);
      const days = val - 2; // Excel 1900 leap year bug
      const d = new Date(excelEpoch.getTime() + days * 86400000);
      return isNaN(d.getTime()) ? null : d.toISOString().split('T')[0];
    }
    const str = String(val).trim();
    if (isNA(str)) return null;
    // Try ISO, then common US formats
    for (const attempt of [
      () => new Date(str),
      () => { const m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); return m ? new Date(+m[3], +m[1]-1, +m[2]) : null; },
      () => { const m = str.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/); return m ? new Date(+m[3], +m[1]-1, +m[2]) : null; },
      () => { const m = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/); return m ? new Date(+m[1], +m[2]-1, +m[3]) : null; }
    ]) {
      try {
        const d = attempt();
        if (d && !isNaN(d.getTime()) && d.getFullYear() > 1970) return d.toISOString().split('T')[0];
      } catch (_) {}
    }
    return null;
  };

  // ── Text normalization (preserve internal newlines) ──
  const cleanText = (val) => {
    if (val == null) return '';
    const s = String(val).replace(/^\s+|\s+$/g, ''); // trim outer whitespace only
    return s;
  };

  const cleanTextNullable = (val) => {
    const s = cleanText(val);
    return isNA(s) ? '' : s;
  };

  // ── Date columns (by canonical name) ──
  const DATE_FIELDS = new Set([
    'Scheduled Completion Date',
    'Updated Scheduled Completion Date',
    'Actual Completion Date',
    'Detection Date'
  ]);

  // ── Parse data rows ──
  const dataStartIdx = headerRowIdx >= 0 ? headerRowIdx + 1 : 0;
  const parsedRows = [];
  const rowErrors = [];
  const rowWarnings = [];
  const seenIds = new Set();

  for (let i = dataStartIdx; i < rows.length; i++) {
    const rowArr = rows[i] || [];
    const rowNum = i + 1; // 1-based for user display

    // Terminate on fully-empty row
    const allEmpty = rowArr.every(cell => String(cell ?? '').trim() === '');
    if (allEmpty) continue; // Skip empty rows but don't terminate — spec says skip, not stop

    const obj = {};
    const issues = [];

    for (let c = 0; c < columnMap.length; c++) {
      const field = typeof columnMap[c] === 'string' ? columnMap[c] : (columnMap[c] || null);
      if (!field) continue;

      const raw = rowArr[c];

      if (DATE_FIELDS.has(field)) {
        const parsed = parseDate(raw);
        if (raw && !isNA(String(raw).trim()) && !parsed) {
          issues.push(`Unparseable date in "${field}": "${raw}"`);
        }
        obj[field] = parsed || '';
      } else {
        obj[field] = cleanTextNullable(raw);
      }
    }

    // Check if row has any meaningful content at all
    const allValues = Object.values(obj);
    const hasAnyContent = allValues.some(v => String(v || '').trim() !== '');
    if (!hasAnyContent) continue;

    // For workbook import: only need SOME identifying info — title or ID
    // Auto-generate item number if missing
    const vulnName = obj['Vulnerability Name'] || '';
    let id = obj['Item number'] || '';

    if (!vulnName && !id) {
      // Check if any other fields have data — if so, try to use first non-empty text field as title
      const fallbackTitle = obj['Vulnerability Description'] || obj['Mitigations'] || '';
      if (fallbackTitle) {
        obj['Vulnerability Name'] = fallbackTitle.substring(0, 200);
      } else {
        rowErrors.push({ row: rowNum, message: 'No title or identifier found — row skipped' });
        continue;
      }
    }

    // Auto-generate item number if not provided
    if (!id) {
      const autoNum = typeof window.poamWorkbookDB.getNextItemNumber === 'function'
        ? String(await window.poamWorkbookDB.getNextItemNumber(systemId))
        : String(rowNum);
      obj['Item number'] = autoNum;
      id = autoNum;
    }

    // Use title as vulnerability name if we only have an ID
    if (!obj['Vulnerability Name'] && id) {
      issues.push('No vulnerability name — row imported with ID only');
    }

    // Duplicate check
    if (seenIds.has(id)) {
      issues.push(`Duplicate finding identifier: ${id}`);
    }
    seenIds.add(id);

    // Enum warnings
    const status = (obj['Status'] || '').trim();
    const knownStatuses = new Set(['open', 'ongoing', 'in progress', 'completed', 'risk accepted', 'delayed', 'pending', 'extended', 'closed']);
    if (status && !knownStatuses.has(status.toLowerCase())) {
      issues.push(`Unknown finding status: "${status}"`);
    }

    const risk = (obj['Severity Value'] || '').trim();
    const knownRisks = new Set(['low', 'moderate', 'medium', 'high', 'critical', 'informational']);
    if (risk && !knownRisks.has(risk.toLowerCase())) {
      issues.push(`Unknown risk level: "${risk}"`);
    }

    const controlFamily = (obj['Impacted Security Controls'] || '').trim();
    const knownFamilies = new Set(['AC','AT','AU','CA','CM','CP','IA','IR','MA','MP','PE','PL','PM','PS','RA','SA','SC','SI','SR']);
    if (controlFamily && !knownFamilies.has(controlFamily.toUpperCase().split('-')[0].split(' ')[0])) {
      issues.push(`Unknown control family: "${controlFamily}"`);
    }

    // Cross-field validation
    const statusLower = status.toLowerCase();
    if (statusLower === 'completed' && !obj['Actual Completion Date']) {
      issues.push('Status is Completed but no actual completion date');
    }
    if (statusLower !== 'completed' && statusLower !== 'closed' && obj['Actual Completion Date']) {
      issues.push('Actual completion date set but status is not Completed');
    }

    if (issues.length > 0) {
      rowWarnings.push({ row: rowNum, id, issues });
    }

    parsedRows.push(obj);
  }

  console.log(`Parsed ${parsedRows.length} data rows, ${rowErrors.length} errors, ${rowWarnings.length} warnings`);

  // ── Save to database ──
  let saved = 0;
  let updated = 0;

  // Check for existing items to support re-import/update
  const existingItems = await window.poamWorkbookDB.getItemsBySystem(systemId);
  const existingById = new Map();
  existingItems.forEach(item => {
    const itemNum = item['Item number'] || '';
    if (itemNum) existingById.set(itemNum, item);
  });

  for (const row of parsedRows) {
    const itemNumber = row['Item number'];
    const existing = existingById.get(itemNumber);

    const item = {
      id: existing ? existing.id : `WB-${systemId}-${Date.now()}-${saved}`,
      systemId,
      createdAt: existing ? existing.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      'Item number': itemNumber,
      'Vulnerability Name': row['Vulnerability Name'] || '',
      'Vulnerability Description': row['Vulnerability Description'] || '',
      'Detection Date': row['Detection Date'] || '',
      'Impacted Security Controls': row['Impacted Security Controls'] || '',
      'Office/Org': row['Office/Org'] || '',
      'POC Name': row['POC Name'] || '',
      'Identifying Detecting Source': row['Identifying Detecting Source'] || '',
      'Mitigations': row['Mitigations'] || '',
      'Severity Value': row['Severity Value'] || '',
      'Resources Required': row['Resources Required'] || '',
      'Scheduled Completion Date': row['Scheduled Completion Date'] || '',
      'Milestone with Completion Dates': row['Milestone with Completion Dates'] || '',
      'Milestone Changes': row['Milestone Changes'] || '',
      'Updated Scheduled Completion Date': row['Updated Scheduled Completion Date'] || '',
      'Actual Completion Date': row['Actual Completion Date'] || '',
      'Affected Components/URLs': row['Affected Components/URLs'] || '',
      'Status': row['Status'] || '',
      'Comments': row['Comments'] || ''
    };

    await window.poamWorkbookDB.saveItem(item);
    if (existing) {
      updated++;
    } else {
      saved++;
    }
  }

  if (typeof window.poamWorkbookNotifyMutation === 'function') {
    window.poamWorkbookNotifyMutation();
  }

  console.log(`Import complete: ${saved} new, ${updated} updated`);

  // Return detailed result
  return {
    saved,
    updated,
    total: parsedRows.length,
    errors: rowErrors,
    warnings: rowWarnings,
    headerWarnings: warnings
  };
}

// Export
window.poamWorkbookImportXlsxSimple = poamWorkbookImportXlsxSimple;
