// Workbook UI module (isolated)

window.poamWorkbookState = {
  activeTab: 'overview',
  activeSystemId: 'default',
  pendingOpenSystemId: null,
  selectedItemIds: new Set(),
  _version: 0,
  _analyticsCache: new Map()
};

window.poamWorkbookNotifyMutation = function () {
  window.poamWorkbookState._version++;
  window.poamWorkbookState._analyticsCache.clear();
};

async function initPOAMWorkbookModule() {
  if (!window.poamWorkbookDB) {
    console.error('Workbook DB missing');
    return;
  }

  if (!window.poamWorkbookDB.db) {
    await window.poamWorkbookDB.init();
    await window.poamWorkbookDB.seedDefaultsIfNeeded();
  }

  await renderWorkbookSidebarSystems();
  await renderWorkbookOverview();

  // If a sidebar click requested a specific system, open it now.
  const pending = window.poamWorkbookState.pendingOpenSystemId;
  if (pending) {
    window.poamWorkbookState.pendingOpenSystemId = null;
    await poamWorkbookOpenSystem(pending);
    return;
  }

  // Default view is overview
  poamWorkbookShowOverview();
}

function poamWorkbookShowOverview() {
  window.poamWorkbookState.activeTab = 'overview';
  const overview = document.getElementById('poam-workbook-view-overview');
  const system = document.getElementById('poam-workbook-view-system');
  if (overview) overview.classList.remove('hidden');
  if (system) system.classList.add('hidden');
}

async function renderWorkbookSidebarSystems() {
  if (!window.poamWorkbookDB || !window.poamWorkbookDB.db) return;
  const systems = await window.poamWorkbookDB.getSystems();

  const container = document.getElementById('scm-poam-workbook-systems');
  if (!container) return;

  const activeId = window.poamWorkbookState.activeSystemId;
  container.innerHTML = `
    <button onclick="poamWorkbookOpenAddSystemModal()" class="sidebar-sublink flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-slate-800 transition-colors text-slate-100">
      <i class="fas fa-plus text-xs w-4 text-indigo-300"></i>
      <span>Add System</span>
    </button>
    <button onclick="poamWorkbookOpenPoamIdFormatModal()" class="sidebar-sublink flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-slate-800 transition-colors text-slate-100">
      <i class="fas fa-hashtag text-xs w-4 text-indigo-300"></i>
      <span>POAM ID Format</span>
    </button>
    ${systems.map(s => {
      const active = s.id === activeId;
      return `
        <div class="flex items-center gap-1">
          <a href="#" onclick="poamWorkbookNavigateToSystem('${s.id}')" class="sidebar-sublink flex-1 flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-slate-800 transition-colors ${active ? 'bg-slate-700 text-white' : ''}">
            <i class="fas fa-server text-xs w-4 text-slate-300"></i>
            <span class="truncate">${escapeHtml(s.name)}</span>
          </a>
          <button onclick="poamWorkbookOpenEditSystemModal('${s.id}')" class="px-2 py-2 rounded-lg hover:bg-slate-800 text-slate-300" title="Edit System">
            <i class="fas fa-pen text-xs"></i>
          </button>
        </div>
      `;
    }).join('')}
  `;
}

async function poamWorkbookOpenEditSystemModal(systemId) {
  try {
    await poamWorkbookEnsureDbReady();
    const system = await window.poamWorkbookDB.getSystemById(systemId);
    if (!system) throw new Error('System not found');

    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';
    modal.innerHTML = `
      <div class="bg-white rounded-2xl p-6 max-w-lg w-full">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-bold text-slate-900">Edit System</h2>
          <button id="wb-editsys-close" class="text-slate-400 hover:text-slate-600"><i class="fas fa-times"></i></button>
        </div>
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-semibold text-slate-700 mb-2">System Name</label>
            <input id="wb-editsys-name" type="text" class="w-full px-3 py-2 border border-slate-200 rounded-lg" value="${escapeAttr(system.name || '')}">
          </div>
          <div>
            <label class="block text-sm font-semibold text-slate-700 mb-2">Description</label>
            <input id="wb-editsys-desc" type="text" class="w-full px-3 py-2 border border-slate-200 rounded-lg" value="${escapeAttr(system.description || '')}">
          </div>
        </div>
        <div class="flex justify-end gap-3 mt-6">
          <button id="wb-editsys-cancel" class="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300">Cancel</button>
          <button id="wb-editsys-save" class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Save</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    const close = () => modal.remove();
    modal.querySelector('#wb-editsys-close')?.addEventListener('click', close);
    modal.querySelector('#wb-editsys-cancel')?.addEventListener('click', close);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) close();
    });

    modal.querySelector('#wb-editsys-save')?.addEventListener('click', async () => {
      try {
        const name = String(modal.querySelector('#wb-editsys-name')?.value || '').trim();
        const description = String(modal.querySelector('#wb-editsys-desc')?.value || '').trim();
        if (!name) throw new Error('System Name is required');
        await window.poamWorkbookDB.saveSystem({ ...system, name, description });
        await renderWorkbookSidebarSystems();
        const sysName = document.getElementById('poam-workbook-active-system-name');
        if (sysName && window.poamWorkbookState.activeSystemId === systemId) {
          sysName.textContent = name;
        }
        showUpdateFeedback('System updated', 'success');
        close();
      } catch (e) {
        console.error(e);
        showUpdateFeedback(`Update system failed: ${e.message}`, 'error');
      }
    });
  } catch (e) {
    console.error(e);
    showUpdateFeedback(`Edit system failed: ${e.message}`, 'error');
  }
}

async function poamWorkbookOpenPoamIdFormatModal() {
  try {
    await poamWorkbookEnsureDbReady();
    const current = await window.poamWorkbookDB.getLookup('poamIdFormat');

    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';
    modal.innerHTML = `
      <div class="bg-white rounded-2xl p-6 max-w-xl w-full">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-bold text-slate-900">POAM ID Format (Workbook)</h2>
          <button id="wb-poamid-close" class="text-slate-400 hover:text-slate-600"><i class="fas fa-times"></i></button>
        </div>
        <div class="space-y-3">
          <div class="text-sm text-slate-600">This controls how new workbook POAM IDs are generated. The numeric sequence always increments (max + 1), even if items are closed.</div>
          <div>
            <label class="block text-sm font-semibold text-slate-700 mb-2">Format</label>
            <input id="wb-poamid-format" type="text" class="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono text-xs" value="${escapeAttr(current || 'POAM-{system}-{n:4}')}">
            <div class="text-xs text-slate-500 mt-2">Tokens: <span class="font-mono">{system}</span>, <span class="font-mono">{year}</span>, <span class="font-mono">{n}</span>, <span class="font-mono">{n:4}</span> (zero-pad)</div>
          </div>
        </div>
        <div class="flex justify-end gap-3 mt-6">
          <button id="wb-poamid-cancel" class="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300">Cancel</button>
          <button id="wb-poamid-save" class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Save</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    const close = () => modal.remove();
    modal.querySelector('#wb-poamid-close')?.addEventListener('click', close);
    modal.querySelector('#wb-poamid-cancel')?.addEventListener('click', close);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) close();
    });

    modal.querySelector('#wb-poamid-save')?.addEventListener('click', async () => {
      try {
        const format = String(modal.querySelector('#wb-poamid-format')?.value || '').trim();
        if (!format) throw new Error('Format is required');
        await window.poamWorkbookDB.putLookup('poamIdFormat', format);
        showUpdateFeedback('POAM ID format saved', 'success');
        close();
      } catch (e) {
        console.error(e);
        showUpdateFeedback(`Save format failed: ${e.message}`, 'error');
      }
    });
  } catch (e) {
    console.error(e);
    showUpdateFeedback(`POAM ID format failed: ${e.message}`, 'error');
  }
}

