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
        description += `View in TRACE: [Dashboard|${this.getAppURL()}#/poam/${poam.id}]\n`;

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
// ═══════════════════════════════════════════════════════════════
// EMAIL DELIVERY SYSTEM
// ═══════════════════════════════════════════════════════════════
// Generates and sends email digests for POAM notifications

console.log('📧 Email Delivery System Loading...');

class EmailDelivery {
    constructor() {
        this.config = window.NOTIFICATION_CONFIG?.email || {};
    }

    // Send weekly digest to POC team
    async sendDigest(pocTeam, poams, batchId) {
        if (!window.isFeatureEnabled('emailDelivery')) {
            console.log('📭 Email delivery disabled');
            return { success: false, reason: 'feature_disabled' };
        }

        try {
            // Group POAMs by severity
            const grouped = this.groupBySeverity(poams);
            
            // Generate email content
            const emailContent = this.generateDigestEmail(pocTeam, grouped, poams.length, batchId);
            
            // Send email (mock for now, replace with actual SMTP when backend ready)
            const result = await this.sendEmail({
                to: this.getPOCTeamEmail(pocTeam),
                cc: window.NOTIFICATION_CONFIG?.recipients?.securityTeam || [],
                bcc: window.NOTIFICATION_CONFIG?.recipients?.alwaysBCC || [],
                subject: emailContent.subject,
                html: emailContent.html,
                text: emailContent.text
            });

            console.log(`✅ Email digest sent to ${pocTeam}`);
            return result;

        } catch (error) {
            console.error(`❌ Failed to send email digest to ${pocTeam}:`, error);
            window.trackFeatureError('emailDelivery', error);
            throw error;
        }
    }

    // Group POAMs by severity
    groupBySeverity(poams) {
        const grouped = {
            critical: [],
            high: [],
            medium: [],
            low: []
        };

        for (const poam of poams) {
            const severity = (poam.risk || 'medium').toLowerCase();
            if (grouped[severity]) {
                grouped[severity].push(poam);
            } else {
                grouped.medium.push(poam);
            }
        }

        return grouped;
    }

    // Generate email digest content
    generateDigestEmail(pocTeam, groupedPOAMs, totalCount, batchId) {
        const subject = this.config.templates?.subject
            ?.replace('{count}', totalCount)
            ?.replace('{team}', pocTeam)
            || `[TRACE] Weekly Security Alert - ${totalCount} New POAMs Assigned to ${pocTeam}`;

        const html = this.generateHTMLEmail(pocTeam, groupedPOAMs, totalCount, batchId);
        const text = this.generatePlainTextEmail(pocTeam, groupedPOAMs, totalCount, batchId);

        return { subject, html, text };
    }

