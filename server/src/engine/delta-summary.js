/**
 * Generate a scan delta summary from identity state changes.
 *
 * @param {Array} identities - array of identity state objects with previous/current status
 * @param {Object} scanMeta - { totalParsed, excluded, source, filename, processingTimeMs }
 * @returns {Object} delta summary
 */
function generateDeltaSummary(identities, scanMeta) {
  const newPoams = [];
  const closedPoams = [];
  const regressingPoams = [];
  const delayedPoams = [];
  const priorityChanges = [];
  const inProgress = [];

  for (const identity of identities) {
    // New: no previous status
    if (identity.previousStatus === null || identity.previousStatus === undefined) {
      newPoams.push({
        id: identity.id,
        displayName: identity.displayName,
        currentStatus: identity.currentStatus,
        priorityTier: identity.currentTier,
        assetCount: identity.currentAssetCount,
        severity: identity.severity,
        poc: identity.poc,
      });
      continue;
    }

    // Closed: transitioned to Closed
    if (identity.currentStatus === 'Closed' && identity.previousStatus !== 'Closed') {
      const daysOpen = identity.createdDate && identity.closedDate
        ? Math.floor((identity.closedDate - identity.createdDate) / 86400000)
        : 0;
      closedPoams.push({
        id: identity.id,
        displayName: identity.displayName,
        daysOpen,
        slaMet: identity.slaMet,
      });
      continue;
    }

    // Regressing
    if (identity.currentStatus === 'Regressing') {
      regressingPoams.push({
        id: identity.id,
        displayName: identity.displayName,
        previousAssetCount: identity.previousAssetCount,
        currentAssetCount: identity.currentAssetCount,
        newAssets: identity.assetDiff.added.map(a => a.assetName),
      });
      continue;
    }

    // Delayed
    if (identity.currentStatus === 'Delayed') {
      delayedPoams.push({
        id: identity.id,
        displayName: identity.displayName,
        scansWithNoMovement: identity.scansWithNoMovement,
        remainingCount: identity.remainingCount || (identity.assetDiff ? identity.assetDiff.remaining.length : 0),
      });
      continue;
    }

    // Priority tier change
    if (identity.previousTier && identity.currentTier && identity.previousTier !== identity.currentTier) {
      priorityChanges.push({
        id: identity.id,
        displayName: identity.displayName,
        from: identity.previousTier,
        to: identity.currentTier,
      });
    }

    // Everything else is in progress
    if (identity.currentStatus === 'Open' || identity.currentStatus === 'Overdue') {
      inProgress.push({
        id: identity.id,
        displayName: identity.displayName,
        currentStatus: identity.currentStatus,
        assetCount: identity.currentAssetCount,
      });
    }
  }

  return {
    metadata: {
      totalParsed: scanMeta.totalParsed || 0,
      excluded: scanMeta.excluded || 0,
      processed: (scanMeta.totalParsed || 0) - (scanMeta.excluded || 0),
      source: scanMeta.source || 'unknown',
      filename: scanMeta.filename || '',
      processingTimeMs: scanMeta.processingTimeMs || 0,
    },
    counts: {
      newPoams: newPoams.length,
      closed: closedPoams.length,
      regressing: regressingPoams.length,
      delayed: delayedPoams.length,
      priorityChanges: priorityChanges.length,
      inProgress: inProgress.length,
    },
    newPoams,
    closedPoams,
    regressingPoams,
    delayedPoams,
    priorityChanges,
    inProgress,
  };
}

module.exports = { generateDeltaSummary };
