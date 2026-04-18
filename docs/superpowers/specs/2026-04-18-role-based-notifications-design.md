# Role-Based Notification System

## Summary

Replace the three global notification toggles in Settings > General with a role-based notification matrix. Administrators configure which roles receive which event types. Users are assigned a single notification role in Admin > Users. Notifications are in-app only (no email delivery in this iteration).

## Roles

| Role | How resolved |
|------|-------------|
| POC | From the POA&M's assigned POC team field |
| Application Owner | From the system assignment in Settings > System Inventory — only notified for POA&Ms tied to their system(s) |
| ISSO | From Admin user list (notification role = `isso`) |
| ISSM | From Admin user list (notification role = `issm`) |
| CISO/AO | From Admin user list (notification role = `ciso`) |
| Security Analyst | From Admin user list (notification role = `analyst`) |
| Auditor | From Admin user list (notification role = `auditor`) |

POC and Application Owner are dynamic — resolved per-POA&M at notification time. All other roles are resolved by querying the Admin user list for users holding that role.

## Event Types

| Key | Display Label | Description |
|-----|--------------|-------------|
| `poam_created` | New POA&M created | A new POA&M record is added to the workbook |
| `poam_assigned` | POA&M assigned / reassigned | POC team or system assignment changes on a POA&M |
| `status_changed` | Status changed | POA&M status transitions (e.g., Open to In Progress) |
| `sla_warning` | SLA warning | A POA&M is approaching its SLA deadline |
| `sla_breach` | SLA breach | A POA&M has exceeded its SLA deadline |
| `extension_requested` | Extension requested | A POC requests a deadline extension |
| `extension_decided` | Extension approved / denied | An extension request is approved or denied |
| `evidence_submitted` | Evidence submitted | Evidence is uploaded against a POA&M |
| `weekly_digest` | Weekly digest | Summary of POA&M activity for the week |

## Default Matrix

| Event | POC | App Owner | ISSO | ISSM | CISO/AO | Analyst | Auditor |
|-------|-----|-----------|------|------|---------|---------|---------|
| New POA&M created | on | on | off | on | off | on | off |
| POA&M assigned/reassigned | on | on | off | off | off | on | off |
| Status changed | on | on | off | off | off | on | off |
| SLA warning | on | on | on | off | off | off | off |
| SLA breach | on | on | on | on | on | on | off |
| Extension requested | off | off | on | on | off | off | off |
| Extension approved/denied | on | off | off | off | off | off | off |
| Evidence submitted | off | off | off | off | off | on | on |
| Weekly digest | on | on | on | on | off | on | off |

These defaults are applied on first load. Admin can toggle any cell. Changes persist to localStorage.

## UI Changes

### Settings > General: Notification Preferences card (replace existing)

The existing card with three toggles (Email Notifications, Desktop Notifications, SLA Violation Alerts) is replaced with two cards:

**Card 1 — Notification Rules**

- Title: "Notification Rules" with card-sub: "Configure which roles receive in-app notifications for each event type"
- Renders the matrix as an HTML table with checkbox inputs in each cell
- Row headers are event display labels (left column)
- Column headers are role names
- Each checkbox has an id pattern: `notif-{eventKey}-{roleKey}` (e.g., `notif-sla_breach-isso`)
- Footer: Reset Defaults button (restores the default matrix above) and Save button

**Card 2 — Role Contacts**

- Title: "Role Contacts" with card-sub: "Map organizational roles to contacts for notification routing"
- Table with two columns: Role, Contact / Group
- One row per non-dynamic role: ISSO, ISSM, CISO/AO, Security Analyst, Auditor
- Each row has a text input for a name or email/distribution list
- POC and App Owner do not appear here (resolved dynamically)
- Footer: Save button
- Stores to localStorage key `roleContacts`

Both cards use existing design system classes: `card`, `card-head`, `card-title`, `card-sub`, `btn-cta`, `btn-sec`, teal accent color, `text-[10px] uppercase` labels.

### Admin > Users tab

Add a "Notification Role" dropdown to each user row in the users table. Values: ISSO, ISSM, CISO/AO, App Owner, Security Analyst, Auditor, POC, or (none). Single selection. Stored on the user record in localStorage.

The existing Admin > Roles & Permissions tab is not modified — it remains a display of access-level roles (Administrator, Security Analyst, Auditor). Notification roles are a separate concept assigned per-user.

## Data Storage

### `notificationRules` (localStorage)

```json
{
  "poam_created":        { "poc": true, "appOwner": true, "isso": false, "issm": true, "ciso": false, "analyst": true, "auditor": false },
  "poam_assigned":       { "poc": true, "appOwner": true, "isso": false, "issm": false, "ciso": false, "analyst": true, "auditor": false },
  "status_changed":      { "poc": true, "appOwner": true, "isso": false, "issm": false, "ciso": false, "analyst": true, "auditor": false },
  "sla_warning":         { "poc": true, "appOwner": true, "isso": true, "issm": false, "ciso": false, "analyst": false, "auditor": false },
  "sla_breach":          { "poc": true, "appOwner": true, "isso": true, "issm": true, "ciso": true, "analyst": true, "auditor": false },
  "extension_requested": { "poc": false, "appOwner": false, "isso": true, "issm": true, "ciso": false, "analyst": false, "auditor": false },
  "extension_decided":   { "poc": true, "appOwner": false, "isso": false, "issm": false, "ciso": false, "analyst": false, "auditor": false },
  "evidence_submitted":  { "poc": false, "appOwner": false, "isso": false, "issm": false, "ciso": false, "analyst": true, "auditor": true },
  "weekly_digest":       { "poc": true, "appOwner": true, "isso": true, "issm": true, "ciso": false, "analyst": true, "auditor": false }
}
```

### `roleContacts` (localStorage)

```json
{
  "isso": "",
  "issm": "",
  "ciso": "",
  "analyst": "",
  "auditor": ""
}
```

### User record (existing localStorage user data)

Add field `notificationRole` with value: `isso` | `issm` | `ciso` | `appOwner` | `analyst` | `auditor` | `poc` | `null`.

## Notification Resolution Logic

When an event fires for a POA&M:

1. Read the `notificationRules` matrix from localStorage
2. Look up the event key to get the map of `{ role: boolean }`
3. For each role where value is `true`:
   - **`poc`**: Resolve from the POA&M's `pocTeam` or `poc` field
   - **`appOwner`**: Look up the POA&M's system, find the system owner in System Inventory
   - **All other roles** (`isso`, `issm`, `ciso`, `analyst`, `auditor`): Query Admin user list for users where `notificationRole` matches
4. Deduplicate recipients
5. Deliver in-app notification to each recipient

## Files Modified

| File | Change |
|------|--------|
| `partials/settings.html` | Replace Notification Preferences card with Notification Rules matrix card and Role Contacts card |
| `sidebar-navigation.js` | Add `saveNotificationRules()`, `loadNotificationRules()`, `resetNotificationDefaults()`, `saveRoleContacts()`, `loadRoleContacts()` functions |
| `partials/admin.html` | Add Notification Role dropdown to user rows in the Users tab |
| `config/notification-config.js` | Update `recipients` section to reference the matrix config instead of hardcoded values |

## Out of Scope

- Email delivery (future, when SMTP is configured)
- Per-user notification overrides (future, when AD/SSO lands)
- In-app notification center / bell icon UI (separate feature)
- Modification of Admin > Roles & Permissions tab
