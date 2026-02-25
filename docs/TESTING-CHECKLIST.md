# POAM Nexus AI Assistant - Testing Checklist

## Pre-Deployment Testing

### Environment Setup
- [ ] Browser: Chrome/Firefox/Edge (latest version)
- [ ] Developer Tools open (F12)
- [ ] Console tab visible for logging
- [ ] Network tab for API monitoring
- [ ] Application tab for IndexedDB inspection

---

## 1. Feature Flags System

### Basic Functionality
- [ ] Open browser console
- [ ] Run: `window.FEATURE_FLAGS`
- [ ] Verify all flags are `false` by default
- [ ] Run: `window.enableFeature('vulnerabilityIntelligence')`
- [ ] Verify console shows: "✅ Enabled: vulnerabilityIntelligence"
- [ ] Run: `window.FEATURE_FLAGS`
- [ ] Verify `vulnerabilityIntelligence: true`
- [ ] Refresh page
- [ ] Verify flag still enabled (localStorage persistence)
- [ ] Run: `window.disableFeature('vulnerabilityIntelligence')`
- [ ] Verify console shows: "❌ Disabled: vulnerabilityIntelligence"
- [ ] Verify flag now `false`

### Bulk Operations
- [ ] Run: `window.enableAllFeatures()`
- [ ] Verify all boolean flags are `true`
- [ ] Run: `window.disableAllFeatures()`
- [ ] Verify all boolean flags are `false`

### Error Tracking
- [ ] Enable a feature
- [ ] Manually trigger errors (see code below)
- [ ] Verify error count increments
- [ ] Trigger 5 errors total
- [ ] Verify feature auto-disabled
- [ ] Verify console warning appears
- [ ] Run: `window.resetFeatureErrorCount('featureName')`
- [ ] Verify count reset to 0

**Error Trigger Code:**
```javascript
window.enableFeature('vulnerabilityIntelligence');
for (let i = 0; i < 5; i++) {
  window.trackFeatureError('vulnerabilityIntelligence', new Error('Test error'));
}
```

### Export/Import
- [ ] Run: `window.exportFeatureFlags()`
- [ ] Verify JSON file downloads
- [ ] Open file, verify structure
- [ ] Modify settings in browser
- [ ] Reload page
- [ ] Verify settings restored

---

## 2. Notification Configuration

### Basic Configuration
- [ ] Run: `window.NOTIFICATION_CONFIG`
- [ ] Verify default configuration loaded
- [ ] Run: `window.updateNotificationConfig('email.smtp.host', 'smtp.test.com')`
- [ ] Verify console shows: "✅ Updated notification config"
- [ ] Run: `window.getNotificationConfig('email.smtp.host')`
- [ ] Verify returns: `'smtp.test.com'`
- [ ] Refresh page
- [ ] Verify setting persisted

### Validation
- [ ] Run: `window.validateNotificationConfig()`
- [ ] Verify validation errors for missing SMTP/Jira config
- [ ] Configure required fields
- [ ] Run validation again
- [ ] Verify: `{ valid: true, errors: [] }`

### Export/Import
- [ ] Run: `window.exportNotificationConfig()`
- [ ] Verify JSON file downloads
- [ ] Verify sensitive data removed (passwords, tokens)
- [ ] Open file, verify structure

---

## 3. Vulnerability Intelligence

### CVE Enrichment (Mock Data)
- [ ] Enable feature: `window.enableFeature('vulnerabilityIntelligence')`
- [ ] Create test POAM:
```javascript
const testPOAM = {
  id: 'TEST-001',
  title: 'Apache Log4j RCE',
  cves: ['CVE-2021-44228'],
  risk: 'critical',
  findingDescription: 'Remote code execution vulnerability'
};
```
- [ ] Run: `const enriched = await window.vulnerabilityIntelligence.enrichPOAM(testPOAM)`
- [ ] Verify console shows: "✅ Enriched POAM TEST-001"
- [ ] Verify `enriched.enrichedData` exists
- [ ] Verify `enriched.enrichedData.cveDetails['CVE-2021-44228']` exists
- [ ] Verify CVE has: `cvssScore`, `severity`, `description`, `references`
- [ ] Verify `enriched.enrichedData.nistControls` array populated
- [ ] Verify `enriched.enrichedData.recommendedMilestones` set

