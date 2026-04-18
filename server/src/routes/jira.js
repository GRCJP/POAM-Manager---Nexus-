const express = require('express');
const router = express.Router();
const { createJiraTicket } = require('../integrations/jira-client');

/**
 * POST /api/jira/tickets
 * Create a Jira ticket for one or more POAM identities.
 *
 * Body: { identityHashes: string[], ticketOverrides?: { summary, description, priority, labels, assignee } }
 */
router.post('/tickets', async (req, res) => {
  try {
    const store = req.app.get('store');
    const jiraConfig = req.app.get('jiraConfig');

    if (!jiraConfig) {
      return res.status(400).json({ error: 'Jira not configured. Set Jira settings first.' });
    }

    const { identityHashes, ticketOverrides } = req.body;
    if (!identityHashes || !Array.isArray(identityHashes) || identityHashes.length === 0) {
      return res.status(400).json({ error: 'identityHashes array is required' });
    }

    const results = [];

    for (const hash of identityHashes) {
      // Check if ticket already exists for this identity
      const existingLink = await store.getJiraLink(hash);
      if (existingLink) {
        results.push({ hash, status: 'skipped', reason: 'ticket already exists', ticketKey: existingLink.ticketKey });
        continue;
      }

      const identity = await store.getIdentity(hash);
      if (!identity) {
        results.push({ hash, status: 'error', reason: 'identity not found' });
        continue;
      }

      const ledger = await store.getAssetLedger(hash);
      const latestEntry = ledger[ledger.length - 1];

      const ticketData = {
        summary: ticketOverrides?.summary || identity.displayName,
        description: ticketOverrides?.description || buildTicketDescription(identity, latestEntry),
        priority: ticketOverrides?.priority || mapTierToJiraPriority(identity.priorityScore?.tier),
        labels: ticketOverrides?.labels || [identity.controlFamily, `severity-${identity.severity}`],
        assignee: ticketOverrides?.assignee || null,
      };

      try {
        const ticket = await createJiraTicket(jiraConfig, ticketData, hash);
        await store.saveJiraLink(hash, { ticketKey: ticket.ticketKey, ticketUrl: ticket.ticketUrl, createdAt: new Date() });
        results.push({ hash, status: 'created', ticketKey: ticket.ticketKey, ticketUrl: ticket.ticketUrl });
      } catch (err) {
        results.push({ hash, status: 'error', reason: err.message });
      }
    }

    res.json({ results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function buildTicketDescription(identity, latestEntry) {
  const assetCount = latestEntry ? latestEntry.total : 0;
  return [
    `POAM: ${identity.displayName}`,
    `Status: ${identity.status}`,
    `Priority: ${identity.priorityScore?.tier} (Score: ${identity.priorityScore?.total})`,
    `Severity: ${identity.severity}`,
    `Control Family: ${identity.controlFamily}`,
    `Affected Assets: ${assetCount}`,
    `Due Date: ${identity.dueDate ? identity.dueDate.toISOString().split('T')[0] : 'N/A'}`,
    `POC: ${identity.poc}`,
    '',
    `Solution: ${identity.currentTargetVersion}`,
  ].join('\n');
}

function mapTierToJiraPriority(tier) {
  switch (tier) {
    case 'P1': return 'Highest';
    case 'P2': return 'High';
    case 'P3': return 'Medium';
    case 'P4': return 'Low';
    default: return 'Medium';
  }
}

module.exports = router;
