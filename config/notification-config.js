// ═══════════════════════════════════════════════════════════════
// NOTIFICATION CONFIGURATION
// ═══════════════════════════════════════════════════════════════
// Configuration for email and Jira notification system

console.log('📧 Notification Configuration Loading...');

window.NOTIFICATION_CONFIG = {
    // Email Configuration
    email: {
        enabled: false, // Controlled by feature flag
        from: 'TRACE <trace@agency.gov>',
        replyTo: 'security-team@agency.gov',
        
        // SMTP Settings (to be configured by admin)
        smtp: {
            host: 'smtp.agency.gov',
            port: 587,
            secure: false, // true for 465, false for other ports
            auth: {
                user: '', // Set via environment or settings
                pass: ''  // Set via environment or settings
            }
        },
        
        // Batch Schedule
        batchSchedule: {
            dayOfWeek: 1,  // 0=Sunday, 1=Monday, 2=Tuesday, etc.
            hour: 8,       // 8am
            minute: 0,
            timezone: 'America/New_York'
        },
        
        // Email Templates
        templates: {
            subject: '[TRACE] Weekly Security Alert - {count} New POAMs Assigned to {team}',
            
            // Severity emoji mapping
            severityEmoji: {
                critical: '🔴',
                high: '🟠',
                medium: '🟡',
                low: '🟢'
            }
        }
    },
    
    // Jira Configuration
    jira: {
        enabled: false, // Controlled by feature flag
        baseUrl: 'https://jira.agency.gov',
        apiToken: '', // Set via environment or settings
        
        // Project Configuration
        projectKey: 'SEC', // Security project
        issueType: 'Security Vulnerability',
        
        // Custom Fields (map to your Jira instance)
        customFields: {
            poamId: 'customfield_10001',
            cveIds: 'customfield_10002',
            assetCount: 'customfield_10003',
            severity: 'customfield_10004',
            dueDate: 'customfield_10005'
        },
        
        // Priority Mapping (POAM severity → Jira priority)
        priorityMapping: {
            critical: 'Highest',
            high: 'High',
            medium: 'Medium',
            low: 'Low'
        },
        
        // POC Team to Jira User Mapping
        pocMapping: {
            'Windows Systems Team': 'windows-team-lead',
            'Linux Systems Team': 'linux-team-lead',
            'Network Security Team': 'network-team-lead',
            'Application Security Team': 'appsec-team-lead',
            'Database Security Team': 'database-team-lead',
            'Cloud Security Team': 'cloud-team-lead',
            'Endpoint Security Team': 'endpoint-team-lead',
            'Critical Systems Team': 'critical-systems-lead',
            'Unassigned': 'security-team-lead'
        },
        
        // Sync Configuration
        autoSync: false, // Sync Jira status back to TRACE
        syncInterval: 3600000, // 1 hour in milliseconds
        
        // Webhook Configuration (for Jira → TRACE updates)
        webhook: {
            enabled: false,
            secret: '', // Webhook secret for validation
            endpoint: '/api/jira-webhook' // Future: backend endpoint
        }
    },
    
    // Notification Queue Settings
    queue: {
        // Detection Rules
        detectNewPOAMs: true,
        excludeBaseline: true, // Don't notify on initial 400 POAMs
        
        // Batching Rules
        batchByPOC: true,      // Group notifications by POC team
        batchWeekly: true,     // Send weekly digests
        maxBatchSize: 100,     // Max POAMs per digest
        
        // Retry Configuration
        maxRetries: 3,
        retryDelay: 300000,    // 5 minutes
        
        // Cleanup
        retentionDays: 90      // Keep notification records for 90 days
    },
    
    // Feedback Collection
    feedback: {
        enabled: false, // Controlled by feature flag
        
        // Acknowledgment Options
        options: [
            { value: 'acknowledged', label: 'I acknowledge receipt of this POAM' },
            { value: 'can-meet-deadline', label: 'I can meet the scheduled completion date' },
            { value: 'need-extension', label: 'I need an extension (requires justification)' }
        ],
        
        // Extension Request Workflow
        extensionWorkflow: {
            requiresApproval: true,
            approvers: ['security-team-lead', 'ciso'],
            maxExtensionDays: 90,
            requireJustification: true
        },
        
        // Feedback Form URL
        formBaseUrl: 'https://trace.agency.gov/feedback'
    },
    
    // Recipients Configuration
    recipients: {
        // Who gets notifications
        notifyPOCTeams: true,
        notifySecurityTeam: true,
        
        // Security Team Contacts
        securityTeam: [
            'security-team@agency.gov',
            'ciso@agency.gov'
        ],
        
        // CC/BCC Configuration
        alwaysCC: [],
        alwaysBCC: ['audit-trail@agency.gov']
    },
    
    // Rate Limiting
    rateLimits: {
        emailsPerHour: 100,
        jiraTicketsPerHour: 50,
        apiCallsPerMinute: 10
    },
    
    // Logging & Audit
    audit: {
        logAllNotifications: true,
        logToConsole: true,
        logToDatabase: true,
        retentionDays: 365
    }
};

