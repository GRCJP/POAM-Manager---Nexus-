# POAM Nexus AI Assistant - Deployment Guide

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Configuration](#configuration)
3. [Backend Setup](#backend-setup)
4. [Testing](#testing)
5. [Production Rollout](#production-rollout)
6. [Monitoring](#monitoring)
7. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Infrastructure

- **SMTP Server** - For email delivery
  - Host, port, authentication credentials
  - TLS/SSL support recommended
  - Rate limit: 100+ emails/hour

- **Jira Instance** - For ticket integration
  - Jira Cloud or Server/Data Center
  - API token with project access
  - Custom fields configured (optional)

- **DMZ Proxy** (Optional) - For external API access
  - Node.js server in DMZ
  - Whitelist: NVD API, MITRE ATT&CK
  - Rate limiting and caching

### Browser Requirements

- Modern browser (Chrome 90+, Firefox 88+, Edge 90+)
- JavaScript enabled
- IndexedDB support
- LocalStorage enabled

### Network Requirements

- HTTPS for production deployment
- Outbound SMTP (port 587 or 465)
- Outbound HTTPS to Jira (port 443)
- Optional: Outbound HTTPS to DMZ proxy

---

## Configuration

### Step 1: Feature Flags

All features are **disabled by default**. Enable them via browser console or settings UI.

**Browser Console:**
```javascript
// Enable individual features
window.enableFeature('vulnerabilityIntelligence');
window.enableFeature('notifications');
window.enableFeature('emailDelivery');
window.enableFeature('jiraIntegration');
window.enableFeature('feedbackCollection');

// Or enable all at once
window.enableAllFeatures();

// Verify
console.log(window.FEATURE_FLAGS);
```

**Persistent Configuration:**
Feature flags are saved to `localStorage` and persist across sessions.

---

### Step 2: Email Configuration

**Update SMTP Settings:**
```javascript
// Configure SMTP server
window.updateNotificationConfig('email.smtp.host', 'smtp.agency.gov');
window.updateNotificationConfig('email.smtp.port', 587);
window.updateNotificationConfig('email.smtp.secure', false);
window.updateNotificationConfig('email.smtp.auth.user', 'poam-nexus@agency.gov');
window.updateNotificationConfig('email.smtp.auth.pass', 'YOUR_PASSWORD_HERE');

// Configure sender
window.updateNotificationConfig('email.from', 'POAM Nexus <poam-nexus@agency.gov>');
window.updateNotificationConfig('email.replyTo', 'security-team@agency.gov');

// Configure batch schedule (Monday 8am Eastern)
window.updateNotificationConfig('email.batchSchedule.dayOfWeek', 1);
window.updateNotificationConfig('email.batchSchedule.hour', 8);
window.updateNotificationConfig('email.batchSchedule.minute', 0);
window.updateNotificationConfig('email.batchSchedule.timezone', 'America/New_York');

// Verify
window.validateNotificationConfig();
```

**Security Best Practices:**
- Store SMTP password in environment variable (backend)
- Use app-specific password if using Gmail/Office365
- Enable TLS/SSL for encryption
- Rotate credentials regularly

---

### Step 3: Jira Configuration

**Update Jira Settings:**
```javascript
// Configure Jira instance
window.updateNotificationConfig('jira.baseUrl', 'https://jira.agency.gov');
window.updateNotificationConfig('jira.apiToken', 'YOUR_JIRA_API_TOKEN');
window.updateNotificationConfig('jira.projectKey', 'SEC');
window.updateNotificationConfig('jira.issueType', 'Security Vulnerability');

// Configure custom fields (if using)
window.updateNotificationConfig('jira.customFields.poamId', 'customfield_10001');
window.updateNotificationConfig('jira.customFields.cveIds', 'customfield_10002');
window.updateNotificationConfig('jira.customFields.assetCount', 'customfield_10003');

// Configure POC team mapping
const pocMapping = {
    'Windows Systems Team': 'windows-team-lead',
    'Linux Systems Team': 'linux-team-lead',
    'Network Security Team': 'network-team-lead',
    'Application Security Team': 'appsec-team-lead',
    'Database Security Team': 'database-team-lead',
    'Cloud Security Team': 'cloud-team-lead',
    'Endpoint Security Team': 'endpoint-team-lead',
    'Critical Systems Team': 'critical-systems-lead',
    'Unassigned': 'security-team-lead'
};

for (const [team, username] of Object.entries(pocMapping)) {
    window.updateNotificationConfig(`jira.pocMapping.${team}`, username);
}

// Verify
window.validateNotificationConfig();
```

**Jira API Token:**
1. Log in to Jira
2. Go to Account Settings → Security → API Tokens
3. Create new token
4. Copy and store securely

---

### Step 4: DMZ Proxy (Optional)

**For external CVE data access:**

**Deploy DMZ Proxy Server:**
```bash
# Clone proxy repository
git clone https://github.com/your-org/poam-dmz-proxy.git
cd poam-dmz-proxy

# Install dependencies
npm install

# Configure
cp .env.example .env
nano .env
```

**DMZ Proxy `.env`:**
```bash
PORT=3000
ALLOWED_ORIGINS=https://poam-nexus.agency.gov
NVD_API_KEY=your_nvd_api_key_here
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=10
CACHE_TTL_SECONDS=86400
```

**Start DMZ Proxy:**
```bash
# Development
npm run dev

# Production (with PM2)
pm2 start server.js --name poam-dmz-proxy
pm2 save
```

**Configure POAM Nexus to use DMZ:**
```javascript
window.enableFeature('dmzProxy');
window.FEATURE_FLAGS.dmzProxyUrl = 'http://dmz-proxy.internal:3000';
```

---

## Backend Setup

### Option A: Client-Side Only (Current)

**Current Implementation:**
- All features run in browser
- Email/Jira use mock implementations
- No backend required for testing

**Limitations:**
- Cannot send real emails (SMTP requires backend)
- Cannot make Jira API calls (CORS restrictions)
- Cannot access external APIs (NVD, MITRE)

**Use Case:**
- Development and testing
- Proof of concept
- Offline environments

---

### Option B: Backend Integration (Production)

**Architecture:**
```
Browser (POAM Nexus)
    ↓ HTTPS
Backend API (Node.js/Express)
    ↓
├─ SMTP Server (Email)
├─ Jira API (Tickets)
└─ DMZ Proxy → NVD API (CVE Data)
```

**Backend API Endpoints:**

```javascript
// POST /api/notifications/send-email
{
  "to": "windows-team@agency.gov",
  "subject": "Weekly POAM Digest",
  "html": "<html>...</html>",
  "text": "Plain text..."
}

// POST /api/jira/create-ticket
{
  "poamId": "POAM-2024-001",
  "summary": "[POAM] Vulnerability Title",
  "description": "...",
  "priority": "High",
  "assignee": "windows-team-lead"
}

// GET /api/cve/:cveId
// Returns CVE data from NVD API (cached)
```

**Implementation Guide:**

1. **Create Express.js Backend:**
```bash
mkdir poam-backend
cd poam-backend
npm init -y
npm install express nodemailer axios cors dotenv
```

2. **Email Service (`services/email.js`):**
```javascript
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

async function sendEmail(to, subject, html, text) {
  const info = await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to,
    subject,
    html,
    text
  });
  return info;
}

module.exports = { sendEmail };
```

3. **Jira Service (`services/jira.js`):**
```javascript
const axios = require('axios');

const jiraClient = axios.create({
  baseURL: process.env.JIRA_BASE_URL,
  headers: {
    'Authorization': `Bearer ${process.env.JIRA_API_TOKEN}`,
    'Content-Type': 'application/json'
  }
});

async function createTicket(payload) {
  const response = await jiraClient.post('/rest/api/2/issue', payload);
  return response.data;
}

module.exports = { createTicket };
```

4. **API Routes (`routes/api.js`):**
```javascript
const express = require('express');
const router = express.Router();
const { sendEmail } = require('../services/email');
const { createTicket } = require('../services/jira');

router.post('/notifications/send-email', async (req, res) => {
  try {
    const { to, subject, html, text } = req.body;
    const result = await sendEmail(to, subject, html, text);
    res.json({ success: true, messageId: result.messageId });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/jira/create-ticket', async (req, res) => {
  try {
    const result = await createTicket(req.body);
    res.json({ success: true, key: result.key });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
```

5. **Update Frontend to Use Backend:**
```javascript
// In email-delivery.js, replace mock sendEmail:
async sendEmail(emailData) {
  const response = await fetch('/api/notifications/send-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(emailData)
  });
  return await response.json();
}

// In jira-integration.js, replace mock sendToJira:
async sendToJira(payload) {
  const response = await fetch('/api/jira/create-ticket', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return await response.json();
}
```

---

## Testing

### Pre-Deployment Testing Checklist

**1. Feature Flags**
- [ ] All features disabled by default
- [ ] Can enable/disable individual features
- [ ] Settings persist across page refresh
- [ ] Error tracking works (auto-disable after 5 errors)

**2. Vulnerability Intelligence**
- [ ] CVE enrichment works with mock data
- [ ] NIST control mapping accurate
- [ ] Caching works (check IndexedDB)
- [ ] Graceful degradation if disabled

**3. Notification Queue**
- [ ] Detects new POAMs (not baseline)
- [ ] Groups by POC team correctly
- [ ] Weekly scheduler calculates next batch time
- [ ] Manual processing works (`window.processNotificationQueue()`)

**4. Email Delivery**
- [ ] HTML template renders correctly
- [ ] Plain text template readable
- [ ] Severity grouping works
- [ ] Links are correct
- [ ] Mock email logs to console

**5. Jira Integration**
- [ ] Ticket payload builds correctly
- [ ] Priority mapping works
- [ ] POC username mapping works
- [ ] Mock ticket creation logs to console

**6. Feedback Collection**
- [ ] Modal opens correctly
- [ ] Form validation works
- [ ] Extension date limits enforced
- [ ] Submission saves to IndexedDB

**7. Database**
- [ ] Upgrades to version 11
- [ ] New stores created (notificationQueue, feedbackResponses, cveCache)
- [ ] No data loss during upgrade
- [ ] Queries work on new stores

**8. Integration**
- [ ] Event fires after POAM import
- [ ] Notification queue receives event
- [ ] No errors in console
- [ ] Existing features still work

---

### Testing Scenarios

**Scenario 1: Import New POAMs**
```
1. Import CSV with 10 vulnerabilities
2. Verify event fires (check console)
3. Check notification queue: window.getNotificationQueueStats()
4. Verify 10 notifications queued
5. Verify grouped by POC team
6. Process queue manually: window.processNotificationQueue()
7. Check console for email/Jira logs
```

**Scenario 2: Weekly Batch**
```
1. Enable notifications
2. Import POAMs on Monday morning
3. Verify batch scheduled for next Monday
4. Check schedule: window.notificationQueue.getNextBatchTime()
5. Wait for batch time (or manually trigger)
6. Verify emails sent (console logs)
7. Verify Jira tickets created (console logs)
```

**Scenario 3: Feedback Form**
```
1. Open POAM detail view
2. Click feedback button
3. Select "I need an extension"
4. Fill out form (date, justification)
5. Submit
6. Verify saved to IndexedDB
7. Verify notification status updated
```

**Scenario 4: Error Handling**
```
1. Enable feature
2. Trigger error (invalid data)
3. Verify error logged
4. Trigger 5 more errors
5. Verify feature auto-disabled
6. Check console for warning
```

---

## Production Rollout

### Phase 1: Pilot (Week 1)

**Scope:**
- 1 POC team (e.g., Windows Systems Team)
- Email notifications only
- No Jira integration yet

**Steps:**
1. Enable features for pilot team:
```javascript
window.enableFeature('notifications');
window.enableFeature('emailDelivery');
// Keep Jira disabled for now
```

2. Configure email for pilot team only:
```javascript
// Modify notification-queue.js to filter by team
if (pocTeam !== 'Windows Systems Team') return;
```

3. Import test scan
4. Verify email sent to pilot team
5. Collect feedback from pilot team
6. Monitor for issues (1 week)

**Success Criteria:**
- [ ] Emails delivered successfully
- [ ] No errors in console
- [ ] Pilot team acknowledges receipt
- [ ] Positive feedback from pilot team

---

### Phase 2: Expand (Week 2-3)

**Scope:**
- All POC teams
- Email + Jira integration
- Feedback collection enabled

**Steps:**
1. Remove pilot team filter
2. Enable Jira integration:
```javascript
window.enableFeature('jiraIntegration');
```

3. Enable feedback collection:
```javascript
window.enableFeature('feedbackCollection');
```

4. Import production scan
5. Verify all teams receive emails
6. Verify Jira tickets created
7. Monitor acknowledgment rates
8. Review extension requests

**Success Criteria:**
- [ ] All teams receive emails
- [ ] Jira tickets created for all POAMs
- [ ] >80% acknowledgment rate within 1 week
- [ ] <20% extension requests
- [ ] No critical errors

---

### Phase 3: Full Production (Week 4+)

**Scope:**
- All features enabled
- Weekly batching active
- DMZ proxy for CVE data
- Backend integration complete

**Steps:**
1. Enable vulnerability intelligence:
```javascript
window.enableFeature('vulnerabilityIntelligence');
window.enableFeature('dmzProxy');
```

2. Deploy backend API
3. Update frontend to use backend
4. Enable weekly batching
5. Monitor metrics:
   - Email delivery rate
   - Jira ticket creation rate
   - Acknowledgment rate
   - Extension request rate
   - MTTR improvement

**Success Criteria:**
- [ ] >95% email delivery rate
- [ ] 100% Jira ticket creation
- [ ] >80% acknowledgment rate
- [ ] <20% extension requests
- [ ] MTTR reduced by 20%
- [ ] Zero critical errors
- [ ] Positive user feedback

---

## Monitoring

### Metrics to Track

**System Health:**
- Feature flag status (enabled/disabled)
- Error counts per feature
- Auto-disable events
- Database version
- Cache hit rate

**Notification Performance:**
- Notifications queued per day
- Notifications sent per day
- Email delivery success rate
- Jira ticket creation success rate
- Average batch size

**User Engagement:**
- Acknowledgment rate
- Time to acknowledge (average)
- Extension request rate
- Extension approval rate
- Feedback submission rate

**Remediation Metrics:**
- MTTR (Mean Time To Remediate)
- SLA compliance rate
- POAMs completed on time
- POAMs requiring extensions
- POAMs auto-resolved

### Monitoring Commands

```javascript
// Check feature status
window.FEATURE_FLAGS

// Check error counts
window.FEATURE_ERROR_COUNTS

// Check notification queue
await window.getNotificationQueueStats()

// Check cache stats
window.vulnerabilityIntelligence.getCacheStats()

// Export configuration
window.exportFeatureFlags()
window.exportNotificationConfig()
```

### Alerts to Configure

**Critical:**
- Feature auto-disabled due to errors
- Email delivery failure rate >10%
- Jira API authentication failure
- Database upgrade failure

**Warning:**
- Acknowledgment rate <60%
- Extension request rate >30%
- Cache miss rate >50%
- Batch processing delayed >1 hour

**Info:**
- Weekly batch completed
- New POAMs detected
- Configuration changed

---

## Troubleshooting

### Common Issues

**Issue: Emails not sending**
```
Symptoms: Console shows "Email would be sent" but no actual emails
Cause: Backend not configured or SMTP credentials invalid
Solution:
1. Verify backend is running
2. Check SMTP credentials
3. Test SMTP connection manually
4. Check firewall rules (port 587/465)
```

**Issue: Jira tickets not creating**
```
Symptoms: Console shows "Jira ticket would be created" but no tickets
Cause: Backend not configured or Jira API token invalid
Solution:
1. Verify backend is running
2. Check Jira API token
3. Verify project key exists
4. Check Jira permissions
```

**Issue: Notifications not queuing**
```
Symptoms: Import POAMs but queue stays empty
Cause: Feature disabled or event not firing
Solution:
1. Check feature flag: window.FEATURE_FLAGS.notifications
2. Check console for event dispatch
3. Verify database has notificationQueue store
4. Check browser console for errors
```

**Issue: Database upgrade fails**
```
Symptoms: Error on page load, features not working
Cause: IndexedDB version conflict or corruption
Solution:
1. Open browser DevTools → Application → IndexedDB
2. Delete POAMDatabase
3. Refresh page (will recreate)
4. Re-import data from backup
```

**Issue: Feature auto-disabled**
```
Symptoms: Feature stops working, console shows auto-disable warning
Cause: 5+ errors triggered auto-disable safety mechanism
Solution:
1. Check console for error details
2. Fix underlying issue
3. Reset error count: window.resetFeatureErrorCount('featureName')
4. Re-enable feature: window.enableFeature('featureName')
```

---

## Rollback Procedures

### Emergency Rollback

**If critical issue detected:**

**Option 1: Disable Features (Instant)**
```javascript
// Disable all AI Assistant features
window.disableAllFeatures()
// Application continues working normally
```

**Option 2: Git Revert (5 minutes)**
```bash
# Revert to commit before AI Assistant
git revert 7db1609
git push origin main
# GitHub Pages redeploys automatically
```

**Option 3: Restore from Backup (10 minutes)**
```javascript
// Use existing backup/restore feature
// Export current state first
window.poamDB.exportPOAMBackup()
// Restore from pre-enhancement backup
```

### Partial Rollback

**Disable specific features:**
```javascript
// Keep intelligence, disable notifications
window.disableFeature('notifications')
window.disableFeature('emailDelivery')
window.disableFeature('jiraIntegration')
// Intelligence still works
```

---

## Security Considerations

### Data Protection

- **Passwords**: Never commit SMTP/Jira passwords to git
- **API Tokens**: Store in environment variables or secrets manager
- **Email Content**: Contains sensitive vulnerability data - use TLS
- **Jira Tickets**: Ensure proper project permissions
- **CVE Data**: Cache locally to minimize external requests

### Access Control

- **Feature Flags**: Admin-only access to enable/disable
- **Configuration**: Restrict who can update SMTP/Jira settings
- **Feedback**: Validate user identity before accepting responses
- **Extension Approvals**: Require Security Team authorization

### Audit Logging

- **Track all configuration changes**
- **Log all email sends (to, subject, timestamp)**
- **Log all Jira ticket creations**
- **Log all feedback submissions**
- **Log all extension approvals/denials**

---

## Support

**Technical Issues:**
- Check browser console (F12) for errors
- Review this deployment guide
- Contact: security-team@agency.gov

**Configuration Help:**
- Review configuration section above
- Test with mock data first
- Contact: security-team@agency.gov

**Training:**
- User Guide: `docs/AI-ASSISTANT-USER-GUIDE.md`
- Monthly training sessions available
- Request: security-training@agency.gov

---

*Last Updated: February 25, 2026*
*Version: 1.0.0*
