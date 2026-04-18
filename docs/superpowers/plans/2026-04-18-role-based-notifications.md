# Role-Based Notification System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the three global notification toggles in Settings with a role-based notification matrix and role contacts card, and add a notification role dropdown to Admin > Users.

**Architecture:** The notification matrix UI is a table of checkboxes (9 events x 7 roles) rendered in `partials/settings.html`. Config is saved/loaded from localStorage via functions in `sidebar-navigation.js`. The Admin user table in `partials/admin.html` gets a Notification Role column with a dropdown. No new files — all changes fit into existing files following established patterns.

**Tech Stack:** HTML (Tailwind CDN classes), vanilla JS, localStorage

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `partials/settings.html` | Modify lines 83-96 | Replace Notification Preferences card with Notification Rules matrix + Role Contacts card |
| `sidebar-navigation.js` | Modify ~line 197 | Add save/load/reset functions for notification rules and role contacts |
| `partials/admin.html` | Modify lines 26-53 | Add Notification Role column header and dropdown to user table |

---

### Task 1: Replace Notification Preferences card with Notification Rules matrix

**Files:**
- Modify: `partials/settings.html:83-96` (the Notification Preferences card)

- [ ] **Step 1: Remove the old Notification Preferences card**

In `partials/settings.html`, replace everything from line 83 (`<div class="card mb-6">` with "Notification Preferences" title) through line 96 (closing `</div>` of that card, just before the System Inventory card at line 98) with the new Notification Rules matrix card:

```html
                <div class="card mb-6">
                    <div class="card-head mb-4">
                        <h2 class="card-title flex items-center gap-2">
                            <span class="w-2 h-5 bg-teal-700 rounded-full"></span>
                            Notification Rules
                        </h2>
                        <p class="card-sub mt-1">Configure which roles receive in-app notifications for each event type</p>
                    </div>
                    <div class="px-5 pb-5">
                        <div class="overflow-x-auto">
                            <table class="w-full text-sm" id="notification-matrix-table">
                                <thead>
                                    <tr class="border-b border-slate-200">
                                        <th class="text-left py-2.5 px-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Event</th>
                                        <th class="text-center py-2.5 px-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">POC</th>
                                        <th class="text-center py-2.5 px-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">App Owner</th>
                                        <th class="text-center py-2.5 px-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">ISSO</th>
                                        <th class="text-center py-2.5 px-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">ISSM</th>
                                        <th class="text-center py-2.5 px-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">CISO/AO</th>
                                        <th class="text-center py-2.5 px-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Analyst</th>
                                        <th class="text-center py-2.5 px-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Auditor</th>
                                    </tr>
                                </thead>
                                <tbody id="notification-matrix-body" class="divide-y divide-slate-100">
                                    <!-- Populated by loadNotificationRules() -->
                                </tbody>
                            </table>
                        </div>

                        <div class="bg-slate-50 rounded-lg p-4 border border-slate-200 mt-6 mb-6">
                            <p class="text-xs text-slate-500"><strong class="text-slate-600">How it works:</strong> When an event occurs on a POA&M, all roles with a checked box receive an in-app notification. POC is resolved from the POA&M assignment. App Owner is resolved from the system in Settings &gt; System Inventory.</p>
                        </div>

                        <div class="flex justify-end gap-3">
                            <button onclick="resetNotificationDefaults()" class="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 bg-white hover:bg-slate-50">
                                <i class="fas fa-redo mr-2"></i>Reset Defaults
                            </button>
                            <button onclick="saveNotificationRules()" class="px-4 py-2 bg-teal-700 text-white rounded-lg text-sm font-medium hover:bg-teal-800">
                                <i class="fas fa-save mr-2"></i>Save Notification Rules
                            </button>
                        </div>
                    </div>
                </div>
```

- [ ] **Step 2: Verify the card renders**

Open the app at `http://localhost:8080`, navigate to Settings > General. The old three-toggle card should be gone, replaced by the Notification Rules card with an empty table body (the JS to populate it comes in Task 3).

- [ ] **Step 3: Commit**

```bash
git add partials/settings.html
git commit -m "feat: replace notification preferences with notification rules matrix card"
```

---

### Task 2: Add Role Contacts card below the matrix

**Files:**
- Modify: `partials/settings.html` (insert after the Notification Rules card, before the System Inventory card)

