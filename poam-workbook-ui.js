// Workbook UI module (isolated)

window.poamWorkbookState = {
  activeTab: 'overview',
  activeSystemId: 'default',
  pendingOpenSystemId: null,
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
    ${systems.map(s => {
      const active = s.id === activeId;
      return `
        <a href="#" onclick="poamWorkbookNavigateToSystem('${s.id}')" class="sidebar-sublink flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-slate-800 transition-colors ${active ? 'bg-slate-700 text-white' : ''}">
          <i class="fas fa-server text-xs w-4 text-slate-300"></i>
          <span>${escapeHtml(s.name)}</span>
        </a>
      `;
    }).join('')}
  `;
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
          <p class="text-sm text-slate-500 mt-1">Paste one or more POAM entries (label: value). Items will be mapped into the workbook columns and saved to the active system.</p>
        </div>
        <button id="wb-paste-close" class="text-slate-400 hover:text-slate-600"><i class="fas fa-times"></i></button>
      </div>
      <div class="space-y-3">
        <div class="text-xs text-slate-500">Active system: <span class="font-mono">${escapeHtml(window.poamWorkbookState.activeSystemId)}</span></div>
        <textarea id="wb-paste-text" class="w-full h-64 px-3 py-2 border border-slate-200 rounded-lg font-mono text-xs" placeholder="Example:\nItem number: 12\nVulnerability Name: Weak cipher suites\nVulnerability Description: ...\nStatus: Open\nSeverity Value: High\n\nItem number: 13\n...\n"></textarea>
      </div>
      <div class="flex justify-end gap-3 mt-6">
        <button id="wb-paste-cancel" class="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300">Cancel</button>
        <button id="wb-paste-import" class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Import Paste</button>
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

      const parsed = poamWorkbookParsePastedPOAMs(text);
      if (parsed.items.length === 0) throw new Error('No POAM items detected');

      let created = 0;
      let updated = 0;
      for (const item of parsed.items) {
        // Ensure we always write all authoritative columns
        const data = {
          ...Object.fromEntries((window.POAM_WORKBOOK_COLUMNS || []).map(c => [c, item[c] ?? ''])),
          [window.POAM_WORKBOOK_INTERNAL_FIELDS.assetsImpacted]: item[window.POAM_WORKBOOK_INTERNAL_FIELDS.assetsImpacted] || ''
        };

        // Parse embedded Assets Impacted from pasted affected components if present
        const rawAffected = String(data['Affected Components/URLs'] || '');
        const extracted = poamWorkbookExtractAssetsImpacted(rawAffected);
        data['Affected Components/URLs'] = extracted.affectedComponents;
        if (!data[window.POAM_WORKBOOK_INTERNAL_FIELDS.assetsImpacted]) {
          data[window.POAM_WORKBOOK_INTERNAL_FIELDS.assetsImpacted] = extracted.assetsImpacted;
        }

        const n = parseInt(String(data['Item number'] || '').trim(), 10);
        if (Number.isFinite(n) && n > 0 && typeof window.poamWorkbookDB.upsertItemBySystemAndItemNumber === 'function') {
          const res = await window.poamWorkbookDB.upsertItemBySystemAndItemNumber(systemId, n, data);
          if (res.created) created++; else updated++;
        } else {
          const nextNum = await window.poamWorkbookDB.getNextItemNumber(systemId);
          data['Item number'] = nextNum;
          await window.poamWorkbookDB.saveItem({
            id: `WB-${systemId}-${Date.now()}-${created}-${updated}`,
            systemId,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            ...data
          });
          created++;
        }
      }

      window.poamWorkbookNotifyMutation();
      await renderWorkbookSidebarSystems();
      await renderWorkbookOverview();

      const msg = updated > 0 ? `Imported ${created} new, updated ${updated}` : `Imported ${created}`;
      showUpdateFeedback(msg, 'success');
      close();
    } catch (e) {
      console.error(e);
      showUpdateFeedback(`Paste import failed: ${e.message}`, 'error');
    }
  });
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
      return `
      <tr class="border-b border-slate-100 hover:bg-indigo-50 transition-colors cursor-pointer" onclick="poamWorkbookOpenItemDetails('${id}')">
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

  newItem['Item number'] = nextNum;
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
  } finally {
    input.value = '';
  }
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
            ${renderFieldText('Resources Required', item['Resources Required'])}
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
                ${controls.families.map(f => `<button type="button" class="px-2 py-1 text-xs bg-slate-100 rounded" onclick="wbAppendControl('${escapeAttr(f)}')">${escapeHtml(f)}</button>`).join('')}
              </div>
              <div class="text-xs text-slate-600 mt-2">Controls</div>
              <div class="flex flex-wrap gap-1">
                ${controls.controls.map(c => `<button type="button" class="px-2 py-1 text-xs bg-slate-100 rounded" onclick="wbAppendControl('${escapeAttr(c)}')">${escapeHtml(c)}</button>`).join('')}
              </div>
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

  const close = () => {
    modal.remove();
    delete window.wbAppendControl;
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

      await renderWorkbookSystemsSelects();
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
