'use strict';

console.log('📦 scope-settings-ui.js loading...');

// ═══════════════════════════════════════════════════════════════
// SCOPE SETTINGS UI — Scope rules, registry, PCA mapping
// ═══════════════════════════════════════════════════════════════

async function renderScopeRules() {
    const container = document.getElementById('scope-rules-container');
    if (!container) return;

    const config = window.scopeRegistry.getRules();
    if (config.rules.length === 0) {
        container.innerHTML = '<p class="text-sm text-slate-400">No rules configured. Add a rule to enable automatic scope detection.</p>';
        return;
    }

    container.innerHTML = config.rules.map((rule, idx) => `
        <div style="padding:12px;border:1px solid #E2E4E8;border-radius:8px;margin-bottom:8px;background:#FAFAFA">
            <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
                <div>
                    <label class="text-[10px] font-semibold text-slate-500 uppercase">Source</label>
                    <select id="scope-rule-source-${idx}" class="block px-2 py-1 text-sm border border-slate-300 rounded" onchange="updateScopeRule(${idx})">
                        <option value="wiz" ${rule.source === 'wiz' ? 'selected' : ''}>Wiz</option>
                        <option value="qualys" ${rule.source === 'qualys' ? 'selected' : ''}>Qualys</option>
                    </select>
                </div>
                <div>
                    <label class="text-[10px] font-semibold text-slate-500 uppercase">Field Name</label>
                    <input type="text" id="scope-rule-field-${idx}" value="${rule.field || ''}" class="block px-2 py-1 text-sm border border-slate-300 rounded w-40" placeholder="e.g. PCA Code, Projects" onchange="updateScopeRule(${idx})">
                </div>
                <div>
                    <label class="text-[10px] font-semibold text-slate-500 uppercase">Mode</label>
                    <select id="scope-rule-mode-${idx}" class="block px-2 py-1 text-sm border border-slate-300 rounded" onchange="updateScopeRule(${idx})">
                        <option value="auto" ${rule.mode === 'auto' ? 'selected' : ''}>Auto (use raw value)</option>
                        <option value="mapped" ${rule.mode === 'mapped' ? 'selected' : ''}>Mapped (PCA lookup)</option>
                    </select>
                </div>
                <div style="margin-left:auto">
                    <button onclick="removeScopeRule(${idx})" class="text-red-500 hover:text-red-700 text-sm" title="Remove rule">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

function addScopeRule() {
    const config = window.scopeRegistry.getRules();
    config.rules.push({ source: 'wiz', field: '', mode: 'auto', mappings: {} });
    window.scopeRegistry.saveRules(config);
    renderScopeRules();
}

function updateScopeRule(idx) {
    const config = window.scopeRegistry.getRules();
    if (!config.rules[idx]) return;

    const source = document.getElementById(`scope-rule-source-${idx}`)?.value || 'wiz';
    const field = document.getElementById(`scope-rule-field-${idx}`)?.value || '';
    const mode = document.getElementById(`scope-rule-mode-${idx}`)?.value || 'auto';

    config.rules[idx].source = source;
    config.rules[idx].field = field;
    config.rules[idx].mode = mode;
    window.scopeRegistry.saveRules(config);
}

function removeScopeRule(idx) {
    const config = window.scopeRegistry.getRules();
    config.rules.splice(idx, 1);
    window.scopeRegistry.saveRules(config);
    renderScopeRules();
}

async function renderScopesTable() {
    const tbody = document.getElementById('scopes-table-body');
    if (!tbody || !window.poamDB) return;

    const scopes = await window.poamDB.getAllScopes();
    if (scopes.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="px-3 py-4 text-center text-sm text-slate-400">No scopes registered yet</td></tr>';
        return;
    }

    tbody.innerHTML = scopes.map(scope => `
        <tr style="border-bottom:1px solid #F3F4F6">
            <td class="px-3 py-2">
                <input type="text" value="${scope.displayName}" class="px-2 py-1 text-sm border border-slate-300 rounded w-48"
                    onchange="updateScopeDisplayName('${scope.id}', this.value)">
            </td>
            <td class="px-3 py-2 text-xs text-slate-500 font-mono">${scope.id}</td>
            <td class="px-3 py-2 text-xs text-slate-500">${scope.autoCreated ? 'Yes' : 'No'}</td>
            <td class="px-3 py-2">
                <button onclick="deleteScopeWithConfirm('${scope.id}')" class="text-red-500 hover:text-red-700 text-sm" title="Delete scope">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

async function updateScopeDisplayName(scopeId, newName) {
    const scope = await window.poamDB.getScope(scopeId);
    if (!scope) return;
    scope.displayName = newName;
    await window.poamDB.saveScope(scope);
    console.log(`📦 Updated scope "${scopeId}" display name to "${newName}"`);
}

async function deleteScopeWithConfirm(scopeId) {
    if (!confirm(`Delete scope "${scopeId}"? POAMs will be set to Unassigned.`)) return;

    // Set all POAMs with this scope to unassigned
    const poams = await window.poamDB.getPOAMsByScope(scopeId);
    for (const poam of poams) {
        poam.scopeId = null;
        poam.scopeSource = null;
        await window.poamDB.savePOAM(poam);
    }

    await window.poamDB.deleteScope(scopeId);
    renderScopesTable();
    console.log(`📦 Deleted scope "${scopeId}", ${poams.length} POAMs set to Unassigned`);
}

// ═══════════════════════════════════════════════════════════════
// PCA CODE MAPPING — Map PCA codes to application scopes
// ═══════════════════════════════════════════════════════════════

const PCA_MAPPING_KEY = 'pcaMappings';

function getPCAMappings() {
    try {
        const saved = localStorage.getItem(PCA_MAPPING_KEY);
        return saved ? JSON.parse(saved) : [];
    } catch (e) {
        return [];
    }
}

function savePCAMappings(mappings) {
    localStorage.setItem(PCA_MAPPING_KEY, JSON.stringify(mappings));
}

function renderPCAMappings() {
    const container = document.getElementById('pca-mapping-container');
    if (!container) return;

    const mappings = getPCAMappings();
    if (mappings.length === 0) {
        container.innerHTML = '<p class="text-sm text-slate-400">No PCA mappings configured. Add a mapping to route findings by PCA code.</p>';
        return;
    }

    container.innerHTML = mappings.map((m, idx) => `
        <div style="padding:10px 12px;border:1px solid #E2E4E8;border-radius:8px;margin-bottom:6px;background:#FAFAFA;display:flex;align-items:center;gap:12px">
            <div>
                <label class="text-[10px] font-semibold text-slate-500 uppercase">PCA Code</label>
                <input type="text" id="pca-code-${idx}" value="${m.pcaCode || ''}" class="block px-2 py-1 text-sm border border-slate-300 rounded w-28" placeholder="e.g. FE410" onchange="updatePCAMapping(${idx})">
            </div>
            <div style="padding-top:14px;color:#9CA3AF"><i class="fas fa-arrow-right"></i></div>
            <div>
                <label class="text-[10px] font-semibold text-slate-500 uppercase">Application / Scope Name</label>
                <input type="text" id="pca-scope-${idx}" value="${m.scopeName || ''}" class="block px-2 py-1 text-sm border border-slate-300 rounded w-48" placeholder="e.g. EBRS Production" onchange="updatePCAMapping(${idx})">
            </div>
            <div style="margin-left:auto;padding-top:14px">
                <button onclick="removePCAMapping(${idx})" class="text-red-500 hover:text-red-700 text-sm" title="Remove mapping">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `).join('');
}

function addPCAMapping() {
    const mappings = getPCAMappings();
    mappings.push({ pcaCode: '', scopeName: '' });
    savePCAMappings(mappings);
    renderPCAMappings();
}

function updatePCAMapping(idx) {
    const mappings = getPCAMappings();
    if (!mappings[idx]) return;
    mappings[idx].pcaCode = document.getElementById(`pca-code-${idx}`)?.value || '';
    mappings[idx].scopeName = document.getElementById(`pca-scope-${idx}`)?.value || '';
    savePCAMappings(mappings);

    // Sync to scope rules as mapped mode
    syncPCAToScopeRules();
}

function removePCAMapping(idx) {
    const mappings = getPCAMappings();
    mappings.splice(idx, 1);
    savePCAMappings(mappings);
    renderPCAMappings();
    syncPCAToScopeRules();
}

function syncPCAToScopeRules() {
    // Build mappings object from PCA mappings for scope registry
    const mappings = getPCAMappings();
    const pcaMap = {};
    for (const m of mappings) {
        if (m.pcaCode && m.scopeName) {
            pcaMap[m.pcaCode] = window.scopeRegistry.normalizeId(m.scopeName);
        }
    }

    // Update or create a Wiz rule with PCA Code field and mapped mode
    if (Object.keys(pcaMap).length > 0) {
        window.scopeRegistry.saveRuleForSource('wiz', 'PCA Code', 'mapped', pcaMap);
    }
}

// Called when Settings > Scopes tab is shown
async function initScopeSettings() {
    await renderScopeRules();
    await renderScopesTable();
    renderPCAMappings();
}

// Expose globally
window.renderScopeRules = renderScopeRules;
window.addScopeRule = addScopeRule;
window.updateScopeRule = updateScopeRule;
window.removeScopeRule = removeScopeRule;
window.renderScopesTable = renderScopesTable;
window.updateScopeDisplayName = updateScopeDisplayName;
window.deleteScopeWithConfirm = deleteScopeWithConfirm;
window.initScopeSettings = initScopeSettings;
window.renderPCAMappings = renderPCAMappings;
window.addPCAMapping = addPCAMapping;
window.updatePCAMapping = updatePCAMapping;
window.removePCAMapping = removePCAMapping;

console.log('✅ scope-settings-ui.js loaded');