    // Generate HTML email
    generateHTMLEmail(pocTeam, groupedPOAMs, totalCount, batchId) {
        const emoji = this.config.templates?.severityEmoji || {
            critical: '🔴',
            high: '🟠',
            medium: '🟡',
            low: '🟢'
        };

        let html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 800px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; }
        .header h1 { margin: 0; font-size: 24px; }
        .header p { margin: 10px 0 0 0; opacity: 0.9; }
        .content { background: #f9fafb; padding: 30px; }
        .section { background: white; border-radius: 8px; padding: 20px; margin-bottom: 20px; border-left: 4px solid #667eea; }
        .section h2 { margin-top: 0; font-size: 18px; color: #1f2937; }
        .poam-item { background: #f9fafb; padding: 15px; margin: 10px 0; border-radius: 6px; border-left: 3px solid #e5e7eb; }
        .poam-title { font-weight: 600; color: #1f2937; margin-bottom: 8px; }
        .poam-meta { font-size: 14px; color: #6b7280; margin: 5px 0; }
        .poam-meta strong { color: #374151; }
        .button { display: inline-block; padding: 10px 20px; margin: 5px; background: #667eea; color: white; text-decoration: none; border-radius: 6px; font-size: 14px; }
        .button:hover { background: #5568d3; }
        .button-secondary { background: #6b7280; }
        .button-secondary:hover { background: #4b5563; }
        .summary { background: #eff6ff; border: 1px solid #bfdbfe; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .summary h3 { margin-top: 0; color: #1e40af; }
        .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 14px; }
        .divider { border: 0; border-top: 2px solid #e5e7eb; margin: 30px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>TRACE Weekly Security Alert</h1>
            <p>New POAMs assigned to ${pocTeam}</p>
        </div>
        
        <div class="content">
            <p>Hi ${pocTeam},</p>
            <p>You have <strong>${totalCount} new POAMs</strong> assigned this week. Please review and acknowledge:</p>
`;

        // Critical POAMs
        if (groupedPOAMs.critical.length > 0) {
            html += this.generateSeveritySection('CRITICAL', groupedPOAMs.critical, emoji.critical, '#dc2626');
        }

        // High POAMs
        if (groupedPOAMs.high.length > 0) {
            html += this.generateSeveritySection('HIGH', groupedPOAMs.high, emoji.high, '#ea580c');
        }

        // Medium POAMs
        if (groupedPOAMs.medium.length > 0) {
            html += this.generateSeveritySection('MEDIUM', groupedPOAMs.medium, emoji.medium, '#ca8a04');
        }

        // Low POAMs
        if (groupedPOAMs.low.length > 0) {
            html += this.generateSeveritySection('LOW', groupedPOAMs.low, emoji.low, '#16a34a');
        }

        // Summary
        html += `
            <div class="summary">
                <h3>Summary</h3>
                <p><strong>Total New POAMs:</strong> ${totalCount}</p>
                <p><strong>By Severity:</strong> Critical: ${groupedPOAMs.critical.length} | High: ${groupedPOAMs.high.length} | Medium: ${groupedPOAMs.medium.length} | Low: ${groupedPOAMs.low.length}</p>
                <p><strong>Batch ID:</strong> ${batchId}</p>
            </div>

            <div style="text-align: center; margin: 30px 0;">
                <a href="${this.getAppURL()}" class="button">View All POAMs in Dashboard</a>
            </div>

            <p><strong>Action Required:</strong></p>
            <ol>
                <li>Review each POAM in TRACE dashboard</li>
                <li>Acknowledge receipt via links above</li>
                <li>Request extensions if needed (requires justification)</li>
            </ol>

            <p>Questions? Contact Security Team at ${this.config.replyTo || 'security-team@agency.gov'}</p>
        </div>

        <div class="footer">
            <p>This is an automated notification from TRACE.</p>
            <p>Sent: ${new Date().toLocaleString()}</p>
        </div>
    </div>
</body>
</html>
`;

        return html;
    }

    // Generate severity section for email
    generateSeveritySection(severityLabel, poams, emoji, color) {
        const daysMap = { critical: 15, high: 30, medium: 90, low: 180 };
        const days = daysMap[severityLabel.toLowerCase()] || 30;

        let html = `
            <hr class="divider">
            <div class="section" style="border-left-color: ${color};">
                <h2>${emoji} ${severityLabel} (${poams.length} POAMs) - Due in ${days} days</h2>
`;

        for (const poam of poams.slice(0, 10)) { // Limit to 10 per severity
            const feedbackUrl = this.getFeedbackURL(poam.id);
            
            html += `
                <div class="poam-item">
                    <div class="poam-title">${poam.id}: ${this.escapeHTML(poam.title || poam.vulnerabilityName || 'Unknown Vulnerability')}</div>
                    <div class="poam-meta"><strong>Affected Assets:</strong> ${poam.totalAffectedAssets || 0} ${poam.totalAffectedAssets === 1 ? 'system' : 'systems'}</div>
                    <div class="poam-meta"><strong>Due Date:</strong> ${this.formatDate(poam.dueDate)}</div>
                    <div class="poam-meta"><strong>Milestones:</strong> ${(poam.milestones || []).length} steps</div>
                    ${poam.cves && poam.cves.length > 0 ? `<div class="poam-meta"><strong>CVEs:</strong> ${poam.cves.join(', ')}</div>` : ''}
                    <div style="margin-top: 10px;">
                        <a href="${this.getAppURL()}#/poam/${poam.id}" class="button">View Details</a>
                        <a href="${feedbackUrl}?action=acknowledge" class="button button-secondary">Acknowledge</a>
                        <a href="${feedbackUrl}?action=extension" class="button button-secondary">Request Extension</a>
                    </div>
                </div>
`;
        }

        if (poams.length > 10) {
            html += `<p><em>...and ${poams.length - 10} more ${severityLabel.toLowerCase()} severity POAMs</em></p>`;
        }

        html += `</div>`;
        return html;
    }

    // Generate plain text email
    generatePlainTextEmail(pocTeam, groupedPOAMs, totalCount, batchId) {
        const emoji = this.config.templates?.severityEmoji || {
            critical: '🔴',
            high: '🟠',
            medium: '🟡',
            low: '🟢'
        };

        let text = `POAM NEXUS WEEKLY SECURITY ALERT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Hi ${pocTeam},

You have ${totalCount} new POAMs assigned this week. Please review and acknowledge:

`;

        // Add each severity section
        const sections = [
            { severity: 'CRITICAL', poams: groupedPOAMs.critical, emoji: emoji.critical, days: 15 },
            { severity: 'HIGH', poams: groupedPOAMs.high, emoji: emoji.high, days: 30 },
            { severity: 'MEDIUM', poams: groupedPOAMs.medium, emoji: emoji.medium, days: 90 },
            { severity: 'LOW', poams: groupedPOAMs.low, emoji: emoji.low, days: 180 }
        ];

        for (const section of sections) {
            if (section.poams.length > 0) {
                text += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${section.emoji} ${section.severity} (${section.poams.length} POAMs) - Due in ${section.days} days
────────────────────────────────────────────────────────────────────

`;
                for (const poam of section.poams.slice(0, 5)) {
                    text += `${poam.id}: ${poam.title || poam.vulnerabilityName || 'Unknown Vulnerability'}
  • Affected Assets: ${poam.totalAffectedAssets || 0}
  • Due Date: ${this.formatDate(poam.dueDate)}
  • Milestones: ${(poam.milestones || []).length} steps
  • View: ${this.getAppURL()}#/poam/${poam.id}

`;
                }
                if (section.poams.length > 5) {
                    text += `...and ${section.poams.length - 5} more ${section.severity.toLowerCase()} severity POAMs\n\n`;
                }
            }
        }

        text += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SUMMARY:
• Total New POAMs: ${totalCount}
• Critical: ${groupedPOAMs.critical.length} | High: ${groupedPOAMs.high.length} | Medium: ${groupedPOAMs.medium.length} | Low: ${groupedPOAMs.low.length}
• Batch ID: ${batchId}

ACTION REQUIRED:
1. Review each POAM in TRACE dashboard
2. Acknowledge receipt
3. Request extensions if needed (requires justification)

Dashboard: ${this.getAppURL()}

Questions? Contact Security Team at ${this.config.replyTo || 'security-team@agency.gov'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
This is an automated notification from TRACE.
Sent: ${new Date().toLocaleString()}
`;

        return text;
    }

    // Send email (mock implementation - replace with actual SMTP)
    async sendEmail(emailData) {
        // In production, this would use SMTP or email API
        // For now, log to console and simulate success
        
        console.log('📧 Email would be sent:', {
            to: emailData.to,
            cc: emailData.cc,
            subject: emailData.subject,
            bodyLength: emailData.html.length
        });

        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 100));

        // Mock success response
        return {
            success: true,
            messageId: `msg-${Date.now()}`,
            timestamp: new Date().toISOString()
        };

        // TODO: Replace with actual SMTP when backend ready
        // Example using nodemailer (backend):
        /*
        const nodemailer = require('nodemailer');
        const transporter = nodemailer.createTransport(this.config.smtp);
        
        const info = await transporter.sendMail({
            from: this.config.from,
            to: emailData.to,
            cc: emailData.cc,
            bcc: emailData.bcc,
            subject: emailData.subject,
            text: emailData.text,
            html: emailData.html
        });
        
        return { success: true, messageId: info.messageId };
        */
    }

    // Get POC team email address
    getPOCTeamEmail(pocTeam) {
        // Map POC team names to email addresses
        const emailMap = {
            'Windows Systems Team': 'windows-team@agency.gov',
            'Linux Systems Team': 'linux-team@agency.gov',
            'Network Security Team': 'network-team@agency.gov',
            'Application Security Team': 'appsec-team@agency.gov',
            'Database Security Team': 'database-team@agency.gov',
            'Cloud Security Team': 'cloud-team@agency.gov',
            'Endpoint Security Team': 'endpoint-team@agency.gov',
            'Critical Systems Team': 'critical-systems@agency.gov',
            'Unassigned': 'security-team@agency.gov'
        };

        return emailMap[pocTeam] || 'security-team@agency.gov';
    }

    // Get application URL
    getAppURL() {
        return window.location.origin + window.location.pathname.replace(/\/[^\/]*$/, '');
    }

    // Get feedback form URL
    getFeedbackURL(poamId) {
        const baseUrl = window.NOTIFICATION_CONFIG?.feedback?.formBaseUrl || this.getAppURL() + '/feedback';
        return `${baseUrl}?poam=${poamId}`;
    }

    // Format date
    formatDate(dateString) {
        if (!dateString) return 'Not set';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    }

    // Escape HTML
    escapeHTML(str) {
        if (!str) return '';
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
}

// Initialize global instance
window.emailDelivery = new EmailDelivery();

console.log('✅ Email Delivery System Ready');
console.log('💡 Use window.emailDelivery.sendDigest(pocTeam, poams, batchId) to send emails');
// ═══════════════════════════════════════════════════════════════
// NOTIFICATION QUEUE SYSTEM
// ═══════════════════════════════════════════════════════════════
// Tracks new POAMs and batches them for weekly delivery by POC team

console.log('📬 Notification Queue System Loading...');

class NotificationQueue {
    constructor() {
        this.db = null;
        this.initPromise = this.init();
    }

    async init() {
        // Extend POAMDatabase with notification queue store
        if (!window.poamDB?.db) {
            console.warn('⚠️ POAMDatabase not ready, waiting...');
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        this.db = window.poamDB?.db;
        
        if (!this.db) {
            console.error('❌ Failed to initialize notification queue: POAMDatabase unavailable');
            return;
        }

        // Check if notificationQueue store exists
        if (!this.db.objectStoreNames.contains('notificationQueue')) {
            console.warn('⚠️ notificationQueue store not found - will be created on next DB upgrade');
        }

        // Listen for POAM batch save events
        window.addEventListener('poam-batch-saved', (event) => this.handlePOAMBatchSaved(event));

        console.log('✅ Notification Queue initialized');
    }

    // Handle POAM batch saved event
    async handlePOAMBatchSaved(event) {
        if (!window.isFeatureEnabled('notifications')) {
            return; // Feature disabled
        }

        await this.initPromise;

        try {
            const { poams, isBaseline } = event.detail;

            // Skip baseline imports (don't notify on initial 400 POAMs)
            if (isBaseline && window.NOTIFICATION_CONFIG?.queue?.excludeBaseline) {
                console.log('📭 Skipping notifications for baseline import');
                return;
            }

            // Detect new POAMs
            const newPOAMs = await this.detectNewPOAMs(poams);
            
            if (newPOAMs.length === 0) {
                console.log('📭 No new POAMs to notify');
                return;
            }

            console.log(`📬 Detected ${newPOAMs.length} new POAMs for notification`);

            // Queue notifications
            await this.queueNotifications(newPOAMs);

        } catch (error) {
            console.error('❌ Failed to handle POAM batch save:', error);
            window.trackFeatureError('notifications', error);
        }
    }

    // Detect new POAMs (not in previous imports)
    async detectNewPOAMs(poams) {
        // For now, treat all POAMs in a non-baseline import as "new"
        // In production, you could track previously seen POAM IDs
        const newPOAMs = [];

        for (const poam of poams) {
            // Check if this POAM was created recently (within last hour)
            const createdDate = new Date(poam.createdDate || Date.now());
            const hourAgo = new Date(Date.now() - 60 * 60 * 1000);

            if (createdDate > hourAgo) {
                newPOAMs.push(poam);
            }
        }

        return newPOAMs;
    }

    // Queue notifications for new POAMs
    async queueNotifications(poams) {
        const queued = [];

        for (const poam of poams) {
            const notification = {
                id: `notif-${poam.id}-${Date.now()}`,
                poamId: poam.id,
                pocTeam: poam.pocTeam || poam.poc || 'Unassigned',
                severity: poam.risk || 'medium',
                createdDate: new Date().toISOString(),
                notificationStatus: 'pending', // pending, sent, acknowledged, failed
                batchId: null,
                sentDate: null,
                acknowledgedDate: null,
                feedbackData: null,
                retryCount: 0,
                lastError: null
            };

            try {
                await this.addToQueue(notification);
                queued.push(notification);
            } catch (error) {
                console.error(`❌ Failed to queue notification for POAM ${poam.id}:`, error);
            }
        }

        console.log(`✅ Queued ${queued.length} notifications`);

        // Trigger immediate processing if not batching
        if (!window.NOTIFICATION_CONFIG?.queue?.batchWeekly) {
            await this.processQueue();
        }
    }

    // Add notification to queue
    async addToQueue(notification) {
        if (!this.db) {
            throw new Error('Database not initialized');
        }

        return new Promise((resolve, reject) => {
            try {
                const transaction = this.db.transaction(['notificationQueue'], 'readwrite');
                const store = transaction.objectStore('notificationQueue');
                const request = store.add(notification);

                request.onsuccess = () => resolve(notification);
                request.onerror = () => reject(request.error);
            } catch (error) {
                // Store might not exist yet
                console.warn('⚠️ notificationQueue store not available:', error);
                resolve(notification);
            }
        });
    }

    // Get pending notifications
    async getPendingNotifications() {
        if (!this.db) {
            return [];
        }

        return new Promise((resolve, reject) => {
            try {
                const transaction = this.db.transaction(['notificationQueue'], 'readonly');
                const store = transaction.objectStore('notificationQueue');
                const index = store.index('notificationStatus');
                const request = index.getAll('pending');

                request.onsuccess = () => resolve(request.result || []);
                request.onerror = () => reject(request.error);
            } catch (error) {
                console.warn('⚠️ Failed to get pending notifications:', error);
                resolve([]);
            }
        });
    }

    // Group notifications by POC team
    groupByPOCTeam(notifications) {
        const grouped = {};

        for (const notification of notifications) {
            const team = notification.pocTeam || 'Unassigned';
            if (!grouped[team]) {
                grouped[team] = [];
            }
            grouped[team].push(notification);
        }

        return grouped;
    }

    // Group notifications by severity
    groupBySeverity(notifications) {
        const grouped = {
            critical: [],
            high: [],
            medium: [],
            low: []
        };

        for (const notification of notifications) {
            const severity = (notification.severity || 'medium').toLowerCase();
            if (grouped[severity]) {
                grouped[severity].push(notification);
            } else {
                grouped.medium.push(notification);
            }
        }

        return grouped;
    }

    // Process notification queue
    async processQueue() {
        if (!window.isFeatureEnabled('notifications')) {
            return;
        }

        try {
            const pending = await this.getPendingNotifications();
            
            if (pending.length === 0) {
                console.log('📭 No pending notifications to process');
                return;
            }

            console.log(`📬 Processing ${pending.length} pending notifications`);

            // Group by POC team
            const byPOC = this.groupByPOCTeam(pending);
            const batchId = `BATCH-${Date.now()}`;

            // Send notifications for each POC team
            for (const [pocTeam, notifications] of Object.entries(byPOC)) {
                await this.sendBatchNotification(pocTeam, notifications, batchId);
            }

        } catch (error) {
            console.error('❌ Failed to process notification queue:', error);
            window.trackFeatureError('notifications', error);
        }
    }

    // Send batch notification for a POC team
    async sendBatchNotification(pocTeam, notifications, batchId) {
        console.log(`📧 Sending batch notification to ${pocTeam}: ${notifications.length} POAMs`);

        try {
            // Get full POAM details
            const poams = [];
            for (const notification of notifications) {
                const poam = await window.poamDB.getPOAM(notification.poamId);
                if (poam) {
                    poams.push(poam);
                }
            }

            // Send email if enabled
            if (window.isFeatureEnabled('emailDelivery')) {
                await window.emailDelivery.sendDigest(pocTeam, poams, batchId);
            }

            // Create Jira tickets if enabled
            if (window.isFeatureEnabled('jiraIntegration')) {
                for (const poam of poams) {
                    await window.jiraIntegration.createTicket(poam);
                }
            }

            // Mark notifications as sent
            for (const notification of notifications) {
                notification.notificationStatus = 'sent';
                notification.batchId = batchId;
                notification.sentDate = new Date().toISOString();
                await this.updateNotification(notification);
            }

            console.log(`✅ Batch notification sent to ${pocTeam}`);

        } catch (error) {
            console.error(`❌ Failed to send batch notification to ${pocTeam}:`, error);
            
            // Mark as failed and increment retry count
            for (const notification of notifications) {
                notification.retryCount = (notification.retryCount || 0) + 1;
                notification.lastError = error.message;
                
                if (notification.retryCount >= (window.NOTIFICATION_CONFIG?.queue?.maxRetries || 3)) {
                    notification.notificationStatus = 'failed';
                } else {
                    notification.notificationStatus = 'pending'; // Retry later
                }
                
                await this.updateNotification(notification);
            }
        }
    }

    // Update notification status
    async updateNotification(notification) {
        if (!this.db) {
            return;
        }

        return new Promise((resolve, reject) => {
            try {
                const transaction = this.db.transaction(['notificationQueue'], 'readwrite');
                const store = transaction.objectStore('notificationQueue');
                const request = store.put(notification);

                request.onsuccess = () => resolve(notification);
                request.onerror = () => reject(request.error);
            } catch (error) {
                console.warn('⚠️ Failed to update notification:', error);
                resolve(notification);
            }
        });
    }

    // Schedule weekly batch processing
    scheduleWeeklyBatch() {
        if (!window.NOTIFICATION_CONFIG?.queue?.batchWeekly) {
            return;
        }

        const config = window.NOTIFICATION_CONFIG.email.batchSchedule;
        const now = new Date();
        
        // Calculate next batch time
        const nextBatch = this.getNextBatchTime(config.dayOfWeek, config.hour, config.minute);
        const delay = nextBatch - now;

        console.log(`📅 Next batch scheduled for ${nextBatch.toLocaleString()} (in ${Math.round(delay / 1000 / 60)} minutes)`);

        // Schedule batch processing
        setTimeout(async () => {
            console.log('⏰ Weekly batch time - processing queue...');
            await this.processQueue();
            
            // Reschedule for next week
            this.scheduleWeeklyBatch();
        }, delay);
    }

    // Calculate next batch time
    getNextBatchTime(dayOfWeek, hour, minute) {
        const now = new Date();
        const next = new Date(now);
        
        // Set to target day of week
        const currentDay = now.getDay();
        const daysUntilTarget = (dayOfWeek - currentDay + 7) % 7;
        next.setDate(now.getDate() + (daysUntilTarget || 7)); // If today, schedule for next week
        
        // Set time
        next.setHours(hour, minute, 0, 0);
        
        // If time has passed today, schedule for next week
        if (next <= now) {
            next.setDate(next.getDate() + 7);
        }
        
        return next;
    }

    // Get queue statistics
    async getQueueStats() {
        const pending = await this.getPendingNotifications();
        const byPOC = this.groupByPOCTeam(pending);
        const bySeverity = this.groupBySeverity(pending);

        return {
            totalPending: pending.length,
            byPOCTeam: Object.entries(byPOC).map(([team, notifs]) => ({
                team,
                count: notifs.length
            })),
            bySeverity: {
                critical: bySeverity.critical.length,
                high: bySeverity.high.length,
                medium: bySeverity.medium.length,
                low: bySeverity.low.length
            }
        };
    }

    // Clear old notifications (cleanup)
    async cleanupOldNotifications() {
        const retentionDays = window.NOTIFICATION_CONFIG?.queue?.retentionDays || 90;
        const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

        if (!this.db) {
            return 0;
        }

        return new Promise((resolve, reject) => {
            try {
                const transaction = this.db.transaction(['notificationQueue'], 'readwrite');
                const store = transaction.objectStore('notificationQueue');
                const request = store.openCursor();
                let deleted = 0;

                request.onsuccess = (event) => {
                    const cursor = event.target.result;
                    if (cursor) {
                        const notification = cursor.value;
                        const createdDate = new Date(notification.createdDate);
                        
                        if (createdDate < cutoffDate && notification.notificationStatus !== 'pending') {
                            cursor.delete();
                            deleted++;
                        }
                        
                        cursor.continue();
                    } else {
                        console.log(`🗑️ Cleaned up ${deleted} old notifications`);
                        resolve(deleted);
                    }
                };

                request.onerror = () => reject(request.error);
            } catch (error) {
                console.warn('⚠️ Failed to cleanup notifications:', error);
                resolve(0);
            }
        });
    }
}

// Initialize global instance
window.notificationQueue = new NotificationQueue();

// Start weekly batch scheduler if enabled
if (window.NOTIFICATION_CONFIG?.queue?.batchWeekly) {
    window.notificationQueue.initPromise.then(() => {
        window.notificationQueue.scheduleWeeklyBatch();
    });
}

// Manual queue processing (for testing)
window.processNotificationQueue = async function() {
    console.log('🔄 Manually processing notification queue...');
    await window.notificationQueue.processQueue();
};

// Get queue stats (for dashboard)
window.getNotificationQueueStats = async function() {
    const stats = await window.notificationQueue.getQueueStats();
    console.log('📊 Notification Queue Stats:', stats);
    return stats;
};

console.log('✅ Notification Queue System Ready');
console.log('💡 Use window.processNotificationQueue() to manually process queue');
console.log('💡 Use window.getNotificationQueueStats() to view queue statistics');
// ═══════════════════════════════════════════════════════════════
// FEEDBACK COLLECTION SYSTEM
// ═══════════════════════════════════════════════════════════════
// Handles user acknowledgment and extension requests for POAMs

console.log('📝 Feedback Collection System Loading...');

class FeedbackCollector {
    constructor() {
        this.config = window.NOTIFICATION_CONFIG?.feedback || {};
    }

    // Show feedback form for POAM
    showFeedbackForm(poamId, action = 'acknowledge') {
        if (!window.isFeatureEnabled('feedbackCollection')) {
            console.log('📝 Feedback collection disabled');
            return;
        }

        // Get POAM details
        window.poamDB.getPOAM(poamId).then(poam => {
            if (!poam) {
                console.error(`❌ POAM ${poamId} not found`);
                return;
            }

            this.renderFeedbackModal(poam, action);
        });
    }

    // Render feedback modal
    renderFeedbackModal(poam, action) {
        const modal = document.createElement('div');
        modal.id = 'feedback-modal';
        modal.className = 'fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm z-50 flex items-center justify-center p-4';

        const formHTML = this.generateFeedbackForm(poam, action);
        modal.innerHTML = formHTML;

        document.body.appendChild(modal);

        // Attach event listeners
        this.attachEventListeners(poam, action);
    }

    // Generate feedback form HTML
    generateFeedbackForm(poam, action) {
        const daysUntilDue = this.calculateDaysUntilDue(poam.dueDate);
        const dueDateFormatted = this.formatDate(poam.dueDate);

        return `
            <div class="bg-white dark:bg-slate-800 rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div class="p-6 border-b border-slate-200 dark:border-slate-700">
                    <div class="flex items-center justify-between">
                        <h2 class="text-2xl font-bold text-slate-900 dark:text-slate-100">POAM Acknowledgment</h2>
                        <button onclick="closeFeedbackModal()" class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                            <i class="fas fa-times text-xl"></i>
                        </button>
                    </div>
                    <p class="text-sm text-slate-600 dark:text-slate-400 mt-2">${poam.id}</p>
                </div>

                <div class="p-6">
                    <!-- POAM Summary -->
                    <div class="bg-slate-50 dark:bg-slate-900 rounded-lg p-4 mb-6">
                        <h3 class="font-semibold text-slate-900 dark:text-slate-100 mb-2">${this.escapeHTML(poam.title || poam.vulnerabilityName)}</h3>
                        <div class="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <span class="text-slate-600 dark:text-slate-400">Severity:</span>
                                <span class="ml-2 font-semibold ${this.getSeverityColor(poam.risk)}">${(poam.risk || 'medium').toUpperCase()}</span>
                            </div>
                            <div>
                                <span class="text-slate-600 dark:text-slate-400">Affected Assets:</span>
                                <span class="ml-2 font-semibold text-slate-900 dark:text-slate-100">${poam.totalAffectedAssets || 0}</span>
                            </div>
                            <div>
                                <span class="text-slate-600 dark:text-slate-400">Due Date:</span>
                                <span class="ml-2 font-semibold ${daysUntilDue < 7 ? 'text-red-600' : 'text-slate-900 dark:text-slate-100'}">${dueDateFormatted} (${daysUntilDue} days)</span>
                            </div>
                            <div>
                                <span class="text-slate-600 dark:text-slate-400">Milestones:</span>
                                <span class="ml-2 font-semibold text-slate-900 dark:text-slate-100">${(poam.milestones || []).length} steps</span>
                            </div>
                        </div>
                    </div>

                    <!-- Feedback Form -->
                    <form id="feedback-form" class="space-y-6">
                        <div>
                            <label class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Response</label>
                            <div class="space-y-2">
                                <label class="flex items-start p-3 border border-slate-200 dark:border-slate-700 rounded-lg cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900">
                                    <input type="radio" name="response" value="acknowledged" class="mt-1 mr-3" ${action === 'acknowledge' ? 'checked' : ''}>
                                    <div>
                                        <div class="font-medium text-slate-900 dark:text-slate-100">I acknowledge receipt of this POAM</div>
                                        <div class="text-sm text-slate-600 dark:text-slate-400">I have reviewed the POAM and understand the requirements</div>
                                    </div>
                                </label>
                                
                                <label class="flex items-start p-3 border border-slate-200 dark:border-slate-700 rounded-lg cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900">
                                    <input type="radio" name="response" value="can-meet-deadline" class="mt-1 mr-3">
                                    <div>
                                        <div class="font-medium text-slate-900 dark:text-slate-100">I can meet the scheduled completion date</div>
                                        <div class="text-sm text-slate-600 dark:text-slate-400">I confirm the remediation will be completed by ${dueDateFormatted}</div>
                                    </div>
                                </label>
                                
                                <label class="flex items-start p-3 border border-slate-200 dark:border-slate-700 rounded-lg cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900">
                                    <input type="radio" name="response" value="need-extension" class="mt-1 mr-3" ${action === 'extension' ? 'checked' : ''}>
                                    <div>
                                        <div class="font-medium text-slate-900 dark:text-slate-100">I need an extension</div>
                                        <div class="text-sm text-slate-600 dark:text-slate-400">Requires justification and approval</div>
                                    </div>
                                </label>
                            </div>
                        </div>

                        <!-- Extension Request Fields (shown when "need-extension" selected) -->
                        <div id="extension-fields" class="space-y-4 hidden">
                            <div>
                                <label class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Requested Completion Date</label>
                                <input type="date" id="requested-date" class="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" min="${this.getTomorrowDate()}" max="${this.getMaxExtensionDate(poam.dueDate)}">
                                <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">Maximum extension: ${this.config.extensionWorkflow?.maxExtensionDays || 90} days</p>
                            </div>

                            <div>
                                <label class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Justification <span class="text-red-500">*</span></label>
                                <textarea id="justification" rows="4" class="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" placeholder="Please provide a detailed justification for the extension request..." required></textarea>
                                <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">This will be reviewed by the Security Team</p>
                            </div>
                        </div>

                        <!-- Comments (optional) -->
                        <div>
                            <label class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Additional Comments (Optional)</label>
                            <textarea id="comments" rows="3" class="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" placeholder="Any additional information or concerns..."></textarea>
                        </div>

                        <!-- Submit Buttons -->
                        <div class="flex gap-3 pt-4">
                            <button type="submit" class="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors">
                                Submit Response
                            </button>
                            <button type="button" onclick="closeFeedbackModal()" class="px-6 py-3 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 font-semibold rounded-lg hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors">
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;
    }

    // Attach event listeners to form
    attachEventListeners(poam, action) {
        const form = document.getElementById('feedback-form');
        const extensionFields = document.getElementById('extension-fields');
        const radioButtons = document.querySelectorAll('input[name="response"]');

        // Show/hide extension fields based on selection
        radioButtons.forEach(radio => {
            radio.addEventListener('change', (e) => {
                if (e.target.value === 'need-extension') {
                    extensionFields.classList.remove('hidden');
                } else {
                    extensionFields.classList.add('hidden');
                }
            });
        });

        // Handle form submission
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.submitFeedback(poam);
        });

        // Trigger initial state
        if (action === 'extension') {
            extensionFields.classList.remove('hidden');
        }
    }

    // Submit feedback
    async submitFeedback(poam) {
        const response = document.querySelector('input[name="response"]:checked')?.value;
        const requestedDate = document.getElementById('requested-date')?.value;
        const justification = document.getElementById('justification')?.value;
        const comments = document.getElementById('comments')?.value;

        if (!response) {
            alert('Please select a response option');
            return;
        }

        if (response === 'need-extension' && !justification) {
            alert('Please provide a justification for the extension request');
            return;
        }

        const feedbackData = {
            poamId: poam.id,
            response,
            requestedDate: response === 'need-extension' ? requestedDate : null,
            justification: response === 'need-extension' ? justification : null,
            comments,
            submittedBy: 'current-user', // TODO: Get from auth system
            submittedAt: new Date().toISOString(),
            status: response === 'need-extension' ? 'pending_approval' : 'acknowledged'
        };

        try {
            // Save feedback
            await this.saveFeedback(feedbackData);

            // Update notification status
            await this.updateNotificationStatus(poam.id, 'acknowledged');

            // If extension requested, update POAM status
            if (response === 'need-extension') {
                poam.status = 'extended';
                poam.extensionRequested = true;
                poam.extensionRequestDate = new Date().toISOString();
                poam.requestedCompletionDate = requestedDate;
                await window.poamDB.savePOAM(poam);
            }

            // Close modal and show success
            this.closeFeedbackModal();
            this.showSuccessMessage(response);

        } catch (error) {
            console.error('❌ Failed to submit feedback:', error);
            alert('Failed to submit feedback. Please try again.');
        }
    }

    // Save feedback to database
    async saveFeedback(feedbackData) {
        if (!window.poamDB?.db) {
            throw new Error('Database not initialized');
        }

        return new Promise((resolve, reject) => {
            try {
                const transaction = window.poamDB.db.transaction(['feedbackResponses'], 'readwrite');
                const store = transaction.objectStore('feedbackResponses');
                const request = store.add({
                    id: `feedback-${Date.now()}`,
                    ...feedbackData
                });

                request.onsuccess = () => resolve(feedbackData);
                request.onerror = () => reject(request.error);
            } catch (error) {
                console.warn('⚠️ feedbackResponses store not available:', error);
                resolve(feedbackData);
            }
        });
    }

    // Update notification status
    async updateNotificationStatus(poamId, status) {
        if (!window.notificationQueue) {
            return;
        }

        // Find and update notification
        const pending = await window.notificationQueue.getPendingNotifications();
        const notification = pending.find(n => n.poamId === poamId);

        if (notification) {
            notification.notificationStatus = status;
            notification.acknowledgedDate = new Date().toISOString();
            await window.notificationQueue.updateNotification(notification);
        }
    }

    // Close feedback modal
    closeFeedbackModal() {
        const modal = document.getElementById('feedback-modal');
        if (modal) {
            modal.remove();
        }
    }

    // Show success message
    showSuccessMessage(response) {
        const messages = {
            'acknowledged': 'Thank you for acknowledging this POAM.',
            'can-meet-deadline': 'Thank you for confirming you can meet the deadline.',
            'need-extension': 'Your extension request has been submitted for approval.'
        };

        const message = messages[response] || 'Feedback submitted successfully.';

        if (typeof showAlert === 'function') {
            showAlert(message, 'success');
        } else {
            alert(message);
        }
    }

    // Helper functions
    calculateDaysUntilDue(dueDate) {
        if (!dueDate) return 0;
        const due = new Date(dueDate);
        const now = new Date();
        const diff = due - now;
        return Math.ceil(diff / (1000 * 60 * 60 * 24));
    }

    formatDate(dateString) {
        if (!dateString) return 'Not set';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    }

    getTomorrowDate() {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        return tomorrow.toISOString().split('T')[0];
    }

    getMaxExtensionDate(currentDueDate) {
        const maxDays = this.config.extensionWorkflow?.maxExtensionDays || 90;
        const due = new Date(currentDueDate || Date.now());
        due.setDate(due.getDate() + maxDays);
        return due.toISOString().split('T')[0];
    }

    getSeverityColor(severity) {
        const colors = {
            critical: 'text-red-600',
            high: 'text-orange-600',
            medium: 'text-yellow-600',
            low: 'text-green-600'
        };
        return colors[severity?.toLowerCase()] || 'text-slate-600';
    }

    escapeHTML(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
}

// Initialize global instance
window.feedbackCollector = new FeedbackCollector();

// Global functions for modal
window.closeFeedbackModal = function() {
    window.feedbackCollector.closeFeedbackModal();
};

window.showFeedbackForm = function(poamId, action = 'acknowledge') {
    window.feedbackCollector.showFeedbackForm(poamId, action);
};

console.log('✅ Feedback Collection System Ready');
console.log('💡 Use window.showFeedbackForm(poamId, action) to show feedback form');