- [ ] **Step 1: Add the Role Contacts card**

In `partials/settings.html`, immediately after the closing `</div>` of the Notification Rules card (from Task 1) and before the System Inventory card (`<div class="card">` with "System Inventory" title), insert:

```html
                <div class="card mb-6">
                    <div class="card-head mb-4">
                        <h2 class="card-title flex items-center gap-2">
                            <span class="w-2 h-5 bg-teal-700 rounded-full"></span>
                            Role Contacts
                        </h2>
                        <p class="card-sub mt-1">Map organizational roles to contacts for notification routing</p>
                    </div>
                    <div class="px-5 pb-5">
                        <div class="overflow-x-auto">
                            <table class="w-full text-sm">
                                <thead>
                                    <tr class="border-b border-slate-200">
                                        <th class="text-left py-2.5 px-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider w-1/3">Role</th>
                                        <th class="text-left py-2.5 px-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Contact / Distribution Group</th>
                                    </tr>
                                </thead>
                                <tbody class="divide-y divide-slate-100">
                                    <tr>
                                        <td class="py-3 px-3 text-sm font-medium text-slate-700">ISSO</td>
                                        <td class="py-3 px-3"><input type="text" id="role-contact-isso" class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm teal-focus focus:ring-2 focus:outline-none" placeholder="e.g. isso@agency.gov"></td>
                                    </tr>
                                    <tr>
                                        <td class="py-3 px-3 text-sm font-medium text-slate-700">ISSM</td>
                                        <td class="py-3 px-3"><input type="text" id="role-contact-issm" class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm teal-focus focus:ring-2 focus:outline-none" placeholder="e.g. issm@agency.gov"></td>
                                    </tr>
                                    <tr>
                                        <td class="py-3 px-3 text-sm font-medium text-slate-700">CISO / AO</td>
                                        <td class="py-3 px-3"><input type="text" id="role-contact-ciso" class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm teal-focus focus:ring-2 focus:outline-none" placeholder="e.g. ciso@agency.gov"></td>
                                    </tr>
                                    <tr>
                                        <td class="py-3 px-3 text-sm font-medium text-slate-700">Security Analyst</td>
                                        <td class="py-3 px-3"><input type="text" id="role-contact-analyst" class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm teal-focus focus:ring-2 focus:outline-none" placeholder="e.g. security-team@agency.gov"></td>
                                    </tr>
                                    <tr>
                                        <td class="py-3 px-3 text-sm font-medium text-slate-700">Auditor</td>
                                        <td class="py-3 px-3"><input type="text" id="role-contact-auditor" class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm teal-focus focus:ring-2 focus:outline-none" placeholder="e.g. audit@agency.gov"></td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        <div class="bg-slate-50 rounded-lg p-4 border border-slate-200 mt-4 mb-6">
                            <p class="text-xs text-slate-500"><strong class="text-slate-600">Note:</strong> POC and App Owner are not listed here. POC contacts are resolved from the POA&M's assigned team. App Owner contacts are resolved from the system owner in System Inventory.</p>
                        </div>

                        <div class="flex justify-end">
                            <button onclick="saveRoleContacts()" class="px-4 py-2 bg-teal-700 text-white rounded-lg text-sm font-medium hover:bg-teal-800">
                                <i class="fas fa-save mr-2"></i>Save Contacts
                            </button>
                        </div>
                    </div>
                </div>
```

- [ ] **Step 2: Verify both cards render in order**

Open Settings > General. Order should be: SLA Thresholds, Notification Rules (matrix), Role Contacts, System Inventory.

- [ ] **Step 3: Commit**

```bash
git add partials/settings.html
git commit -m "feat: add role contacts card to settings general tab"
```

---

### Task 3: Add notification rules JS functions to sidebar-navigation.js

**Files:**
- Modify: `sidebar-navigation.js:~197` (after `loadSLAConfig` function, before `saveRiskFramework`)

- [ ] **Step 1: Add the default matrix constant and save/load/reset/render functions**

In `sidebar-navigation.js`, insert the following block after the closing `}` of `loadSLAConfig()` (line 196) and before the `function saveRiskFramework()` line (line 198):