### NIST Control Mapping
- [ ] Create POAMs with different keywords:
```javascript
const patchPOAM = { title: 'Missing security patch', description: 'Update required' };
const configPOAM = { title: 'Misconfiguration detected', description: 'Settings hardening needed' };
const authPOAM = { title: 'Weak password policy', description: 'MFA not enabled' };
```
- [ ] Enrich each POAM
- [ ] Verify `patchPOAM` maps to SI controls
- [ ] Verify `configPOAM` maps to CM controls
- [ ] Verify `authPOAM` maps to IA controls

### Caching
- [ ] Enrich POAM with CVE
- [ ] Check cache: `window.vulnerabilityIntelligence.getCacheStats()`
- [ ] Verify cache size = 1
- [ ] Enrich same POAM again
- [ ] Verify console shows cache hit (faster response)
- [ ] Clear cache: `window.vulnerabilityIntelligence.clearCache()`
- [ ] Verify cache size = 0

### Batch Enrichment
- [ ] Create array of 5 test POAMs
- [ ] Run: `const enriched = await window.enrichPOAMsBatch(testPOAMs)`
- [ ] Verify console shows: "🧠 Enriching 5 POAMs..."
- [ ] Verify all POAMs enriched
- [ ] Verify console shows: "✅ Enriched 5 POAMs"

---

## 4. Database Schema

### Version Upgrade
- [ ] Open DevTools → Application → IndexedDB
- [ ] Expand POAMDatabase
- [ ] Verify version = 11
- [ ] Verify stores exist:
  - [ ] poams
  - [ ] scans
  - [ ] scanRuns
  - [ ] systems
  - [ ] milestones
  - [ ] comments
  - [ ] poamScanSummaries
  - [ ] phaseArtifacts
  - [ ] reports
  - [ ] criticalAssets
  - [ ] **notificationQueue** (new)
  - [ ] **feedbackResponses** (new)
  - [ ] **cveCache** (new)

### New Stores Structure
- [ ] Click notificationQueue store
- [ ] Verify indexes: poamId, pocTeam, notificationStatus, batchId
- [ ] Click feedbackResponses store
- [ ] Verify indexes: poamId, status, submittedAt
- [ ] Click cveCache store
- [ ] Verify indexes: timestamp

---

## 5. Notification Queue

### Event Detection
- [ ] Enable notifications: `window.enableFeature('notifications')`
- [ ] Import a CSV file with vulnerabilities
- [ ] Watch console for: "📬 Detected X new POAMs for notification"
- [ ] Verify event fired after import completes
- [ ] Run: `await window.getNotificationQueueStats()`
- [ ] Verify `totalPending` > 0
- [ ] Verify `byPOCTeam` array populated
- [ ] Verify `bySeverity` breakdown correct

### Baseline Exclusion
- [ ] Clear all POAMs
- [ ] Import CSV (baseline)
- [ ] Verify console shows: "📭 Skipping notifications for baseline import"
- [ ] Verify queue stats show 0 pending
- [ ] Import another CSV (re-import)
- [ ] Verify notifications queued for new POAMs only

### Grouping
- [ ] Queue notifications for multiple POC teams
- [ ] Run: `const stats = await window.getNotificationQueueStats()`
- [ ] Verify `byPOCTeam` groups correctly
- [ ] Verify each team has correct count
- [ ] Verify `bySeverity` breakdown accurate

### Manual Processing
- [ ] Queue some notifications
- [ ] Run: `await window.processNotificationQueue()`
- [ ] Verify console shows: "📬 Processing X pending notifications"
- [ ] Verify email delivery logs (mock)
- [ ] Verify Jira ticket logs (mock)
- [ ] Check queue stats again
- [ ] Verify notifications marked as 'sent'

