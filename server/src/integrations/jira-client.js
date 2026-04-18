const fetch = require('node-fetch');

/**
 * Create a Jira ticket for a POAM identity.
 *
 * @param {Object} config - { baseUrl, projectKey, authToken, email }
 * @param {Object} ticketData - { summary, description, priority, assignee, labels }
 * @param {string} idempotencyKey - Remediation Identity hash (prevents duplicates)
 * @returns {Promise<{ ticketKey: string, ticketUrl: string }>}
 */
async function createJiraTicket(config, ticketData, idempotencyKey) {
  const { baseUrl, projectKey, authToken, email } = config;

  const body = {
    fields: {
      project: { key: projectKey },
      summary: ticketData.summary,
      description: ticketData.description,
      issuetype: { name: 'Task' },
      priority: { name: ticketData.priority || 'Medium' },
      labels: ticketData.labels || [],
    },
  };

  if (ticketData.assignee) {
    body.fields.assignee = { accountId: ticketData.assignee };
  }

  const response = await fetch(`${baseUrl}/rest/api/3/issue`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${Buffer.from(`${email}:${authToken}`).toString('base64')}`,
      'Content-Type': 'application/json',
      'X-Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Jira API error (${response.status}): ${error}`);
  }

  const result = await response.json();
  return {
    ticketKey: result.key,
    ticketUrl: `${baseUrl}/browse/${result.key}`,
  };
}

/**
 * Add a comment to an existing Jira ticket.
 *
 * @param {Object} config - { baseUrl, authToken, email }
 * @param {string} ticketKey - e.g., "POAM-123"
 * @param {string} commentBody - comment text
 */
async function addJiraComment(config, ticketKey, commentBody) {
  const { baseUrl, authToken, email } = config;

  const response = await fetch(`${baseUrl}/rest/api/3/issue/${ticketKey}/comment`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${Buffer.from(`${email}:${authToken}`).toString('base64')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      body: {
        type: 'doc',
        version: 1,
        content: [{
          type: 'paragraph',
          content: [{ type: 'text', text: commentBody }],
        }],
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Jira comment error (${response.status}): ${error}`);
  }
}

/**
 * Transition a Jira ticket to a new status.
 *
 * @param {Object} config - { baseUrl, authToken, email }
 * @param {string} ticketKey
 * @param {string} transitionName - e.g., "Done", "Reopen"
 */
async function transitionJiraTicket(config, ticketKey, transitionName) {
  const { baseUrl, authToken, email } = config;
  const authHeader = `Basic ${Buffer.from(`${email}:${authToken}`).toString('base64')}`;

  // First, get available transitions
  const transResponse = await fetch(`${baseUrl}/rest/api/3/issue/${ticketKey}/transitions`, {
    headers: { 'Authorization': authHeader },
  });

  if (!transResponse.ok) throw new Error(`Failed to get transitions for ${ticketKey}`);

  const { transitions } = await transResponse.json();
  const target = transitions.find(t => t.name.toLowerCase() === transitionName.toLowerCase());
  if (!target) throw new Error(`Transition "${transitionName}" not found for ${ticketKey}`);

  const response = await fetch(`${baseUrl}/rest/api/3/issue/${ticketKey}/transitions`, {
    method: 'POST',
    headers: {
      'Authorization': authHeader,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ transition: { id: target.id } }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Jira transition error (${response.status}): ${error}`);
  }
}

module.exports = { createJiraTicket, addJiraComment, transitionJiraTicket };
