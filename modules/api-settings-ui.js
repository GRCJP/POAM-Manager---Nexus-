// ═══════════════════════════════════════════════════════════════
// API SETTINGS UI
// User interface for managing API integrations
// ═══════════════════════════════════════════════════════════════

async function renderAPISettingsTab() {
    const container = document.getElementById('api-settings-content');
    if (!container) {
        console.error('API settings container not found');
        return;
    }

    // Initialize API manager if needed
    if (!window.apiIntegrationManager.db) {
        await window.apiIntegrationManager.init();
    }

    // Load existing connections
    const connections = Array.from(window.apiIntegrationManager.activeConnections.values());

    let html = `
        <div class="space-y-6">
            <!-- Header -->
            <div class="flex items-center justify-between">
                <div>
                    <h3 class="text-lg font-semibold text-slate-800">API Integrations</h3>
                    <p class="text-sm text-slate-500 mt-1">Configure scheduled scan imports from vulnerability scanners</p>
                </div>
                <button onclick="showAddAPIConnectionModal()" class="px-4 py-2 bg-teal-700 text-white rounded-lg hover:bg-teal-800 font-medium">
                    <i class="fas fa-plus mr-2"></i>Add Connection
                </button>
            </div>

            <!-- Connections List -->
            <div class="space-y-4">
    `;

    if (connections.length === 0) {
        html += `
            <div class="bg-slate-50 border border-slate-200 rounded-lg p-8 text-center">
                <i class="fas fa-plug text-slate-400 text-4xl mb-3"></i>
                <p class="text-slate-600 font-medium">No API connections configured</p>
                <p class="text-sm text-slate-500 mt-2">Add a connection to enable scheduled scan imports</p>
                <button onclick="showAddAPIConnectionModal()" class="mt-4 px-4 py-2 bg-teal-700 text-white rounded-lg hover:bg-teal-800">
                    Get Started
                </button>
            </div>
        `;
    } else {
        connections.forEach(conn => {
            const statusBadge = conn.enabled 
                ? '<span class="px-2 py-1 bg-green-100 text-green-700 text-xs rounded font-medium">Enabled</span>'
                : '<span class="px-2 py-1 bg-slate-200 text-slate-600 text-xs rounded font-medium">Disabled</span>';

            const lastSyncStatus = conn.lastSyncStatus 
                ? (conn.lastSyncStatus.status === 'success' 
                    ? `<span class="text-green-600"><i class="fas fa-check-circle"></i> ${conn.lastSyncStatus.message}</span>`
                    : `<span class="text-red-600"><i class="fas fa-exclamation-circle"></i> ${conn.lastSyncStatus.message}</span>`)
                : '<span class="text-slate-400">Never synced</span>';

            const lastSyncTime = conn.lastSync 
                ? new Date(conn.lastSync).toLocaleString()
                : 'N/A';

            html += `
                <div class="bg-white border border-slate-200 rounded-lg p-6 hover:shadow-md transition-shadow">
                    <div class="flex items-start justify-between mb-4">
                        <div class="flex-1">
                            <div class="flex items-center gap-3 mb-2">
                                <h4 class="text-lg font-semibold text-slate-800">${conn.name}</h4>
                                ${statusBadge}
                                <span class="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded font-medium">${conn.type.toUpperCase()}</span>
                            </div>
                            <p class="text-sm text-slate-600">${conn.baseUrl || 'Default endpoint'}</p>
                        </div>
                        <div class="flex gap-2">
                            <button onclick="testAPIConnection('${conn.id}')" class="px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded border border-blue-200">
                                <i class="fas fa-vial"></i> Test
                            </button>
                            <button onclick="syncAPIConnection('${conn.id}')" class="px-3 py-1.5 text-sm text-teal-700 hover:bg-teal-50 rounded border border-teal-100">
                                <i class="fas fa-sync-alt"></i> Sync Now
                            </button>
                            <button onclick="editAPIConnection('${conn.id}')" class="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 rounded border border-slate-200">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button onclick="deleteAPIConnection('${conn.id}')" class="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded border border-red-200">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>

                    <div class="grid grid-cols-3 gap-4 text-sm">
                        <div>
                            <span class="text-slate-500">Schedule:</span>
                            <span class="ml-2 font-medium text-slate-700">${conn.schedule || 'Manual only'}</span>
                        </div>
                        <div>
                            <span class="text-slate-500">Last Sync:</span>
                            <span class="ml-2 font-medium text-slate-700">${lastSyncTime}</span>
                        </div>
                        <div>
                            <span class="text-slate-500">Status:</span>
                            <span class="ml-2 text-sm">${lastSyncStatus}</span>
                        </div>
                    </div>
                </div>
            `;
        });
    }

    html += `
            </div>

            <!-- Info Box -->
            <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div class="flex items-start gap-3">
                    <i class="fas fa-info-circle text-blue-600 mt-1"></i>
                    <div class="text-sm text-blue-800">
                        <p class="font-medium mb-1">Supported Platforms</p>
                        <ul class="list-disc list-inside space-y-1 text-blue-700">
                            <li><strong>Tenable.io</strong> - Requires Access Key and Secret Key</li>
                            <li><strong>Qualys</strong> - Requires Username and Password</li>
                            <li><strong>Rapid7 InsightVM</strong> - Requires API Key</li>
                            <li><strong>Custom API</strong> - Any REST API returning vulnerability data</li>
                        </ul>
                        <p class="mt-3 text-xs">API credentials are encrypted and stored locally in your browser. Scheduled imports use the same analysis pipeline as manual CSV uploads.</p>
                    </div>
                </div>
            </div>
        </div>
    `;

    container.innerHTML = html;
}