async function poamWorkbookFormatItemNumber(systemId, n) {
  const fmt = await window.poamWorkbookDB.getLookup('poamIdFormat');
  const sys = await window.poamWorkbookDB.getSystemById(systemId);
  const systemToken = systemId;
  const yearToken = String(new Date().getFullYear());

  const replaceN = (template) => {
    return template
      .replace(/\{n:(\d+)\}/g, (_, width) => String(n).padStart(parseInt(width, 10) || 0, '0'))
      .replace(/\{n\}/g, String(n));
  };

  const out = replaceN(String(fmt || 'POAM-{system}-{n:4}'))
    .replace(/\{system\}/g, systemToken)
    .replace(/\{systemName\}/g, String(sys?.name || systemToken))
    .replace(/\{year\}/g, yearToken);
  return out;
}

async function poamWorkbookEnsureDbReady() {
  if (!window.poamWorkbookDB) return;
  if (!window.poamWorkbookDB.db) {
    await window.poamWorkbookDB.init();
    await window.poamWorkbookDB.seedDefaultsIfNeeded();
  }
}

function poamWorkbookOpenPasteModal() {
  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';
  modal.innerHTML = `
    <div class="bg-white rounded-2xl p-6 max-w-4xl w-full">
      <div class="flex items-start justify-between gap-4 mb-4">
        <div>
          <h2 class="text-lg font-bold text-slate-900">Paste POAMs</h2>
          <p class="text-sm text-slate-500 mt-1">Paste from Excel (tab-separated) or paste label:value blocks. You will get a preview before saving.</p>
        </div>
        <button id="wb-paste-close" class="text-slate-400 hover:text-slate-600"><i class="fas fa-times"></i></button>
      </div>
      <div class="space-y-3">
        <div class="text-xs text-slate-500">Active system: <span class="font-mono">${escapeHtml(window.poamWorkbookState.activeSystemId)}</span></div>
        <textarea id="wb-paste-text" class="w-full h-64 px-3 py-2 border border-slate-200 rounded-lg font-mono text-xs" placeholder="Paste table (Ctrl/Cmd+C from Excel) or label:value text here..."></textarea>
      </div>
      <div class="flex justify-end gap-3 mt-6">
        <button id="wb-paste-cancel" class="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300">Cancel</button>
        <button id="wb-paste-import" class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Preview</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  const close = () => modal.remove();
  modal.querySelector('#wb-paste-close')?.addEventListener('click', close);
  modal.querySelector('#wb-paste-cancel')?.addEventListener('click', close);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) close();
  });

  modal.querySelector('#wb-paste-import')?.addEventListener('click', async () => {
    try {
      await poamWorkbookEnsureDbReady();
      const systemId = window.poamWorkbookState.activeSystemId || 'default';
      const text = String(modal.querySelector('#wb-paste-text')?.value || '').trim();
      if (!text) throw new Error('Nothing to import');

      const expectedCols = (window.POAM_WORKBOOK_COLUMNS || []).length;
      const parsed = poamWorkbookParseClipboardToWorkbookRows(text, expectedCols);
      poamWorkbookOpenPastePreviewModal({ systemId, parsed, onCommit: async () => {
        const result = await poamWorkbookCommitParsedRows(systemId, parsed);
        await renderWorkbookSidebarSystems();
        await renderWorkbookOverview();
        if (window.poamWorkbookState.activeTab === 'system') {
          await renderWorkbookSystemTable(window.poamWorkbookState.activeSystemId);
        }
        const extra = parsed?.diagnostics?.unmappedHeaders?.length
          ? ` (Ignored columns: ${parsed.diagnostics.unmappedHeaders.slice(0, 5).map(h => h.header).join(', ')}${parsed.diagnostics.unmappedHeaders.length > 5 ? ', …' : ''})`
          : '';
        showUpdateFeedback(result.updated > 0 ? `Imported ${result.saved} new, updated ${result.updated}${extra}` : `Imported ${result.saved}${extra}`, 'success');
        close();
      }});
    } catch (e) {
      console.error(e);
      showUpdateFeedback(`Paste preview failed: ${e.message}`, 'error');
    }
  });
}

function poamWorkbookNormalizeHeader(h) {
  return String(h || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n/g, ' ')
    .replace(/"/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function poamWorkbookHeaderAliases() {
  const internal = window.POAM_WORKBOOK_INTERNAL_FIELDS?.assetsImpacted;
  return new Map([
    ['item number', 'Item number'],
    ['poam id', 'Item number'],
    ['poam number', 'Item number'],
    ['id', 'Item number'],
    ['vulnerability name', 'Vulnerability Name'],
    ['vulnerability description', 'Vulnerability Description'],
    ['detection date', 'Detection Date'],
    ['impacted security controls', 'Impacted Security Controls'],
    ['office/org', 'Office/Org'],
    ['office', 'Office/Org'],
    ['org', 'Office/Org'],
    ['poc name', 'POC Name'],
    ['identifying detecting source', 'Identifying Detecting Source'],
    ['identifying/detecting source', 'Identifying Detecting Source'],
    ['detecting source', 'Identifying Detecting Source'],
    ['mitigations', 'Mitigations'],
    ['severity value', 'Severity Value'],
    ['severity', 'Severity Value'],
    ['resources required', 'Resources Required'],
    ['scheduled completion date', 'Scheduled Completion Date'],
    ['milestone with completion dates', 'Milestone with Completion Dates'],
    ['milestone changes', 'Milestone Changes'],
    ['affected components/urls', 'Affected Components/URLs'],
    ['affected components/urls ', 'Affected Components/URLs'],
    ['affected components urls', 'Affected Components/URLs'],
    ['affected components', 'Affected Components/URLs'],
    ['urls', 'Affected Components/URLs'],
    ['status', 'Status'],
    ['comments', 'Comments'],
    ['assets impacted', internal]
  ]);
}

function poamWorkbookReconstructRows(text, expectedCols) {
  const lines = String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n');

  const rows = [];
  const minColsForRowBoundary = Math.max(4, Math.min(8, expectedCols));

  const countCols = (s) => String(s || '').split('\t').length;
  const looksLikeNewRow = (line) => {
    const c = countCols(line);
    if (c < minColsForRowBoundary) return false;
    const first = String(line || '').split('\t')[0] || '';
    return String(first).trim() !== '';
  };

  let buffer = '';
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim() && !buffer) continue;

    if (!buffer) {
      buffer = line;
    } else {
      buffer = buffer + '\n' + line;
    }

    const cols = countCols(buffer);
    if (cols >= expectedCols) {
      rows.push(buffer.split('\t'));
      buffer = '';
      continue;
    }

    // If we have "enough" columns already, and the NEXT line looks like a new row,
    // treat this as a completed row even if trailing blank columns were omitted.
    const nextLine = i + 1 < lines.length ? lines[i + 1] : '';
    if (cols >= minColsForRowBoundary && looksLikeNewRow(nextLine)) {
      rows.push(buffer.split('\t'));
      buffer = '';
    }
  }

  if (buffer.trim()) rows.push(buffer.split('\t'));
  return rows;
}

function poamWorkbookParseClipboardToWorkbookRows(text, expectedCols) {
  // If it looks like a tabular paste (Excel/Sheets), parse as TSV.
  if (String(text).includes('\t')) {
    const rows = poamWorkbookReconstructRows(text, expectedCols);
    return poamWorkbookMapTabularRows(rows, expectedCols);
  }

  // Fallback to label:value parsing
  const legacy = poamWorkbookParsePastedPOAMs(text);
  return {
    detectedHeader: false,
    expectedCols,
    header: null,
    rowsReconstructed: legacy.items.length,
    accepted: legacy.items.map(it => ({ obj: it, source: 'label' })),
    rejected: []
  };
}

function poamWorkbookMapTabularRows(rows, expectedCols) {
  const required = window.POAM_WORKBOOK_COLUMNS || [];
  const aliases = poamWorkbookHeaderAliases();

  const looksLikeHeader = (row) => {
    const normalized = row.map(c => poamWorkbookNormalizeHeader(c));
    const hits = normalized.filter(h => aliases.has(h) || required.some(r => poamWorkbookNormalizeHeader(r) === h)).length;
    const firstCellNumeric = /^\s*\d+\s*$/.test(String(row[0] || ''));
    return hits >= 4 && !firstCellNumeric;
  };

  const headerRow = rows.length > 0 && looksLikeHeader(rows[0]) ? rows[0] : null;
  const startIndex = headerRow ? 1 : 0;

  let columnMap = null; // index -> canonical
  const diagnostics = {
    unmappedHeaders: [],
    missingCanonical: []
  };
  if (headerRow) {
    columnMap = headerRow.map(h => {
      const norm = poamWorkbookNormalizeHeader(h);
      return aliases.get(norm) || required.find(r => poamWorkbookNormalizeHeader(r) === norm) || null;
    });

    diagnostics.unmappedHeaders = headerRow
      .map((h, idx) => ({ idx, header: String(h || '').trim(), mappedTo: columnMap[idx] }))
      .filter(x => x.header && !x.mappedTo);

    const mappedCanon = new Set(columnMap.filter(Boolean));
    diagnostics.missingCanonical = required.filter(c => !mappedCanon.has(c));
  } else {
    // No header: assume canonical column order
    columnMap = required.slice();
  }

  const accepted = [];
  const rejected = [];

  for (let i = startIndex; i < rows.length; i++) {
    const r = rows[i];

    if (!Array.isArray(r)) {
      rejected.push({ index: i + 1, reason: `Row parse failed` });
      continue;
    }

    // Excel sometimes omits trailing blank columns in TSV clipboard.
    // Pad to expected length so mapping still works.
    if (r.length < expectedCols) {
      while (r.length < expectedCols) r.push('');
    }

    if (r.length > expectedCols) {
      rejected.push({ index: i + 1, reason: `Too many columns (expected ${expectedCols}, got ${r.length})` });
      continue;
    }

    const obj = {};
    for (let c = 0; c < expectedCols; c++) {
      const key = columnMap[c];
      if (!key) continue;
      obj[key] = String(r[c] ?? '').trim();
    }

    // If no header and first cell is blank, skip
    const any = Object.values(obj).some(v => String(v || '').trim() !== '');
    if (!any) continue;

    accepted.push({ obj, source: headerRow ? 'tsv-with-header' : 'tsv-no-header' });
  }

  return {
    detectedHeader: !!headerRow,
    expectedCols,
    header: headerRow,
    rowsReconstructed: rows.length,
    accepted,
    rejected,
    diagnostics
  };
}

function poamWorkbookOpenPastePreviewModal({ systemId, parsed, onCommit }) {
  const preview = document.createElement('div');
  preview.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';

  const sampleRows = parsed.accepted.slice(0, 5).map(x => x.obj);
  const cols = window.POAM_WORKBOOK_COLUMNS || [];

  const unmapped = parsed?.diagnostics?.unmappedHeaders || [];
  const missingCanon = parsed?.diagnostics?.missingCanonical || [];

  preview.innerHTML = `
    <div class="bg-white rounded-2xl p-6 max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
      <div class="flex items-start justify-between gap-4 mb-4">
        <div>
          <h2 class="text-lg font-bold text-slate-900">Paste Preview</h2>
          <div class="text-sm text-slate-500 mt-1">
            Detected header: <span class="font-semibold">${parsed.detectedHeader ? 'Yes' : 'No'}</span> | 
            Reconstructed rows: <span class="font-semibold">${parsed.rowsReconstructed}</span> | 
            Accepted: <span class="font-semibold">${parsed.accepted.length}</span> | 
            Rejected: <span class="font-semibold">${parsed.rejected.length}</span>
          </div>
        </div>
        <button id="wb-preview-close" class="text-slate-400 hover:text-slate-600"><i class="fas fa-times"></i></button>
      </div>
      <div class="flex-1 overflow-y-auto">
        ${unmapped.length ? `
          <div class="mb-4 bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-900">
            <div class="font-bold mb-1">Unmapped header columns (ignored)</div>
            <div class="text-xs">${unmapped.slice(0, 12).map(h => escapeHtml(h.header)).join(', ')}${unmapped.length > 12 ? ', …' : ''}</div>
          </div>
        ` : ''}
        ${missingCanon.length ? `
          <div class="mb-4 bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm text-slate-700">
            <div class="font-bold mb-1">Missing workbook columns (will be blank)</div>
            <div class="text-xs">${missingCanon.slice(0, 12).map(c => escapeHtml(c)).join(', ')}${missingCanon.length > 12 ? ', …' : ''}</div>
          </div>
        ` : ''}
        ${parsed.rejected.length ? `
          <div class="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">
            <div class="font-bold mb-1">Rejected rows</div>
            <div class="text-xs">${parsed.rejected.slice(0, 10).map(r => `Row ${r.index}: ${escapeHtml(r.reason)}`).join('<br>')}${parsed.rejected.length > 10 ? '<br>…' : ''}</div>
          </div>
        ` : ''}
        <div class="border border-slate-200 rounded-xl overflow-hidden">
          <div class="overflow-x-auto">
            <table class="min-w-full text-xs">
              <thead class="bg-slate-50 border-b border-slate-200">
                <tr>
                  ${cols.map(c => `<th class="px-2 py-2 text-left font-semibold text-slate-600">${escapeHtml(c)}</th>`).join('')}
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                ${sampleRows.map(row => `
                  <tr>
                    ${cols.map(c => `<td class="px-2 py-2 text-slate-700">${escapeHtml(String(row[c] ?? '').slice(0, 80))}</td>`).join('')}
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <div class="flex justify-end gap-3 mt-4">
        <button id="wb-preview-cancel" class="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300">Cancel</button>
        <button id="wb-preview-commit" class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Commit</button>
      </div>
    </div>
  `;
  document.body.appendChild(preview);

  const close = () => preview.remove();
  preview.querySelector('#wb-preview-close')?.addEventListener('click', close);
  preview.querySelector('#wb-preview-cancel')?.addEventListener('click', close);
  preview.addEventListener('click', (e) => {
    if (e.target === preview) close();
  });

  preview.querySelector('#wb-preview-commit')?.addEventListener('click', async () => {
    try {
      if (typeof onCommit === 'function') await onCommit();
      close();
    } catch (e) {
      console.error(e);
      showUpdateFeedback(`Commit failed: ${e.message}`, 'error');
    }
  });
}

async function poamWorkbookCommitParsedRows(systemId, parsed) {
  let saved = 0;
  let updated = 0;

  for (const entry of parsed.accepted) {
    const item = entry.obj || {};
    const data = {
      ...Object.fromEntries((window.POAM_WORKBOOK_COLUMNS || []).map(c => [c, item[c] ?? ''])),
      [window.POAM_WORKBOOK_INTERNAL_FIELDS.assetsImpacted]: item[window.POAM_WORKBOOK_INTERNAL_FIELDS.assetsImpacted] || ''
    };

    // Normalize multiline header variants
    if (!data['Identifying Detecting Source'] && item['Identifying Detecting Source\n']) {
      data['Identifying Detecting Source'] = item['Identifying Detecting Source\n'];
    }
    if (!data['Affected Components/URLs'] && (item['Affected Components/\nURLs'] || item['Affected Components/ URLs'])) {
      data['Affected Components/URLs'] = item['Affected Components/\nURLs'] || item['Affected Components/ URLs'];
    }

    // Assets impacted extraction
    const rawAffected = String(data['Affected Components/URLs'] || '');
    const extracted = poamWorkbookExtractAssetsImpacted(rawAffected);
    data['Affected Components/URLs'] = extracted.affectedComponents;
    if (!data[window.POAM_WORKBOOK_INTERNAL_FIELDS.assetsImpacted]) {
      data[window.POAM_WORKBOOK_INTERNAL_FIELDS.assetsImpacted] = extracted.assetsImpacted;
    }

    // Determine numeric item number if present
    const n = parseInt(String(data['Item number'] || '').replace(/[^0-9]/g, ''), 10);
    if (Number.isFinite(n) && n > 0 && typeof window.poamWorkbookDB.upsertItemBySystemAndItemNumber === 'function') {
      const res = await window.poamWorkbookDB.upsertItemBySystemAndItemNumber(systemId, n, data);
      if (res.created) saved++; else updated++;
      continue;
    }

    // Auto-number if missing
    const nextNum = await window.poamWorkbookDB.getNextItemNumber(systemId);
    data['Item number'] = await poamWorkbookFormatItemNumber(systemId, nextNum);
    await window.poamWorkbookDB.saveItem({
      id: `WB-${systemId}-${Date.now()}-${saved}-${updated}`,
      systemId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...data
    });
    saved++;
  }

  window.poamWorkbookNotifyMutation();
  return { saved, updated };
}

function poamWorkbookParsePastedPOAMs(text) {
  const normalizeKey = (k) => String(k || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^a-z0-9/ ]/g, '');

  const aliases = new Map([
    // Item number / POAM ID
    ['item number', 'Item number'],
    ['item', 'Item number'],
    ['poam id', 'Item number'],
    ['poam', 'Item number'],
    ['poam number', 'Item number'],
    // Core fields
    ['vulnerability name', 'Vulnerability Name'],
    ['vulnerability', 'Vulnerability Name'],
    ['vulnerability description', 'Vulnerability Description'],
    ['description', 'Vulnerability Description'],
    ['detection date', 'Detection Date'],
    ['impacted security controls', 'Impacted Security Controls'],
    ['security controls', 'Impacted Security Controls'],
    ['office/org', 'Office/Org'],
    ['office', 'Office/Org'],
    ['org', 'Office/Org'],
    ['poc name', 'POC Name'],
    ['poc', 'POC Name'],
    ['identifying detecting source', 'Identifying Detecting Source'],
    ['detecting source', 'Identifying Detecting Source'],
    ['source', 'Identifying Detecting Source'],
    ['mitigations', 'Mitigations'],
    ['severity value', 'Severity Value'],
    ['severity', 'Severity Value'],
    ['resources required', 'Resources Required'],
    ['scheduled completion date', 'Scheduled Completion Date'],
    ['completion date', 'Scheduled Completion Date'],
    ['milestone with completion dates', 'Milestone with Completion Dates'],
    ['milestones', 'Milestone with Completion Dates'],
    ['milestone changes', 'Milestone Changes'],
    ['affected components/urls', 'Affected Components/URLs'],
    ['affected components', 'Affected Components/URLs'],
    ['urls', 'Affected Components/URLs'],
    ['status', 'Status'],
    ['comments', 'Comments'],
    // Internal
    ['assets impacted', window.POAM_WORKBOOK_INTERNAL_FIELDS.assetsImpacted]
  ]);

  const isStartOfItem = (line) => {
    const l = String(line || '');
    return /^\s*(item\s*number|poam\s*id)\s*[:#-]/i.test(l);
  };

  const lines = String(text || '').replace(/\r\n/g, '\n').split('\n');
  const blocks = [];
  let current = [];
  for (const line of lines) {
    if (isStartOfItem(line) && current.length > 0) {
      blocks.push(current);
      current = [line];
      continue;
    }
    // Split on hard blank line if we already have content and next lines start a new section
    if (String(line).trim() === '' && current.length > 0) {
      current.push('');
      continue;
    }
    current.push(line);
  }
  if (current.length > 0) blocks.push(current);

  const items = [];
  for (const block of blocks) {
    const item = {};
    let currentKey = null;

    for (const rawLine of block) {
      const line = String(rawLine || '');
      const m = line.match(/^\s*([^:]{2,80})\s*:\s*(.*)$/);
      if (m) {
        const label = normalizeKey(m[1]);
        const mapped = aliases.get(label);
        if (mapped) {
          currentKey = mapped;
          const val = m[2] || '';
          item[currentKey] = (item[currentKey] ? String(item[currentKey]) + '\n' : '') + val;
          continue;
        }
      }

      // Continuation lines
      if (currentKey) {
        const trimmed = line.trimEnd();
        if (trimmed !== '') {
          item[currentKey] = (item[currentKey] ? String(item[currentKey]) + '\n' : '') + trimmed;
        }
      }
    }

    // If nothing mapped, skip
    const hasAny = Object.keys(item).length > 0;
    if (!hasAny) continue;

    // Normalize Item number if it looks like WB-xx or POAM-xx
    if (item['Item number']) {
      const n = parseInt(String(item['Item number']).replace(/[^0-9]/g, ''), 10);
      if (Number.isFinite(n) && n > 0) item['Item number'] = n;
    }

    // Normalize dates if present
    const normalizeDate = (v) => {
      if (!v) return '';
      const d = new Date(v);
      if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
      return String(v).trim();
    };
    if (item['Detection Date']) item['Detection Date'] = normalizeDate(item['Detection Date']);
    if (item['Scheduled Completion Date']) item['Scheduled Completion Date'] = normalizeDate(item['Scheduled Completion Date']);

    items.push(item);
  }

  return { items };
}

async function poamWorkbookNavigateToSystem(systemId) {
  try {
    await poamWorkbookEnsureDbReady();
    window.poamWorkbookState.activeSystemId = systemId;
    window.poamWorkbookState.pendingOpenSystemId = systemId;
    showModule('security-control-monitoring');
  } catch (e) {
    console.error(e);
  }
}

async function poamWorkbookOpenSystem(systemId) {
  window.poamWorkbookState.activeSystemId = systemId;
  poamWorkbookClearSelection();
  await renderWorkbookSidebarSystems();
  await renderWorkbookSystemTable(systemId);

  const sys = await window.poamWorkbookDB.getSystemById(systemId);
  const sysName = document.getElementById('poam-workbook-active-system-name');
  if (sysName) sysName.textContent = sys?.name || systemId;

  const overview = document.getElementById('poam-workbook-view-overview');
  const system = document.getElementById('poam-workbook-view-system');
  if (overview) overview.classList.add('hidden');
  if (system) system.classList.remove('hidden');
  window.poamWorkbookState.activeTab = 'system';
}

async function renderWorkbookOverview() {
  const items = await window.poamWorkbookDB.getAllItems();
  const analytics = computeWorkbookAnalytics(items, 'overview');

  const total = document.getElementById('poam-workbook-metric-total');
  if (total) total.textContent = analytics.total;

  const overdue = document.getElementById('poam-workbook-metric-overdue');
  if (overdue) overdue.textContent = analytics.overdue;

  const missingPoc = document.getElementById('poam-workbook-metric-missing-poc');
  if (missingPoc) missingPoc.textContent = analytics.missingPoc;

  const byStatus = document.getElementById('poam-workbook-metric-status');
  if (byStatus) byStatus.innerHTML = renderMiniBreakdown(analytics.byStatus);

  const bySeverity = document.getElementById('poam-workbook-metric-severity');
  if (bySeverity) bySeverity.innerHTML = renderMiniBreakdown(analytics.bySeverity);

  const topVulns = document.getElementById('poam-workbook-top-vulns');
  if (topVulns) topVulns.innerHTML = renderTopList(analytics.topVulns);

  const controlsDist = document.getElementById('poam-workbook-controls-dist');
  if (controlsDist) controlsDist.innerHTML = renderTopList(analytics.controlsDist);
}

async function renderWorkbookSystemTable(systemId) {
  const items = await window.poamWorkbookDB.getItemsBySystem(systemId);
  const analytics = computeWorkbookAnalytics(items, `system:${systemId}`);

  const sysTotal = document.getElementById('poam-workbook-system-total');
  if (sysTotal) sysTotal.textContent = analytics.total;

  const tableBody = document.getElementById('poam-workbook-table-body');
  if (!tableBody) return;

  // Sync select-all checkbox state
  const selectAll = document.getElementById('poam-workbook-select-all');
  if (selectAll) {
    const ids = items.map(i => i.id);
    const selected = window.poamWorkbookState.selectedItemIds;
    const allSelected = ids.length > 0 && ids.every(id => selected.has(id));
    const anySelected = ids.some(id => selected.has(id));
    selectAll.checked = allSelected;
    selectAll.indeterminate = anySelected && !allSelected;
  }

  const pocs = (await window.poamWorkbookDB.getLookup('pocs')) || [];
  const statuses = (await window.poamWorkbookDB.getLookup('statusValues')) || window.POAM_WORKBOOK_ENUMS.statusValues;
  const severities = (await window.poamWorkbookDB.getLookup('severityValues')) || window.POAM_WORKBOOK_ENUMS.severityValues;
  const sources = (await window.poamWorkbookDB.getLookup('detectingSources')) || window.POAM_WORKBOOK_ENUMS.detectingSources;

  tableBody.innerHTML = items
    .sort((a, b) => {
      const an = parseInt(String(a['Item number'] || 0), 10) || 0;
      const bn = parseInt(String(b['Item number'] || 0), 10) || 0;
      return an - bn;
    })
    .map(item => {
      const id = item.id;
      const checked = window.poamWorkbookState.selectedItemIds.has(id);
      return `
      <tr class="border-b border-slate-100 hover:bg-indigo-50 transition-colors cursor-pointer" onclick="poamWorkbookOpenItemDetails('${id}')">
        <td class="px-3 py-2" onclick="event.stopPropagation()">
          <input type="checkbox" ${checked ? 'checked' : ''} onchange="poamWorkbookToggleRowSelection('${id}', this.checked)" />
        </td>
        <td class="px-3 py-2 text-xs text-slate-700 font-mono">${escapeHtml(item['Item number'] || '')}</td>
        <td class="px-3 py-2 text-sm text-slate-900">${escapeHtml(item['Vulnerability Name'] || '')}</td>
        <td class="px-3 py-2" onclick="event.stopPropagation()">
          ${renderInlineSelect(id, 'POC Name', item['POC Name'], pocs)}
        </td>
        <td class="px-3 py-2" onclick="event.stopPropagation()">
          ${renderInlineSelect(id, 'Identifying Detecting Source', item['Identifying Detecting Source'], sources)}
        </td>
        <td class="px-3 py-2" onclick="event.stopPropagation()">
          ${renderInlineSelect(id, 'Severity Value', item['Severity Value'], severities)}
        </td>
        <td class="px-3 py-2" onclick="event.stopPropagation()">
          ${renderInlineSelect(id, 'Status', item['Status'], statuses)}
        </td>
        <td class="px-3 py-2" onclick="event.stopPropagation()">
          ${renderInlineDate(id, 'Scheduled Completion Date', item['Scheduled Completion Date'])}
        </td>
      </tr>
      `;
    })
    .join('');

  poamWorkbookUpdateBulkActionBar();
}

function poamWorkbookToggleRowSelection(id, checked) {
  if (!id) return;
  if (checked) window.poamWorkbookState.selectedItemIds.add(id);
  else window.poamWorkbookState.selectedItemIds.delete(id);
  poamWorkbookUpdateBulkActionBar();
}

async function poamWorkbookToggleSelectAll(checked) {
  const systemId = window.poamWorkbookState.activeSystemId;
  const items = await window.poamWorkbookDB.getItemsBySystem(systemId);
  if (checked) {
    items.forEach(i => window.poamWorkbookState.selectedItemIds.add(i.id));
  } else {
    items.forEach(i => window.poamWorkbookState.selectedItemIds.delete(i.id));
  }
  await renderWorkbookSystemTable(systemId);
}

function poamWorkbookClearSelection() {
  window.poamWorkbookState.selectedItemIds.clear();
  poamWorkbookUpdateBulkActionBar();
  const selectAll = document.getElementById('poam-workbook-select-all');
  if (selectAll) {
    selectAll.checked = false;
    selectAll.indeterminate = false;
  }
}

function poamWorkbookUpdateBulkActionBar() {
  const bar = document.getElementById('poam-workbook-bulk-actions');
  const countEl = document.getElementById('poam-workbook-selected-count');
  if (!bar || !countEl) return;
  const count = window.poamWorkbookState.selectedItemIds.size;
  countEl.textContent = String(count);
  if (count > 0) bar.classList.remove('hidden');
  else bar.classList.add('hidden');
}

async function poamWorkbookBulkDeleteSelected() {
  const ids = Array.from(window.poamWorkbookState.selectedItemIds);
  if (ids.length === 0) return;
  if (!confirm(`Delete ${ids.length} workbook POAM(s)? This cannot be undone.`)) return;

  try {
    for (const id of ids) {
      await window.poamWorkbookDB.deleteItem(id);
    }
    window.poamWorkbookNotifyMutation();
    poamWorkbookClearSelection();
    await renderWorkbookSystemTable(window.poamWorkbookState.activeSystemId);
    await renderWorkbookOverview();
    showUpdateFeedback('Deleted selected workbook POAMs', 'success');
  } catch (e) {
    console.error(e);
    showUpdateFeedback(`Bulk delete failed: ${e.message}`, 'error');
  }
}

function poamWorkbookBulkUpdateStatus() {
  poamWorkbookOpenBulkEditModal({ mode: 'status' });
}

function poamWorkbookOpenBulkEditModal({ mode } = {}) {
  const ids = Array.from(window.poamWorkbookState.selectedItemIds);
  if (ids.length === 0) return;

  const statuses = window.POAM_WORKBOOK_ENUMS?.statusValues || [];
  const severities = window.POAM_WORKBOOK_ENUMS?.severityValues || [];

  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4';
  modal.innerHTML = `
    <div class="bg-white rounded-2xl shadow-xl max-w-xl w-full p-6">
      <div class="flex items-start justify-between gap-4 mb-4">
        <div>
          <h2 class="text-lg font-bold text-slate-900">Bulk Update</h2>
          <p class="text-sm text-slate-500">Updating <span class="font-bold">${ids.length}</span> workbook POAM(s). Leave fields blank to keep existing values.</p>
        </div>
        <button id="wb-bulk-close" class="text-slate-400 hover:text-slate-600"><i class="fas fa-times"></i></button>
      </div>
      <div class="space-y-4">
        <div ${mode === 'status' ? '' : ''}>
          <label class="block text-sm font-semibold text-slate-700 mb-2">Status</label>
          <select id="wb-bulk-status" class="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white">
            <option value="">(no change)</option>
            ${statuses.map(s => `<option value="${escapeAttr(s)}">${escapeHtml(s)}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="block text-sm font-semibold text-slate-700 mb-2">Severity Value</label>
          <select id="wb-bulk-severity" class="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white">
            <option value="">(no change)</option>
            ${severities.map(s => `<option value="${escapeAttr(s)}">${escapeHtml(s)}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="block text-sm font-semibold text-slate-700 mb-2">POC Name</label>
          <input id="wb-bulk-poc" type="text" class="w-full px-3 py-2 border border-slate-200 rounded-lg" placeholder="(no change)">
        </div>
        <div>
          <label class="block text-sm font-semibold text-slate-700 mb-2">Scheduled Completion Date</label>
          <input id="wb-bulk-due" type="date" class="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white">
          <div class="text-xs text-slate-500 mt-1">(leave blank for no change)</div>
        </div>
      </div>
      <div class="flex justify-end gap-3 mt-6">
        <button id="wb-bulk-cancel" class="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300">Cancel</button>
        <button id="wb-bulk-apply" class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Apply</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  const close = () => modal.remove();
  modal.querySelector('#wb-bulk-close')?.addEventListener('click', close);
  modal.querySelector('#wb-bulk-cancel')?.addEventListener('click', close);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) close();
  });

  modal.querySelector('#wb-bulk-apply')?.addEventListener('click', async () => {
    try {
      const status = String(modal.querySelector('#wb-bulk-status')?.value || '').trim();
      const severity = String(modal.querySelector('#wb-bulk-severity')?.value || '').trim();
      const poc = String(modal.querySelector('#wb-bulk-poc')?.value || '').trim();
      const due = String(modal.querySelector('#wb-bulk-due')?.value || '').trim();

      for (const id of ids) {
        const item = await window.poamWorkbookDB.getItem(id);
        if (!item) continue;
        if (status) item['Status'] = status;
        if (severity) item['Severity Value'] = severity;
        if (poc) item['POC Name'] = poc;
        if (due) item['Scheduled Completion Date'] = due;
        item.updatedAt = new Date().toISOString();
        await window.poamWorkbookDB.saveItem(item);
      }

      window.poamWorkbookNotifyMutation();
      await renderWorkbookSystemTable(window.poamWorkbookState.activeSystemId);
      await renderWorkbookOverview();
      showUpdateFeedback('Bulk update applied', 'success');
      close();
    } catch (e) {
      console.error(e);
      showUpdateFeedback(`Bulk update failed: ${e.message}`, 'error');
    }
  });
}

function renderInlineSelect(id, field, value, options) {
  const safeVal = value == null ? '' : String(value);
  return `
    <select class="w-full text-xs border border-slate-200 rounded px-2 py-1 bg-white" onchange="poamWorkbookInlineUpdate('${id}', '${escapeAttr(field)}', this.value)">
      ${options.map(o => {
        const v = String(o);
        return `<option value="${escapeAttr(v)}" ${v === safeVal ? 'selected' : ''}>${escapeHtml(v)}</option>`;
      }).join('')}
    </select>
  `;
}

function renderInlineDate(id, field, value) {
  const safe = value ? String(value).split('T')[0] : '';
  return `<input type="date" value="${escapeAttr(safe)}" class="w-full text-xs border border-slate-200 rounded px-2 py-1 bg-white" onchange="poamWorkbookInlineUpdate('${id}', '${escapeAttr(field)}', this.value)">`;
}

async function poamWorkbookInlineUpdate(id, field, value) {
  const item = await window.poamWorkbookDB.getItem(id);
  if (!item) return;

  // Validate enums for known dropdown fields
  const enums = window.POAM_WORKBOOK_ENUMS;
  if (field === 'Severity Value' && value && !enums.severityValues.includes(value)) return;
  if (field === 'Status' && value && !enums.statusValues.includes(value)) return;
  if (field === 'Identifying Detecting Source' && value && !enums.detectingSources.includes(value)) return;

  item[field] = value;
  item.updatedAt = new Date().toISOString();
  await window.poamWorkbookDB.saveItem(item);
  window.poamWorkbookNotifyMutation();

  // Refresh small metrics in system view
  await renderWorkbookSystemTable(item.systemId);
}

async function poamWorkbookCreateItem() {
  const systemId = window.poamWorkbookState.activeSystemId;
  const nextNum = await window.poamWorkbookDB.getNextItemNumber(systemId);

  const now = new Date().toISOString();
  const newItem = {
    id: `WB-${systemId}-${Date.now()}`,
    systemId,
    createdAt: now,
    updatedAt: now,
    ...Object.fromEntries((window.POAM_WORKBOOK_COLUMNS || []).map(c => [c, ''])),
    [window.POAM_WORKBOOK_INTERNAL_FIELDS.assetsImpacted]: ''
  };

  newItem['Item number'] = await poamWorkbookFormatItemNumber(systemId, nextNum);
  newItem['Status'] = 'Open';
  newItem['Severity Value'] = 'Medium';
  newItem['POC Name'] = 'Unassigned';
  newItem['Identifying Detecting Source'] = 'Continuous Monitoring';

  await window.poamWorkbookDB.saveItem(newItem);
  window.poamWorkbookNotifyMutation();

  await renderWorkbookSystemTable(systemId);
  await renderWorkbookOverview();
}

async function poamWorkbookHandleImportInput(evt) {
  const input = evt.target;
  const file = input.files && input.files[0];
  if (!file) return;

  const systemId = window.poamWorkbookState.activeSystemId || 'default';
  try {
    const result = await poamWorkbookImportXlsx(file, systemId);
    const updated = result.updated || 0;
    const msg = updated > 0
      ? `Imported ${result.saved} new workbook POAMs, updated ${updated}`
      : `Imported ${result.saved} workbook POAMs`;
    showUpdateFeedback(msg, 'success');
    await renderWorkbookSidebarSystems();
    await renderWorkbookOverview();
    if (window.poamWorkbookState.activeTab === 'system') {
      await renderWorkbookSystemTable(window.poamWorkbookState.activeSystemId);
    }
  } catch (e) {
    console.error(e);
    showUpdateFeedback(`Import failed: ${e.message}`, 'error');
    // If the message is long (header diagnostics), show a modal so user can see full details.
    const msg = String(e?.message || '');
    if (msg.length > 160 || msg.includes('First headers:')) {
      poamWorkbookOpenImportErrorModal(msg);
    }
  } finally {
    input.value = '';
  }
}

function poamWorkbookOpenImportErrorModal(message) {
  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';
  modal.innerHTML = `
    <div class="bg-white rounded-2xl p-6 max-w-2xl w-full">
      <div class="flex items-start justify-between gap-4 mb-4">
        <div>
          <h2 class="text-lg font-bold text-slate-900">Import Error Details</h2>
          <p class="text-sm text-slate-500 mt-1">Copy/paste this into chat if you want me to add more header aliases.</p>
        </div>
        <button id="wb-importerr-close" class="text-slate-400 hover:text-slate-600"><i class="fas fa-times"></i></button>
      </div>
      <pre class="w-full max-h-[55vh] overflow-auto text-xs bg-slate-50 border border-slate-200 rounded-lg p-3 whitespace-pre-wrap">${escapeHtml(String(message || ''))}</pre>
      <div class="flex justify-end gap-3 mt-5">
        <button id="wb-importerr-ok" class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Close</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  const close = () => modal.remove();
  modal.querySelector('#wb-importerr-close')?.addEventListener('click', close);
  modal.querySelector('#wb-importerr-ok')?.addEventListener('click', close);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) close();
  });
}

async function poamWorkbookExportAll() {
  try {
    await poamWorkbookExportXlsx({ systemId: null });
    showUpdateFeedback('Export started', 'success');
  } catch (e) {
    console.error(e);
    showUpdateFeedback(`Export failed: ${e.message}`, 'error');
  }
}

async function poamWorkbookExportSystem() {
  const systemId = window.poamWorkbookState.activeSystemId;
  try {
    await poamWorkbookExportXlsx({ systemId });
    showUpdateFeedback('Export started', 'success');
  } catch (e) {
    console.error(e);
    showUpdateFeedback(`Export failed: ${e.message}`, 'error');
  }
}

function poamWorkbookOpenAddSystemModal() {
  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';
  modal.innerHTML = `
    <div class="bg-white rounded-2xl p-6 max-w-lg w-full">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-lg font-bold text-slate-900">Add System</h2>
        <button id="wb-addsys-close" class="text-slate-400 hover:text-slate-600"><i class="fas fa-times"></i></button>
      </div>
      <div class="space-y-4">
        <div>
          <label class="block text-sm font-semibold text-slate-700 mb-2">System Name</label>
          <input id="wb-addsys-name" type="text" class="w-full px-3 py-2 border border-slate-200 rounded-lg" placeholder="e.g., Enclave Echo">
        </div>
        <div>
          <label class="block text-sm font-semibold text-slate-700 mb-2">Description</label>
          <input id="wb-addsys-desc" type="text" class="w-full px-3 py-2 border border-slate-200 rounded-lg" placeholder="Security Control Monitoring system">
        </div>
      </div>
      <div class="flex justify-end gap-3 mt-6">
        <button id="wb-addsys-cancel" class="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300">Cancel</button>
        <button id="wb-addsys-save" class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Save</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  const close = () => modal.remove();
  modal.querySelector('#wb-addsys-close')?.addEventListener('click', close);
  modal.querySelector('#wb-addsys-cancel')?.addEventListener('click', close);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) close();
  });

  modal.querySelector('#wb-addsys-save')?.addEventListener('click', async () => {
    try {
      const name = String(modal.querySelector('#wb-addsys-name')?.value || '').trim();
      const description = String(modal.querySelector('#wb-addsys-desc')?.value || '').trim();
      if (!name) throw new Error('System Name is required');

      const id = `sys-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}-${Date.now()}`;
      await window.poamWorkbookDB.saveSystem({ id, name, description });
      window.poamWorkbookNotifyMutation();
      await renderWorkbookSidebarSystems();
      showUpdateFeedback('System added', 'success');
      close();
    } catch (e) {
      console.error(e);
      showUpdateFeedback(`Add system failed: ${e.message}`, 'error');
    }
  });
}

async function poamWorkbookOpenItemDetails(id) {
  const item = await window.poamWorkbookDB.getItem(id);
  if (!item) return;

  const pocs = (await window.poamWorkbookDB.getLookup('pocs')) || [];
  const controls = (await window.poamWorkbookDB.getLookup('securityControls')) || { families: [], controls: [] };
  const resourcesRequired = (await window.poamWorkbookDB.getLookup('resourcesRequired')) || [];

  const systems = await window.poamWorkbookDB.getSystems();

  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4';
  modal.innerHTML = `
    <div class="bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
      <div class="bg-slate-900 text-white px-6 py-3 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <span class="text-xs font-mono bg-slate-700 px-2 py-1 rounded">WB</span>
          <div class="text-sm font-semibold truncate">${escapeHtml(item['Vulnerability Name'] || 'Workbook POAM')}</div>
        </div>
        <div class="flex items-center gap-2">
          <button id="wb-save" class="text-xs font-semibold px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-700">Save</button>
          <button id="wb-cancel" class="text-slate-300 hover:text-white"><i class="fas fa-times"></i></button>
        </div>
      </div>

      <div class="p-6 overflow-y-auto">
        <div class="grid grid-cols-12 gap-6">
          <div class="col-span-12 lg:col-span-8 space-y-4">
            ${renderFieldText('Item number', item['Item number'], true)}
            ${renderFieldText('Vulnerability Name', item['Vulnerability Name'])}
            ${renderFieldTextarea('Vulnerability Description', item['Vulnerability Description'])}
            <div class="grid grid-cols-2 gap-4">
              ${renderFieldDate('Detection Date', item['Detection Date'])}
              ${renderFieldDate('Scheduled Completion Date', item['Scheduled Completion Date'])}
            </div>
            ${renderFieldTextarea('Impacted Security Controls', item['Impacted Security Controls'], false, 'wb-controls')}
            ${renderFieldText('Office/Org', item['Office/Org'])}
            ${renderFieldSelect('POC Name', item['POC Name'], pocs)}
            ${renderFieldSelect('Identifying Detecting Source', item['Identifying Detecting Source'], window.POAM_WORKBOOK_ENUMS.detectingSources)}
            ${renderFieldTextarea('Mitigations', item['Mitigations'])}
            <div class="grid grid-cols-2 gap-4">
              ${renderFieldSelect('Severity Value', item['Severity Value'], window.POAM_WORKBOOK_ENUMS.severityValues)}
              ${renderFieldSelect('Status', item['Status'], window.POAM_WORKBOOK_ENUMS.statusValues)}
            </div>
            ${resourcesRequired.length ? renderFieldSelect('Resources Required', item['Resources Required'], resourcesRequired) : renderFieldText('Resources Required', item['Resources Required'])}
            ${renderFieldTextarea('Milestone with Completion Dates', item['Milestone with Completion Dates'])}
            ${renderFieldTextarea('Milestone Changes', item['Milestone Changes'])}
            ${renderFieldTextarea('Affected Components/URLs', item['Affected Components/URLs'])}
            ${renderFieldTextarea('Comments', item['Comments'])}
          </div>

          <div class="col-span-12 lg:col-span-4 space-y-4">
            <div class="border border-slate-200 rounded-lg p-4 space-y-3">
              <div class="text-[11px] font-bold text-slate-500 uppercase tracking-wider">System</div>
              <label class="text-[10px] font-bold text-slate-500 uppercase">Assigned System</label>
              <select id="wb-systemId" class="w-full text-sm font-semibold text-slate-800 border border-slate-200 rounded px-3 py-2">
                ${systems.map(s => `<option value="${escapeAttr(s.id)}" ${s.id === item.systemId ? 'selected' : ''}>${escapeHtml(s.name)}</option>`).join('')}
              </select>
            </div>

            <div class="border border-slate-200 rounded-lg p-4 space-y-3">
              <div class="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Workbook Internal</div>
              ${renderFieldTextarea(window.POAM_WORKBOOK_INTERNAL_FIELDS.assetsImpacted, item[window.POAM_WORKBOOK_INTERNAL_FIELDS.assetsImpacted] || '', false, 'wb-assetsImpacted')}
              <div class="text-[10px] text-slate-500">Export mapping rule: Assets Impacted is exported inside "Affected Components/URLs" as a block starting with "Assets Impacted:".</div>
            </div>

            <div class="border border-slate-200 rounded-lg p-4 space-y-3">
              <div class="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Control Picker (helper)</div>
              <div class="text-xs text-slate-600">Families</div>
              <div class="flex flex-wrap gap-1">
                ${controls.families.map(f => `<button type="button" class="px-2 py-1 text-xs bg-slate-100 rounded" onclick="wbSelectControlFamily('${escapeAttr(f)}')">${escapeHtml(f)}</button>`).join('')}
              </div>
              <div class="text-xs text-slate-600 mt-2">Controls</div>
              <div class="flex items-center gap-2">
                <select id="wb-control-select" class="flex-1 text-xs border border-slate-200 rounded px-2 py-1 bg-white"></select>
                <button type="button" class="px-2 py-1 text-xs bg-indigo-600 text-white rounded" onclick="wbAppendSelectedControl()">Add</button>
              </div>
              <button type="button" class="w-full mt-2 px-2 py-1 text-xs bg-white border border-slate-200 rounded hover:bg-slate-50" onclick="wbApplyMitigationTemplate()">Insert mitigation starter</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  window.wbAppendControl = function (control) {
    const ta = modal.querySelector('#wb-controls');
    if (!ta) return;
    const current = ta.value || '';
    const sep = current && !current.trim().endsWith(',') ? ', ' : '';
    ta.value = current + sep + control;
  };

  window.wbSelectControlFamily = function (family) {
    const select = modal.querySelector('#wb-control-select');
    if (!select) return;
    const all = Array.isArray(controls.controls) ? controls.controls : [];
    const filtered = all
      .map(c => String(c || '').trim())
      .filter(Boolean)
      .filter(c => c.startsWith(String(family || '').trim() + '-'))
      .sort((a, b) => a.localeCompare(b));
    const options = filtered.length ? filtered : all;
    select.innerHTML = options.map(c => `<option value="${escapeAttr(c)}">${escapeHtml(c)}</option>`).join('');

    // Auto-add family token to impacted controls if empty (optional starter)
    const ta = modal.querySelector('#wb-controls');
    if (ta && !String(ta.value || '').trim()) {
      ta.value = String(family || '').trim();
    }
  };

  window.wbAppendSelectedControl = function () {
    const select = modal.querySelector('#wb-control-select');
    if (!select) return;
    const value = select.value;
    if (value) window.wbAppendControl(value);
  };

  window.wbApplyMitigationTemplate = function () {
    const controlsTa = modal.querySelector('#wb-controls');
    const family = String(controlsTa?.value || '').split(/[;,\n\s]+/).find(tok => /^[A-Z]{2}$/.test(tok)) || '';
    const templates = {
      AC: 'Review and enforce least privilege. Disable/expire unused accounts. Implement access reviews and MFA where applicable.',
      AU: 'Enable and centralize auditing. Ensure logs are time-synced, protected from tampering, and reviewed on a defined cadence.',
      CM: 'Establish secure configuration baselines. Implement configuration monitoring and change control with documented approvals.',
      IA: 'Implement strong identification and authentication. Enforce MFA, password policy, and session management controls.',
      IR: 'Update incident response procedures. Validate detection/alerting, runbooks, and conduct tabletop exercises.',
      SC: 'Harden network/system communications. Enforce encryption, segmentation, and secure boundary protections.',
      SI: 'Apply patching and vulnerability remediation. Improve malware defenses, integrity monitoring, and continuous scanning.',
      PE: 'Verify physical access controls. Ensure visitor logs, badge controls, and secure areas are enforced.',
      AT: 'Provide security awareness and role-based training. Track completion and refresh on a defined schedule.'
    };
    const mit = modal.querySelector('[data-wb-field="Mitigations"]');
    if (!mit) return;
    const starter = templates[family] || 'Document remediation steps, validate implementation, and update procedures to prevent recurrence.';
    if (!String(mit.value || '').trim()) {
      mit.value = starter;
    } else {
      mit.value = String(mit.value).trim() + "\n\n" + starter;
    }
  };

  // Initialize control dropdown
  try {
    const select = modal.querySelector('#wb-control-select');
    if (select) {
      const all = Array.isArray(controls.controls) ? controls.controls : [];
      select.innerHTML = all.map(c => `<option value="${escapeAttr(String(c))}">${escapeHtml(String(c))}</option>`).join('');
    }
  } catch (e) {
    // ignore
  }

  const close = () => {
    modal.remove();
    delete window.wbAppendControl;
    delete window.wbSelectControlFamily;
    delete window.wbAppendSelectedControl;
    delete window.wbApplyMitigationTemplate;
  };

  modal.querySelector('#wb-cancel')?.addEventListener('click', close);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) close();
  });

  modal.querySelector('#wb-save')?.addEventListener('click', async () => {
    try {
      const updated = { ...item };
      updated.systemId = modal.querySelector('#wb-systemId')?.value || updated.systemId;

      for (const col of window.POAM_WORKBOOK_COLUMNS) {
        const el = modal.querySelector(`[data-wb-field="${cssEscape(col)}"]`);
        if (!el) continue;
        updated[col] = el.value;
      }

      const assetsEl = modal.querySelector('#wb-assetsImpacted');
      if (assetsEl) {
        updated[window.POAM_WORKBOOK_INTERNAL_FIELDS.assetsImpacted] = assetsEl.value;
      }

      // Validate enums
      const enums = window.POAM_WORKBOOK_ENUMS;
      if (updated['Severity Value'] && !enums.severityValues.includes(updated['Severity Value'])) {
        throw new Error('Invalid Severity Value');
      }
      if (updated['Status'] && !enums.statusValues.includes(updated['Status'])) {
        throw new Error('Invalid Status');
      }
      if (updated['Identifying Detecting Source'] && !enums.detectingSources.includes(updated['Identifying Detecting Source'])) {
        throw new Error('Invalid Identifying Detecting Source');
      }

      // Ensure Item number uniqueness within system
      const itemsInSystem = await window.poamWorkbookDB.getItemsBySystem(updated.systemId);
      const dup = itemsInSystem.find(x => x.id !== updated.id && String(x['Item number']) === String(updated['Item number']));
      if (dup) {
        throw new Error('Item number must be unique within system');
      }

      updated.updatedAt = new Date().toISOString();
      await window.poamWorkbookDB.saveItem(updated);
      window.poamWorkbookNotifyMutation();

      await renderWorkbookSidebarSystems();
      await renderWorkbookOverview();
      await renderWorkbookSystemTable(updated.systemId);

      showUpdateFeedback('Workbook POAM saved', 'success');
      close();
    } catch (e) {
      console.error(e);
      showUpdateFeedback(`Save failed: ${e.message}`, 'error');
    }
  });
}