### Weekly Scheduler
- [ ] Check next batch time: `window.notificationQueue.getNextBatchTime()`
- [ ] Verify date is next Monday at 8am
- [ ] Verify timezone correct
- [ ] If today is Monday before 8am, verify scheduled for today
- [ ] If today is Monday after 8am, verify scheduled for next week

---

## 6. Email Delivery

### Template Generation
- [ ] Enable email delivery: `window.enableFeature('emailDelivery')`
- [ ] Create test POAMs:
```javascript
const testPOAMs = [
  { id: 'P1', title: 'Critical Vuln', risk: 'critical', totalAffectedAssets: 50, dueDate: '2026-03-15', cves: ['CVE-2024-1234'], milestones: [{name: 'Test', targetDate: '2026-03-01'}] },
  { id: 'P2', title: 'High Vuln', risk: 'high', totalAffectedAssets: 25, dueDate: '2026-03-30', cves: ['CVE-2024-5678'], milestones: [] },
  { id: 'P3', title: 'Medium Vuln', risk: 'medium', totalAffectedAssets: 10, dueDate: '2026-04-15', cves: [], milestones: [] }
];
```
- [ ] Run: `await window.emailDelivery.sendDigest('Windows Systems Team', testPOAMs, 'TEST-BATCH')`
- [ ] Verify console shows email details
- [ ] Verify HTML template logged
- [ ] Copy HTML from console
- [ ] Save to .html file
- [ ] Open in browser
- [ ] Verify formatting correct:
  - [ ] Header with gradient background
  - [ ] POAMs grouped by severity
  - [ ] Critical section (red)
  - [ ] High section (orange)
  - [ ] Medium section (yellow)
  - [ ] Summary box
  - [ ] Action buttons
  - [ ] Footer

### Email Content Validation
- [ ] Verify subject line includes count and team name
- [ ] Verify each POAM shows:
  - [ ] POAM ID and title
  - [ ] Affected assets count
  - [ ] Due date
  - [ ] Milestone count
  - [ ] CVE IDs (if present)
  - [ ] View Details button
  - [ ] Acknowledge button
  - [ ] Request Extension button
- [ ] Verify summary section shows:
  - [ ] Total count
  - [ ] Breakdown by severity
  - [ ] Batch ID
- [ ] Verify links are correct (point to app URL)

### Plain Text Template
- [ ] Check console for plain text version
- [ ] Verify readable without HTML
- [ ] Verify formatting with line breaks and separators
- [ ] Verify all information present

---

## 7. Jira Integration

### Ticket Payload Generation
- [ ] Enable Jira: `window.enableFeature('jiraIntegration')`
- [ ] Create test POAM with full data:
```javascript
const fullPOAM = {
  id: 'POAM-2024-001',
  title: 'Apache Log4j Remote Code Execution',
  vulnerabilityName: 'Log4j RCE',
  risk: 'critical',
  cves: ['CVE-2021-44228'],
  totalAffectedAssets: 45,
  breachedAssets: 10,
  activeAssets: 45,
  dueDate: '2026-03-11',
  pocTeam: 'Windows Systems Team',
  controlFamily: 'SI',
  findingDescription: 'Critical RCE vulnerability in Apache Log4j library',
  solution: 'Upgrade to Log4j 2.17.1 or later',
  milestones: [
    { name: 'Identify patch', targetDate: '2026-02-28', status: 'pending' },
    { name: 'Test patch', targetDate: '2026-03-05', status: 'pending' },
    { name: 'Deploy patch', targetDate: '2026-03-10', status: 'pending' }
  ]
};
```
- [ ] Run: `await window.jiraIntegration.createTicket(fullPOAM)`
- [ ] Verify console shows ticket details
- [ ] Verify ticket key format: `SEC-XXXX`
- [ ] Verify payload includes:
  - [ ] Project key
  - [ ] Summary with [POAM] prefix
  - [ ] Description in Wiki markup
  - [ ] Priority (Highest for critical)
  - [ ] Assignee (windows-team-lead)
  - [ ] Due date
  - [ ] Labels (poam, vulnerability, critical, control-si, cve)
  - [ ] Custom fields (POAM ID, CVE IDs, asset count)

