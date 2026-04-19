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

async function poamWorkbookOpenSystemIdConfigModal(forSystemId) {
  try {
    await poamWorkbookEnsureDbReady();

    const systemId = forSystemId || window.poamWorkbookState.activeSystemId;
    if (!systemId) throw new Error('No active system');

    const sys = await window.poamWorkbookDB.getSystemById(systemId);
    const cfg = typeof window.poamWorkbookDB.getWorkbookIdConfigForSystem === 'function'
      ? await window.poamWorkbookDB.getWorkbookIdConfigForSystem(systemId)
      : { org: '', app: '', year: String(new Date().getFullYear()), pad: 3 };

    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';
    modal.innerHTML = `
      <div class="bg-white rounded-2xl p-6 max-w-xl w-full">
        <div class="flex items-center justify-between mb-4">
          <div>
            <h2 class="text-lg font-bold text-slate-900">Workbook POAM ID (Per System)</h2>
            <div class="text-xs text-slate-500 mt-1">System: <span class="font-mono">${escapeHtml(sys?.name || systemId)}</span></div>
          </div>
          <button id="wb-sysid-close" class="text-slate-400 hover:text-slate-600"><i class="fas fa-times"></i></button>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label class="block text-sm font-semibold text-slate-700 mb-2">Org</label>
            <input type="text" id="wb-sysid-org" class="w-full px-3 py-2 border border-slate-200 rounded-lg" value="${escapeAttr(cfg.org)}">
          </div>
          <div>
            <label class="block text-sm font-semibold text-slate-700 mb-2">App / System</label>
            <input type="text" id="wb-sysid-app" class="w-full px-3 py-2 border border-slate-200 rounded-lg" value="${escapeAttr(cfg.app)}">
          </div>
          <div>
            <label class="block text-sm font-semibold text-slate-700 mb-2">Year</label>
            <input type="text" id="wb-sysid-year" class="w-full px-3 py-2 border border-slate-200 rounded-lg" value="${escapeAttr(cfg.year)}">
          </div>
          <div>
            <label class="block text-sm font-semibold text-slate-700 mb-2">Number Padding</label>
            <input type="number" id="wb-sysid-pad" min="1" max="8" class="w-full px-3 py-2 border border-slate-200 rounded-lg" value="${escapeAttr(cfg.pad)}">
          </div>
        </div>

        <div class="bg-slate-50 border border-slate-200 rounded-lg p-3 mt-4">
          <div class="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Preview</div>
          <div id="wb-sysid-preview" class="font-mono text-sm text-slate-800">...</div>
        </div>

        <div class="flex justify-between items-center gap-3 mt-6">
          <button id="wb-sysid-reset" class="px-4 py-2 border border-orange-300 rounded-lg text-sm font-semibold text-orange-700 bg-orange-50 hover:bg-orange-100">Reset Counter</button>
          <div class="flex gap-3">
            <button id="wb-sysid-cancel" class="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300">Cancel</button>
            <button id="wb-sysid-save" class="px-4 py-2 bg-teal-700 text-white rounded-lg hover:bg-teal-800">Save</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    const close = () => modal.remove();
    modal.querySelector('#wb-sysid-close')?.addEventListener('click', close);
    modal.querySelector('#wb-sysid-cancel')?.addEventListener('click', close);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) close();
    });

    const updatePreview = async () => {
      try {
        const org = String(modal.querySelector('#wb-sysid-org')?.value || '').trim();
        const app = String(modal.querySelector('#wb-sysid-app')?.value || '').trim();
        const year = String(modal.querySelector('#wb-sysid-year')?.value || String(new Date().getFullYear())).trim();
        const pad = Math.max(1, Math.min(8, parseInt(String(modal.querySelector('#wb-sysid-pad')?.value || '3'), 10) || 3));
        const num = String(1).padStart(pad, '0');
        const preview = `${org}_${app}_${year}_${num}`.replace(/^_+|_+$/g, '').replace(/__+/g, '_');
        const el = modal.querySelector('#wb-sysid-preview');
        if (el) el.textContent = preview;
      } catch (e) {
        // ignore
      }
    };

    modal.querySelector('#wb-sysid-org')?.addEventListener('input', updatePreview);
    modal.querySelector('#wb-sysid-app')?.addEventListener('input', updatePreview);
    modal.querySelector('#wb-sysid-year')?.addEventListener('input', updatePreview);
    modal.querySelector('#wb-sysid-pad')?.addEventListener('input', updatePreview);
    await updatePreview();

    modal.querySelector('#wb-sysid-reset')?.addEventListener('click', async () => {
      try {
        if (typeof window.poamWorkbookDB.resetWorkbookItemNumberCounter === 'function') {
          await window.poamWorkbookDB.resetWorkbookItemNumberCounter(systemId);
        }
        showUpdateFeedback('Workbook counter reset for this system', 'success');
      } catch (e) {
        console.error(e);
        showUpdateFeedback(`Reset failed: ${e.message}`, 'error');
      }
    });

    modal.querySelector('#wb-sysid-save')?.addEventListener('click', async () => {
      try {
        const org = String(modal.querySelector('#wb-sysid-org')?.value || '').trim();
        const app = String(modal.querySelector('#wb-sysid-app')?.value || '').trim();
        const year = String(modal.querySelector('#wb-sysid-year')?.value || String(new Date().getFullYear())).trim();
        const pad = Math.max(1, Math.min(8, parseInt(String(modal.querySelector('#wb-sysid-pad')?.value || '3'), 10) || 3));

        if (typeof window.poamWorkbookDB.setWorkbookIdConfigForSystem === 'function') {
          await window.poamWorkbookDB.setWorkbookIdConfigForSystem(systemId, { org, app, year, pad });
        }

        showUpdateFeedback('Workbook POAM ID settings saved for this system', 'success');
        close();
      } catch (e) {
        console.error(e);
        showUpdateFeedback(`Save failed: ${e.message}`, 'error');
      }
    });
  } catch (e) {
    console.error(e);
    showUpdateFeedback(`Open workbook ID settings failed: ${e.message}`, 'error');
  }
}

function poamWorkbookParseItemNumberNumeric(value) {
  if (typeof value === 'number') return value;
  const s = String(value || '').trim();
  if (!s) return NaN;
  const m = s.match(/(\d+)(?!.*\d)/);
  if (m) return parseInt(m[1], 10);
  return parseInt(s, 10);
}

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

  // If a system selector explicitly requested a system, open it now.
  const pending = window.poamWorkbookState.pendingOpenSystemId;
  if (pending) {
    window.poamWorkbookState.pendingOpenSystemId = null;
    await poamWorkbookOpenSystem(pending);
    return;
  }

  // Default entry view is overview (do not auto-open a system just because it was last active).
  poamWorkbookShowOverview();
}

function poamWorkbookShowOverview() {
  window.poamWorkbookState.activeTab = 'overview';
  window.poamWorkbookState.activeSystemId = null;
  const overview = document.getElementById('poam-workbook-view-overview');
  const system = document.getElementById('poam-workbook-view-system');
  const allSystems = document.getElementById('poam-workbook-view-all-systems');
  if (overview) overview.classList.remove('hidden');
  if (system) system.classList.add('hidden');
  if (allSystems) allSystems.classList.add('hidden');
  const sel = document.getElementById('poam-system-select');
  if (sel) sel.value = 'all';
}

async function poamWorkbookShowAllSystems() {
  window.poamWorkbookState.activeTab = 'all-systems';
  const overview = document.getElementById('poam-workbook-view-overview');
  const system = document.getElementById('poam-workbook-view-system');
  const allSystems = document.getElementById('poam-workbook-view-all-systems');
  
  if (overview) overview.classList.add('hidden');
  if (system) system.classList.add('hidden');
  if (allSystems) {
    allSystems.classList.remove('hidden');
    if (window.poamWorkbookRenderAllSystemsView) {
      allSystems.innerHTML = await window.poamWorkbookRenderAllSystemsView();
    }
  }
}
window.poamWorkbookShowAllSystems = poamWorkbookShowAllSystems;

async function renderWorkbookSidebarSystems() {
  if (!window.poamWorkbookDB || !window.poamWorkbookDB.db) return;
  const systems = await window.poamWorkbookDB.getSystems();

  const container = document.getElementById('scm-poam-workbook-systems');
  if (!container) return;

  const activeId = window.poamWorkbookState.activeSystemId;

  // Populate the system select dropdown
  const sel = document.getElementById('poam-system-select');
  if (sel) {
    // Rebuild options after "All Systems" (index 0)
    while (sel.options.length > 1) sel.remove(1);
    systems.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.id;
      opt.textContent = s.name;
      sel.appendChild(opt);
    });
    const onOverview = !activeId || window.poamWorkbookState.activeTab === 'overview';
    sel.value = onOverview ? 'all' : (activeId || 'all');
  }

  // Keep container empty (no longer used for tabs)
  container.innerHTML = '';
}

// Handle system dropdown selection
window.poamWorkbookHandleSystemSelect = async function(value) {
  if (value === 'all') {
    window.poamWorkbookState.activeSystemId = null;
    window.poamWorkbookState.activeTab = 'overview';
    poamWorkbookShowOverview();
  } else {
    await poamWorkbookNavigateToSystem(value);
  }
};

// Render per-system breakdown table into #poam-workbook-systems-table
async function renderWorkbookSystemsTable() {
  const container = document.getElementById('poam-workbook-systems-table');
  if (!container) return;

  const systems = await window.poamWorkbookDB.getSystems();
  if (!systems || systems.length === 0) {
    container.innerHTML = '<div style="padding:40px;text-align:center;color:#6B7280;font-size:13px">No systems configured. Click "Add System" to get started.</div>';
    return;
  }

  const rows = await Promise.all(systems.map(async s => {
    const items = await window.poamWorkbookDB.getItemsBySystem(s.id);
    const a = computeWorkbookAnalytics(items, `sys-table:${s.id}`);
    const open = items.filter(i => {
      const st = String(i['Status'] || '').trim();
      return st !== 'Completed' && st !== 'Closed';
    }).length;
    return { id: s.id, name: s.name, total: a.total, open, overdue: a.overdue, comingDue: a.comingDue };
  }));

  container.innerHTML = `
    <table style="width:100%;border-collapse:collapse">
      <thead>
        <tr>
          <th style="text-align:left;padding:10px 20px;font-size:10px;font-weight:700;color:#6B7280;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #F3F4F6">System</th>
          <th style="text-align:center;padding:10px 16px;font-size:10px;font-weight:700;color:#6B7280;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #F3F4F6">Total</th>
          <th style="text-align:center;padding:10px 16px;font-size:10px;font-weight:700;color:#6B7280;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #F3F4F6">Open</th>
          <th style="text-align:center;padding:10px 16px;font-size:10px;font-weight:700;color:#991B1B;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #F3F4F6">Overdue</th>
          <th style="text-align:center;padding:10px 16px;font-size:10px;font-weight:700;color:#B45309;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #F3F4F6">Coming Due</th>
          <th style="padding:10px 20px;border-bottom:1px solid #F3F4F6"></th>
        </tr>
      </thead>
      <tbody>
        ${rows.map(r => `
          <tr style="cursor:pointer" onclick="poamWorkbookNavigateToSystem('${escapeAttr(r.id)}')" onmouseover="this.style.background='#FAFAFA'" onmouseout="this.style.background=''">
            <td style="padding:12px 20px;font-size:13px;font-weight:600;color:#111827;border-bottom:1px solid #F3F4F6">${escapeHtml(r.name)}</td>
            <td style="padding:12px 16px;text-align:center;font-size:13px;font-weight:600;color:#374151;border-bottom:1px solid #F3F4F6">${r.total}</td>
            <td style="padding:12px 16px;text-align:center;font-size:13px;font-weight:700;color:#111827;border-bottom:1px solid #F3F4F6">${r.open}</td>
            <td style="padding:12px 16px;text-align:center;font-size:13px;font-weight:700;color:${r.overdue > 0 ? '#DC2626' : '#6B7280'};border-bottom:1px solid #F3F4F6">${r.overdue}</td>
            <td style="padding:12px 16px;text-align:center;font-size:13px;font-weight:700;color:${r.comingDue > 0 ? '#B45309' : '#6B7280'};border-bottom:1px solid #F3F4F6">${r.comingDue}</td>
            <td style="padding:12px 20px;text-align:right;border-bottom:1px solid #F3F4F6">
              <button onclick="event.stopPropagation();poamWorkbookNavigateToSystem('${escapeAttr(r.id)}')" class="btn-sec" style="font-size:11.5px;padding:5px 12px">View</button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
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
          <button id="wb-editsys-save" class="px-4 py-2 bg-teal-700 text-white rounded-lg hover:bg-teal-800">Save</button>
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


async function poamWorkbookFormatItemNumber(systemId, n) {
  if (window.poamWorkbookDB && typeof window.poamWorkbookDB.formatWorkbookItemNumber === 'function') {
    return window.poamWorkbookDB.formatWorkbookItemNumber(systemId, n);
  }
  return String(n);
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
        <button id="wb-paste-import" class="px-4 py-2 bg-teal-700 text-white rounded-lg hover:bg-teal-800">Preview</button>
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
        <button id="wb-preview-commit" class="px-4 py-2 bg-teal-700 text-white rounded-lg hover:bg-teal-800">Commit</button>
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
    const n = poamWorkbookParseItemNumberNumeric(data['Item number']);
    if (Number.isFinite(n) && n > 0 && typeof window.poamWorkbookDB.upsertItemBySystemAndItemNumber === 'function') {
      const res = await window.poamWorkbookDB.upsertItemBySystemAndItemNumber(systemId, n, data);
      if (res.created) saved++; else updated++;
      continue;
    }

    // Auto-number if missing (reserve so concurrent commits don't collide)
    const nextNum = typeof window.poamWorkbookDB.reserveNextWorkbookItemNumber === 'function'
      ? await window.poamWorkbookDB.reserveNextWorkbookItemNumber(systemId)
      : await window.poamWorkbookDB.getNextItemNumber(systemId);
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
  window.poamWorkbookState.activeTab = 'system';
  poamWorkbookClearSelection();
  // Sync dropdown
  const sel = document.getElementById('poam-system-select');
  if (sel) sel.value = systemId;
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

  const comingDue = document.getElementById('poam-workbook-metric-coming-due');
  if (comingDue) comingDue.textContent = analytics.comingDue || 0;

  const missingPoc = document.getElementById('poam-workbook-metric-missing-poc');
  if (missingPoc) missingPoc.textContent = analytics.missingPoc;

  const completed = document.getElementById('poam-workbook-metric-completed');
  if (completed) completed.textContent = analytics.completed || 0;

  const byStatus = document.getElementById('poam-workbook-metric-status');
  if (byStatus) byStatus.innerHTML = renderMiniBreakdown(analytics.byStatus);

  const bySeverity = document.getElementById('poam-workbook-metric-severity');
  if (bySeverity) bySeverity.innerHTML = renderMiniBreakdown(analytics.bySeverity);

  const topVulns = document.getElementById('poam-workbook-top-vulns');
  if (topVulns) topVulns.innerHTML = renderTopList(analytics.topVulns);

  const controlsDist = document.getElementById('poam-workbook-controls-dist');
  if (controlsDist) controlsDist.innerHTML = renderTopList(analytics.controlsDist);

  // Render per-system breakdown table
  await renderWorkbookSystemsTable();
}

async function renderWorkbookSystemTable(systemId) {
  const allItems = await window.poamWorkbookDB.getItemsBySystem(systemId);
  
  // Apply filters if filtering is enabled
  const items = window.poamWorkbookFilterItems ? window.poamWorkbookFilterItems(allItems) : allItems;
  
  const analytics = computeWorkbookAnalytics(allItems, `system:${systemId}`);

  const sysTotal = document.getElementById('poam-workbook-system-total');
  if (sysTotal) sysTotal.textContent = allItems.length;
  
  // Render quick status panel
  const quickStatus = document.getElementById('poam-workbook-quick-status');
  if (quickStatus && window.poamWorkbookRenderQuickStatusPanel) {
    quickStatus.innerHTML = window.poamWorkbookRenderQuickStatusPanel(allItems);
  }

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
      const dueDate = item['Updated Scheduled Completion Date'] || item['Scheduled Completion Date'] || '';
      return `
      <tr class="border-b border-slate-100 hover:bg-teal-50 transition-colors group">
        <td class="px-3 py-2" onclick="event.stopPropagation()">
          <input type="checkbox" ${checked ? 'checked' : ''} onchange="poamWorkbookToggleRowSelection('${id}', this.checked)" />
        </td>
        <td class="px-3 py-2 text-xs text-slate-700 font-mono">
          <div class="flex items-center gap-2">
            ${escapeHtml(item['Item number'] || '')}
            <button onclick="event.stopPropagation(); showQuickEditPOAMModal('${id}', '${systemId}')"
                    class="opacity-0 group-hover:opacity-100 transition-opacity text-teal-700 hover:text-teal-900"
                    title="Quick Edit">
              <i class="fas fa-edit text-xs"></i>
            </button>
          </div>
        </td>
        <td class="px-3 py-2 text-sm text-slate-900 cursor-pointer" onclick="poamWorkbookOpenItemDetails('${id}')">${escapeHtml(item['Vulnerability Name'] || '')}</td>
        <td class="px-3 py-2 text-xs text-slate-700">${escapeHtml(item['Impacted Security Controls'] || '')}</td>
        <td class="px-3 py-2" onclick="event.stopPropagation()">
          ${renderInlineSelect(id, 'Severity Value', item['Severity Value'], severities)}
        </td>
        <td class="px-3 py-2" onclick="event.stopPropagation()">
          ${renderInlineSelect(id, 'Status', item['Status'], statuses)}
        </td>
        <td class="px-3 py-2" onclick="event.stopPropagation()">
          ${renderInlineSelect(id, 'POC Name', item['POC Name'], pocs)}
        </td>
        <td class="px-3 py-2" onclick="event.stopPropagation()">
          ${renderInlineDate(id, 'Scheduled Completion Date', dueDate)}
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

async function poamWorkbookClearSystemPOAMs() {
  const systemId = window.poamWorkbookState.activeSystemId;
  if (!systemId) {
    showUpdateFeedback('No system selected', 'error');
    return;
  }

  try {
    const items = await window.poamWorkbookDB.getItemsBySystem(systemId);
    const count = items.length;

    if (count === 0) {
      showUpdateFeedback('No POAMs to clear for this system', 'info');
      return;
    }

    const systemName = (await window.poamWorkbookDB.getSystemById(systemId))?.name || systemId;
    
    if (!confirm(`⚠️ Clear all ${count} POAM(s) for system "${systemName}"?\n\nThis will delete all POAMs for this system only. Other systems will not be affected.\n\nThis action cannot be undone. Continue?`)) {
      return;
    }

    // Delete all items for this system
    for (const item of items) {
      await window.poamWorkbookDB.deleteItem(item.id);
    }

    window.poamWorkbookNotifyMutation();
    poamWorkbookClearSelection();
    await renderWorkbookSystemTable(systemId);
    await renderWorkbookOverview();
    
    showUpdateFeedback(`Cleared ${count} POAM(s) from system "${systemName}"`, 'success');
  } catch (e) {
    console.error('Failed to clear system POAMs:', e);
    showUpdateFeedback(`Failed to clear system POAMs: ${e.message}`, 'error');
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
        <button id="wb-bulk-apply" class="px-4 py-2 bg-teal-700 text-white rounded-lg hover:bg-teal-800">Apply</button>
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
  if (!systemId || systemId === 'all') {
    // Check if any systems exist
    const systems = await window.poamWorkbookDB.getSystems();
    if (!systems || systems.length === 0) {
      showUpdateFeedback('Add a system first before creating a POA&M.', 'error');
      poamWorkbookOpenAddSystemModal();
      return;
    }
    showUpdateFeedback('Select a system from the dropdown before adding a POA&M.', 'error');
    const sel = document.getElementById('poam-system-select');
    if (sel) { sel.focus(); sel.style.outline = '2px solid #0D7377'; setTimeout(() => sel.style.outline = '', 2000); }
    return;
  }
  const nextNum = typeof window.poamWorkbookDB.reserveNextWorkbookItemNumber === 'function'
    ? await window.poamWorkbookDB.reserveNextWorkbookItemNumber(systemId)
    : await window.poamWorkbookDB.getNextItemNumber(systemId);

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
        <button id="wb-importerr-ok" class="px-4 py-2 bg-teal-700 text-white rounded-lg hover:bg-teal-800">Close</button>
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

// Global alias so onclick="openAddSystemModal()" works from HTML
window.openAddSystemModal = function() { poamWorkbookOpenAddSystemModal(); };

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
          <input id="wb-addsys-name" type="text" class="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-600" placeholder="e.g., Enclave Echo">
        </div>
        <div>
          <label class="block text-sm font-semibold text-slate-700 mb-2">Description</label>
          <input id="wb-addsys-desc" type="text" class="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-600" placeholder="Security Control Monitoring system">
        </div>
      </div>
      <div class="flex justify-end gap-3 mt-6">
        <button id="wb-addsys-cancel" class="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300">Cancel</button>
        <button id="wb-addsys-save" class="px-4 py-2 bg-teal-700 text-white rounded-lg hover:bg-teal-800">Save</button>
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
          <button id="wb-save" class="text-xs font-semibold px-3 py-1 rounded bg-teal-700 hover:bg-teal-800">Save</button>
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
                <button type="button" class="px-2 py-1 text-xs bg-teal-700 text-white rounded" onclick="wbAppendSelectedControl()">Add</button>
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
  const thirtyDaysOut = new Date(today);
  thirtyDaysOut.setDate(thirtyDaysOut.getDate() + 30);

  let overdue = 0;
  let comingDue = 0;
  let completed = 0;
  let missingPoc = 0;

  for (const item of items) {
    const st = String(item['Status'] || '').trim() || 'Open';
    byStatus[st] = (byStatus[st] || 0) + 1;

    if (st === 'Completed' || st === 'Closed') completed++;

    const sev = String(item['Severity Value'] || '').trim() || 'Medium';
    bySeverity[sev] = (bySeverity[sev] || 0) + 1;

    const poc = String(item['POC Name'] || '').trim();
    if (!poc || poc === 'Unassigned') missingPoc++;

    const due = String(item['Scheduled Completion Date'] || '').trim();
    if (due) {
      const d = new Date(due);
      if (!isNaN(d.getTime())) {
        d.setHours(0, 0, 0, 0);
        if (st !== 'Completed' && st !== 'Closed') {
          if (d < today) {
            overdue++;
          } else if (d <= thirtyDaysOut) {
            comingDue++;
          }
        }
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
    comingDue,
    completed,
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
class POAMWorkbookDatabase {
  constructor() {
    this.dbName = 'POAMWorkbookDB';
    this.version = 2;
    this.db = null;
    this._nistControlsBootstrapAttempted = false;
  }

  async getWorkbookIdConfigForSystem(systemId) {
    const sys = await this.getSystemById(systemId);
    const cfg = sys && sys.workbookPoamIdConfig ? sys.workbookPoamIdConfig : null;

    const fallbackOrg = await this.getLookup('workbookPoamOrg');
    const fallbackApp = await this.getLookup('workbookPoamApp');
    const fallbackYear = await this.getLookup('workbookPoamYear');
    const fallbackPad = await this.getLookup('workbookPoamPad');

    const out = {
      org: String(cfg?.org ?? (fallbackOrg ?? '')).trim(),
      app: String(cfg?.app ?? (fallbackApp ?? '')).trim(),
      year: String(cfg?.year ?? (fallbackYear ?? String(new Date().getFullYear()))).trim(),
      pad: Math.max(1, Math.min(8, parseInt(String(cfg?.pad ?? (fallbackPad ?? 3)), 10) || 3))
    };

    // One-time migration: if system has no config but global lookups exist, persist into system.
    if (sys && !sys.workbookPoamIdConfig && (fallbackOrg != null || fallbackApp != null || fallbackYear != null || fallbackPad != null)) {
      try {
        await this.saveSystem({
          ...sys,
          workbookPoamIdConfig: out
        });
      } catch (e) {
        // ignore migration errors
      }
    }

    return out;
  }

  async setWorkbookIdConfigForSystem(systemId, config) {
    const sys = await this.getSystemById(systemId);
    if (!sys) throw new Error('System not found');

    const nextCfg = {
      org: String(config?.org ?? '').trim(),
      app: String(config?.app ?? '').trim(),
      year: String(config?.year ?? String(new Date().getFullYear())).trim(),
      pad: Math.max(1, Math.min(8, parseInt(String(config?.pad ?? 3), 10) || 3))
    };

    await this.saveSystem({
      ...sys,
      workbookPoamIdConfig: nextCfg
    });

    return nextCfg;
  }

  async resetWorkbookItemNumberCounter(systemId) {
    const sys = await this.getSystemById(systemId);
    if (!sys) throw new Error('System not found');
    await this.saveSystem({
      ...sys,
      workbookLastItemNumber: 0
    });
  }

  async reserveNextWorkbookItemNumber(systemId) {
    const sys = await this.getSystemById(systemId);
    if (!sys) throw new Error('System not found');

    const items = await this.getItemsBySystem(systemId);
    const maxFromItems = items
      .map(i => (typeof i.itemNumberNumeric === 'number' ? i.itemNumberNumeric : 0))
      .filter(n => n > 0);
    const maxItem = maxFromItems.length ? Math.max(...maxFromItems) : 0;

    const last = typeof sys.workbookLastItemNumber === 'number' ? sys.workbookLastItemNumber : 0;
    const next = Math.max(last, maxItem) + 1;

    await this.saveSystem({
      ...sys,
      workbookLastItemNumber: next
    });

    return next;
  }

  async formatWorkbookItemNumber(systemId, n) {
    const cfg = await this.getWorkbookIdConfigForSystem(systemId);
    const org = String(cfg.org || '').trim();
    const app = String(cfg.app || '').trim();
    const year = String(cfg.year || String(new Date().getFullYear())).trim();
    const pad = Math.max(1, Math.min(8, parseInt(String(cfg.pad || 3), 10) || 3));
    const num = String(n).padStart(pad, '0');
    return `${org}_${app}_${year}_${num}`.replace(/^_+|_+$/g, '').replace(/__+/g, '_');
  }

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        this.db.onversionchange = () => {
          try {
            this.db.close();
          } catch (e) {
            // ignore
          }
        };
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        const tx = event.target.transaction;

        if (!db.objectStoreNames.contains('poamWorkbookItems')) {
          const items = db.createObjectStore('poamWorkbookItems', { keyPath: 'id' });
          items.createIndex('systemId', 'systemId', { unique: false });

          // IMPORTANT: IndexedDB keyPaths cannot contain spaces.
          // We keep workbook columns as-is, but index via safe derived fields.
          items.createIndex('itemNumber', ['systemId', 'itemNumberNumeric'], { unique: false });
          items.createIndex('severity', 'severityValue', { unique: false });
          items.createIndex('status', 'statusValue', { unique: false });
          items.createIndex('vulnName', 'vulnerabilityName', { unique: false });
          items.createIndex('scheduledCompletion', 'scheduledCompletionDate', { unique: false });
        }

        // If the store already existed from a prior version, ensure the safe indexes exist.
        if (db.objectStoreNames.contains('poamWorkbookItems')) {
          const items = tx.objectStore('poamWorkbookItems');
          if (!items.indexNames.contains('systemId')) {
            items.createIndex('systemId', 'systemId', { unique: false });
          }
          if (!items.indexNames.contains('itemNumber')) {
            items.createIndex('itemNumber', ['systemId', 'itemNumberNumeric'], { unique: false });
          }
          if (!items.indexNames.contains('severity')) {
            items.createIndex('severity', 'severityValue', { unique: false });
          }
          if (!items.indexNames.contains('status')) {
            items.createIndex('status', 'statusValue', { unique: false });
          }
          if (!items.indexNames.contains('vulnName')) {
            items.createIndex('vulnName', 'vulnerabilityName', { unique: false });
          }
          if (!items.indexNames.contains('scheduledCompletion')) {
            items.createIndex('scheduledCompletion', 'scheduledCompletionDate', { unique: false });
          }

          // Migrate existing records to include derived fields used by indexes.
          try {
            const cursorReq = items.openCursor();
            cursorReq.onsuccess = (e) => {
              const cursor = e.target.result;
              if (!cursor) return;
              const value = cursor.value || {};
              const migrated = this._withDerivedFields(value);
              cursor.update(migrated);
              cursor.continue();
            };
          } catch (e) {
            // ignore migration errors during upgrade
          }
        }

        if (!db.objectStoreNames.contains('poamWorkbookSystems')) {
          const systems = db.createObjectStore('poamWorkbookSystems', { keyPath: 'id' });
          systems.createIndex('name', 'name', { unique: false });
        }

        if (!db.objectStoreNames.contains('poamWorkbookLookups')) {
          const lookups = db.createObjectStore('poamWorkbookLookups', { keyPath: 'key' });
        }
      };
    });
  }

  hasStore(storeName) {
    return !!(this.db && this.db.objectStoreNames && this.db.objectStoreNames.contains(storeName));
  }

  async seedDefaultsIfNeeded() {
    if (!this.db) await this.init();

    const existing = await this.getLookup('pocs');
    if (!existing) {
      await this.putLookup('pocs', [
        'Unassigned',
        'Windows Systems Team',
        'Linux Systems Team',
        'Network Engineering Team',
        'Application Development Team'
      ]);
    }

    const controls = await this.getLookup('securityControls');
    if (!controls) {
      await this.putLookup('securityControls', {
        families: ['AC', 'AT', 'AU', 'CA', 'CM', 'CP', 'IA', 'IR', 'MA', 'MP', 'PE', 'PL', 'PM', 'PS', 'PT', 'RA', 'SA', 'SC', 'SI', 'SR'],
        controls: ['SI-2', 'CM-6', 'AC-2', 'IA-2', 'AU-2', 'SC-7', 'IR-4']
      });
    }

    // Bootstrap full NIST 800-53 Rev 5 control IDs (cached into lookups).
    // We fetch from NIST's OSCAL content repo the first time (or if the list is small).
    try {
      const currentControls = await this.getLookup('securityControls');
      const currentCount = Array.isArray(currentControls?.controls) ? currentControls.controls.length : 0;
      if (!this._nistControlsBootstrapAttempted && currentCount < 200) {
        this._nistControlsBootstrapAttempted = true;
        const full = await this._fetchNist80053Rev5Controls();
        if (full && Array.isArray(full.controls) && full.controls.length > currentCount) {
          await this.putLookup('securityControls', full);
        }
      }
    } catch (e) {
      // ignore bootstrap failures (offline or blocked)
    }

    const resourcesRequired = await this.getLookup('resourcesRequired');
    if (!resourcesRequired) {
      await this.putLookup('resourcesRequired', [
        'None',
        'Staff Time',
        'Configuration Change',
        'Patch/Upgrade',
        'Vendor Support',
        'New Tooling',
        'Funding',
        'Maintenance Window',
        'Change Control Approval'
      ]);
    }

    const detectingSources = await this.getLookup('detectingSources');
    if (!detectingSources) {
      await this.putLookup('detectingSources', window.POAM_WORKBOOK_ENUMS?.detectingSources || []);
    }

    const severityValues = await this.getLookup('severityValues');
    if (!severityValues) {
      await this.putLookup('severityValues', window.POAM_WORKBOOK_ENUMS?.severityValues || []);
    }

    const statusValues = await this.getLookup('statusValues');
    if (!statusValues) {
      await this.putLookup('statusValues', window.POAM_WORKBOOK_ENUMS?.statusValues || []);
    }

    const poamIdFormat = await this.getLookup('poamIdFormat');
    if (!poamIdFormat) {
      await this.putLookup('poamIdFormat', 'POAM-{system}-{n:4}');
    }

    const wbOrg = await this.getLookup('workbookPoamOrg');
    if (wbOrg == null) {
      await this.putLookup('workbookPoamOrg', '');
    }

    const wbApp = await this.getLookup('workbookPoamApp');
    if (wbApp == null) {
      await this.putLookup('workbookPoamApp', '');
    }

    const wbYear = await this.getLookup('workbookPoamYear');
    if (wbYear == null) {
      await this.putLookup('workbookPoamYear', String(new Date().getFullYear()));
    }

    const wbPad = await this.getLookup('workbookPoamPad');
    if (wbPad == null) {
      await this.putLookup('workbookPoamPad', 3);
    }

    const defaultSystem = await this.getSystemById('default');
    if (!defaultSystem) {
      await this.saveSystem({
        id: 'default',
        name: 'Default System',
        description: 'Workbook system',
        workbookPoamIdConfig: {
          org: '',
          app: '',
          year: String(new Date().getFullYear()),
          pad: 3
        },
        workbookLastItemNumber: 0
      });
    }

    // Seed sample systems (only if they do not already exist)
    const sampleSystems = [
      { id: 'sys-alpha', name: 'Enclave Alpha', description: 'Security Control Monitoring system' },
      { id: 'sys-bravo', name: 'Enclave Bravo', description: 'Security Control Monitoring system' },
      { id: 'sys-charlie', name: 'Enclave Charlie', description: 'Security Control Monitoring system' },
      { id: 'sys-delta', name: 'Enclave Delta', description: 'Security Control Monitoring system' }
    ];

    for (const s of sampleSystems) {
      const existingSystem = await this.getSystemById(s.id);
      if (!existingSystem) {
        await this.saveSystem({
          ...s,
          workbookPoamIdConfig: {
            org: '',
            app: '',
            year: String(new Date().getFullYear()),
            pad: 3
          },
          workbookLastItemNumber: 0
        });
      }
    }
  }

  async _fetchNist80053Rev5Controls() {
    if (typeof fetch !== 'function') return null;

    // Authoritative source: NIST OSCAL content (SP800-53).
    // Link published on CSRC page points to github.com/usnistgov/oscal-content.
    // Use a pinned tag to reduce churn.
    const url = 'https://raw.githubusercontent.com/usnistgov/oscal-content/v1.4.0/src/nist.gov/SP800-53/catalog/json/NIST_SP-800-53_rev5_catalog.json';

    const resp = await fetch(url, { cache: 'force-cache' });
    if (!resp.ok) return null;
    const json = await resp.json();
    const catalog = json?.catalog;
    if (!catalog) return null;

    const families = ['AC', 'AT', 'AU', 'CA', 'CM', 'CP', 'IA', 'IR', 'MA', 'MP', 'PE', 'PL', 'PM', 'PS', 'PT', 'RA', 'SA', 'SC', 'SI', 'SR'];
    const outControls = new Set();

    const idToLabel = (id) => {
      const s = String(id || '').trim();
      if (!s) return '';
      // Examples:
      // - ac-2 -> AC-2
      // - ac-2.1 -> AC-2(1)
      const upper = s.toUpperCase();
      const m = upper.match(/^([A-Z]{2})-(\d+)(?:\.(\d+))?$/);
      if (m) {
        const fam = m[1];
        const base = m[2];
        const enh = m[3];
        return enh ? `${fam}-${base}(${parseInt(enh, 10)})` : `${fam}-${base}`;
      }
      return upper.replace(/_/g, '-');
    };

    const extractLabel = (control) => {
      const props = Array.isArray(control?.props) ? control.props : [];
      const labelProp = props.find(p => String(p?.name || '').toLowerCase() === 'label');
      const raw = labelProp?.value || control?.id;
      return idToLabel(raw);
    };

    const walkControls = (arr) => {
      if (!Array.isArray(arr)) return;
      for (const c of arr) {
        const label = extractLabel(c);
        if (label) outControls.add(label);
        if (Array.isArray(c?.controls)) walkControls(c.controls);
      }
    };

    // OSCAL 800-53 catalog uses groups with nested controls.
    const groups = Array.isArray(catalog?.groups) ? catalog.groups : [];
    for (const g of groups) {
      walkControls(g?.controls);
    }

    const controlsList = Array.from(outControls)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));

    if (!controlsList.length) return null;
    return { families, controls: controlsList };
  }

  async putLookup(key, value) {
    if (!this.db) await this.init();
    const tx = this.db.transaction(['poamWorkbookLookups'], 'readwrite');
    const store = tx.objectStore('poamWorkbookLookups');
    return new Promise((resolve, reject) => {
      const req = store.put({ key, value });
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }

  async getLookup(key) {
    if (!this.db) await this.init();
    const tx = this.db.transaction(['poamWorkbookLookups'], 'readonly');
    const store = tx.objectStore('poamWorkbookLookups');
    return new Promise((resolve, reject) => {
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result ? req.result.value : null);
      req.onerror = () => reject(req.error);
    });
  }

  async saveSystem(system) {
    if (!this.db) await this.init();
    const tx = this.db.transaction(['poamWorkbookSystems'], 'readwrite');
    const store = tx.objectStore('poamWorkbookSystems');
    return new Promise((resolve, reject) => {
      const req = store.put(system);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async getSystems() {
    if (!this.db) await this.init();
    const tx = this.db.transaction(['poamWorkbookSystems'], 'readonly');
    const store = tx.objectStore('poamWorkbookSystems');
    return new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async getSystemById(id) {
    if (!this.db) await this.init();
    const tx = this.db.transaction(['poamWorkbookSystems'], 'readonly');
    const store = tx.objectStore('poamWorkbookSystems');
    return new Promise((resolve, reject) => {
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async saveItem(item) {
    if (!this.db) await this.init();
    const tx = this.db.transaction(['poamWorkbookItems'], 'readwrite');
    const store = tx.objectStore('poamWorkbookItems');

    const toSave = this._withDerivedFields(item);
    return new Promise((resolve, reject) => {
      const req = store.put(toSave);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  _withDerivedFields(item) {
    const out = { ...(item || {}) };
    const rawItemNumber = out['Item number'];

    const parsedItemNumber = (() => {
      if (typeof rawItemNumber === 'number') return rawItemNumber;
      const s = String(rawItemNumber || '').trim();
      if (!s) return NaN;
      // Support formatted IDs like POAM-SYS-0001 by extracting the last digit group.
      const m = s.match(/(\d+)(?!.*\d)/);
      if (m) return parseInt(m[1], 10);
      return parseInt(s, 10);
    })();

    out.itemNumberNumeric = Number.isFinite(parsedItemNumber) ? parsedItemNumber : 0;

    out.severityValue = String(out['Severity Value'] || '').trim();
    out.statusValue = String(out['Status'] || '').trim();
    out.vulnerabilityName = String(out['Vulnerability Name'] || '').trim();
    out.scheduledCompletionDate = String(out['Scheduled Completion Date'] || '').trim();
    return out;
  }

  async getItem(id) {
    if (!this.db) await this.init();
    const tx = this.db.transaction(['poamWorkbookItems'], 'readonly');
    const store = tx.objectStore('poamWorkbookItems');
    return new Promise((resolve, reject) => {
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async getItemsBySystem(systemId) {
    if (!this.db) await this.init();
    const tx = this.db.transaction(['poamWorkbookItems'], 'readonly');
    const store = tx.objectStore('poamWorkbookItems');
    const idx = store.index('systemId');
    return new Promise((resolve, reject) => {
      const req = idx.getAll(systemId);
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async getItemBySystemAndItemNumber(systemId, itemNumber) {
    if (!this.db) await this.init();
    const tx = this.db.transaction(['poamWorkbookItems'], 'readonly');
    const store = tx.objectStore('poamWorkbookItems');
    const idx = store.index('itemNumber');
    const n = typeof itemNumber === 'number' ? itemNumber : parseInt(String(itemNumber || '').trim(), 10);
    const key = [systemId, Number.isFinite(n) ? n : 0];
    return new Promise((resolve, reject) => {
      const req = idx.get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async upsertItemBySystemAndItemNumber(systemId, itemNumber, data) {
    if (!systemId) throw new Error('Missing systemId');
    const n = typeof itemNumber === 'number' ? itemNumber : parseInt(String(itemNumber || '').trim(), 10);
    if (!Number.isFinite(n) || n <= 0) throw new Error('Invalid Item number');

    const existing = await this.getItemBySystemAndItemNumber(systemId, n);
    const now = new Date().toISOString();

    const base = existing || {
      id: `WB-${systemId}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      systemId,
      createdAt: now
    };

    const merged = {
      ...base,
      ...data,
      id: base.id,
      systemId,
      createdAt: base.createdAt || now,
      updatedAt: now
    };

    await this.saveItem(merged);

    // Advance per-system counter so future auto-numbering continues from the max imported/updated value.
    try {
      const sys = await this.getSystemById(systemId);
      const last = typeof sys?.workbookLastItemNumber === 'number' ? sys.workbookLastItemNumber : 0;
      if (sys && n > last) {
        await this.saveSystem({
          ...sys,
          workbookLastItemNumber: n
        });
      }
    } catch (e) {
      // ignore counter update errors
    }

    return { id: merged.id, created: !existing };
  }

  async getAllItems() {
    if (!this.db) await this.init();
    const tx = this.db.transaction(['poamWorkbookItems'], 'readonly');
    const store = tx.objectStore('poamWorkbookItems');
    return new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async deleteItem(id) {
    if (!this.db) await this.init();
    const tx = this.db.transaction(['poamWorkbookItems'], 'readwrite');
    const store = tx.objectStore('poamWorkbookItems');
    return new Promise((resolve, reject) => {
      const req = store.delete(id);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }

  async getNextItemNumber(systemId) {
    const sys = await this.getSystemById(systemId);
    const last = typeof sys?.workbookLastItemNumber === 'number' ? sys.workbookLastItemNumber : 0;

    const items = await this.getItemsBySystem(systemId);
    const nums = items
      .map(i => (typeof i.itemNumberNumeric === 'number' ? i.itemNumberNumeric : 0))
      .filter(n => n > 0);
    const max = nums.length ? Math.max(...nums) : 0;
    return Math.max(last, max) + 1;
  }
}

window.poamWorkbookDB = new POAMWorkbookDatabase();

document.addEventListener('DOMContentLoaded', async () => {
  try {
    await window.poamWorkbookDB.init();
    if (typeof window.poamWorkbookDB.seedDefaultsIfNeeded === 'function') {
      await window.poamWorkbookDB.seedDefaultsIfNeeded();
    }
  } catch (e) {
    console.error('Failed to init POAMWorkbookDB', e);
  }
});
async function poamWorkbookImportXlsx(file, systemId) {
  console.log('🚀 Excel Import STARTED:', { fileName: file?.name, systemId, fileSize: file?.size });
  
  if (!file) throw new Error('No file provided');
  if (!systemId) throw new Error('No system selected');

  if (typeof XLSX === 'undefined') {
    throw new Error('XLSX library not loaded');
  }

  if (!window.poamWorkbookDB) {
    throw new Error('Workbook DB not available');
  }

  console.log('📖 Reading Excel file...');
  const wb = await file.arrayBuffer().then(buf => XLSX.read(buf, { type: 'array', cellDates: true }));
  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw new Error('Workbook has no sheets');

  const ws = wb.Sheets[sheetName];

  // Read as matrix so we can normalize headers rather than requiring exact matches.
  // Use raw: true to preserve actual cell values, then convert to strings as needed
  const matrix = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true });
  if (!Array.isArray(matrix) || matrix.length < 2) {
    throw new Error('No rows found in workbook');
  }

  // Some exports include banner/title rows above the actual column header row
  // (e.g., classification markings like "CUI//FOUO"). We'll scan for the best header.
  const headerSearchRows = matrix.slice(0, Math.min(60, matrix.length));

  const normalizeHeader = (h) => String(h || '')
    .replace(/\u2013|\u2014/g, '-')
    .replace(/\u2018|\u2019|\u201C|\u201D/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n/g, ' ')
    .replace(/"/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/\s*\/\s*/g, '/')
    .replace(/[^a-z0-9 /]/g, '')
    .trim();

  const headerAliases = new Map([
    // Standard aliases
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
    ['detection date', 'Detection Date'],
    
    // User's specific Excel format aliases - exact matches from their file
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

  const requiredHeaders = window.POAM_WORKBOOK_COLUMNS || [];
  const canonicalByNorm = new Map(requiredHeaders.map(h => [normalizeHeader(h), h]));
  for (const [k, v] of headerAliases.entries()) {
    canonicalByNorm.set(normalizeHeader(k), v);
  }

  // Fuzzy matching: allows headers like "Vulnerability\nName", "Detecting Source",
  // "Affected Components / URLs", etc.
  const fuzzyMatchCanonical = (cell) => {
    const norm = normalizeHeader(cell);
    if (!norm) return null;
    if (canonicalByNorm.has(norm)) return canonicalByNorm.get(norm);

    // contains matching against known keys
    for (const [k, v] of canonicalByNorm.entries()) {
      if (!k) continue;
      if (norm.includes(k) || k.includes(norm)) return v;
    }

    // token-based heuristics for common tricky cases
    const has = (tok) => norm.includes(tok);
    
    // User's specific format patterns
    if (has('finding') && has('identifier')) return 'Item number';
    if (has('control') && has('family')) return 'Impacted Security Controls';
    if (has('finding') && has('description')) return 'Vulnerability Description';
    if (has('finding') && has('source')) return 'Identifying Detecting Source';
    if (has('finding') && has('status')) return 'Status';
    if (has('risk') && has('level')) return 'Severity Value';
    if (has('initial') && has('scheduled') && has('completion')) return 'Scheduled Completion Date';
    if (has('updated') && has('scheduled') && has('completion')) return 'Scheduled Completion Date';
    if (has('actual') && has('completion')) return 'Detection Date';
    if (has('milestones') && has('completion') && has('dates')) return 'Milestone with Completion Dates';
    if (has('changes') && has('milestones')) return 'Milestone Changes';
    
    // Standard patterns
    if ((has('detect') || has('identifying')) && has('source')) return 'Identifying Detecting Source';
    if (has('affected') && (has('url') || has('urls') || has('component'))) return 'Affected Components/URLs';
    if (has('item') && (has('number') || has('no') || has('#') || has('id') || has('poam'))) return 'Item number';
    if (has('vulnerability') && has('description')) return 'Vulnerability Description';
    if (has('vulnerability') && (has('name') || norm === 'vulnerability')) return 'Vulnerability Name';
    if (has('scheduled') && has('completion')) return 'Scheduled Completion Date';
    if (has('detection') && has('date')) return 'Detection Date';
    if ((has('office') || has('org')) && !has('category')) return 'Office/Org';
    if (has('poc')) return 'POC Name';
    if (has('severity')) return 'Severity Value';
    if (has('status')) return 'Status';
    if (has('milestone') && has('completion')) return 'Milestone with Completion Dates';
    if (has('milestone') && has('change')) return 'Milestone Changes';
    if (has('mitigation')) return 'Mitigations';
    if (has('resource') && has('required')) return 'Resources Required';
    if (has('comment')) return 'Comments';

    return null;
  };

  const scoreHeaderRow = (row) => {
    const cells = Array.isArray(row) ? row : [];
    const matched = new Set();
    for (let i = 0; i < cells.length; i++) {
      const canonical = fuzzyMatchCanonical(cells[i]);
      if (canonical) matched.add(canonical);
    }
    return matched.size;
  };

  let bestHeaderRowIndex = -1;
  let bestHeaderScore = 0;
  const rowScores = [];
  for (let i = 0; i < headerSearchRows.length; i++) {
    const score = scoreHeaderRow(headerSearchRows[i]);
    const firstCells = headerSearchRows[i].slice(0, 10).map(c => String(c || '').substring(0, 20));
    rowScores.push({ row: i, score, preview: firstCells.join(' | ') });
    if (score > bestHeaderScore) {
      bestHeaderScore = score;
      bestHeaderRowIndex = i;
    }
  }
  
  console.log('📊 Excel Import - Scanned rows:', rowScores.filter(r => r.score > 0));

  // Require at least 4 recognizable columns to find the POAM table
  // (Finding Identifier, Control Family, Vulnerability Name, Finding Description, etc.)
  if (bestHeaderRowIndex === -1 || bestHeaderScore < 4) {
    const firstRow = Array.isArray(matrix[0]) ? matrix[0] : [];
    const rawHeaders = firstRow
      .map(h => String(h || '').replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .slice(0, 30);
    throw new Error(`No recognizable POAM table found. Need at least 5 matching columns. Best score: ${bestHeaderScore} at row ${bestHeaderRowIndex}. First headers: ${rawHeaders.join(' | ')}`);
  }

  const headerRow = (matrix[bestHeaderRowIndex] || []).map(v => String(v || ''));
  const dataRows = matrix.slice(bestHeaderRowIndex + 1);

  console.log('📊 Excel Import - Header row detected at index:', bestHeaderRowIndex);
  console.log('📊 Excel Import - Raw headers:', headerRow);

  const headerIndexToCanonical = new Map();
  for (let i = 0; i < headerRow.length; i++) {
    const canonical = fuzzyMatchCanonical(headerRow[i]);
    if (canonical) {
      headerIndexToCanonical.set(i, canonical);
      console.log(`📊 Excel Import - Column ${i}: "${headerRow[i]}" → "${canonical}"`);
    } else {
      console.log(`📊 Excel Import - Column ${i}: "${headerRow[i]}" → NOT MAPPED`);
    }
  }

  console.log('📊 Excel Import - Total mapped columns:', headerIndexToCanonical.size);

  // Do not require exact headers; proceed best-effort.
  if (headerIndexToCanonical.size === 0) {
    const rawHeaders = headerRow
      .map(h => String(h || '').replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .slice(0, 30);
    throw new Error(`No recognizable columns found in workbook header row (detected at row ${bestHeaderRowIndex + 1}). Headers: ${rawHeaders.join(' | ')}`);
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
    if (window.poamWorkbookDB && typeof window.poamWorkbookDB.formatWorkbookItemNumber === 'function') {
      return window.poamWorkbookDB.formatWorkbookItemNumber(systemId, n);
    }
    return String(n);
  };

  // Persist (upsert by systemId + Item number where possible)
  let saved = 0;
  let updated = 0;

  const parseItemNumberNumeric = (v) => {
    if (typeof v === 'number') return v;
    const s = String(v || '').trim();
    if (!s) return NaN;
    const m = s.match(/(\d+)(?!.*\d)/);
    if (m) return parseInt(m[1], 10);
    return parseInt(s, 10);
  };

  for (const entry of parsedRows) {
    const r = entry.row;
    const itemNumberRaw = r['Item number'];
    const n = parseItemNumberNumeric(itemNumberRaw);

    console.log('📊 Excel Import - Processing row:', {
      itemNumber: itemNumberRaw,
      vulnName: r['Vulnerability Name'],
      poc: r['POC Name'],
      severity: r['Severity Value'],
      rawRow: r
    });

    const data = {
      ...pickWorkbookColumns(r),
      [window.POAM_WORKBOOK_INTERNAL_FIELDS.assetsImpacted]: entry.assets.assetsImpacted
    };
    data['Affected Components/URLs'] = entry.assets.affectedComponents;

    console.log('📊 Excel Import - Data after pickWorkbookColumns:', data);

    if (Number.isFinite(n) && n > 0 && typeof window.poamWorkbookDB.upsertItemBySystemAndItemNumber === 'function') {
      data['Item number'] = String(itemNumberRaw || n);
      console.log('📊 Excel Import - Upserting item:', { systemId, itemNumber: n, data });
      const result = await window.poamWorkbookDB.upsertItemBySystemAndItemNumber(systemId, n, data);
      console.log('📊 Excel Import - Upsert result:', result);
      if (result.created) saved++; else updated++;
      continue;
    }

    // Fallback: create a new item number (reserve so repeated imports don't collide)
    const nextNum = typeof window.poamWorkbookDB.reserveNextWorkbookItemNumber === 'function'
      ? await window.poamWorkbookDB.reserveNextWorkbookItemNumber(systemId)
      : await window.poamWorkbookDB.getNextItemNumber(systemId);
    const item = {
      id: `WB-${systemId}-${Date.now()}-${saved}-${updated}`,
      systemId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...data
    };
    item['Item number'] = await formatItemNumber(nextNum);
    console.log('📊 Excel Import - Saving new item:', item);
    await window.poamWorkbookDB.saveItem(item);
    console.log('📊 Excel Import - Item saved successfully');
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
// POAM Workbook (isolated module)

window.POAM_WORKBOOK_COLUMNS = [
  'Item number',
  'Impacted Security Controls',
  'Vulnerability Name',
  'Vulnerability Description',
  'Affected Components/URLs',
  'Identifying Detecting Source',
  'POC Name',
  'Resources Required',
  'Scheduled Completion Date',
  'Milestone with Completion Dates',
  'Milestone Changes',
  'Updated Scheduled Completion Date',
  'Actual Completion Date',
  'Status',
  'Severity Value',
  'Mitigations',
  'Comments'
];

window.POAM_WORKBOOK_ENUMS = {
  detectingSources: ['Continuous Monitoring', 'Assessment', 'HVA Assessment', 'Pen Test', 'Audit', 'Self-Assessment'],
  severityValues: ['Critical', 'High', 'Moderate', 'Medium', 'Low', 'Informational'],
  statusValues: ['Open', 'In Progress', 'Completed', 'Risk Accepted', 'Extended', 'Closed', 'Ongoing', 'Delayed']
};

// ── Inline Quick Add ──
let _inlineRowCounter = 0;

function poamWorkbookToggleInlineEntry() {
  const panel = document.getElementById('wb-inline-entry');
  if (!panel) return;
  const isHidden = panel.classList.contains('hidden');
  if (isHidden) {
    panel.classList.remove('hidden');
    _inlineRowCounter = 0;
    const tbody = document.getElementById('wb-inline-entry-body');
    if (tbody) tbody.innerHTML = '';
    poamWorkbookInlineAddRow();
    poamWorkbookInlineAddRow();
    poamWorkbookInlineAddRow();
  } else {
    panel.classList.add('hidden');
  }
}

function poamWorkbookInlineAddRow() {
  const tbody = document.getElementById('wb-inline-entry-body');
  if (!tbody) return;
  _inlineRowCounter++;
  const idx = _inlineRowCounter;
  const sevOpts = (window.POAM_WORKBOOK_ENUMS?.severityValues || []).map(v => `<option value="${v}">${v}</option>`).join('');
  const statusOpts = (window.POAM_WORKBOOK_ENUMS?.statusValues || []).map(v => `<option value="${v}">${v}</option>`).join('');
  const sourceOpts = (window.POAM_WORKBOOK_ENUMS?.detectingSources || []).map(v => `<option value="${v}">${v}</option>`).join('');

  const tr = document.createElement('tr');
  tr.className = 'border-b border-slate-100';
  tr.id = `wb-inline-row-${idx}`;
  tr.innerHTML = `
    <td class="px-2 py-1.5 text-xs text-slate-400 text-center">${idx}</td>
    <td class="px-2 py-1.5"><input type="text" class="wb-inline-field w-full px-2 py-1.5 border border-slate-200 rounded text-sm focus:border-teal-500 focus:outline-none" data-field="Vulnerability Name" placeholder="Required"></td>
    <td class="px-2 py-1.5"><input type="text" class="wb-inline-field w-full px-2 py-1.5 border border-slate-200 rounded text-sm focus:border-teal-500 focus:outline-none" data-field="Impacted Security Controls" placeholder="e.g. CM"></td>
    <td class="px-2 py-1.5"><select class="wb-inline-field w-full px-2 py-1.5 border border-slate-200 rounded text-sm focus:border-teal-500 focus:outline-none" data-field="Severity Value"><option value="">--</option>${sevOpts}</select></td>
    <td class="px-2 py-1.5"><select class="wb-inline-field w-full px-2 py-1.5 border border-slate-200 rounded text-sm focus:border-teal-500 focus:outline-none" data-field="Status"><option value="Open">Open</option>${statusOpts}</select></td>
    <td class="px-2 py-1.5"><select class="wb-inline-field w-full px-2 py-1.5 border border-slate-200 rounded text-sm focus:border-teal-500 focus:outline-none" data-field="Identifying Detecting Source"><option value="">--</option>${sourceOpts}</select></td>
    <td class="px-2 py-1.5"><input type="date" class="wb-inline-field w-full px-2 py-1.5 border border-slate-200 rounded text-sm focus:border-teal-500 focus:outline-none" data-field="Scheduled Completion Date"></td>
    <td class="px-2 py-1.5 text-center"><button onclick="this.closest('tr').remove(); poamWorkbookInlineUpdateCount()" class="text-slate-400 hover:text-red-600 text-xs"><i class="fas fa-trash-alt"></i></button></td>
  `;
  tbody.appendChild(tr);

  // Focus the vulnerability name field of the new row
  const nameInput = tr.querySelector('input[data-field="Vulnerability Name"]');
  if (nameInput) nameInput.focus();

  // Add Enter key handler on the last field to add a new row
  const lastField = tr.querySelector('input[data-field="Scheduled Completion Date"]');
  if (lastField) {
    lastField.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        poamWorkbookInlineAddRow();
      }
    });
  }

  poamWorkbookInlineUpdateCount();
}

function poamWorkbookInlineUpdateCount() {
  const tbody = document.getElementById('wb-inline-entry-body');
  const countEl = document.getElementById('wb-inline-count');
  if (tbody && countEl) {
    const rows = tbody.querySelectorAll('tr').length;
    countEl.textContent = `${rows} row${rows !== 1 ? 's' : ''}`;
  }
}

async function poamWorkbookInlineSaveAll() {
  const tbody = document.getElementById('wb-inline-entry-body');
  if (!tbody) return;

  const systemId = window.poamWorkbookState?.activeSystemId;
  if (!systemId) {
    showUpdateFeedback('Select a system first', 'error');
    return;
  }

  const rows = tbody.querySelectorAll('tr');
  let saved = 0;
  let skipped = 0;

  for (const tr of rows) {
    const fields = tr.querySelectorAll('.wb-inline-field');
    const data = {};
    fields.forEach(f => {
      const key = f.getAttribute('data-field');
      data[key] = (f.value || '').trim();
    });

    // Skip rows with no vulnerability name
    if (!data['Vulnerability Name']) {
      skipped++;
      continue;
    }

    const itemNumber = typeof window.poamWorkbookDB.getNextItemNumber === 'function'
      ? String(await window.poamWorkbookDB.getNextItemNumber(systemId))
      : String(Date.now());

    const item = {
      id: `WB-${systemId}-${Date.now()}-${saved}`,
      systemId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      'Item number': itemNumber,
      'Vulnerability Name': data['Vulnerability Name'] || '',
      'Vulnerability Description': '',
      'Detection Date': new Date().toISOString().split('T')[0],
      'Impacted Security Controls': data['Impacted Security Controls'] || '',
      'Office/Org': '',
      'POC Name': '',
      'Identifying Detecting Source': data['Identifying Detecting Source'] || '',
      'Mitigations': '',
      'Severity Value': data['Severity Value'] || '',
      'Resources Required': '',
      'Scheduled Completion Date': data['Scheduled Completion Date'] || '',
      'Milestone with Completion Dates': '',
      'Milestone Changes': '',
      'Updated Scheduled Completion Date': '',
      'Actual Completion Date': '',
      'Affected Components/URLs': '',
      'Status': data['Status'] || 'Open',
      'Comments': ''
    };

    await window.poamWorkbookDB.saveItem(item);
    saved++;
  }

  if (saved === 0) {
    showUpdateFeedback('No findings to save — fill in at least one Vulnerability Name', 'error');
    return;
  }

  if (typeof window.poamWorkbookNotifyMutation === 'function') {
    window.poamWorkbookNotifyMutation();
  }

  showUpdateFeedback(`Added ${saved} finding${saved !== 1 ? 's' : ''}${skipped > 0 ? ` (${skipped} empty rows skipped)` : ''}`, 'success');

  // Close the panel and refresh
  document.getElementById('wb-inline-entry')?.classList.add('hidden');
  await renderWorkbookOverview();
  if (window.poamWorkbookState.activeTab === 'system') {
    await renderWorkbookSystemTable(systemId);
  }
}

window.poamWorkbookToggleInlineEntry = poamWorkbookToggleInlineEntry;
window.poamWorkbookInlineAddRow = poamWorkbookInlineAddRow;
window.poamWorkbookInlineUpdateCount = poamWorkbookInlineUpdateCount;
window.poamWorkbookInlineSaveAll = poamWorkbookInlineSaveAll;

window.POAM_WORKBOOK_INTERNAL_FIELDS = {
  assetsImpacted: 'Assets Impacted'
};