```javascript

// Notification Rules (role-based matrix)
const NOTIFICATION_DEFAULTS = {
    poam_created:        { poc: true, appOwner: true, isso: false, issm: true, ciso: false, analyst: true, auditor: false },
    poam_assigned:       { poc: true, appOwner: true, isso: false, issm: false, ciso: false, analyst: true, auditor: false },
    status_changed:      { poc: true, appOwner: true, isso: false, issm: false, ciso: false, analyst: true, auditor: false },
    sla_warning:         { poc: true, appOwner: true, isso: true, issm: false, ciso: false, analyst: false, auditor: false },
    sla_breach:          { poc: true, appOwner: true, isso: true, issm: true, ciso: true, analyst: true, auditor: false },
    extension_requested: { poc: false, appOwner: false, isso: true, issm: true, ciso: false, analyst: false, auditor: false },
    extension_decided:   { poc: true, appOwner: false, isso: false, issm: false, ciso: false, analyst: false, auditor: false },
    evidence_submitted:  { poc: false, appOwner: false, isso: false, issm: false, ciso: false, analyst: true, auditor: true },
    weekly_digest:       { poc: true, appOwner: true, isso: true, issm: true, ciso: false, analyst: true, auditor: false }
};

const NOTIFICATION_EVENT_LABELS = {
    poam_created: 'New POA&M created',
    poam_assigned: 'POA&M assigned / reassigned',
    status_changed: 'Status changed',
    sla_warning: 'SLA warning',
    sla_breach: 'SLA breach',
    extension_requested: 'Extension requested',
    extension_decided: 'Extension approved / denied',
    evidence_submitted: 'Evidence submitted',
    weekly_digest: 'Weekly digest'
};

const NOTIFICATION_ROLE_KEYS = ['poc', 'appOwner', 'isso', 'issm', 'ciso', 'analyst', 'auditor'];

function renderNotificationMatrix(rules) {
    const tbody = document.getElementById('notification-matrix-body');
    if (!tbody) return;

    tbody.innerHTML = '';
    const eventKeys = Object.keys(NOTIFICATION_EVENT_LABELS);

    eventKeys.forEach(eventKey => {
        const tr = document.createElement('tr');
        // Event label cell
        const tdLabel = document.createElement('td');
        tdLabel.className = 'py-3 px-3 text-sm font-medium text-slate-700';
        tdLabel.textContent = NOTIFICATION_EVENT_LABELS[eventKey];
        tr.appendChild(tdLabel);

        // Checkbox cells for each role
        NOTIFICATION_ROLE_KEYS.forEach(roleKey => {
            const td = document.createElement('td');
            td.className = 'py-3 px-2 text-center';
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = `notif-${eventKey}-${roleKey}`;
            checkbox.className = 'rounded text-teal-700 focus:ring-teal-500 cursor-pointer';
            checkbox.checked = !!(rules[eventKey] && rules[eventKey][roleKey]);
            td.appendChild(checkbox);
            tr.appendChild(td);
        });

        tbody.appendChild(tr);
    });
}

function saveNotificationRules() {
    const rules = {};
    const eventKeys = Object.keys(NOTIFICATION_EVENT_LABELS);

    eventKeys.forEach(eventKey => {
        rules[eventKey] = {};
        NOTIFICATION_ROLE_KEYS.forEach(roleKey => {
            const cb = document.getElementById(`notif-${eventKey}-${roleKey}`);
            rules[eventKey][roleKey] = cb ? cb.checked : false;
        });
    });

    localStorage.setItem('notificationRules', JSON.stringify(rules));
    alert('Notification rules saved successfully.');
}

function loadNotificationRules() {
    const saved = localStorage.getItem('notificationRules');
    const rules = saved ? JSON.parse(saved) : JSON.parse(JSON.stringify(NOTIFICATION_DEFAULTS));
    renderNotificationMatrix(rules);
}

function resetNotificationDefaults() {
    if (confirm('Reset notification rules to default values?')) {
        const defaults = JSON.parse(JSON.stringify(NOTIFICATION_DEFAULTS));
        localStorage.setItem('notificationRules', JSON.stringify(defaults));
        renderNotificationMatrix(defaults);
    }
}

function saveRoleContacts() {
    const contacts = {
        isso: (document.getElementById('role-contact-isso') || {}).value || '',
        issm: (document.getElementById('role-contact-issm') || {}).value || '',
        ciso: (document.getElementById('role-contact-ciso') || {}).value || '',
        analyst: (document.getElementById('role-contact-analyst') || {}).value || '',
        auditor: (document.getElementById('role-contact-auditor') || {}).value || ''
    };
    localStorage.setItem('roleContacts', JSON.stringify(contacts));
    alert('Role contacts saved successfully.');
}

function loadRoleContacts() {
    const saved = localStorage.getItem('roleContacts');
    if (saved) {
        const contacts = JSON.parse(saved);
        const fields = ['isso', 'issm', 'ciso', 'analyst', 'auditor'];
        fields.forEach(role => {
            const el = document.getElementById(`role-contact-${role}`);
            if (el) el.value = contacts[role] || '';
        });
    }
}

```