// Show add connection modal
function showAddAPIConnectionModal() {
    const modal = document.createElement('div');
    modal.className = 'modal fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    modal.innerHTML = `
        <div class="bg-white rounded-lg shadow-xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h2 class="text-xl font-bold text-slate-800 mb-4">Add API Connection</h2>
            
            <form id="api-connection-form" class="space-y-4">
                <!-- Connection Name -->
                <div>
                    <label class="block text-sm font-medium text-slate-700 mb-1">Connection Name</label>
                    <input type="text" id="api-name" required class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500" placeholder="Production Tenable Scanner">
                </div>

                <!-- Platform Type -->
                <div>
                    <label class="block text-sm font-medium text-slate-700 mb-1">Platform</label>
                    <select id="api-type" required class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500" onchange="updateAPICredentialFields()">
                        <option value="">Select platform...</option>
                        <option value="tenable">Tenable.io</option>
                        <option value="qualys">Qualys</option>
                        <option value="rapid7">Rapid7 InsightVM</option>
                        <option value="custom">Custom API</option>
                    </select>
                </div>

                <!-- Base URL (optional for cloud platforms) -->
                <div id="api-url-field" style="display: none;">
                    <label class="block text-sm font-medium text-slate-700 mb-1">API Base URL</label>
                    <input type="url" id="api-url" class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500" placeholder="https://api.example.com">
                    <p class="text-xs text-slate-500 mt-1">Leave empty to use default cloud endpoint</p>
                </div>

                <!-- Credentials (dynamic based on platform) -->
                <div id="api-credentials-fields">
                    <p class="text-sm text-slate-500 italic">Select a platform to configure credentials</p>
                </div>

                <!-- Schedule -->
                <div>
                    <label class="block text-sm font-medium text-slate-700 mb-1">Sync Schedule</label>
                    <select id="api-schedule" class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500">
                        <option value="">Manual only</option>
                        <option value="30m">Every 30 minutes</option>
                        <option value="1h">Every hour</option>
                        <option value="4h">Every 4 hours</option>
                        <option value="daily">Daily</option>
                    </select>
                    <p class="text-xs text-slate-500 mt-1">Scheduled imports will run automatically in the background</p>
                </div>

                <!-- Enabled -->
                <div class="flex items-center">
                    <input type="checkbox" id="api-enabled" checked class="w-4 h-4 text-teal-700 border-slate-300 rounded focus:ring-teal-500">
                    <label for="api-enabled" class="ml-2 text-sm text-slate-700">Enable this connection</label>
                </div>

                <!-- Actions -->
                <div class="flex justify-end gap-3 pt-4 border-t">
                    <button type="button" onclick="this.closest('.modal').remove()" class="px-4 py-2 text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200">
                        Cancel
                    </button>
                    <button type="submit" class="px-4 py-2 bg-teal-700 text-white rounded-lg hover:bg-teal-800">
                        <i class="fas fa-save mr-2"></i>Save Connection
                    </button>
                </div>
            </form>
        </div>
    `;

    modal.onclick = (e) => {
        if (e.target === modal) modal.remove();
    };

    document.body.appendChild(modal);

    // Form submission
    document.getElementById('api-connection-form').onsubmit = async (e) => {
        e.preventDefault();
        await saveAPIConnection();
        modal.remove();
    };
}

// Update credential fields based on platform selection
function updateAPICredentialFields() {
    const type = document.getElementById('api-type').value;
    const urlField = document.getElementById('api-url-field');
    const credFields = document.getElementById('api-credentials-fields');

    // Show URL field for custom APIs
    urlField.style.display = type === 'custom' ? 'block' : 'none';

    let html = '';

    switch (type) {
        case 'tenable':
            html = `
                <div class="space-y-3">
                    <div>
                        <label class="block text-sm font-medium text-slate-700 mb-1">Access Key</label>
                        <input type="text" id="api-access-key" required class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500" placeholder="Your Tenable access key">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-slate-700 mb-1">Secret Key</label>
                        <input type="password" id="api-secret-key" required class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500" placeholder="Your Tenable secret key">
                    </div>
                </div>
            `;
            break;

        case 'qualys':
            html = `
                <div class="space-y-3">
                    <div>
                        <label class="block text-sm font-medium text-slate-700 mb-1">Username</label>
                        <input type="text" id="api-username" required class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500" placeholder="Your Qualys username">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-slate-700 mb-1">Password</label>
                        <input type="password" id="api-password" required class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500" placeholder="Your Qualys password">
                    </div>
                </div>
            `;
            break;

        case 'rapid7':
            html = `
                <div>
                    <label class="block text-sm font-medium text-slate-700 mb-1">API Key</label>
                    <input type="password" id="api-key" required class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500" placeholder="Your Rapid7 API key">
                </div>
            `;
            break;

        case 'custom':
            html = `
                <div>
                    <label class="block text-sm font-medium text-slate-700 mb-1">Bearer Token</label>
                    <input type="password" id="api-token" required class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500" placeholder="Your API bearer token">
                    <p class="text-xs text-slate-500 mt-1">API must return vulnerability data in our normalized format</p>
                </div>
            `;
            break;

        default:
            html = '<p class="text-sm text-slate-500 italic">Select a platform to configure credentials</p>';
    }

    credFields.innerHTML = html;
}

// Save API connection
async function saveAPIConnection() {
    const name = document.getElementById('api-name').value;
    const type = document.getElementById('api-type').value;
    const baseUrl = document.getElementById('api-url')?.value || '';
    const schedule = document.getElementById('api-schedule').value;
    const enabled = document.getElementById('api-enabled').checked;

    // Gather credentials based on type
    let credentials = {};
    switch (type) {
        case 'tenable':
            credentials = {
                accessKey: document.getElementById('api-access-key').value,
                secretKey: document.getElementById('api-secret-key').value
            };
            break;
        case 'qualys':
            credentials = {
                username: document.getElementById('api-username').value,
                password: document.getElementById('api-password').value
            };
            break;
        case 'rapid7':
            credentials = {
                apiKey: document.getElementById('api-key').value
            };
            break;
        case 'custom':
            credentials = {
                token: document.getElementById('api-token').value
            };
            break;
    }

    const connection = {
        id: `api-${Date.now()}`,
        name,
        type,
        baseUrl,
        credentials,
        schedule,
        enabled
    };

    try {
        await window.apiIntegrationManager.saveConnection(connection);
        
        // Start scheduled job if enabled
        if (enabled && schedule) {
            await window.apiIntegrationManager.scheduleSync(connection);
        }

        alert(`✅ API connection "${name}" saved successfully!`);
        await renderAPISettingsTab();
    } catch (error) {
        console.error('Failed to save API connection:', error);
        alert(`❌ Failed to save connection: ${error.message}`);
    }
}

// Test API connection
async function testAPIConnection(connectionId) {
    try {
        alert('🔄 Testing connection... This may take a moment.');
        await window.apiIntegrationManager.syncConnection(connectionId, true);
        alert('✅ Connection test successful!');
        await renderAPISettingsTab();
    } catch (error) {
        console.error('Connection test failed:', error);
        alert(`❌ Connection test failed: ${error.message}`);
    }
}

// Sync API connection manually
async function syncAPIConnection(connectionId) {
    try {
        alert('🔄 Starting sync... This may take a few minutes.');
        const result = await window.apiIntegrationManager.syncConnection(connectionId, true);
        alert(`✅ Sync complete! Processed ${result.counts?.poamsCreated || 0} POAMs.`);
        await renderAPISettingsTab();
        
        // Refresh dashboard if visible
        if (typeof loadDashboardMetrics === 'function') {
            await loadDashboardMetrics();
        }
    } catch (error) {
        console.error('Sync failed:', error);
        alert(`❌ Sync failed: ${error.message}`);
    }
}

// Delete API connection
async function deleteAPIConnection(connectionId) {
    const conn = window.apiIntegrationManager.activeConnections.get(connectionId);
    if (!conn) return;

    if (!confirm(`Delete API connection "${conn.name}"? This cannot be undone.`)) {
        return;
    }

    try {
        await window.apiIntegrationManager.deleteConnection(connectionId);
        alert('✅ Connection deleted');
        await renderAPISettingsTab();
    } catch (error) {
        console.error('Failed to delete connection:', error);
        alert(`❌ Failed to delete: ${error.message}`);
    }
}

// Edit API connection (simplified - just show the form with existing values)
function editAPIConnection(connectionId) {
    alert('Edit functionality coming soon. For now, please delete and recreate the connection.');
}

// Export functions globally
window.renderAPISettingsTab = renderAPISettingsTab;
window.showAddAPIConnectionModal = showAddAPIConnectionModal;
window.updateAPICredentialFields = updateAPICredentialFields;
window.saveAPIConnection = saveAPIConnection;
window.testAPIConnection = testAPIConnection;
window.syncAPIConnection = syncAPIConnection;
window.deleteAPIConnection = deleteAPIConnection;
window.editAPIConnection = editAPIConnection;
