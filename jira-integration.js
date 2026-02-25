// ═══════════════════════════════════════════════════════════════
// JIRA INTEGRATION MODULE
// ═══════════════════════════════════════════════════════════════
// Creates and syncs Jira tickets for POAM tracking

console.log('🎫 Jira Integration Module Loading...');

class JiraIntegration {
    constructor() {
        this.config = window.NOTIFICATION_CONFIG?.jira || {};
        this.ticketCache = new Map();
    }

    // Create Jira ticket for POAM
    async createTicket(poam) {
        if (!window.isFeatureEnabled('jiraIntegration')) {
            console.log('🎫 Jira integration disabled');
            return { success: false, reason: 'feature_disabled' };
        }

        try {
            // Check if ticket already exists
            if (poam.jiraTicketId) {
                console.log(`🎫 POAM ${poam.id} already has Jira ticket: ${poam.jiraTicketId}`);
                return { success: true, ticketId: poam.jiraTicketId, created: false };
            }

            // Build Jira payload
            const payload = this.buildJiraPayload(poam);

            // Create ticket (mock for now, replace with actual API call)
            const result = await this.sendToJira(payload);

            // Store ticket ID in POAM
            if (result.success) {
                poam.jiraTicketId = result.key;
                poam.jiraTicketUrl = `${this.config.baseUrl}/browse/${result.key}`;
                await window.poamDB.savePOAM(poam);
                
                console.log(`✅ Created Jira ticket ${result.key} for POAM ${poam.id}`);
            }

            return result;

        } catch (error) {
            console.error(`❌ Failed to create Jira ticket for POAM ${poam.id}:`, error);
            window.trackFeatureError('jiraIntegration', error);
            throw error;
        }
    }

    // Build Jira ticket payload
    buildJiraPayload(poam) {
        const enrichedData = poam.enrichedData || {};
        const cveDetails = enrichedData.cveDetails || {};
        const firstCVE = poam.cves?.[0];
        const cveData = firstCVE ? cveDetails[firstCVE] : null;

        return {
            fields: {
                project: {
                    key: this.config.projectKey || 'SEC'
                },
                summary: `[POAM] ${poam.title || poam.vulnerabilityName || 'Security Vulnerability'}`,
                description: this.buildJiraDescription(poam, enrichedData, cveData),
                issuetype: {
                    name: this.config.issueType || 'Security Vulnerability'
                },
                priority: {
                    name: this.mapSeverityToPriority(poam.risk)
                },
                assignee: {
                    name: this.getPOCJiraUsername(poam.pocTeam || poam.poc)
                },
                duedate: this.formatJiraDate(poam.dueDate),
                labels: this.buildLabels(poam),
                
                // Custom fields
                [this.config.customFields?.poamId || 'customfield_10001']: poam.id,
                [this.config.customFields?.cveIds || 'customfield_10002']: poam.cves?.join(', ') || '',
                [this.config.customFields?.assetCount || 'customfield_10003']: poam.totalAffectedAssets || 0,
                [this.config.customFields?.severity || 'customfield_10004']: (poam.risk || 'medium').toUpperCase()
            }
        };
    }

    // Build Jira description in Wiki markup
    buildJiraDescription(poam, enrichedData, cveData) {
        let description = `h2. Vulnerability Details\n\n`;
        description += `*POAM ID:* ${poam.id}\n`;
        description += `*Severity:* ${(poam.risk || 'medium').toUpperCase()}\n`;
        
        if (poam.cves && poam.cves.length > 0) {
            description += `*CVEs:* ${poam.cves.join(', ')}\n`;
        }
        
        if (cveData?.cvssScore) {
            description += `*CVSS Score:* ${cveData.cvssScore}\n`;
        }

        description += `\n`;
        description += `*Description:*\n`;
        description += `${poam.findingDescription || poam.description || 'No description available'}\n\n`;

        description += `h2. Affected Assets\n\n`;
        description += `*Total:* ${poam.totalAffectedAssets || 0}\n`;
        description += `*Breached SLA:* ${poam.breachedAssets || 0}\n`;
        description += `*Active:* ${poam.activeAssets || poam.totalAffectedAssets || 0}\n\n`;

        description += `h2. Remediation Plan\n\n`;
        description += `*Control Family:* ${poam.controlFamily || 'CM'}\n`;
        description += `*POC Team:* ${poam.pocTeam || poam.poc || 'Unassigned'}\n`;
        description += `*Due Date:* ${this.formatDate(poam.dueDate)}\n\n`;

        if (poam.milestones && poam.milestones.length > 0) {
            description += `*Milestones:*\n`;
            poam.milestones.forEach((m, i) => {
                description += `# ${m.name} - ${this.formatDate(m.targetDate)} (${m.status || 'pending'})\n`;
            });
            description += `\n`;
        }

        description += `h2. Mitigation Steps\n\n`;
        if (cveData?.description) {
            description += `${cveData.description}\n\n`;
        }
        if (poam.solution) {
            description += `${poam.solution}\n\n`;
        }

        if (enrichedData.nistControls && enrichedData.nistControls.length > 0) {
            description += `h2. NIST Controls\n\n`;
            description += `${enrichedData.nistControls.join(', ')}\n\n`;
        }

        if (cveData?.references && cveData.references.length > 0) {
            description += `h2. References\n\n`;
            cveData.references.slice(0, 5).forEach(ref => {
                description += `* [${ref.source || 'Reference'}|${ref.url}]\n`;
            });
            description += `\n`;
        }

        description += `----\n`;
        description += `View in POAM Nexus: [Dashboard|${this.getAppURL()}#/poam/${poam.id}]\n`;

        return description;
    }