- [ ] **Step 2: Hook load functions into the General tab loader**

In `sidebar-navigation.js`, find the block at approximately line 88:

```javascript
    if (finalTabName === 'general') {
        loadSLAConfig();
        if (typeof settingsManager !== 'undefined') {
            settingsManager.renderSystemsSettings();
        }
```

Replace it with:

```javascript
    if (finalTabName === 'general') {
        loadSLAConfig();
        loadNotificationRules();
        loadRoleContacts();
        if (typeof settingsManager !== 'undefined') {
            settingsManager.renderSystemsSettings();
        }
```

- [ ] **Step 3: Verify the matrix populates on tab load**

Open Settings > General. The Notification Rules table should render 9 rows with checkboxes. Default checked states should match the `NOTIFICATION_DEFAULTS` object. Toggle a few checkboxes, click Save, refresh the page — selections should persist.

- [ ] **Step 4: Verify reset works**

Click "Reset Defaults", confirm the dialog. All checkboxes should revert to defaults.

- [ ] **Step 5: Verify Role Contacts save/load**

Enter values into the Role Contacts fields, click Save. Refresh. Values should persist.

- [ ] **Step 6: Commit**

```bash
git add sidebar-navigation.js
git commit -m "feat: add notification rules and role contacts save/load/render logic"
```

---

### Task 4: Add Notification Role column to Admin > Users table

**Files:**
- Modify: `partials/admin.html:26-53` (user management table)

- [ ] **Step 1: Add the Notification Role column header**

In `partials/admin.html`, find the `<thead>` row (lines 25-32). Between the "Role" `<th>` and the "Department" `<th>`, add a new column header:

```html
                                        <th style="font-size:10px;font-weight:700;color:#6B7280;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #F3F4F6;padding:10px 12px;text-align:left">Notification Role</th>
```

- [ ] **Step 2: Add the Notification Role dropdown cell to the existing user row**

In `partials/admin.html`, find the Admin User row (lines 35-53). Between the "Role" `<td>` (the `<span>Administrator</span>` cell, line 45) and the "Department" `<td>` (line 46), add a new cell:

```html
                                        <td style="padding:12px">
                                            <select style="border:1px solid #D1D5DB;border-radius:6px;padding:4px 8px;font-size:12px;color:#374151;font-family:inherit;outline:none;min-width:130px" class="user-notification-role" data-user="admin">
                                                <option value="">(none)</option>
                                                <option value="isso">ISSO</option>
                                                <option value="issm">ISSM</option>
                                                <option value="ciso">CISO / AO</option>
                                                <option value="appOwner">App Owner</option>
                                                <option value="analyst">Security Analyst</option>
                                                <option value="auditor">Auditor</option>
                                                <option value="poc">POC</option>
                                            </select>
                                        </td>
```

- [ ] **Step 3: Verify the column renders**

Open Admin > Users. The table should now show a "Notification Role" column between "Role" and "Department" with a dropdown on the Admin User row.

- [ ] **Step 4: Commit**

```bash
git add partials/admin.html
git commit -m "feat: add notification role dropdown to admin user management table"
```

---

### Task 5: Wire notification role persistence in sidebar-navigation.js

**Files:**
- Modify: `sidebar-navigation.js` (add functions after the role contacts block from Task 3)

- [ ] **Step 1: Add save/load for user notification roles**

In `sidebar-navigation.js`, after the `loadRoleContacts()` function added in Task 3, insert:

