# POAM Nexus AI Assistant - User Guide

## Overview

The POAM Nexus AI Assistant enhances your vulnerability management workflow with intelligent automation, proactive notifications, and streamlined collaboration.

## Features

### 1. Vulnerability Intelligence

**What it does:**
- Automatically enriches POAMs with CVE data from the National Vulnerability Database (NVD)
- Maps vulnerabilities to NIST SP 800-53 control families
- Identifies MITRE ATT&CK techniques
- Detects patch availability

**How to use:**
1. Import a vulnerability scan (CSV file)
2. If enabled, POAMs are automatically enriched during import
3. View enriched data in POAM detail view

**Benefits:**
- Faster remediation planning with authoritative data
- Accurate control family mapping for compliance
- Patch availability information for prioritization

---

### 2. Weekly Email Notifications

**What it does:**
- Sends weekly email digests to POC teams
- Groups POAMs by severity (Critical, High, Medium, Low)
- Includes affected assets, due dates, and milestones
- Provides direct links to acknowledge or request extensions

**How to use:**
1. New POAMs are automatically detected after CSV import
2. Notifications are queued and grouped by POC team
3. Every Monday at 8am, weekly digests are sent
4. Click links in email to acknowledge or request extension

**Email includes:**
- Summary of new POAMs assigned to your team
- Severity breakdown with due dates
- Affected asset counts
- Milestone timelines
- Action buttons (View, Acknowledge, Request Extension)

---

### 3. Jira Integration

**What it does:**
- Automatically creates Jira tickets for new POAMs
- Syncs POAM details to Jira (description, severity, due date)
- Links POAM to Jira ticket for tracking
- Optional: Sync status changes back to POAM Nexus

**How to use:**
1. New POAMs automatically get Jira tickets created
2. Ticket includes full POAM details in Wiki markup
3. Update ticket in Jira or POAM Nexus (stays in sync)
4. View ticket link in POAM detail view

**Jira ticket includes:**
- POAM ID, CVEs, severity, CVSS score
- Affected assets and SLA status
- Remediation plan with milestones
- NIST controls and references
- Link back to POAM Nexus

---

### 4. Feedback & Acknowledgment

**What it does:**
- Allows POC teams to acknowledge POAM receipt
- Enables extension requests with justification
- Tracks acknowledgment status
- Routes extension requests for approval

**How to use:**

**From Email:**
1. Click "Acknowledge" or "Request Extension" in email
2. Fill out feedback form
3. Submit response

**From Dashboard:**
1. Open POAM detail view
2. Click "Provide Feedback" button
3. Select response type:
   - **I acknowledge receipt** - Confirm you've reviewed the POAM
   - **I can meet the deadline** - Confirm completion by due date
   - **I need an extension** - Request more time (requires justification)
4. If requesting extension:
   - Select new completion date (max 90 days)
   - Provide detailed justification
   - Submit for Security Team approval
5. Add optional comments
6. Submit

**Extension Request Process:**
1. POC team submits extension request
2. Security Team receives notification
3. Security Team reviews justification
4. Approval/denial sent to POC team
5. If approved, POAM due date updated

---

## User Workflows

### Workflow 1: Receiving Weekly Notifications

```
Monday 8am
    ↓
Email arrives: "15 New POAMs Assigned to Windows Systems Team"
    ↓
Review email digest
    ↓
Click "View Details" for critical POAMs
    ↓
Review in POAM Nexus dashboard
    ↓
Click "Acknowledge" in email
    ↓
Confirm receipt and commitment to timeline
```

### Workflow 2: Requesting Extension

```
Review POAM due date
    ↓
Realize more time needed
    ↓
Click "Request Extension" in email or dashboard
    ↓
Select new completion date
    ↓
Write justification:
  - Why extension needed
  - What's blocking remediation
  - What's the plan to complete
    ↓
Submit request
    ↓
Security Team reviews
    ↓
Receive approval/denial notification
    ↓
If approved: Continue work with new deadline
If denied: Escalate or meet original deadline
```

### Workflow 3: Working with Jira Tickets

```
New POAM created
    ↓
Jira ticket auto-created: SEC-1234
    ↓
Receive email with Jira link
    ↓
Open ticket in Jira
    ↓
Add comments, attachments, work logs
    ↓
Update status in Jira
    ↓
Status syncs back to POAM Nexus (if enabled)
    ↓
Complete remediation
    ↓
Close ticket in Jira
    ↓
POAM marked as completed
```

---

## FAQs

### Q: Will I get notified about the initial 400 baseline POAMs?
**A:** No. The system only sends notifications for NEW POAMs created after the baseline import. This prevents email overload.

