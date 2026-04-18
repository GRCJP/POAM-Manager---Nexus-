const { StoreInterface } = require('./store-interface');

/**
 * In-memory store for testing. All data lives in plain objects/maps.
 */
class MemoryStore extends StoreInterface {
  constructor() {
    super();
    this.identities = new Map();
    this.assetLedgers = new Map();  // identityHash → entry[]
    this.scanRecords = [];
    this.jiraLinks = new Map();
  }

  async getIdentity(hash) {
    return this.identities.get(hash) || null;
  }

  async getAllIdentities() {
    return Array.from(this.identities.values());
  }

  async saveIdentity(identity) {
    this.identities.set(identity.hash, { ...identity });
  }

  async updateIdentity(hash, updates) {
    const existing = this.identities.get(hash);
    if (!existing) return null;
    const updated = { ...existing, ...updates };
    this.identities.set(hash, updated);
    return updated;
  }

  async getAssetLedger(identityHash) {
    return this.assetLedgers.get(identityHash) || [];
  }

  async appendLedgerEntry(identityHash, entry) {
    const ledger = this.assetLedgers.get(identityHash) || [];
    ledger.push(entry);
    this.assetLedgers.set(identityHash, ledger);
  }

  async saveScanRecord(record) {
    this.scanRecords.push(record);
  }

  async getAllScanRecords() {
    return [...this.scanRecords];
  }

  async getJiraLink(identityHash) {
    return this.jiraLinks.get(identityHash) || null;
  }

  async saveJiraLink(identityHash, jiraData) {
    this.jiraLinks.set(identityHash, jiraData);
  }

  /** Reset all data (useful between tests) */
  clear() {
    this.identities.clear();
    this.assetLedgers.clear();
    this.scanRecords = [];
    this.jiraLinks.clear();
  }
}

module.exports = { MemoryStore };
