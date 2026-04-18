// ═══════════════════════════════════════════════════════════════
// TRACE — Mockup-C Dashboard Widget Renderers
// Populates all the secondary widgets on partials/dashboard.html that
// the legacy reporting.js engine doesn't know about:
//   • SLA ring + risk accepted + scan coverage (metrics strip)
//   • Trend line SVG (12-month rolling)
//   • Compliance score gauge
//   • Risk distribution donut (conic-gradient)
//   • Priority list, systems list, activity feed (bottom row)
// ═══════════════════════════════════════════════════════════════

(function () {
    'use strict';

    const OPEN_STATES = new Set(['open', 'in-progress', 'in_progress', 'delayed', 'needs-review']);
    const CLOSED_STATES = new Set(['completed', 'closed', 'fixed', 'resolved']);
    const RISK_ACCEPTED_STATES = new Set(['risk-accepted', 'ignored']);

    function normStatus(raw) {
        const s = String(raw || 'open').toLowerCase().trim().replace(/_/g, '-').replace(/\s+/g, '-');
        if (s === 'risk-accepted' || s === 'ignored') return 'risk-accepted';
        if (CLOSED_STATES.has(s)) return 'completed';
        if (OPEN_STATES.has(s)) return s === 'open' ? 'open' : s;
        return s || 'open';
    }
    function isOpen(p) {
        const s = normStatus(p.findingStatus || p.status);
        return !CLOSED_STATES.has(s) && !RISK_ACCEPTED_STATES.has(s) && s !== 'risk-accepted';
    }
    function isRiskAccepted(p) {
        const s = normStatus(p.findingStatus || p.status);
        return s === 'risk-accepted';
    }
    function getRisk(p) {
        return String(p.riskLevel || p.risk || 'medium').toLowerCase().trim();
    }
    function getDueDate(p) {
        const d = new Date(p.updatedScheduledCompletionDate || p.dueDate);
        return Number.isNaN(d.getTime()) ? null : d;
    }
    function setText(id, value) {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    }
    function setAttr(id, attr, value) {
        const el = document.getElementById(id);
        if (el) el.setAttribute(attr, value);
    }
    function setStyle(id, prop, value) {
        const el = document.getElementById(id);
        if (el) el.style[prop] = value;
    }
    function escapeHtml(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));
    }

    // ─────────────────────────────────────────────
    // 1. SLA Compliance Ring (metrics strip)
    // ─────────────────────────────────────────────
    function renderSLARing(openPOAMs) {
        const now = new Date();
        let withinSLA = 0;
        openPOAMs.forEach(p => {
            const d = getDueDate(p);
            if (d && d >= now) withinSLA++;
        });
        const pct = openPOAMs.length === 0 ? 100 : Math.round(withinSLA / openPOAMs.length * 100);
        const circumference = 2 * Math.PI * 14; // r = 14 -> ~87.96
        const dashLen = (pct / 100) * circumference;
        setAttr('dash-sla-ring-arc', 'stroke-dasharray', `${dashLen.toFixed(2)} ${circumference.toFixed(2)}`);
        setText('dash-sla-ring-text', `${pct}%`);
        setText('dash-sla-compliance', `${pct}%`);
        const sub = document.getElementById('dash-sla-compliance-sub');
        if (sub) sub.textContent = openPOAMs.length === 0 ? 'No open items' : `${withinSLA}/${openPOAMs.length} within window`;
    }

    // ─────────────────────────────────────────────
    // 2. Risk Accepted count (metrics strip)
    // ─────────────────────────────────────────────
    function renderRiskAcceptedTile(poams) {
        const count = poams.filter(isRiskAccepted).length;
        setText('dash-risk-accepted', count);
        setText('dash-risk-accepted-sub', count === 0 ? 'No accepted risks' : 'Acknowledged risks');
    }

    // ─────────────────────────────────────────────
    // 3. Scan Coverage (metrics strip)
    // ─────────────────────────────────────────────
    function renderScanCoverage(poams) {
        // Coverage = % of known systems touched by the most recent scan.
        // Heuristic: count unique system/host names across POAMs that have a lastScanDate.
        const uniqueSystems = new Set();
        const scannedSystems = new Set();
        poams.forEach(p => {
            const sys = p.system || p.assetName || (p.affectedAssets && p.affectedAssets[0]) || null;
            if (sys) uniqueSystems.add(sys);
            if (p.lastScanDate && sys) scannedSystems.add(sys);
        });
        const pct = uniqueSystems.size === 0 ? 0 : Math.round(scannedSystems.size / uniqueSystems.size * 100);
        setText('dash-scan-coverage', `${pct}%`);
        setStyle('dash-scan-coverage-bar', 'width', `${pct}%`);
    }

    // ─────────────────────────────────────────────
    // 4. Compliance Gauge
    // ─────────────────────────────────────────────
    function renderComplianceGauge(poams) {
        const total = poams.length;
        if (total === 0) {
            setText('dash-compliance-score', '—');
            setText('dash-compliance-grade', '—');
            setText('dash-compliance-resolved', '0');
            setText('dash-compliance-sla', '0%');
            setText('dash-compliance-overdue', '0');
            return;
        }
        const closed = poams.filter(p => normStatus(p.findingStatus || p.status) === 'completed').length;
        const accepted = poams.filter(isRiskAccepted).length;
        const openList = poams.filter(isOpen);
        const now = new Date();
        const overdueCount = openList.filter(p => { const d = getDueDate(p); return d && d < now; }).length;
        const withinSLA = openList.length === 0 ? 100 : Math.round((openList.length - overdueCount) / openList.length * 100);

        // Compliance score formula: weighted average of resolution rate and SLA adherence
        const resolutionRate = Math.round(((closed + accepted) / total) * 100);
        const score = Math.round(resolutionRate * 0.5 + withinSLA * 0.5);

        const grade = score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : score >= 60 ? 'D' : 'F';
        setText('dash-compliance-score', score);
        setText('dash-compliance-grade', grade);
        setText('dash-compliance-resolved', `${closed + accepted} / ${total}`);
        setText('dash-compliance-sla', `${withinSLA}%`);
        setText('dash-compliance-overdue', overdueCount);

        // Arc path — gauge is a semicircle, we shorten the arc proportionally to the score
        // Full arc: M 20,100 A 80,80 0 0 1 180,100 (180° semicircle)
        const arcEl = document.getElementById('dash-compliance-arc');
        if (arcEl) {
            const angleDeg = 180 * (score / 100);
            const angleRad = (Math.PI * angleDeg) / 180;
            const endX = 100 - 80 * Math.cos(angleRad);
            const endY = 100 - 80 * Math.sin(angleRad);
            const largeArc = angleDeg > 180 ? 1 : 0;
            arcEl.setAttribute('d', `M 20,100 A 80,80 0 ${largeArc} 1 ${endX.toFixed(2)},${endY.toFixed(2)}`);
            const col = score >= 90 ? '#059669' : score >= 70 ? '#0D7377' : score >= 50 ? '#B45309' : '#DC2626';
            arcEl.setAttribute('stroke', col);
        }
    }

    // ─────────────────────────────────────────────
    // 5. Risk Distribution Donut
    // ─────────────────────────────────────────────
    function renderRiskDonut(poams) {
        const openList = poams.filter(isOpen);
        const total = openList.length;
        const counts = { critical: 0, high: 0, medium: 0, low: 0 };
        openList.forEach(p => {
            const r = getRisk(p);
            if (r === 'critical') counts.critical++;
            else if (r === 'high') counts.high++;
            else if (r === 'medium') counts.medium++;
            else counts.low++;
        });
        const pct = k => total === 0 ? 0 : Math.round(counts[k] / total * 100);
        setText('dash-risk-donut-num', total);
        setText('dash-risk-pct-crit', `${pct('critical')}%`);
        setText('dash-risk-pct-high', `${pct('high')}%`);
        setText('dash-risk-pct-med', `${pct('medium')}%`);
        setText('dash-risk-pct-low', `${pct('low')}%`);
        setText('dash-risk-cnt-crit', counts.critical ? `(${counts.critical})` : '');
        setText('dash-risk-cnt-high', counts.high ? `(${counts.high})` : '');
        setText('dash-risk-cnt-med', counts.medium ? `(${counts.medium})` : '');
        setText('dash-risk-cnt-low', counts.low ? `(${counts.low})` : '');

        const chart = document.getElementById('dash-risk-donut-chart');
        if (chart) {
            if (total === 0) {
                chart.style.background = '#F3F4F6';
            } else {
                const critEnd = pct('critical');
                const highEnd = critEnd + pct('high');
                const medEnd = highEnd + pct('medium');
                chart.style.background = `conic-gradient(#991B1B 0% ${critEnd}%, #B45309 ${critEnd}% ${highEnd}%, #0D7377 ${highEnd}% ${medEnd}%, #6B7280 ${medEnd}% 100%)`;
            }
        }
    }

    // ─────────────────────────────────────────────
    // 6. Trend Line SVG (last 12 months)
    // ─────────────────────────────────────────────
    function renderTrendSVG(poams) {
        // Compute monthly rolling open and closed counts over last 12 months
        const now = new Date();
        const months = [];
        for (let i = 11; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            months.push({
                key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
                label: d.toLocaleDateString('en-US', { month: 'short' }),
                date: d,
                open: 0,
                closed: 0
            });
        }

        poams.forEach(p => {
            const createdAt = new Date(p.createdDate || p.firstDetectedDate || p.lastScanDate || 0);
            if (!Number.isNaN(createdAt.getTime())) {
                const mi = months.findIndex(m => createdAt <= new Date(m.date.getFullYear(), m.date.getMonth() + 1, 0));
                if (mi >= 0 && isOpen(p)) months[mi].open++;
            }
            const closedAt = new Date(p.actualCompletionDate || 0);
            if (!Number.isNaN(closedAt.getTime()) && closedAt.getFullYear() > 2000) {
                const mi = months.findIndex(m => m.key === `${closedAt.getFullYear()}-${String(closedAt.getMonth() + 1).padStart(2, '0')}`);
                if (mi >= 0) months[mi].closed++;
            }
        });

        const maxVal = Math.max(1, ...months.map(m => Math.max(m.open, m.closed)));
        const yHi = maxVal;
        const yMid = Math.round(maxVal / 2);
        const yLo = 0;
        setText('dash-trend-y-hi', yHi);
        setText('dash-trend-y-mid', yMid);
        setText('dash-trend-y-lo', yLo);

        // Viewport: x 44..560 (width 516), y 14..140 (height 126)
        const xStart = 44, xEnd = 560, yTop = 14, yBot = 140;
        const xStep = (xEnd - xStart) / 11;

        const yFor = v => yBot - (v / maxVal) * (yBot - yTop);
        const openPts = months.map((m, i) => `${(xStart + i * xStep).toFixed(1)},${yFor(m.open).toFixed(1)}`);
        const closedPts = months.map((m, i) => `${(xStart + i * xStep).toFixed(1)},${yFor(m.closed).toFixed(1)}`);

        setAttr('dash-trend-open-line', 'points', openPts.join(' '));
        setAttr('dash-trend-closed-line', 'points', closedPts.join(' '));

        const openArea = [...openPts, `${xEnd},${yBot}`, `${xStart},${yBot}`].join(' ');
        const closedArea = [...closedPts, `${xEnd},${yBot}`, `${xStart},${yBot}`].join(' ');
        setAttr('dash-trend-open-area', 'points', openArea);
        setAttr('dash-trend-closed-area', 'points', closedArea);

        const openDots = document.getElementById('dash-trend-dots-open');
        const closedDots = document.getElementById('dash-trend-dots-closed');
        const xLabels = document.getElementById('dash-trend-x-labels');
        if (openDots) openDots.innerHTML = openPts.map(pt => {
            const [x, y] = pt.split(',');
            return `<circle cx="${x}" cy="${y}" r="3" fill="#1F2937"/>`;
        }).join('');
        if (closedDots) closedDots.innerHTML = closedPts.map(pt => {
            const [x, y] = pt.split(',');
            return `<circle cx="${x}" cy="${y}" r="2.5" fill="#0D7377"/>`;
        }).join('');
        if (xLabels) xLabels.innerHTML = months.map((m, i) => {
            const x = xStart + i * xStep;
            return `<text x="${x.toFixed(1)}" y="160" text-anchor="middle" fill="#6B7280" font-size="9" font-family="Inter,system-ui">${m.label}</text>`;
        }).join('');

        // Hide empty-state message if we have any data
        const emptyMsg = document.getElementById('dash-trend-empty');
        if (emptyMsg) emptyMsg.style.display = poams.length === 0 ? 'block' : 'none';
    }

    // ─────────────────────────────────────────────
    // 7. Top Priority List
    // ─────────────────────────────────────────────
    function renderPriorityList(poams) {
        const openList = poams.filter(isOpen);
        const now = new Date();
        const riskOrder = { critical: 4, high: 3, medium: 2, low: 1 };

        const scored = openList.map(p => {
            const d = getDueDate(p);
            const overdueDays = d ? Math.max(0, Math.round((now - d) / 86400000)) : 0;
            const daysToDue = d ? Math.round((d - now) / 86400000) : 365;
            const riskScore = riskOrder[getRisk(p)] || 0;
            // Score: higher = more urgent. Overdue heavily weighted.
            const score = riskScore * 20 + (overdueDays > 0 ? 100 + overdueDays : Math.max(0, 30 - daysToDue));
            return { poam: p, score, overdueDays, daysToDue, risk: getRisk(p) };
        });
        scored.sort((a, b) => b.score - a.score);
        const top = scored.slice(0, 5);

        setText('dash-priority-count', `${top.length} of ${openList.length}`);

        const listEl = document.getElementById('dash-priority-list');
        if (!listEl) return;
        if (top.length === 0) {
            listEl.innerHTML = '<div style="padding:24px 18px;text-align:center;font-size:13px;color:#6B7280">No open items</div>';
            return;
        }
        listEl.innerHTML = top.map(item => {
            const p = item.poam;
            const sevClass = item.risk === 'critical' ? 'bc' : item.risk === 'high' ? 'bh' : item.risk === 'medium' ? 'bt' : 'bl';
            const sevBar = item.risk === 'critical' ? '#991B1B' : item.risk === 'high' ? '#B45309' : item.risk === 'medium' ? '#0D7377' : '#6B7280';
            const dueText = item.overdueDays > 0
                ? `<span style="color:#DC2626">${item.overdueDays}d overdue</span>`
                : item.daysToDue <= 0
                    ? '<span style="color:#DC2626">Due today</span>'
                    : `<span style="color:#374151">${item.daysToDue}d left</span>`;
            const urgencyPct = item.overdueDays > 0 ? 100 : Math.max(5, Math.min(100, 100 - item.daysToDue * 2));
            const title = escapeHtml((p.title || p.vulnerabilityName || 'Untitled POAM').substring(0, 90));
            const system = escapeHtml(p.system || p.assetName || (p.affectedAssets && p.affectedAssets[0]) || 'Unknown');
            return `
                <div class="pri-item" onclick="showModule('vulnerability-tracking')">
                    <div class="pri-sev" style="background:${sevBar}"></div>
                    <div class="pri-body">
                        <div class="pri-top">
                            <span class="pri-id">${escapeHtml(p.id || '')}</span>
                            <span class="sev-badge ${sevClass}">${escapeHtml(item.risk.toUpperCase())}</span>
                            <span class="pri-title">${title}</span>
                        </div>
                        <div class="pri-bottom">
                            <span class="pri-sys-pill">${system}</span>
                            <div class="pri-urgency-wrap">
                                <div class="pri-urgency-track"><div class="pri-urgency-fill" style="width:${urgencyPct}%;background:${sevBar}"></div></div>
                            </div>
                            <span class="pri-due">${dueText}</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    // ─────────────────────────────────────────────
    // 8. Systems with most open POAMs
    // ─────────────────────────────────────────────
    function renderSystemsList(poams) {
        const openList = poams.filter(isOpen);
        const bySystem = new Map();
        openList.forEach(p => {
            const sys = p.system || p.assetName || (p.affectedAssets && p.affectedAssets[0]) || 'Unknown';
            bySystem.set(sys, (bySystem.get(sys) || 0) + 1);
        });
        const ranked = [...bySystem.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
        const maxCount = ranked.length ? ranked[0][1] : 1;

        const el = document.getElementById('dash-systems-list');
        if (!el) return;
        if (ranked.length === 0) {
            el.innerHTML = '<div style="font-size:12px;color:#6B7280;padding:8px 0">No data available</div>';
            return;
        }
        el.innerHTML = ranked.map(([sys, count]) => {
            const pct = Math.round(count / maxCount * 100);
            return `
                <div class="sys-row">
                    <div class="sys-meta">
                        <span class="sys-name">${escapeHtml(sys)}</span>
                        <span class="sys-count">${count}</span>
                    </div>
                    <div class="sys-bar-track"><div class="sys-bar-fill" style="width:${pct}%"></div></div>
                </div>
            `;
        }).join('');
    }

    // ─────────────────────────────────────────────
    // 9. Recent Activity Feed
    // ─────────────────────────────────────────────
    function renderActivityFeed(poams) {
        const events = [];
        poams.forEach(p => {
            const history = Array.isArray(p.statusHistory) ? p.statusHistory : [];
            history.forEach(h => {
                if (h && h.date) {
                    events.push({
                        date: new Date(h.date),
                        action: h.action || 'update',
                        details: h.details || '',
                        poam: p
                    });
                }
            });
        });
        events.sort((a, b) => b.date - a.date);
        const top = events.slice(0, 6);
        const el = document.getElementById('dash-activity-feed');
        if (!el) return;
        if (top.length === 0) {
            el.innerHTML = '<div class="act-item"><div class="act-dot" style="background:#6B7280"></div><div class="act-text">No recent activity</div><div class="act-time">—</div></div>';
            return;
        }
        const now = new Date();
        const dotFor = action => {
            if (action === 'created') return '#3B82F6';
            if (action === 'auto_resolved' || action === 'resolved' || action === 'closed') return '#10B981';
            if (action === 'risk_change') return '#F59E0B';
            if (action === 'risk_accepted') return '#6B7280';
            return '#6B7280';
        };
        el.innerHTML = top.map(ev => {
            const ageMs = now - ev.date;
            const ageDays = Math.floor(ageMs / 86400000);
            const ageHours = Math.floor(ageMs / 3600000);
            const timeStr = ageDays > 0 ? `${ageDays}d ago` : ageHours > 0 ? `${ageHours}h ago` : 'just now';
            const label = (ev.details || ev.action || 'update').substring(0, 70);
            return `
                <div class="act-item">
                    <div class="act-dot" style="background:${dotFor(ev.action)}"></div>
                    <div class="act-text">${escapeHtml(label)}</div>
                    <div class="act-time">${timeStr}</div>
                </div>
            `;
        }).join('');
    }

    // ─────────────────────────────────────────────
    // ENTRY POINT — call after loadDashboardMetrics()
    // ─────────────────────────────────────────────
    function renderMockupCDashboard(poams) {
        if (!Array.isArray(poams)) poams = [];
        const openList = poams.filter(isOpen);
        try { renderSLARing(openList); } catch (e) { console.warn('SLARing:', e.message); }
        try { renderRiskAcceptedTile(poams); } catch (e) { console.warn('RiskAcceptedTile:', e.message); }
        try { renderScanCoverage(poams); } catch (e) { console.warn('ScanCoverage:', e.message); }
        try { renderComplianceGauge(poams); } catch (e) { console.warn('ComplianceGauge:', e.message); }
        try { renderRiskDonut(poams); } catch (e) { console.warn('RiskDonut:', e.message); }
        try { renderTrendSVG(poams); } catch (e) { console.warn('TrendSVG:', e.message); }
        try { renderPriorityList(poams); } catch (e) { console.warn('PriorityList:', e.message); }
        try { renderSystemsList(poams); } catch (e) { console.warn('SystemsList:', e.message); }
        try { renderActivityFeed(poams); } catch (e) { console.warn('ActivityFeed:', e.message); }
    }

    // Expose globally
    window.renderMockupCDashboard = renderMockupCDashboard;

    // Hook into the existing loadDashboardMetrics flow.
    // Wrap the original so we always populate the new widgets after the legacy
    // renderer runs. If loadDashboardMetrics isn't defined yet (script order),
    // retry on DOMContentLoaded.
    function installHook() {
        if (typeof window.loadDashboardMetrics !== 'function') return false;
        if (window.__mockupCHookInstalled) return true;
        const original = window.loadDashboardMetrics;
        window.loadDashboardMetrics = async function () {
            const result = await original.apply(this, arguments);
            try {
                if (window.poamDB && typeof window.poamDB.getAllPOAMs === 'function') {
                    const poams = await window.poamDB.getAllPOAMs();
                    renderMockupCDashboard(poams);
                }
            } catch (e) {
                console.warn('Mockup-C dashboard hook failed:', e.message);
            }
            return result;
        };
        window.__mockupCHookInstalled = true;
        return true;
    }

    if (!installHook()) {
        document.addEventListener('DOMContentLoaded', () => {
            installHook();
        });
    }
})();
