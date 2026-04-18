/**
 * Abstract store interface. All persistence implementations must provide these methods.
 * This allows swapping between in-memory (tests), DynamoDB (production), etc.
 */
class StoreInterface {
  // --- Identities ---
  async getIdentity(hash) { throw new Error('Not implemented'); }
  async getAllIdentities() { throw new Error('Not implemented'); }
  async saveIdentity(identity) { throw new Error('Not implemented'); }
  async updateIdentity(hash, updates) { throw new Error('Not implemented'); }

  // --- Asset Ledger ---
  async getAssetLedger(identityHash) { throw new Error('Not implemented'); }
  async appendLedgerEntry(identityHash, entry) { throw new Error('Not implemented'); }

  // --- Scan History ---
  async saveScanRecord(record) { throw new Error('Not implemented'); }
  async getAllScanRecords() { throw new Error('Not implemented'); }

  // --- Jira Links ---
  async getJiraLink(identityHash) { throw new Error('Not implemented'); }
  async saveJiraLink(identityHash, jiraData) { throw new Error('Not implemented'); }
}

module.exports = { StoreInterface };
