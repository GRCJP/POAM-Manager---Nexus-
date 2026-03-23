// Simple direct Excel import for POAM Workbook
// Scans all sheets, scans deep (150 rows), finds POAM table, imports data

async function poamWorkbookImportXlsxSimple(file, systemId) {
  console.log('🚀 Excel Import STARTED:', { fileName: file?.name, systemId, fileSize: file?.size });
  
  if (!file) throw new Error('No file provided');
  if (!systemId) throw new Error('No system selected');
  if (typeof XLSX === 'undefined') throw new Error('XLSX library not loaded');
  if (!window.poamWorkbookDB) throw new Error('Workbook DB not available');

  console.log('📖 Reading Excel file...');
  const wb = await file.arrayBuffer().then(buf => XLSX.read(buf, { type: 'array', cellDates: true }));
  
  console.log('📘 Workbook sheets:', wb.SheetNames);
  
  if (!wb.SheetNames || wb.SheetNames.length === 0) {
    throw new Error('Workbook has no sheets');
  }

  // Helper: normalize header text
  const normalizeHeader = (h) => String(h || '')
    .replace(/\u2013|\u2014/g, '-')
    .replace(/\u2018|\u2019|\u201C|\u201D/g, '')
    .replace(/\r\n|\r|\n/g, ' ')
    .replace(/"/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/\s*\/\s*/g, '/')
    .replace(/[^a-z0-9 /]/g, '')
    .trim();

  // Header mappings - user's exact Excel columns
  const headerMap = new Map([
    ['finding identifier', 'Item number'],
    ['control family', 'Impacted Security Controls'],
    ['vulnerability name', 'Vulnerability Name'],
    ['finding description', 'Vulnerability Description'],
    ['finding source', 'Identifying Detecting Source'],
    ['poc', 'POC Name'],
    ['resources required', 'Resources Required'],
    ['initial scheduled completion date', 'Scheduled Completion Date'],
    ['milestones with completion dates', 'Milestone with Completion Dates'],
    ['changes to milestones with completion dates', 'Milestone Changes'],
    ['updated scheduled completion date', 'Scheduled Completion Date'],
    ['actual completion date', 'Detection Date'],
    ['finding status', 'Status'],
    ['risk level', 'Severity Value'],
    ['mitigation', 'Mitigations'],
    ['comments', 'Comments']
  ]);

  // Helper: match header to canonical name
  const matchHeader = (cell) => {
    const norm = normalizeHeader(cell);
    if (!norm) return null;
    
    // Exact match
    if (headerMap.has(norm)) return headerMap.get(norm);
    
    // Fuzzy patterns
    const has = (tok) => norm.includes(tok);
    if (has('finding') && has('identifier')) return 'Item number';
    if (has('control') && has('family')) return 'Impacted Security Controls';
    if (has('vulnerability') && has('name')) return 'Vulnerability Name';
    if (has('finding') && has('description')) return 'Vulnerability Description';
    if (has('finding') && has('source')) return 'Identifying Detecting Source';
    if (has('finding') && has('status')) return 'Status';
    if (has('risk') && has('level')) return 'Severity Value';
    if (has('mitigation')) return 'Mitigations';
    if (has('comment')) return 'Comments';
    if (has('poc')) return 'POC Name';
    if (has('resource') && has('required')) return 'Resources Required';
    if (has('milestones') && has('completion')) return 'Milestone with Completion Dates';
    if (has('changes') && has('milestones')) return 'Milestone Changes';
    if (has('scheduled') && has('completion')) return 'Scheduled Completion Date';
    
    return null;
  };

  // Helper: score a row as potential header
  const scoreRow = (row) => {
    const matched = new Set();
    for (const cell of row) {
      const canonical = matchHeader(cell);
      if (canonical) matched.add(canonical);
    }
    return matched.size;
  };

  // Helper: count non-empty cells (for fallback tabular detection)
  const countNonEmpty = (row) => {
    return row.filter(cell => String(cell || '').trim() !== '').length;
  };

  // Scan all sheets to find best POAM table
  let bestCandidate = null;
  
  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true, blankrows: false });
    
    console.log(`📄 Sheet "${sheetName}" has ${rows.length} rows`);
    
    if (!Array.isArray(rows) || rows.length < 2) continue;

    // Scan first 150 rows
    const scanLimit = Math.min(150, rows.length);
    
    for (let i = 0; i < scanLimit; i++) {
      const row = rows[i] || [];
      const score = scoreRow(row);
      
      if (score > 0) {
        console.log(`📊 Sheet "${sheetName}" row ${i}: score=${score}, preview: ${row.slice(0, 5).join(' | ')}`);
      }
      
      if (!bestCandidate || score > bestCandidate.score) {
        bestCandidate = {
          sheetName,
          rowIndex: i,
          headers: row,
          score,
          allRows: rows
        };
      }
    }
  }

  // Fallback: if no good header found, look for first tabular row
  if (!bestCandidate || bestCandidate.score < 4) {
    console.log('⚠️ No strong header match, trying fallback tabular detection...');
    
    for (const sheetName of wb.SheetNames) {
      const ws = wb.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true, blankrows: false });
      
      const scanLimit = Math.min(200, rows.length);
      for (let i = 0; i < scanLimit; i++) {
        const nonEmpty = countNonEmpty(rows[i] || []);
        if (nonEmpty >= 6) {
          console.log(`📋 Fallback: Found tabular row at sheet "${sheetName}" row ${i} with ${nonEmpty} cells`);
          bestCandidate = {
            sheetName,
            rowIndex: i,
            headers: rows[i],
            score: 0,
            allRows: rows
          };
          break;
        }
      }
      if (bestCandidate && bestCandidate.score === 0) break;
    }
  }

  if (!bestCandidate) {
    throw new Error('No recognizable POAM table found in any sheet');
  }

  console.log(`✅ Using sheet "${bestCandidate.sheetName}" row ${bestCandidate.rowIndex} (score: ${bestCandidate.score})`);
  console.log('📊 Headers:', bestCandidate.headers.slice(0, 10));

  // Map columns
  const columnMap = new Map();
  for (let i = 0; i < bestCandidate.headers.length; i++) {
    const canonical = matchHeader(bestCandidate.headers[i]);
    if (canonical) {
      columnMap.set(i, canonical);
      console.log(`📊 Column ${i}: "${bestCandidate.headers[i]}" → "${canonical}"`);
    }
  }

  console.log(`📊 Mapped ${columnMap.size} columns`);

  if (columnMap.size === 0) {
    throw new Error('No columns could be mapped');
  }

  // Helper: normalize date values from Excel (handles multiple formats)
  const normalizeDate = (val) => {
    if (!val) return '';
    
    // Already a Date object
    if (val instanceof Date) {
      return val.toISOString().split('T')[0];
    }
    
    // Excel serial number (days since 1900-01-01)
    if (typeof val === 'number' && val > 0 && val < 100000) {
      const excelEpoch = new Date(1900, 0, 1);
      const days = val - 2; // Excel incorrectly treats 1900 as a leap year
      const d = new Date(excelEpoch.getTime() + days * 24 * 60 * 60 * 1000);
      if (!isNaN(d.getTime())) {
        return d.toISOString().split('T')[0];
      }
    }
    
    const str = String(val).trim();
    if (!str) return '';
    
    // Try standard Date parsing first
    let d = new Date(str);
    if (!isNaN(d.getTime())) {
      return d.toISOString().split('T')[0];
    }
    
    // Try MM/DD/YYYY format
    const mmddyyyy = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (mmddyyyy) {
      const [, month, day, year] = mmddyyyy;
      d = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      if (!isNaN(d.getTime())) {
        return d.toISOString().split('T')[0];
      }
    }
    
    // Try DD-MM-YYYY format
    const ddmmyyyy = str.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
    if (ddmmyyyy) {
      const [, day, month, year] = ddmmyyyy;
      d = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      if (!isNaN(d.getTime())) {
        return d.toISOString().split('T')[0];
      }
    }
    
    // Try YYYY-MM-DD format (ISO)
    const yyyymmdd = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (yyyymmdd) {
      const [, year, month, day] = yyyymmdd;
      d = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      if (!isNaN(d.getTime())) {
        return d.toISOString().split('T')[0];
      }
    }
    
    // Return original if no format matched
    console.warn('Could not parse date:', str);
    return '';
  };

  // Helper: normalize text values
  const normalizeText = (val) => {
    return String(val || '').trim();
  };

  // Parse data rows
  const dataRows = bestCandidate.allRows.slice(bestCandidate.rowIndex + 1);
  const parsedRows = [];

  for (let i = 0; i < dataRows.length; i++) {
    const rowArr = dataRows[i] || [];
    const rowData = {};

    for (let c = 0; c < rowArr.length; c++) {
      const canonical = columnMap.get(c);
      if (canonical) {
        let value = rowArr[c];
        
        // Normalize dates
        if (canonical === 'Scheduled Completion Date' || canonical === 'Detection Date') {
          value = normalizeDate(value);
        } else {
          value = normalizeText(value);
        }
        
        rowData[canonical] = value;
      }
    }

    // Skip empty rows
    const hasData = Object.values(rowData).some(v => String(v || '').trim() !== '');
    if (!hasData) continue;

    parsedRows.push(rowData);
  }

  console.log(`📊 Parsed ${parsedRows.length} data rows`);

  // Save to database
  let saved = 0;
  let updated = 0;

  for (const row of parsedRows) {
    // Use item number from Excel if present, otherwise auto-generate
    const excelItemNumber = normalizeText(row['Item number']);
    const itemNumber = excelItemNumber || (typeof window.poamWorkbookDB.getNextItemNumber === 'function'
      ? String(await window.poamWorkbookDB.getNextItemNumber(systemId))
      : String(saved + 1));
    
    // Build item with all fields from row
    const item = {
      id: `WB-${systemId}-${Date.now()}-${saved}`,
      systemId,
      createdAt: new Date().toISOString(),
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
      'Affected Components/URLs': row['Affected Components/URLs'] || '',
      'Status': row['Status'] || '',
      'Comments': row['Comments'] || ''
    };

    console.log(`📊 Saving item ${saved + 1}:`, { 
      itemNumber: item['Item number'], 
      vulnName: item['Vulnerability Name'],
      poc: item['POC Name'],
      scheduledDate: item['Scheduled Completion Date'],
      detectionDate: item['Detection Date'],
      status: item['Status'],
      severity: item['Severity Value'],
      detectingSource: item['Identifying Detecting Source']
    });
    console.log(`📊 Raw row data:`, row);
    console.log(`📊 Full item being saved:`, item);

    await window.poamWorkbookDB.saveItem(item);
    saved++;
  }

  if (typeof window.poamWorkbookNotifyMutation === 'function') {
    window.poamWorkbookNotifyMutation();
  }

  console.log(`✅ Import complete: ${saved} items saved`);

  return { saved, updated };
}

// Export
window.poamWorkbookImportXlsxSimple = poamWorkbookImportXlsxSimple;
