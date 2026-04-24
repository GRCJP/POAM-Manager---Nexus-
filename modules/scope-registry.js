'use strict';

console.log('📦 scope-registry.js loading...');

// ═══════════════════════════════════════════════════════════════
// SCOPE REGISTRY - Manages import scopes and routing rules
// ═══════════════════════════════════════════════════════════════

class ScopeRegistry {
    constructor() {
        this.RULES_KEY = 'scopeRules';
    }

    // ── Rule Management (localStorage) ──

    getRules() {
        try {
            const saved = localStorage.getItem(this.RULES_KEY);
            return saved ? JSON.parse(saved) : { rules: [] };
        } catch (e) {
            console.warn('Failed to load scope rules:', e.message);
            return { rules: [] };
        }
    }

    saveRules(rulesConfig) {
        localStorage.setItem(this.RULES_KEY, JSON.stringify(rulesConfig));
    }

    getRuleForSource(source) {
        const config = this.getRules();
        return config.rules.find(r => r.source === source.toLowerCase()) || null;
    }

    saveRuleForSource(source, field, mode, mappings) {
        const config = this.getRules();
        const existing = config.rules.findIndex(r => r.source === source.toLowerCase());
        const rule = {
            source: source.toLowerCase(),
            field: field,
            mode: mode || 'auto',
            mappings: mappings || {}
        };
        if (existing >= 0) {
            config.rules[existing] = rule;
        } else {
            config.rules.push(rule);
        }
        this.saveRules(config);
        return rule;
    }

    // ── Scope Resolution ──

    async resolveScope(finding, source) {
        const rule = this.getRuleForSource(source);
        if (!rule || !rule.field) return null;

        // Extract the field value from raw scan data
        const rawValue = this.extractFieldValue(finding, rule.field);
        if (!rawValue) return null;

        if (rule.mode === 'mapped') {
            // Mapped mode: look up in mappings table
            return rule.mappings[rawValue] || null;
        }

        // Auto mode: raw value becomes the scopeId
        const scopeId = this.normalizeId(rawValue);

        // Ensure scope exists in registry
        if (window.poamDB) {
            const existing = await window.poamDB.getScope(scopeId);
            if (!existing) {
                await window.poamDB.saveScope({
                    id: scopeId,
                    displayName: rawValue,
                    description: '',
                    createdAt: new Date().toISOString(),
                    autoCreated: true
                });
                console.log(`📦 Auto-created scope: ${scopeId} (${rawValue})`);
            }
        }

        return scopeId;
    }

    extractFieldValue(finding, fieldName) {
        // Check raw scan data first (preserves original column names)
        if (finding.raw && finding.raw[fieldName] !== undefined) {
            const val = finding.raw[fieldName];
            return val && val.trim() !== '' ? val.trim() : null;
        }

        // Check normalized finding fields
        if (finding[fieldName] !== undefined) {
            const val = String(finding[fieldName]);
            return val && val.trim() !== '' ? val.trim() : null;
        }

        // Check asset tags (comma-separated, look for key=value pattern)
        const tags = finding.raw?.['Asset Tags'] || finding.assetTags || '';
        if (tags) {
            const tagParts = tags.split(',').map(t => t.trim());
            for (const tag of tagParts) {
                const [key, value] = tag.split('=').map(s => s?.trim());
                if (key && key.toLowerCase() === fieldName.toLowerCase() && value) {
                    return value;
                }
            }
        }

        return null;
    }

    normalizeId(rawValue) {
        return rawValue.toLowerCase()
            .replace(/[^a-z0-9\-_]/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');
    }

    // ── Batch Scope Resolution ──

    async resolveScopeForFindings(findings, source) {
        const rule = this.getRuleForSource(source);
        if (!rule || !rule.field) {
            // No rule configured — all findings are unassigned
            findings.forEach(f => { f.scopeId = null; f.scopeSource = null; });
            return { scoped: 0, unassigned: findings.length };
        }

        let scoped = 0;
        let unassigned = 0;

        for (const finding of findings) {
            const scopeId = await this.resolveScope(finding, source);
            finding.scopeId = scopeId;
            finding.scopeSource = scopeId ? 'auto' : null;
            if (scopeId) scoped++;
            else unassigned++;
        }

        console.log(`📦 Scope resolution: ${scoped} scoped, ${unassigned} unassigned`);
        return { scoped, unassigned };
    }
}

// Export
window.ScopeRegistry = ScopeRegistry;
window.scopeRegistry = new ScopeRegistry();

console.log('✅ scope-registry.js loaded');