### Description Formatting
- [ ] Copy description from console
- [ ] Verify Wiki markup syntax:
  - [ ] `h2.` for headers
  - [ ] `*bold*` for labels
  - [ ] `#` for numbered lists
  - [ ] `[link|url]` for references
- [ ] Verify sections present:
  - [ ] Vulnerability Details
  - [ ] Affected Assets
  - [ ] Remediation Plan
  - [ ] Mitigation Steps
  - [ ] NIST Controls (if enriched)
  - [ ] References (if enriched)
  - [ ] Link back to POAM Nexus

### Batch Creation
- [ ] Create array of 3 POAMs
- [ ] Run: `await window.createJiraTicketsBatch(testPOAMs)`
- [ ] Verify console shows: "🎫 Creating Jira tickets for 3 POAMs..."
- [ ] Verify 3 tickets created
- [ ] Verify success count: "✅ Created 3/3 Jira tickets"

### Ticket Linking
- [ ] Create ticket for POAM
- [ ] Verify POAM updated with:
  - [ ] `jiraTicketId` field
  - [ ] `jiraTicketUrl` field
- [ ] Verify ticket saved to database
- [ ] Reload POAM
- [ ] Verify ticket info persisted

---

## 8. Feedback Collection

### Modal Display
- [ ] Run: `window.showFeedbackForm('POAM-2024-001', 'acknowledge')`
- [ ] Verify modal appears
- [ ] Verify POAM summary shows:
  - [ ] Title
  - [ ] Severity with color
  - [ ] Affected assets
  - [ ] Due date with days remaining
  - [ ] Milestone count
- [ ] Verify 3 response options:
  - [ ] I acknowledge receipt
  - [ ] I can meet deadline
  - [ ] I need extension
- [ ] Verify "acknowledge" option pre-selected

### Acknowledgment Flow
- [ ] Select "I acknowledge receipt"
- [ ] Verify extension fields hidden
- [ ] Add optional comment
- [ ] Click "Submit Response"
- [ ] Verify modal closes
- [ ] Verify success message appears
- [ ] Check IndexedDB → feedbackResponses
- [ ] Verify feedback saved

### Extension Request Flow
- [ ] Open feedback form
- [ ] Select "I need an extension"
- [ ] Verify extension fields appear:
  - [ ] Requested completion date (date picker)
  - [ ] Justification (textarea, required)
- [ ] Try to submit without justification
- [ ] Verify validation error
- [ ] Fill out justification
- [ ] Select date (within 90 days)
- [ ] Try to select date > 90 days
- [ ] Verify date limited
- [ ] Submit form
- [ ] Verify modal closes
- [ ] Verify success message
- [ ] Check IndexedDB → feedbackResponses
- [ ] Verify feedback saved with:
  - [ ] response: 'need-extension'
  - [ ] requestedDate
  - [ ] justification
  - [ ] status: 'pending_approval'

### POAM Status Update
- [ ] Submit extension request
- [ ] Load POAM from database
- [ ] Verify POAM updated:
  - [ ] status: 'extended'
  - [ ] extensionRequested: true
  - [ ] extensionRequestDate set
  - [ ] requestedCompletionDate set

### Cancel Button
- [ ] Open feedback form
- [ ] Fill out some fields
- [ ] Click "Cancel"
- [ ] Verify modal closes
- [ ] Verify nothing saved

---

## 9. Integration Testing

### End-to-End: CSV Import → Notification
- [ ] Enable all features:
```javascript
window.enableFeature('vulnerabilityIntelligence');
window.enableFeature('notifications');
window.enableFeature('emailDelivery');
window.enableFeature('jiraIntegration');
```
- [ ] Import CSV file with 10 vulnerabilities
- [ ] Verify pipeline completes successfully
- [ ] Verify POAMs created
- [ ] Verify event dispatched (console log)
- [ ] Verify notifications queued
- [ ] Run: `await window.processNotificationQueue()`
- [ ] Verify emails logged (mock)
- [ ] Verify Jira tickets logged (mock)
- [ ] Check notification queue stats
- [ ] Verify all marked as 'sent'

