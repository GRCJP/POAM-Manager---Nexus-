// ═══════════════════════════════════════════════════════════════
// STATUS NORMALIZATION LIBRARY
// Handles inconsistent status values from different POAM sources
// ═══════════════════════════════════════════════════════════════

/**
 * Status Mapping Library
 * Maps various status inputs to standardized values
 */
const STATUS_MAPPINGS = {
    // Open variations
    'open': 'open',
    'new': 'open',
    'pending': 'open',
    'submitted': 'open',
    
    // In Progress variations
    'in-progress': 'in-progress',
    'in_progress': 'in-progress',
    'inprogress': 'in-progress',
    'in progress': 'in-progress',
    'ongoing': 'in-progress',
    'active': 'in-progress',
    'working': 'in-progress',
    'wip': 'in-progress',
    
    // Completed variations
    'completed': 'completed',
    'complete': 'completed',
    'closed': 'completed',
    'resolved': 'completed',
    'fixed': 'completed',
    'done': 'completed',
    
    // Risk Accepted variations
    'risk-accepted': 'risk-accepted',
    'risk accepted': 'risk-accepted',
    'risk_accepted': 'risk-accepted',
    'riskaccepted': 'risk-accepted',
    'accepted': 'risk-accepted',
    'ignored': 'risk-accepted',
    
    // Extended variations
    'extended': 'extended',
    'postponed': 'extended',
    
    // Delayed/Overdue variations
    'delayed': 'delayed',
    'overdue': 'delayed',
    'past due': 'delayed',
    'past-due': 'delayed'
};

/**
 * Normalize status to standard value
 * @param {string} rawStatus - Raw status from any source
 * @returns {string} - Normalized status value
 */
function normalizeStatus(rawStatus) {
    if (!rawStatus) return 'open';
    
    const cleaned = String(rawStatus)
        .toLowerCase()
        .trim()
        .replace(/[_\s]+/g, '-'); // Replace underscores and spaces with hyphens
    
    return STATUS_MAPPINGS[cleaned] || 'open';
}

/**
 * Check if POAM is considered "open" (not completed or risk-accepted)
 * @param {Object} poam - POAM object
 * @returns {boolean}
 */
function isOpenPOAM(poam) {
    const status = normalizeStatus(poam.findingStatus || poam.status);
    return status !== 'completed' && status !== 'risk-accepted';
}

/**
 * Check if POAM is in progress
 * @param {Object} poam - POAM object
 * @returns {boolean}
 */
function isInProgressPOAM(poam) {
    const status = normalizeStatus(poam.findingStatus || poam.status);
    return status === 'in-progress';
}

/**
 * Check if POAM is completed
 * @param {Object} poam - POAM object
 * @returns {boolean}
 */
function isCompletedPOAM(poam) {
    const status = normalizeStatus(poam.findingStatus || poam.status);
    return status === 'completed';
}

/**
 * Check if POAM is delayed/overdue
 * @param {Object} poam - POAM object
 * @returns {boolean}
 */
function isDelayedPOAM(poam) {
    if (!isOpenPOAM(poam)) return false;
    
    const dueDate = new Date(poam.updatedScheduledCompletionDate || poam.scheduledCompletionDate || poam.dueDate);
    if (!dueDate || isNaN(dueDate.getTime())) return false;
    
    return dueDate < new Date();
}

/**
 * Get display-friendly status label
 * @param {string} status - Normalized status
 * @returns {string}
 */
function getStatusLabel(status) {
    const labels = {
        'open': 'Open',
        'in-progress': 'In Progress',
        'completed': 'Completed',
        'risk-accepted': 'Risk Accepted',
        'extended': 'Extended',
        'delayed': 'Delayed'
    };
    
    return labels[status] || 'Open';
}

/**
 * Get status color class for UI
 * @param {string} status - Normalized status
 * @returns {string}
 */
function getStatusColorClass(status) {
    const colors = {
        'open': 'bg-blue-100 text-blue-700',
        'in-progress': 'bg-yellow-100 text-yellow-700',
        'completed': 'bg-green-100 text-green-700',
        'risk-accepted': 'bg-gray-100 text-gray-700',
        'extended': 'bg-orange-100 text-orange-700',
        'delayed': 'bg-red-100 text-red-700'
    };
    
    return colors[status] || 'bg-slate-100 text-slate-700';
}

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.StatusNormalization = {
        normalizeStatus,
        isOpenPOAM,
        isInProgressPOAM,
        isCompletedPOAM,
        isDelayedPOAM,
        getStatusLabel,
        getStatusColorClass,
        STATUS_MAPPINGS
    };
}

console.log('✅ Status Normalization Library loaded');
