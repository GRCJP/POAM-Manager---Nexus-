// ═══════════════════════════════════════════════════════════════
// FEATURE FLAGS - AI VULNERABILITY ASSISTANT AGENT
// ═══════════════════════════════════════════════════════════════
// Global feature flags for safe, gradual rollout of new features
// All features default to OFF for zero-risk deployment

console.log('🚩 Feature Flags System Loading...');

// Initialize global feature flags
window.FEATURE_FLAGS = {
    // Phase 1: Vulnerability Intelligence
    vulnerabilityIntelligence: false,  // CVE/MITRE/NIST lookups via DMZ
    enhancedMilestones: false,         // Extended control family templates
    
    // Phase 1: Notification System
    notifications: false,              // Email + Jira alerts for new POAMs
    notificationBatching: false,       // Weekly batched digests by POC team
    feedbackCollection: false,         // User acknowledgment and extension requests
    
    // Infrastructure
    dmzProxy: false,                   // Use DMZ proxy for external API calls
    dmzProxyUrl: 'http://dmz-proxy.internal:3000',
    
    // Email Configuration
    emailDelivery: false,              // Send email notifications
    emailBatchDay: 1,                  // 0=Sunday, 1=Monday, etc.
    emailBatchHour: 8,                 // 8am
    
    // Jira Integration
    jiraIntegration: false,            // Create Jira tickets for new POAMs
    jiraAutoSync: false,               // Sync status changes back to POAM Nexus
    
    // Future: LLM Assistant (Phase 2)
    llmAssistant: false,               // Use internal LLM for analysis
    llmEndpoint: 'http://llm-server.internal:8000/v1/chat/completions',
    
    // Debug & Monitoring
    debugMode: false,                  // Verbose logging for troubleshooting
    autoDisableOnError: true,          // Auto-disable features after repeated failures
    errorThreshold: 5                  // Number of errors before auto-disable
};

// Feature flag management functions
window.enableFeature = function(featureName) {
    if (featureName in window.FEATURE_FLAGS) {
        window.FEATURE_FLAGS[featureName] = true;
        console.log(`✅ Feature Enabled: ${featureName}`);
        
        // Persist to localStorage
        localStorage.setItem(`feature_${featureName}`, 'true');
        
        // Dispatch event for listeners
        window.dispatchEvent(new CustomEvent('feature-flag-changed', {
            detail: { feature: featureName, enabled: true }
        }));
    } else {
        console.warn(`⚠️ Unknown feature: ${featureName}`);
    }
};

window.disableFeature = function(featureName) {
    if (featureName in window.FEATURE_FLAGS) {
        window.FEATURE_FLAGS[featureName] = false;
        console.log(`❌ Feature Disabled: ${featureName}`);
        
        // Persist to localStorage
        localStorage.setItem(`feature_${featureName}`, 'false');
        
        // Dispatch event for listeners
        window.dispatchEvent(new CustomEvent('feature-flag-changed', {
            detail: { feature: featureName, enabled: false }
        }));
    } else {
        console.warn(`⚠️ Unknown feature: ${featureName}`);
    }
};

window.isFeatureEnabled = function(featureName) {
    return window.FEATURE_FLAGS[featureName] === true;
};

window.getFeatureFlags = function() {
    return { ...window.FEATURE_FLAGS };
};

// Load persisted feature flags from localStorage
function loadPersistedFlags() {
    for (const key in window.FEATURE_FLAGS) {
        const stored = localStorage.getItem(`feature_${key}`);
        if (stored === 'true') {
            window.FEATURE_FLAGS[key] = true;
        } else if (stored === 'false') {
            window.FEATURE_FLAGS[key] = false;
        }
    }
}

// Initialize on load
loadPersistedFlags();

// Error tracking for auto-disable
window.FEATURE_ERROR_COUNTS = {};

window.trackFeatureError = function(featureName, error) {
    if (!window.FEATURE_FLAGS.autoDisableOnError) return;
    
    if (!window.FEATURE_ERROR_COUNTS[featureName]) {
        window.FEATURE_ERROR_COUNTS[featureName] = 0;
    }
    
    window.FEATURE_ERROR_COUNTS[featureName]++;
    
    console.error(`❌ Feature Error (${featureName}): ${window.FEATURE_ERROR_COUNTS[featureName]}/${window.FEATURE_FLAGS.errorThreshold}`, error);
    
    if (window.FEATURE_ERROR_COUNTS[featureName] >= window.FEATURE_FLAGS.errorThreshold) {
        console.warn(`⚠️ Auto-disabling ${featureName} due to repeated failures`);
        window.disableFeature(featureName);
        
        // Alert user
        if (typeof showAlert === 'function') {
            showAlert(`Feature "${featureName}" has been automatically disabled due to errors. Check console for details.`, 'warning');
        }
    }
};

window.resetFeatureErrorCount = function(featureName) {
    window.FEATURE_ERROR_COUNTS[featureName] = 0;
    console.log(`🔄 Reset error count for ${featureName}`);
};

// Bulk enable/disable for testing
window.enableAllFeatures = function() {
    for (const key in window.FEATURE_FLAGS) {
        if (typeof window.FEATURE_FLAGS[key] === 'boolean') {
            window.enableFeature(key);
        }
    }
    console.log('✅ All features enabled');
};

window.disableAllFeatures = function() {
    for (const key in window.FEATURE_FLAGS) {
        if (typeof window.FEATURE_FLAGS[key] === 'boolean') {
            window.disableFeature(key);
        }
    }
    console.log('❌ All features disabled');
};

// Export current configuration (for debugging)
window.exportFeatureFlags = function() {
    const config = {
        flags: window.FEATURE_FLAGS,
        errorCounts: window.FEATURE_ERROR_COUNTS,
        timestamp: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `feature-flags-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    console.log('📥 Feature flags exported');
};

console.log('✅ Feature Flags System Ready');
console.log('💡 Use window.enableFeature("featureName") to enable features');
console.log('💡 Use window.disableFeature("featureName") to disable features');
console.log('💡 Current flags:', window.FEATURE_FLAGS);
