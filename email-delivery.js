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
            || `[POAM Nexus] Weekly Security Alert - ${totalCount} New POAMs Assigned to ${pocTeam}`;

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
            <h1>POAM Nexus Weekly Security Alert</h1>
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
                <li>Review each POAM in POAM Nexus dashboard</li>
                <li>Acknowledge receipt via links above</li>
                <li>Request extensions if needed (requires justification)</li>
            </ol>

            <p>Questions? Contact Security Team at ${this.config.replyTo || 'security-team@agency.gov'}</p>
        </div>

        <div class="footer">
            <p>This is an automated notification from POAM Nexus.</p>
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
1. Review each POAM in POAM Nexus dashboard
2. Acknowledge receipt
3. Request extensions if needed (requires justification)

Dashboard: ${this.getAppURL()}

Questions? Contact Security Team at ${this.config.replyTo || 'security-team@agency.gov'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
This is an automated notification from POAM Nexus.
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
