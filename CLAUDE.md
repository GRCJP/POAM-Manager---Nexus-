# TRACE — POAM Nexus: Claude Code Reference

## Project
- **App name:** TRACE (Tracking Remediation & Compliance Efficiently)
- **Local path:** `/Users/jleepe/CascadeProjects/repo/poam-project/POAM-Manager---Nexus-`
- **GitHub:** https://github.com/GRCJP/POAM-Manager---Nexus-
- **Dev server:** `python3 -m http.server 8080` from project directory
- **Entry point:** `index.html` (~3,345 lines) — single-file SPA

## Architecture
- Single-page app. No build step. Plain HTML/CSS/JS + Tailwind CDN.
- Module JS files in `modules/` loaded via `<script>` tags at bottom of `index.html`.
- `script.js` — main controller (`showModule`, `showEvidenceTab`, `renderScanHistory`, evidence functions, settings)
- `sidebar-navigation.js` — sidebar toggle behavior
- Data persistence: IndexedDB (POA&M Workbook), localStorage (findings/vulnerability data)
- Infrastructure: Windows EC2, AWS CodePipeline, DynamoDB, AD federation/SSO, no Cognito

## Naming Conventions (approved — do not change)
- **Findings** — items auto-imported from Qualys/vulnerability scans. Machine-sourced, high volume. Module: `vulnerability-tracking`.
- **POA&Ms** — control deficiency items tied to NIST 800-53 controls. Manually entered or assessment-derived. ATO package items. Module: `security-control-monitoring`.
- Findings can be promoted to a POA&M. POA&Ms are broken out per System.

---

## Module Map (`index.html`)

| Sidebar label       | `showModule()` arg            | HTML element ID                         | Approx lines |
|---------------------|-------------------------------|-----------------------------------------|-------------|
| Dashboard           | `dashboard`                   | `#dashboard-module`                     | 628–932     |
| Findings            | `vulnerability-tracking`      | `#vulnerability-tracking-module`        | 1425–1879   |
| POA&M Workbook      | `security-control-monitoring` | `#security-control-monitoring-module`   | 1880–2171   |
| Evidence Vault      | `evidence`                    | `#evidence-module`                      | 1201–1424   |
| Executive Reporting | `reporting`                   | `#reporting-module`                     | 2433–2508   |
| Audit Logs          | `audit`                       | `#audit-module`                         | 2509–2546   |
| Settings            | `settings`                    | `#settings-module`                      | 2172–2432 and 2547+ |
| Administration      | `admin`                       | `#admin-module`                         | 2899+       |

**Note:** `scan-history` is NOT a sidebar entry. It lives as a tab inside `#evidence-module`. `showModule('scan-history')` is redirected by `showModule()` in `script.js` to `showModule('evidence')` + `showEvidenceTab('scan-history')`.

### Evidence Vault tabs
- `showEvidenceTab('evidence')` — shows `#evidence-panel-evidence`, activates `#ev-tab-evidence`
- `showEvidenceTab('scan-history')` — shows `#evidence-panel-scan-history`, activates `#ev-tab-scan-history`, calls `renderScanHistory()`
- Scan history table body: `#scan-history-list` (JS writes rows here)

### POA&M Workbook sub-views
- System selected via `<select id="poam-system-select">` (onchange → `poamWorkbookHandleSystemSelect(value)`)
- `value='all'` → `poamWorkbookShowOverview()` → shows `#poam-workbook-view-overview`
- `value=systemId` → `poamWorkbookNavigateToSystem(id)` → shows `#poam-workbook-view-system`
- Per-system breakdown table: `#poam-workbook-systems-table` (rendered by `renderWorkbookSystemsTable()` in `workbook.js`)
- Add system: `openAddSystemModal()`

---

## JS Contracts — IDs that must not change (JS targets them directly)

### Core navigation
- `#dashboard-module`, `#vulnerability-tracking-module`, `#security-control-monitoring-module`, `#evidence-module`, `#reporting-module`, `#audit-module`, `#settings-module`, `#admin-module`
- `#ev-tab-evidence`, `#ev-tab-scan-history`, `#evidence-panel-evidence`, `#evidence-panel-scan-history`
- `#scan-history-list` (tbody)
- `#poam-system-select`, `#poam-workbook-systems-table`
- `#poam-workbook-view-overview`, `#poam-workbook-view-system`, `#poam-workbook-view-all-systems`
- `#scm-poam-workbook-systems`, `#poam-sys-pill-all` (hidden, preserved for compat)

### Dashboard KPIs
- `#dash-overdue-tag`, `#dash-last-updated`

### Findings (vulnerability-tracking) module
- `#total-poams-count`, `#overdue-poams-count`, `#critical-poams-count`, `#open-poams-count`
- `#findings-count-tag`
- `#poam-count-display`

### POA&M Workbook overview metrics
- `#poam-workbook-metric-total`, `#poam-workbook-metric-overdue`, `#poam-workbook-metric-coming-due`
- `#poam-workbook-metric-missing-poc`, `#poam-workbook-metric-completed` (hidden, preserve for JS compat)
- `#poam-workbook-metric-status`, `#poam-workbook-metric-severity` (hidden, preserve for JS compat)
- `#poam-workbook-controls-dist`, `#poam-workbook-top-vulns` (hidden, preserve for JS compat)
- `#poam-workbook-active-system-name`, `#poam-workbook-system-total`
- `#poam-workbook-table-body`, `#poam-workbook-empty-state`, `#poam-workbook-search`
- `#poam-workbook-select-all`, `#poam-workbook-selected-count`, `#poam-workbook-bulk-actions`
- `#poam-header-system-tag`, `#poam-header-fisma-tag`, `#poam-header-open-count-tag`