// Configuration Management Functions
window.updateNotificationConfig = function(path, value) {
    const keys = path.split('.');
    let obj = window.NOTIFICATION_CONFIG;
    
    for (let i = 0; i < keys.length - 1; i++) {
        if (!obj[keys[i]]) obj[keys[i]] = {};
        obj = obj[keys[i]];
    }
    
    obj[keys[keys.length - 1]] = value;
    
    // Persist to localStorage
    localStorage.setItem('notification_config', JSON.stringify(window.NOTIFICATION_CONFIG));
    
    console.log(`✅ Updated notification config: ${path} = ${value}`);
};

window.getNotificationConfig = function(path) {
    if (!path) return window.NOTIFICATION_CONFIG;
    
    const keys = path.split('.');
    let obj = window.NOTIFICATION_CONFIG;
    
    for (const key of keys) {
        if (!obj[key]) return undefined;
        obj = obj[key];
    }
    
    return obj;
};

// Load persisted configuration
function loadPersistedConfig() {
    const stored = localStorage.getItem('notification_config');
    if (stored) {
        try {
            const config = JSON.parse(stored);
            // Merge with defaults (preserve new fields)
            Object.assign(window.NOTIFICATION_CONFIG, config);
            console.log('✅ Loaded persisted notification configuration');
        } catch (e) {
            console.warn('⚠️ Failed to load persisted config:', e);
        }
    }
}

// Export configuration (for backup/transfer)
window.exportNotificationConfig = function() {
    const config = {
        ...window.NOTIFICATION_CONFIG,
        exportedAt: new Date().toISOString(),
        version: '1.0.0'
    };
    
    // Remove sensitive data
    delete config.email.smtp.auth.pass;
    delete config.jira.apiToken;
    delete config.feedback.extensionWorkflow.approvers;
    
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `notification-config-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    console.log('📥 Notification configuration exported');
};

// Import configuration
window.importNotificationConfig = function(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const config = JSON.parse(e.target.result);
            Object.assign(window.NOTIFICATION_CONFIG, config);
            localStorage.setItem('notification_config', JSON.stringify(window.NOTIFICATION_CONFIG));
            console.log('✅ Notification configuration imported');
        } catch (error) {
            console.error('❌ Failed to import configuration:', error);
        }
    };
    reader.readAsText(file);
};

// Validate configuration
window.validateNotificationConfig = function() {
    const errors = [];
    
    // Email validation
    if (window.FEATURE_FLAGS?.emailDelivery) {
        if (!window.NOTIFICATION_CONFIG.email.smtp.host) {
            errors.push('Email: SMTP host not configured');
        }
        if (!window.NOTIFICATION_CONFIG.email.smtp.auth.user) {
            errors.push('Email: SMTP user not configured');
        }
    }
    
    // Jira validation
    if (window.FEATURE_FLAGS?.jiraIntegration) {
        if (!window.NOTIFICATION_CONFIG.jira.baseUrl) {
            errors.push('Jira: Base URL not configured');
        }
        if (!window.NOTIFICATION_CONFIG.jira.apiToken) {
            errors.push('Jira: API token not configured');
        }
    }
    
    if (errors.length > 0) {
        console.warn('⚠️ Configuration validation errors:', errors);
        return { valid: false, errors };
    }
    
    console.log('✅ Configuration validation passed');
    return { valid: true, errors: [] };
};

// Initialize
loadPersistedConfig();

console.log('✅ Notification Configuration Ready');
console.log('💡 Use window.updateNotificationConfig("path.to.key", value) to update');
console.log('💡 Use window.validateNotificationConfig() to check configuration');