### Q: Can I change the notification schedule?
**A:** Yes. Administrators can configure the batch schedule (day of week, time) in the notification settings.

### Q: What happens if I don't acknowledge a POAM?
**A:** Acknowledgment is tracked but not required. However, acknowledging helps the Security Team know you've received and reviewed the POAM. Unacknowledged POAMs may be flagged for follow-up.

### Q: How long can I request an extension for?
**A:** Maximum 90 days from the original due date. Extensions require justification and Security Team approval.

### Q: Can I see all my team's pending POAMs?
**A:** Yes. Use the dashboard filters to view POAMs by POC team. Click your team name in the POC Team table or use the filter dropdown.

### Q: What if a POAM is assigned to the wrong team?
**A:** Contact the Security Team to reassign. POC assignments are based on asset tags, OS type, and platform. The Security Team can update assignment rules.

### Q: Can I add comments to a POAM?
**A:** Yes. Open the POAM detail view and use the Comments section. Comments are visible to all users and synced to Jira (if enabled).

### Q: How do I track milestone progress?
**A:** Open the POAM detail view and navigate to the Milestones tab. Update milestone status as you complete each step. Progress is tracked and visible to the Security Team.

### Q: What if I complete remediation early?
**A:** Great! Update the POAM status to "Completed" and set the actual completion date. This helps track MTTR (Mean Time To Remediate) metrics.

### Q: Can I export my team's POAMs?
**A:** Yes. Use the bulk operations feature to select POAMs by POC team and export to CSV or Excel.

---

## Best Practices

### For POC Teams

1. **Review weekly emails promptly** - Critical POAMs need immediate attention
2. **Acknowledge receipt within 24 hours** - Shows you're aware and working on it
3. **Update milestone progress regularly** - Helps Security Team track overall progress
4. **Request extensions early** - Don't wait until the due date
5. **Provide detailed justifications** - Increases approval likelihood
6. **Use Jira for collaboration** - Centralize communication and documentation
7. **Close POAMs when complete** - Update actual completion date for metrics

### For Security Team

1. **Review extension requests within 48 hours** - Don't block remediation teams
2. **Provide clear approval/denial reasons** - Help teams understand decisions
3. **Monitor acknowledgment rates** - Follow up with teams that don't respond
4. **Adjust notification schedules if needed** - Balance urgency with email fatigue
5. **Review NIST control mappings** - Ensure accuracy for compliance reporting
6. **Track MTTR metrics** - Identify teams that need support
7. **Update POC assignment rules** - Improve auto-assignment accuracy

---

## Troubleshooting

### Issue: Not receiving email notifications
**Solutions:**
1. Check spam/junk folder
2. Verify email address in POC team mapping
3. Contact Security Team to verify notification settings
4. Check if notifications are enabled (feature flag)

### Issue: Jira ticket not created
**Solutions:**
1. Verify Jira integration is enabled
2. Check POAM has required fields (title, severity, due date)
3. Contact Security Team to check Jira API credentials
4. Look for error messages in browser console (F12)

### Issue: Feedback form not working
**Solutions:**
1. Ensure feedback collection is enabled
2. Try refreshing the page
3. Check browser console for errors (F12)
4. Use a different browser (Chrome, Firefox, Edge)

### Issue: Extension request not approved
**Solutions:**
1. Review justification - was it detailed enough?
2. Contact Security Team for clarification
3. Provide additional context if needed
4. Escalate to management if critical

### Issue: POAM assigned to wrong team
**Solutions:**
1. Contact Security Team to reassign
2. Provide correct team name
3. Explain why assignment was incorrect
4. Security Team will update assignment rules

---

## Support

**For technical issues:**
- Email: security-team@agency.gov
- Jira: Create ticket in SEC project
- Dashboard: Use "Report Issue" button

**For policy questions:**
- Contact: CISO office
- Email: ciso@agency.gov

**For training:**
- Schedule: Monthly POAM Nexus training sessions
- Request: security-training@agency.gov

---

## Glossary

- **POAM**: Plan of Action and Milestones - A remediation plan for security findings
- **POC**: Point of Contact - Team responsible for remediation
- **CVE**: Common Vulnerabilities and Exposures - Standardized vulnerability identifier
- **NIST**: National Institute of Standards and Technology
- **MITRE ATT&CK**: Framework for understanding attacker tactics and techniques
- **SLA**: Service Level Agreement - Required remediation timeframe
- **MTTR**: Mean Time To Remediate - Average time to fix vulnerabilities
- **Baseline**: Initial import of existing POAMs (no notifications sent)
- **Enrichment**: Adding CVE data, NIST controls, and intelligence to POAMs

---

*Last Updated: February 25, 2026*
*Version: 1.0.0*
