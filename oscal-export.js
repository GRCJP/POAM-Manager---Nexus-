// ═══════════════════════════════════════════════════════════════
// OSCAL POA&M EXPORT (v1.1.2)
// Secondary export format for tool interoperability.
// Generates a valid OSCAL plan-of-action-and-milestones JSON.
// Primary formats remain Excel (XLSX) and CSV.
// ═══════════════════════════════════════════════════════════════

console.log('🔄 oscal-export.js loading...');

// ═══════════════════════════════════════════════════════════════
// MAIN EXPORT FUNCTION
// ═══════════════════════════════════════════════════════════════

async function exportOSCALPOAM(options = {}) {
    console.log('🔄 Generating OSCAL POA&M JSON...');
    try {
        if (!poamDB || !poamDB.db) await poamDB.init();

        let poams = await poamDB.getAllPOAMs();
        if (options.systemId) {
            poams = poams.filter(p => p.systemId === options.systemId || p.scanId === options.systemId);
        }

        if (poams.length === 0) {
            alert('No POAMs found to export. Import scan data first.');
            return;
        }

        const documentUUID = generateOSCALUUID();
        const now = new Date().toISOString();

        const parties = buildParties(poams);
        const risks = [];
        const observations = [];
        const poamItems = [];
        const inventoryItems = [];
        const components = [];

        const componentMap = new Map();
        const partyMap = new Map();
        parties.forEach(p => partyMap.set(p._originalName, p.uuid));

        poams.forEach(p => {
            const riskUUID = generateOSCALUUID();
            const obsUUID = generateOSCALUUID();
            const poamItemUUID = generateOSCALUUID();

            // Build observation
            const observation = {
                uuid: obsUUID,
                title: p.vulnerabilityName || p.title || 'Vulnerability Finding',
                description: p.findingDescription || p.description || 'No description available',
                methods: ['TEST'],
                types: ['finding'],
                collected: p.createdDate || now,
                origins: [{
                    actors: [{
                        type: 'tool',
                        'actor-uuid': generateOSCALUUID(),
                        props: [{ name: 'tool-name', value: p.findingSource || 'Vulnerability Scanner', ns: 'https://poam-nexus.local' }]
                    }]
                }]
            };
            observations.push(observation);

            // Build risk
            const risk = {
                uuid: riskUUID,
                title: p.vulnerabilityName || p.title || 'Identified Risk',
                description: p.findingDescription || p.description || 'No description',
                statement: `Risk identified for ${p.controlFamily || 'unknown'} control family with ${p.riskLevel || p.risk || 'medium'} severity.`,
                props: [
                    { name: 'risk-level', value: p.riskLevel || p.risk || 'medium', ns: 'https://poam-nexus.local' }
                ],
                status: mapStatusToOSCAL(p.findingStatus || p.status || 'open'),
                characterizations: [{
                    facets: [{
                        name: 'likelihood',
                        system: 'https://poam-nexus.local',
                        value: mapRiskToLikelihood(p.riskLevel || p.risk || 'medium')
                    }, {
                        name: 'impact',
                        system: 'https://poam-nexus.local',
                        value: p.riskLevel || p.risk || 'medium'
                    }]
                }],
                'related-observations': [{ 'observation-uuid': obsUUID }]
            };

            // Add remediation if mitigation exists
            if (p.mitigation || p.dueDate) {
                const remediation = {
                    uuid: generateOSCALUUID(),
                    lifecycle: 'planned',
                    title: `Remediation for ${p.id}`,
                    description: p.mitigation || 'Remediation plan pending',
                    props: []
                };
                if (p.dueDate || p.updatedScheduledCompletionDate) {
                    remediation.props.push({ name: 'planned-completion-date', value: p.updatedScheduledCompletionDate || p.dueDate, ns: 'https://poam-nexus.local' });
                }
                if (p.initialScheduledCompletionDate) {
                    remediation.props.push({ name: 'original-completion-date', value: p.initialScheduledCompletionDate, ns: 'https://poam-nexus.local' });
                }
                if (p.updatedScheduledCompletionDate && p.initialScheduledCompletionDate && p.updatedScheduledCompletionDate !== p.initialScheduledCompletionDate) {
                    remediation.props.push({ name: 'adjusted-completion-date', value: p.updatedScheduledCompletionDate, ns: 'https://poam-nexus.local' });
                }
                if (p.actualCompletionDate) {
                    remediation.props.push({ name: 'actual-completion-date', value: p.actualCompletionDate, ns: 'https://poam-nexus.local' });
                }

                // Add milestones as tasks
                if (Array.isArray(p.milestones) && p.milestones.length > 0) {
                    remediation['required-assets'] = p.milestones.map(m => ({
                        uuid: generateOSCALUUID(),
                        description: m.name || m.description || 'Milestone',
                        props: m.targetDate ? [{ name: 'target-date', value: m.targetDate, ns: 'https://poam-nexus.local' }] : []
                    }));
                }

                risk.remediations = [remediation];
            }

            risks.push(risk);

            // Build POAM item
            const poamItem = {
                uuid: poamItemUUID,
                title: p.vulnerabilityName || p.title || `POAM Item ${p.id}`,
                description: p.findingDescription || p.description || 'No description',
                props: [
                    { name: 'finding-id', value: p.id || '', ns: 'https://poam-nexus.local' },
                    { name: 'status', value: p.findingStatus || p.status || 'open', ns: 'https://poam-nexus.local' },
                    { name: 'control-id', value: p.controlFamily || '', ns: 'https://poam-nexus.local' },
                    { name: 'date-created', value: p.createdDate || now, ns: 'https://poam-nexus.local' }
                ],
                'related-risks': [{ 'risk-uuid': riskUUID }]
            };

            if (p.notes) {
                poamItem.remarks = p.notes;
            }

            // Link POC as responsible party
            const pocName = p.poc || p.pocTeam;
            if (pocName && partyMap.has(pocName)) {
                poamItem.origins = [{
                    actors: [{
                        type: 'party',
                        'actor-uuid': partyMap.get(pocName)
                    }]
                }];
            }

            poamItems.push(poamItem);

            // Build inventory items from affected assets
            if (Array.isArray(p.affectedAssets)) {
                p.affectedAssets.forEach(asset => {
                    const assetStr = typeof asset === 'string' ? asset : (asset.hostname || asset.ip || JSON.stringify(asset));
                    if (!componentMap.has(assetStr)) {
                        const compUUID = generateOSCALUUID();
                        componentMap.set(assetStr, compUUID);
                        components.push({
                            uuid: compUUID,
                            type: 'software',
                            title: assetStr,
                            description: `Component identified from POAM ${p.id}`,
                            status: { state: 'operational' }
                        });
                        inventoryItems.push({
                            uuid: generateOSCALUUID(),
                            description: `Asset: ${assetStr}`,
                            'implemented-components': [{ 'component-uuid': compUUID }]
                        });
                    }
                });
            }
        });

        // Build the full OSCAL document
        const oscalDocument = {
            'plan-of-action-and-milestones': {
                uuid: documentUUID,
                metadata: buildOSCALMetadata(parties, now),
                'system-id': {
                    'identifier-type': 'https://poam-nexus.local',
                    id: options.systemId || 'poam-nexus-default-system'
                },
                'poam-items': poamItems,
                risks: risks,
                observations: observations
            }
        };

        // Add local definitions if we have components/inventory
        if (components.length > 0 || inventoryItems.length > 0) {
            oscalDocument['plan-of-action-and-milestones']['local-definitions'] = {};
            if (components.length > 0) {
                oscalDocument['plan-of-action-and-milestones']['local-definitions'].components = components;
            }
            if (inventoryItems.length > 0) {
                oscalDocument['plan-of-action-and-milestones']['local-definitions']['inventory-items'] = inventoryItems;
            }
        }

        downloadOSCALJSON(oscalDocument, options.systemId);
        console.log(`✅ OSCAL export complete: ${poams.length} POAMs, ${risks.length} risks, ${observations.length} observations`);

    } catch (err) {
        console.error('❌ OSCAL export error:', err);
        alert(`OSCAL export failed: ${err.message}`);
    }
}