### End-to-End: Notification → Feedback
- [ ] Process notification queue
- [ ] Note a POAM ID from console logs
- [ ] Run: `window.showFeedbackForm('POAM-ID-HERE')`
- [ ] Submit acknowledgment
- [ ] Verify notification status updated to 'acknowledged'
- [ ] Check IndexedDB → notificationQueue
- [ ] Find notification by POAM ID
- [ ] Verify `notificationStatus: 'acknowledged'`
- [ ] Verify `acknowledgedDate` set

### Existing Features Still Work
- [ ] Import CSV (existing workflow)
- [ ] Verify POAMs created correctly
- [ ] Open POAM detail view
- [ ] Edit POAM fields
- [ ] Add milestones
- [ ] Add comments
- [ ] Export POAMs
- [ ] Backup/restore
- [ ] Dashboard metrics
- [ ] Reports generation
- [ ] Verify no regressions

---

## 10. Error Handling

### Network Errors
- [ ] Enable features
- [ ] Disconnect network
- [ ] Try to process notifications
- [ ] Verify graceful error handling
- [ ] Verify error logged to console
- [ ] Verify feature doesn't crash
- [ ] Reconnect network
- [ ] Retry operation
- [ ] Verify works

### Invalid Data
- [ ] Try to enrich POAM without CVEs
- [ ] Verify handles gracefully
- [ ] Try to create Jira ticket with missing fields
- [ ] Verify handles gracefully
- [ ] Try to submit feedback for non-existent POAM
- [ ] Verify error message

### Database Errors
- [ ] Manually corrupt IndexedDB (delete a store)
- [ ] Refresh page
- [ ] Verify database recreated
- [ ] Verify features still work

---

## 11. Performance Testing

### Large Dataset
- [ ] Import CSV with 100+ vulnerabilities
- [ ] Measure import time
- [ ] Verify no browser freeze
- [ ] Verify notifications queue quickly
- [ ] Process queue
- [ ] Measure processing time
- [ ] Verify < 5 seconds for 100 POAMs

### Memory Usage
- [ ] Open DevTools → Performance → Memory
- [ ] Take heap snapshot
- [ ] Import large CSV
- [ ] Process notifications
- [ ] Take another snapshot
- [ ] Verify no memory leaks
- [ ] Verify reasonable memory usage (< 100MB)

### Cache Performance
- [ ] Enrich 50 POAMs with same CVEs
- [ ] Verify cache hits (console logs)
- [ ] Verify fast response times
- [ ] Check cache size
- [ ] Verify reasonable (< 10MB)

---

## 12. Browser Compatibility

### Chrome
- [ ] Run all tests above
- [ ] Verify no console errors
- [ ] Verify UI renders correctly
- [ ] Verify modals work
- [ ] Verify forms work

### Firefox
- [ ] Run all tests above
- [ ] Verify no console errors
- [ ] Verify UI renders correctly
- [ ] Verify modals work
- [ ] Verify forms work

### Edge
- [ ] Run all tests above
- [ ] Verify no console errors
- [ ] Verify UI renders correctly
- [ ] Verify modals work
- [ ] Verify forms work

### Mobile (Optional)
- [ ] Open on mobile device
- [ ] Verify responsive design
- [ ] Verify modals work on small screens
- [ ] Verify forms usable

---

## Sign-Off

**Tester Name:** ___________________________

**Date:** ___________________________

**Environment:**
- Browser: ___________________________
- Version: ___________________________
- OS: ___________________________

**Results:**
- [ ] All tests passed
- [ ] Some tests failed (see notes below)
- [ ] Critical issues found (see notes below)

**Notes:**
_____________________________________________
_____________________________________________
_____________________________________________

**Recommendation:**
- [ ] Ready for production deployment
- [ ] Ready for pilot deployment
- [ ] Needs fixes before deployment
- [ ] Not ready for deployment

---

*Last Updated: February 25, 2026*
*Version: 1.0.0*