```javascript
// User notification role persistence
function saveUserNotificationRole(userId, role) {
    const saved = localStorage.getItem('userNotificationRoles');
    const roles = saved ? JSON.parse(saved) : {};
    roles[userId] = role || null;
    localStorage.setItem('userNotificationRoles', JSON.stringify(roles));
}

function loadUserNotificationRoles() {
    const saved = localStorage.getItem('userNotificationRoles');
    if (!saved) return;
    const roles = JSON.parse(saved);
    document.querySelectorAll('.user-notification-role').forEach(select => {
        const userId = select.getAttribute('data-user');
        if (userId && roles[userId]) {
            select.value = roles[userId];
        }
    });
}

// Attach change listeners to notification role dropdowns
function initUserNotificationRoles() {
    document.querySelectorAll('.user-notification-role').forEach(select => {
        select.addEventListener('change', function() {
            const userId = this.getAttribute('data-user');
            saveUserNotificationRole(userId, this.value);
        });
    });
    loadUserNotificationRoles();
}
```

- [ ] **Step 2: Call init on Admin Users tab load**

In `sidebar-navigation.js`, find the `showAdminTab` function (approximately line 125). After the line that shows the selected tab and before the mobile sidebar close, add:

```javascript
    if (tabName === 'users') {
        initUserNotificationRoles();
    }
```

Find the exact insertion point — it should go after `if (activeTabBtn) activeTabBtn.classList.add('active');` (approximately line 142) and before the mobile sidebar check.

- [ ] **Step 3: Verify persistence**

Open Admin > Users. Select "ISSM" from the notification role dropdown on the Admin User row. Refresh the page, navigate back to Admin > Users. The dropdown should still show "ISSM".

- [ ] **Step 4: Commit**

```bash
git add sidebar-navigation.js
git commit -m "feat: persist user notification role selection in admin users tab"
```

---

### Task 6: Update notification-config.js recipients to reference the matrix

**Files:**
- Modify: `config/notification-config.js:142-157` (recipients section)

- [ ] **Step 1: Add a getNotificationRecipients utility function**

In `config/notification-config.js`, after the `loadPersistedConfig()` call (line 296) and before the final `console.log` lines, insert:

```javascript
// Resolve notification recipients for an event using the role-based matrix
window.getNotificationRecipients = function(eventKey, poam) {
    const saved = localStorage.getItem('notificationRules');
    if (!saved) return [];

    const rules = JSON.parse(saved);
    const eventRules = rules[eventKey];
    if (!eventRules) return [];

    const recipients = [];
    const roleContacts = JSON.parse(localStorage.getItem('roleContacts') || '{}');
    const userRoles = JSON.parse(localStorage.getItem('userNotificationRoles') || '{}');

    // POC — resolved from POA&M
    if (eventRules.poc && poam) {
        const pocTeam = poam.pocTeam || poam.poc;
        if (pocTeam) recipients.push({ role: 'poc', contact: pocTeam, source: 'poam' });
    }

    // App Owner — resolved from system assignment
    if (eventRules.appOwner && poam && poam.systemId) {
        // Find users with appOwner role (future: resolve from System Inventory owner field)
        Object.entries(userRoles).forEach(([userId, role]) => {
            if (role === 'appOwner') recipients.push({ role: 'appOwner', contact: userId, source: 'user' });
        });
    }

    // Static roles — resolved from role contacts + user list
    ['isso', 'issm', 'ciso', 'analyst', 'auditor'].forEach(roleKey => {
        if (!eventRules[roleKey]) return;

        // Add from role contacts (distribution list)
        if (roleContacts[roleKey]) {
            recipients.push({ role: roleKey, contact: roleContacts[roleKey], source: 'roleContacts' });
        }

        // Add individual users assigned this role
        Object.entries(userRoles).forEach(([userId, userRole]) => {
            if (userRole === roleKey) {
                recipients.push({ role: roleKey, contact: userId, source: 'user' });
            }
        });
    });

    // Deduplicate by contact
    const seen = new Set();
    return recipients.filter(r => {
        if (seen.has(r.contact)) return false;
        seen.add(r.contact);
        return true;
    });
};
```

- [ ] **Step 2: Verify the function is accessible**

Open the browser console and run:

```javascript
getNotificationRecipients('sla_breach', { pocTeam: 'Windows Systems Team', systemId: 'sys-001' });
```

Expected: Returns an array. If no user roles or contacts are configured yet, returns only the POC entry `{ role: 'poc', contact: 'Windows Systems Team', source: 'poam' }`.

- [ ] **Step 3: Commit**

```bash
git add config/notification-config.js
git commit -m "feat: add getNotificationRecipients resolver using role-based matrix"
```