function renderFieldText(label, value, readonly = false) {
  return `
    <div>
      <label class="text-[11px] font-bold text-slate-500 uppercase tracking-wider">${escapeHtml(label)}</label>
      <input data-wb-field="${escapeAttr(label)}" ${readonly ? 'readonly' : ''} value="${escapeAttr(value || '')}" class="w-full text-sm text-slate-800 border border-slate-200 rounded px-3 py-2 ${readonly ? 'bg-slate-50' : 'bg-white'}">
    </div>
  `;
}

function renderFieldTextarea(label, value, readonly = false, id = null) {
  return `
    <div>
      <label class="text-[11px] font-bold text-slate-500 uppercase tracking-wider">${escapeHtml(label)}</label>
      <textarea ${id ? `id=\"${id}\"` : ''} data-wb-field="${escapeAttr(label)}" ${readonly ? 'readonly' : ''} rows="3" class="w-full text-sm text-slate-800 border border-slate-200 rounded px-3 py-2 ${readonly ? 'bg-slate-50' : 'bg-white'}">${escapeHtml(value || '')}</textarea>
    </div>
  `;
}

function renderFieldSelect(label, value, options) {
  const val = value == null ? '' : String(value);
  return `
    <div>
      <label class="text-[11px] font-bold text-slate-500 uppercase tracking-wider">${escapeHtml(label)}</label>
      <select data-wb-field="${escapeAttr(label)}" class="w-full text-sm text-slate-800 border border-slate-200 rounded px-3 py-2 bg-white">
        ${options.map(o => {
          const v = String(o);
          return `<option value="${escapeAttr(v)}" ${v === val ? 'selected' : ''}>${escapeHtml(v)}</option>`;
        }).join('')}
      </select>
    </div>
  `;
}

function renderFieldDate(label, value) {
  const safe = value ? String(value).split('T')[0] : '';
  return `
    <div>
      <label class="text-[11px] font-bold text-slate-500 uppercase tracking-wider">${escapeHtml(label)}</label>
      <input type="date" data-wb-field="${escapeAttr(label)}" value="${escapeAttr(safe)}" class="w-full text-sm text-slate-800 border border-slate-200 rounded px-3 py-2 bg-white">
    </div>
  `;
}

function computeWorkbookAnalytics(items, scopeKey) {
  const cacheKey = `${scopeKey}|${window.poamWorkbookState._version}`;
  const cached = window.poamWorkbookState._analyticsCache.get(cacheKey);
  if (cached) return cached;

  const byStatus = {};
  const bySeverity = {};
  const topVulnMap = new Map();
  const controlsMap = new Map();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let overdue = 0;
  let missingPoc = 0;

  for (const item of items) {
    const st = String(item['Status'] || '').trim() || 'Open';
    byStatus[st] = (byStatus[st] || 0) + 1;

    const sev = String(item['Severity Value'] || '').trim() || 'Medium';
    bySeverity[sev] = (bySeverity[sev] || 0) + 1;

    const poc = String(item['POC Name'] || '').trim();
    if (!poc || poc === 'Unassigned') missingPoc++;

    const due = String(item['Scheduled Completion Date'] || '').trim();
    if (due) {
      const d = new Date(due);
      if (!isNaN(d.getTime())) {
        d.setHours(0, 0, 0, 0);
        if (d < today && st !== 'Completed' && st !== 'Closed') overdue++;
      }
    }

    const vn = String(item['Vulnerability Name'] || '').trim();
    if (vn) topVulnMap.set(vn, (topVulnMap.get(vn) || 0) + 1);

    const impacted = String(item['Impacted Security Controls'] || '').trim();
    if (impacted) {
      impacted.split(/[;,\n]/).map(s => s.trim()).filter(Boolean).forEach(tok => {
        controlsMap.set(tok, (controlsMap.get(tok) || 0) + 1);
      });
    }
  }

  const toTop = (m) => Array.from(m.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10);

  const result = {
    total: items.length,
    overdue,
    missingPoc,
    byStatus,
    bySeverity,
    topVulns: toTop(topVulnMap),
    controlsDist: toTop(controlsMap)
  };

  window.poamWorkbookState._analyticsCache.set(cacheKey, result);
  return result;
}

function renderMiniBreakdown(obj) {
  const entries = Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, 6);
  return entries.map(([k, v]) => `<div class="flex justify-between text-xs"><span class="text-slate-600">${escapeHtml(k)}</span><span class="font-semibold text-slate-800">${v}</span></div>`).join('');
}

function renderTopList(entries) {
  if (!entries || entries.length === 0) {
    return '<div class="text-xs text-slate-500">No data</div>';
  }
  return entries.map(([k, v]) => `<div class="flex justify-between text-xs"><span class="text-slate-600 truncate pr-2" title="${escapeAttr(k)}">${escapeHtml(k)}</span><span class="font-semibold text-slate-800">${v}</span></div>`).join('');
}

function escapeHtml(str) {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function escapeAttr(str) {
  return escapeHtml(str).replace(/\n/g, ' ');
}

function cssEscape(str) {
  // minimal escape for attribute selectors
  return String(str).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}