### Evidence Vault
- `#evidence-poam-select`, `#evidence-type-select`, `#evidence-owner`, `#evidence-submitter`
- `#evidence-date`, `#evidence-reference`, `#evidence-email`, `#evidence-description`
- `#evidence-auto-close`, `#evidence-file-upload`, `#selected-files-preview`, `#selected-files-list`
- `#evidence-list`, `#evidence-search`, `#evidence-sort`
- `#selected-poam-info`, `#selected-poam-id`, `#selected-poam-status-badge`
- `#selected-poam-description`, `#selected-poam-risk`, `#selected-poam-due`

### Upload modal
- `#upload-modal`, `#scan-file-input`, `#upload-progress`, `#upload-progress-bar`
- `#upload-progress-text`, `#upload-progress-percent`, `#upload-progress-detail`

### Settings
- `#tab-link-preferences`, `#tab-link-systems`

---

## Design System (mockup-C — approved, no exceptions)

### Color palette
| Use | Value |
|-----|-------|
| Page background | `#F1F0EE` |
| Banner | `#1F2937` |
| Sidebar bg | `#FFFFFF`, text `#3D4451` |
| Accent / CTA / active | `#0D7377` teal |
| Critical severity | `#991B1B` / `#DC2626` |
| High severity | `#B45309` amber-brown |
| Medium severity | `#0D7377` teal |
| Low severity | `#6B7280` grey |
| Card background | `#FFFFFF` |
| Card border | `#E2E4E8` |
| Primary text | `#111827` |
| Secondary text | `#6B7280` |
| Muted / disabled | `#9CA3AF` |
| Overdue card bg | `#FFF5F5`, left border `4px solid #DC2626` |
| Teal light bg | `#E6F7F7` |
| Teal light border | `#CCEEEE` |

**BANNED:** purple, orange (except severity), yellow (except severity), indigo, violet — no `#7C3AED`, `#F97316`, `#EA580C`, `EDE9FE`, etc.

### Typography
- Font: Inter (Google Fonts)
- Body text: `#111827` or `#374151` — NEVER light grey on white
- Section labels: 9.5–10px, 700 weight, `#9CA3AF`, uppercase, letter-spacing
- Card titles: 14px, 700 weight, `#111827`
- Page titles: 21px, 800 weight, `#111827`

### Rules
- No emojis in headers, section labels, tab labels, card titles, or module names
- Emojis only in user-generated content or activity feed entries
- No gradient decorations on UI elements (kpi-top-bars use solid colors, not linear-gradient)
- Card shadow: `0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.05)`

### CSS class reference
```
.module          — top-level module container (JS shows/hides via .hidden)
.card            — white content card with border and shadow
.card-head       — card header row (padding: 16px 20px 0)
.card-title      — 14px 700 #111827
.card-sub        — 11.5px #6B7280
.kpi             — KPI tile (white card variant)
.kpi.urgent      — red-tinted KPI tile
.kpi-top-bar     — 3px solid color accent bar at top of KPI card (NO gradient)
.kpi-lbl         — 10px uppercase label
.kpi-num         — 46px 900 weight number
.ph              — page header row
.ph-title        — 21px 800 page title
.ph-actions      — right-side action buttons
.btn-cta         — teal primary button
.btn-sec         — white/grey secondary button
.sb-item         — sidebar nav item
.sb-item.active  — active sidebar item (teal left border + teal text)
.sb-lbl          — sidebar section label
.sb-divider      — sidebar horizontal rule
.sev-badge       — severity pill (.bc critical, .bh high, .bt teal/medium, .bl low)
.metrics-strip   — horizontal metrics bar
.mod-tabs        — horizontal underline tab bar (evidence vault)
.mod-tab         — individual tab button
.mod-tab.active  — active tab (teal underline)
```

---

## Module JS files (in `modules/`)

| File | Purpose |
|------|---------|
| `workbook.js` | POA&M Workbook core: DB (IndexedDB), system management, table rendering, analytics |
| `workbook-enhancements.js` | Workbook filters, bulk actions, control family strip, quick status panel |
| `workbook-enhancements-v2.js` | All-systems view render, export all systems, XLSX import/export |
| `workbook-import-preview.js` | Import preview modal |
| `workbook-import-simple.js` | Simplified import flow |
| `pipeline.js` | Qualys CSV import pipeline, scan ingestion, normalizeQualysFinding |
| `data-processing.js` | Finding deduplication, status normalization |
| `poam-ui.js` | Findings table rendering, POAM detail modal |
| `poam-activity-monitor.js` | Activity feed, overdue monitoring |
| `poam-activity-widget.js` | Activity widget rendering |
| `status-normalization.js` | Status string normalization |
| `api-integration.js` | External API calls |
| `api-settings-ui.js` | API settings tab UI |
| `integrations.js` | Third-party integrations UI |
| `reporting.js` | Executive reporting module |

---

## Key bugs fixed (do not reintroduce)
- `normalizeQualysFinding` in `pipeline.js` must preserve the Qualys `Ignored` column to correctly classify Risk Accepted findings (was dropping it, causing 3,528 findings to appear as Open)
- Risk Accepted status must have a date stamp and be excluded from open counts and overdue alerts

## Known remaining issues (as of 2026-04-10)
- Purple still appears in Risk Accepted dropdown/buttons in Findings module
- Settings and Admin tabs need consistent form styling
- Modals (upload, first-run, POAM modal, system modal) need consistent styling sweep