    // Map POAM severity to Jira priority
    mapSeverityToPriority(severity) {
        const mapping = this.config.priorityMapping || {
            critical: 'Highest',
            high: 'High',
            medium: 'Medium',
            low: 'Low'
        };

        return mapping[severity?.toLowerCase()] || 'Medium';
    }

    // Get Jira username for POC team
    getPOCJiraUsername(pocTeam) {
        const mapping = this.config.pocMapping || {};
        return mapping[pocTeam] || mapping['Unassigned'] || 'security-team-lead';
    }

    // Build labels for Jira ticket
    buildLabels(poam) {
        const labels = ['poam', 'vulnerability'];
        
        if (poam.risk) {
            labels.push(poam.risk.toLowerCase());
        }
        
        if (poam.controlFamily) {
            labels.push(`control-${poam.controlFamily.toLowerCase()}`);
        }
        
        if (poam.cves && poam.cves.length > 0) {
            labels.push('cve');
        }

        return labels;
    }

    // Send ticket to Jira API
    async sendToJira(payload) {
        // In production, this would call Jira REST API
        // For now, mock the response
        
        console.log('🎫 Jira ticket would be created:', {
            project: payload.fields.project.key,
            summary: payload.fields.summary,
            assignee: payload.fields.assignee.name,
            priority: payload.fields.priority.name
        });

        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 200));

        // Mock success response
        const ticketKey = `${payload.fields.project.key}-${Math.floor(Math.random() * 10000)}`;
        
        return {
            success: true,
            key: ticketKey,
            id: `${Date.now()}`,
            self: `${this.config.baseUrl}/rest/api/2/issue/${ticketKey}`,
            created: true
        };

        // TODO: Replace with actual Jira API call when backend ready
        /*
        const response = await fetch(`${this.config.baseUrl}/rest/api/2/issue`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.config.apiToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`Jira API returned ${response.status}: ${await response.text()}`);
        }

        const result = await response.json();
        return {
            success: true,
            key: result.key,
            id: result.id,
            self: result.self,
            created: true
        };
        */
    }

    // Update Jira ticket
    async updateTicket(poam, updates) {
        if (!poam.jiraTicketId) {
            console.warn(`⚠️ POAM ${poam.id} has no Jira ticket to update`);
            return { success: false, reason: 'no_ticket' };
        }

        try {
            console.log(`🎫 Updating Jira ticket ${poam.jiraTicketId} for POAM ${poam.id}`);

            // Build update payload
            const payload = {
                fields: updates
            };

            // Send update (mock for now)
            await new Promise(resolve => setTimeout(resolve, 100));
            
            console.log(`✅ Updated Jira ticket ${poam.jiraTicketId}`);
            return { success: true, ticketId: poam.jiraTicketId };

            // TODO: Replace with actual API call
            /*
            const response = await fetch(`${this.config.baseUrl}/rest/api/2/issue/${poam.jiraTicketId}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${this.config.apiToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`Jira API returned ${response.status}`);
            }

            return { success: true, ticketId: poam.jiraTicketId };
            */

        } catch (error) {
            console.error(`❌ Failed to update Jira ticket:`, error);
            throw error;
        }
    }

    // Sync POAM status to Jira
    async syncStatusToJira(poam) {
        if (!window.isFeatureEnabled('jiraAutoSync')) {
            return;
        }

        const statusMapping = {
            'open': 'To Do',
            'in-progress': 'In Progress',
            'risk-accepted': 'Won\'t Do',
            'extended': 'In Progress',
            'completed': 'Done',
            'closed': 'Done'
        };

        const jiraStatus = statusMapping[poam.status?.toLowerCase()] || 'To Do';

        await this.updateTicket(poam, {
            status: { name: jiraStatus }
        });
    }

    // Batch create tickets
    async createTicketsBatch(poams) {
        const results = [];
        
        for (const poam of poams) {
            try {
                const result = await this.createTicket(poam);
                results.push({ poamId: poam.id, ...result });
            } catch (error) {
                results.push({ 
                    poamId: poam.id, 
                    success: false, 
                    error: error.message 
                });
            }
        }

        const successCount = results.filter(r => r.success).length;
        console.log(`✅ Created ${successCount}/${poams.length} Jira tickets`);

        return results;
    }

    // Format date for Jira (YYYY-MM-DD)
    formatJiraDate(dateString) {
        if (!dateString) return null;
        const date = new Date(dateString);
        return date.toISOString().split('T')[0];
    }

    // Format date for display
    formatDate(dateString) {
        if (!dateString) return 'Not set';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    }

    // Get application URL
    getAppURL() {
        return window.location.origin + window.location.pathname.replace(/\/[^\/]*$/, '');
    }

    // Get ticket URL
    getTicketURL(ticketKey) {
        return `${this.config.baseUrl}/browse/${ticketKey}`;
    }
}

// Initialize global instance
window.jiraIntegration = new JiraIntegration();

// Batch create tickets (for testing)
window.createJiraTicketsBatch = async function(poams) {
    console.log(`🎫 Creating Jira tickets for ${poams.length} POAMs...`);
    return await window.jiraIntegration.createTicketsBatch(poams);
};

console.log('✅ Jira Integration Module Ready');
console.log('💡 Use window.jiraIntegration.createTicket(poam) to create tickets');
console.log('💡 Use window.createJiraTicketsBatch(poams) for batch creation');
