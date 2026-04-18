# TRACE Design System — Sentry-Inspired, Federal Compliance

A hybrid design system combining Sentry's component patterns (severity triage, issue tracking, KPI dashboards, status workflows) with TRACE's approved light-mode color palette and Inter typography. Built for POAM/FISMA compliance tooling.

## 1. Visual Theme & Atmosphere

TRACE borrows Sentry's disciplined approach to displaying dense operational data — severity badges, triage tables, priority indicators, status pipelines — while replacing Sentry's dark-mode purple palette with a warm, light-mode surface system built on `#F1F0EE` (warm off-white). The result feels like a federal compliance tool designed by the Sentry team: information-dense but never cluttered, professional but never sterile.

The banner uses the same dark-header-over-light-content pattern seen in Sentry's navigation, with a `#1F2937` (slate-charcoal) header creating a clear visual anchor at the top. A single accent color — teal `#0D7377` — replaces Sentry's purple for all interactive elements, CTAs, and focus states. Severity follows the FISMA/CVSS convention: red (Critical), amber-brown (High), teal (Medium), grey (Low).

**Key Characteristics:**
- Light warm background (`#F1F0EE`) — never pure white for page surfaces
- Dark charcoal banner (`#1F2937`) — Sentry's dark-header pattern, adapted
- White cards (`#FFFFFF`) with subtle shadow elevation — Sentry's "content island" approach on a light canvas
- Single teal accent (`#0D7377`) for CTAs, active states, and focus — replaces Sentry's purple spectrum
- FISMA severity scale (red/amber/teal/grey) — mirrors Sentry's issue-severity color coding
- Inter as the sole typeface — clean federal-tool feel, Sentry's weight stratification applied
- Uppercase letter-spaced section labels (Sentry's "technical label" pattern) in muted grey
- Tactile button depth via subtle inset shadows (borrowed from Sentry)
- Card-based content islands with 10px radius and layered shadows

## 2. Color Palette & Roles

### Surfaces
| Role | Color | Usage |
|------|-------|-------|
| Page background | `#F1F0EE` | Base canvas — warm off-white, never pure white |
| Card / panel | `#FFFFFF` | Content islands floating on the page background |
| Card border | `#E2E4E8` | Subtle structural boundary around content islands |
| Banner | `#1F2937` | Top navigation bar — dark anchor |
| Sidebar | `#FFFFFF` | Navigation rail, bordered right |
| Sidebar border | `#E2E4E8` | Right edge of sidebar |

### Accent / Interactive
| Role | Color | Usage |
|------|-------|-------|
| Primary CTA | `#0D7377` | Buttons, active sidebar, links, focus rings |
| CTA hover | `#0A5E62` | Darkened teal on hover/press |
| Active surface | `#E6F7F7` | Light teal wash behind active sidebar item, selected row |
| Active border | `#CCEEEE` | Light teal border for tags, badges, selected pills |

### Severity (Sentry-style issue badges adapted for FISMA)
| Severity | Badge BG | Badge Text | Bar / Accent |
|----------|----------|------------|--------------|
| Critical | `#FEE2E2` | `#991B1B` | `#DC2626` |
| High | `#FFF3E0` | `#9A3412` | `#B45309` |
| Medium | `#E6F7F7` | `#0A5E62` | `#0D7377` |
| Low | `#F3F4F6` | `#374151` | `#6B7280` |

### Status
| Status | Color treatment |
|--------|----------------|
| Open | Default — no special color, primary text |
| In Progress | Teal text `#0D7377` or teal left-border |
| Delayed | Amber text `#B45309` |
| Risk Accepted | Grey text `#6B7280`, muted badge |
| Overdue | Red background `#FFF5F5`, left border `4px solid #DC2626` |
| Completed / Closed | Green text `#059669` or muted |

### Text
| Role | Color | Usage |
|------|-------|-------|
| Primary | `#111827` | Headings, body text, data values — NEVER light grey on white |
| Secondary | `#6B7280` | Descriptions, helper text |
| Muted / disabled | `#9CA3AF` | Section labels, timestamps, placeholders |
| On-dark (banner) | `#F3F4F6` | Brand name, banner text |
| On-dark secondary | `#4B5563` | Banner subtitle, search placeholder |

### Shadows (Sentry-inspired elevation system adapted for light mode)
| Level | Shadow | Usage |
|-------|--------|-------|
| Flat (L0) | none | Banner, sidebar, inline elements |
| Surface (L1) | `0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.05)` | Cards, KPI tiles |
| Elevated (L2) | `0 4px 12px rgba(0,0,0,0.08), 0 8px 24px rgba(0,0,0,0.06)` | Hover cards, dropdowns |
| Prominent (L3) | `0 8px 30px rgba(0,0,0,0.12)` | Modals, floating panels |
| Inset (L-1) | `inset 0 1px 2px rgba(0,0,0,0.06)` | Active/pressed buttons (Sentry's tactile quality) |

### BANNED Colors
No purples, indigo, violet, or orange outside severity. Specifically banned: `#7C3AED`, `#F97316`, `#EA580C`, `#EDE9FE`, any `indigo-*` or `violet-*` Tailwind class.

## 3. Typography Rules

### Font Family
- **Primary**: `Inter` (Google Fonts) — all weights 400–900
- **Fallback**: `-apple-system, BlinkMacSystemFont, system-ui, sans-serif`
- **Monospace** (data tables, IDs): `SF Mono, Monaco, Menlo, monospace`

### Hierarchy (Sentry's weight stratification applied to Inter)

| Role | Size | Weight | Color | Spacing | Notes |
|------|------|--------|-------|---------|-------|
| Page title | 21px | 800 | `#111827` | -0.5px | Sentry's "section heading" scale |
| Card title | 14px | 700 | `#111827` | normal | Compact, data-dense |
| KPI number | 46px | 900 | `#111827` | -2.5px | Large impact number (Sentry's hero-scale approach) |
| KPI label | 10px | 700 | `#6B7280` | 0.9px, uppercase | Sentry's "micro label" pattern |
| Section label | 9.5–10px | 700 | `#9CA3AF` | 1.1px, uppercase | Sidebar labels, card section dividers |
| Body text | 13–14px | 500 | `#374151` | normal | Data rows, descriptions |
| Button text | 12.5px | 600 | inherit | 0.1px | Teal CTA: white text; secondary: `#374151` |
| Caption / meta | 11–12px | 500–600 | `#6B7280` | normal | Timestamps, sub-labels |
| Badge text | 10.5px | 700 | per severity | normal | Severity/status pills |

### Principles (from Sentry, adapted)
- **Uppercase as system**: Section labels, KPI labels, sidebar labels, and badge text all use `text-transform: uppercase` with letter-spacing. This is Sentry's "technical label" pattern — it signals metadata vs. content.
- **Weight stratification**: 400 (light body), 500 (default body/nav), 600 (emphasis/buttons), 700 (titles/badges), 800 (page titles), 900 (KPI hero numbers). Six tiers for maximum hierarchy control.
- **Tight headings, relaxed body**: Titles use letter-spacing -0.5px; body is normal; labels expand to +1px. Matches Sentry's rhythm.
- **Never light grey on white**: Body text minimum is `#374151`. Muted labels use `#9CA3AF` only for non-essential metadata.

## 4. Component Stylings

### Buttons (Sentry's tactile depth adapted for light mode)

**Primary CTA (Teal)**
- Background: `#0D7377`
- Text: `#FFFFFF`, 12.5px, weight 600, letter-spacing 0.1px
- Border: none
- Radius: 6px
- Shadow: `inset 0 1px 2px rgba(0,0,0,0.06)` (Sentry's tactile inset feel)
- Hover: background `#0A5E62`, shadow `0 4px 12px rgba(13,115,119,0.25)`
- Active: `inset 0 2px 4px rgba(0,0,0,0.12)` (pressed deeper)

**Secondary (White)**
- Background: `#FFFFFF`
- Text: `#374151`, 12px, weight 500
- Border: `1px solid #D1D5DB`
- Radius: 6px
- Shadow: `0 1px 2px rgba(0,0,0,0.04)`
- Hover: background `#F9FAFB`

**Danger**
- Background: `#DC2626`
- Text: `#FFFFFF`
- Same radius/shadow as primary
- Hover: `#B91C1C`

### Severity Badges (Sentry's issue-type badges)
- Shape: `border-radius: 4px`, padding `2px 8px`
- Text: 10.5px, weight 700
- Critical: bg `#FEE2E2`, text `#991B1B`
- High: bg `#FFF3E0`, text `#9A3412`
- Medium: bg `#E6F7F7`, text `#0A5E62`
- Low: bg `#F3F4F6`, text `#374151`

### Cards (Sentry's "content islands")
- Background: `#FFFFFF`
- Border: `1px solid #E2E4E8`
- Radius: 10px
- Shadow: `0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.05)`
- Header area: `padding: 16px 20px 0`, flex row with title left and actions right
- No top-edge gradient bars (Sentry keeps cards clean; KPI tiles get a 3px solid top-bar for severity color)

### KPI Tiles (Sentry's metric panels)
- Same card base, but with a `3px solid` top bar in the relevant color (teal for general, red for urgent)
- Overdue/urgent variant: background `#FFF5F5`, border `1px solid #FECACA`, left border `4px solid #DC2626`
- Number: 46px / 900 weight / `#111827` (or `#B91C1C` for overdue)
- Label: 10px / 700 / uppercase / `#6B7280`
- Delta indicator below number: 12px, green `#059669` for improvement, red `#DC2626` for regression

### Tables (Sentry's issue list pattern)
- Header row: `#F9FAFB` background, 10px uppercase labels, weight 700, `#6B7280`
- Data rows: white background, `border-bottom: 1px solid #F3F4F6`
- Row hover: `#FAFAFA`
- Severity column: left-aligned colored dot or severity badge
- Status column: text colored by status
- Selection: checkbox left column, selected row gets `#E6F7F7` background

### Sidebar Navigation (Sentry's nav rail adapted)
- Width: 210px fixed
- Items: 13.5px, weight 500, color `#3D4451`
- Active: background `#E6F7F7`, color `#0D7377`, left border `3px solid #0D7377`, weight 700
- Hover: background `#F3F4F6`
- Section labels: 9.5px uppercase, `#9CA3AF`, 1.1px letter-spacing

### Inputs
- Background: `#FFFFFF`
- Border: `1px solid #D1D5DB`
- Radius: 6px
- Padding: 8px 12px
- Text: 13px, `#374151`
- Focus: border `#0D7377`, ring `0 0 0 3px rgba(13,115,119,0.12)`
- Placeholder: `#9CA3AF`

### Modals (Sentry's overlay pattern)
- Overlay: `rgba(0,0,0,0.5)`
- Panel: white, radius 12px, shadow L3
- Header: 18px weight 700, close button top-right
- Footer: right-aligned buttons, border-top `1px solid #E5E7EB`

## 5. Layout Principles

### Spacing System (8px base, matching Sentry)
- Scale: 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 32px
- Card internal padding: 16–20px
- Section gaps: 14px between cards
- Page padding: 22px 26px

### Grid & Container
- Banner: full width, 54px height, fixed top
- Sidebar: 210px fixed left
- Main content: `flex: 1`, scrollable, `#F1F0EE` background
- Dashboard: CSS Grid for KPI rows (`repeat(4, 1fr)`), charts row (`55fr 22fr 23fr`), bottom row (`60fr 40fr`)

### Content Island Pattern (from Sentry)
Every data section is a self-contained white card floating on the warm grey canvas. Cards should feel like discrete "panels" — each with its own header, content, and optional footer. The background provides visual breathing room between them.

### Border Radius Scale
| Size | Usage |
|------|-------|
| 4px | Badges, severity pills |
| 6px | Buttons, inputs, small cards |
| 10px | Standard cards, KPI tiles |
| 12px | Modals, large panels |

## 6. Depth & Elevation

| Level | Treatment | Usage |
|-------|-----------|-------|
| Inset (L-1) | `inset 0 1px 2px rgba(0,0,0,0.06)` | Active/pressed CTA buttons |
| Flat (L0) | none | Banner, sidebar, inline elements |
| Surface (L1) | `0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.05)` | Cards, tiles — the default content island |
| Elevated (L2) | `0 4px 12px rgba(0,0,0,0.08), 0 8px 24px rgba(0,0,0,0.06)` | Hover states, dropdowns |
| Prominent (L3) | `0 8px 30px rgba(0,0,0,0.12)` | Modals, floating panels |

Sentry's philosophy: **buttons feel pressed INTO the surface** (inset shadow), **cards float ABOVE the surface** (drop shadow). Both create tactile depth without visual noise.

## 7. Do's and Don'ts

### Do
- Use `#F1F0EE` page background — never pure white (`#FFFFFF`) for page surfaces
- Apply the 3px solid top-bar on KPI tiles (teal for default, red for urgent/overdue)
- Use `text-transform: uppercase` + `letter-spacing` on ALL labels, section dividers, and badge text — this is the "technical label" pattern from Sentry
- Apply `inset` shadow on primary CTA buttons for the tactile pressed feel
- Use the severity badge system consistently: every finding, POAM, and table row gets a colored badge
- Keep card padding consistent: 16–20px internal, 14px gaps between cards
- Use Inter's weight stratification: 500 (body), 600 (emphasis), 700 (titles/badges), 800 (page headings), 900 (KPI numbers)
- Display overdue items with the red-tinted background + left border pattern

### Don't
- Don't use purples, indigo, violet, or orange outside the severity palette
- Don't use light grey text (`#D1D5DB` or lighter) on white backgrounds — minimum body text is `#374151`
- Don't put emojis in section headers, card titles, tab labels, or module names
- Don't use flat (non-inset) shadows on CTA buttons — the pressed quality is core to the design
- Don't use gradient decorations on KPI tiles (solid colors only)
- Don't mix severity colors outside their assigned meaning (red = critical, amber = high, teal = medium, grey = low)
- Don't use borders heavier than 1px on cards — the shadow provides the depth
- Don't skip the uppercase treatment on labels — it distinguishes metadata from content

## 8. Responsive Behavior

### Breakpoints
| Name | Width | Changes |
|------|-------|---------|
| Mobile | <768px | Sidebar collapses to hamburger overlay, KPI grid → 2-col, charts stack |
| Tablet | 768–1024px | Sidebar visible, KPI stays 4-col, charts 2-col |
| Desktop | 1024–1440px | Full layout — sidebar + main content |
| Wide | >1440px | Content max-width maintained, generous side margins |

### Collapsing Strategy
- Sidebar: fixed rail → hidden with hamburger toggle
- KPI row: 4-col → 2-col → 1-col
- Charts row: 3-col side-by-side → stacked
- Bottom row: 60/40 split → stacked
- Tables: horizontal scroll with sticky first column
- Modals: centered → full-width on mobile

## 9. Agent Prompt Guide

### Quick Color Reference
- Page: `#F1F0EE` | Cards: `#FFFFFF` | Banner: `#1F2937`
- Accent: `#0D7377` (teal) | Hover: `#0A5E62` | Active bg: `#E6F7F7`
- Text: `#111827` (primary), `#374151` (body), `#6B7280` (secondary), `#9CA3AF` (muted)
- Critical: `#991B1B` / `#DC2626` | High: `#B45309` | Medium: `#0D7377` | Low: `#6B7280`
- Borders: `#E2E4E8` (cards), `#D1D5DB` (inputs), `#F3F4F6` (row dividers)

### Example Component Prompts
- "Create a KPI tile row: 4 white cards on `#F1F0EE` background. Each card has a 3px solid teal (`#0D7377`) top bar, 10px label (uppercase, `#6B7280`), 46px number (weight 900, `#111827`), and a 12px delta line. Second tile is urgent: `#FFF5F5` background, `4px solid #DC2626` left border, red number."
- "Build a findings table: Sentry-style issue list. Header row `#F9FAFB` with 10px uppercase labels. Rows have severity badge (left), title, system pill, POC name, due date, status. Row hover `#FAFAFA`. Selected rows get `#E6F7F7` background."
- "Design a sidebar: 210px white rail. Section labels at 9.5px uppercase `#9CA3AF`. Items at 13.5px weight 500 `#3D4451`. Active item: `#E6F7F7` background, `#0D7377` text, 3px solid teal left border."
- "Create a compliance gauge: white card, SVG semicircle arc. Track stroke `#E5E7EB`, progress stroke `#0D7377`. Center number 40px weight 900. Grade pill below: `#E6F7F7` background, `#0A5E62` text, rounded."
- "Build a severity donut chart: CSS conic-gradient with `#991B1B` (critical), `#B45309` (high), `#0D7377` (medium), `#6B7280` (low). Center hole shows total count. Legend to the right with colored swatches."

### Iteration Guide
1. Always start with the `#F1F0EE` background and white card islands — the warm canvas is the foundation
2. Apply uppercase + letter-spacing to ALL labels before anything else — it's the system's signature
3. Use inset shadows on CTAs, drop shadows on cards — two layers of depth
4. Teal `#0D7377` is the ONLY accent color — use it for one focal point per card (not everywhere)
5. Severity colors are the ONLY exceptions to the teal-only rule — and they only appear in badges, bars, and status indicators
6. Inter handles 100% of typography — use the 6-tier weight system to create hierarchy instead of size variation