// ═══════════════════════════════════════════════════════════════
// METADATA BUILDER
// ═══════════════════════════════════════════════════════════════

function buildOSCALMetadata(parties, timestamp) {
    const cleanParties = parties.map(p => {
        const { _originalName, ...rest } = p;
        return rest;
    });

    return {
        title: 'POAM Nexus — Plan of Action and Milestones Export',
        'last-modified': timestamp,
        version: '1.0',
        'oscal-version': '1.1.2',
        roles: [
            { id: 'poc', title: 'Point of Contact' },
            { id: 'system-owner', title: 'System Owner' },
            { id: 'tool', title: 'Assessment Tool' }
        ],
        parties: cleanParties.length > 0 ? cleanParties : [{
            uuid: generateOSCALUUID(),
            type: 'organization',
            name: 'POAM Nexus Export'
        }]
    };
}

function buildParties(poams) {
    const pocSet = new Map();
    poams.forEach(p => {
        const poc = p.poc || p.pocTeam;
        if (poc && !pocSet.has(poc)) {
            pocSet.set(poc, {
                uuid: generateOSCALUUID(),
                type: 'organization',
                name: poc,
                _originalName: poc
            });
        }
    });
    return Array.from(pocSet.values());
}

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

function mapStatusToOSCAL(status) {
    const s = (status || 'open').toLowerCase();
    if (s === 'completed' || s === 'closed') return 'closed';
    if (s === 'risk-accepted' || s === 'ignored') return 'deviation-approved';
    if (s === 'in-progress' || s === 'in_progress') return 'open';
    return 'open';
}

function mapRiskToLikelihood(risk) {
    const r = (risk || 'medium').toLowerCase();
    if (r === 'critical') return 'high';
    if (r === 'high') return 'moderate';
    if (r === 'medium' || r === 'moderate') return 'low';
    return 'low';
}

function generateOSCALUUID() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
}

function downloadOSCALJSON(data, systemId) {
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const sysLabel = systemId ? `_${systemId}` : '';
    a.href = url;
    a.download = `POAM_OSCAL${sysLabel}_${ts}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
