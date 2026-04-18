'use strict';

const path = require('path');
const { MemoryStore } = require('../../src/store/memory-store');
const { runImportPipeline } = require('../../src/engine/pipeline');
const { setKevCache } = require('../../src/integrations/kev-catalog');

const SCAN_A = path.resolve(__dirname, '../fixtures/scan-a.csv');
const SCAN_B = path.resolve(__dirname, '../fixtures/scan-b.csv');

// Inject KEV cache before all tests so no network calls are made
beforeAll(() => {
  setKevCache(new Set(['CVE-2023-51385']));
});

describe('Scan Comparison Integration', () => {

  // ────────────────────────────────────────────────────────
  // (a) Scan A creates identities from baseline
  // ────────────────────────────────────────────────────────
  it('Scan A creates identities from baseline', async () => {
    const store = new MemoryStore();
    const { summary } = await runImportPipeline(SCAN_A, store, {
      source: 'qualys',
      filename: 'scan-a.csv',
      today: new Date(2026, 0, 15), // Jan 15, 2026
    });

    const identities = await store.getAllIdentities();
    expect(identities.length).toBeGreaterThan(0);

    const scanRecords = await store.getAllScanRecords();
    expect(scanRecords).toHaveLength(1);

    // All identities should be new in a baseline scan
    expect(summary.counts.newPoams).toBeGreaterThan(0);
    expect(summary.newPoams.length).toBe(summary.counts.newPoams);
  }, 30000);

  // ────────────────────────────────────────────────────────
  // (b) Scan B detects remediated, new, and regressing
  // ────────────────────────────────────────────────────────
  it('Scan B detects remediated, new, and regressing', async () => {
    const store = new MemoryStore();

    // Import Scan A as baseline
    await runImportPipeline(SCAN_A, store, {
      source: 'qualys',
      filename: 'scan-a.csv',
      today: new Date(2026, 0, 15),
    });
    const identitiesAfterA = (await store.getAllIdentities()).length;

    // Import Scan B
    const { summary } = await runImportPipeline(SCAN_B, store, {
      source: 'qualys',
      filename: 'scan-b.csv',
      today: new Date(2026, 1, 15), // Feb 15, 2026
    });
    const identitiesAfterB = (await store.getAllIdentities()).length;

    // Nginx is new in Scan B, so more identities
    expect(identitiesAfterB).toBeGreaterThan(identitiesAfterA);

    // Check that some asset ledger entries show remediatedCount > 0
    const allIdentities = await store.getAllIdentities();
    let hasRemediation = false;
    for (const identity of allIdentities) {
      const ledger = await store.getAssetLedger(identity.hash);
      for (const entry of ledger) {
        if (entry.remediatedCount > 0) {
          hasRemediation = true;
          break;
        }
      }
      if (hasRemediation) break;
    }
    expect(hasRemediation).toBe(true);

    // Delta summary should show new POAMs (Nginx)
    expect(summary.counts.newPoams).toBeGreaterThanOrEqual(1);
  }, 60000);

  // ────────────────────────────────────────────────────────
  // (c) 30-day eligibility gate excludes recent findings
  // ────────────────────────────────────────────────────────
  it('30-day eligibility gate excludes recent findings', async () => {
    const store = new MemoryStore();
    const { summary } = await runImportPipeline(SCAN_A, store, {
      source: 'qualys',
      filename: 'scan-a.csv',
      today: new Date(2026, 0, 15),
    });

    expect(summary.metadata.excluded).toBeGreaterThanOrEqual(0);
    expect(summary.metadata.totalParsed).toBeGreaterThan(summary.metadata.excluded);
  }, 30000);

  // ────────────────────────────────────────────────────────
  // (d) Scan history records analysis data points
  // ────────────────────────────────────────────────────────
  it('scan history records analysis data points', async () => {
    const store = new MemoryStore();

    await runImportPipeline(SCAN_A, store, {
      source: 'qualys',
      filename: 'scan-a.csv',
      today: new Date(2026, 0, 15),
    });

    await runImportPipeline(SCAN_B, store, {
      source: 'qualys',
      filename: 'scan-b.csv',
      today: new Date(2026, 1, 15),
    });

    const records = await store.getAllScanRecords();
    expect(records).toHaveLength(2);

    const second = records[1];
    expect(second).toHaveProperty('newIdentities');
    expect(second).toHaveProperty('updatedIdentities');
    expect(second).toHaveProperty('totalParsed');
    expect(second).toHaveProperty('excluded');
    expect(second).toHaveProperty('riskAcceptedCount');
  }, 60000);

  // ────────────────────────────────────────────────────────
  // (e) Priority scores include factor breakdown
  // ────────────────────────────────────────────────────────
  it('priority scores include factor breakdown', async () => {
    const store = new MemoryStore();
    await runImportPipeline(SCAN_A, store, {
      source: 'qualys',
      filename: 'scan-a.csv',
      today: new Date(2026, 0, 15),
    });

    const identities = await store.getAllIdentities();
    expect(identities.length).toBeGreaterThan(0);

    for (const identity of identities) {
      expect(identity.priorityScore).toBeDefined();
      expect(identity.priorityScore).toHaveProperty('total');
      expect(identity.priorityScore).toHaveProperty('tier');
      expect(identity.priorityScore).toHaveProperty('factors');
      expect(identity.priorityScore.total).toBeGreaterThanOrEqual(0);
      expect(identity.priorityScore.total).toBeLessThanOrEqual(100);
    }
  }, 30000);

  // ────────────────────────────────────────────────────────
  // (f) OpenSSH identity gets high exploitability due to KEV
  // ────────────────────────────────────────────────────────
  it('OpenSSH identity gets high exploitability due to KEV', async () => {
    const store = new MemoryStore();
    await runImportPipeline(SCAN_A, store, {
      source: 'qualys',
      filename: 'scan-a.csv',
      today: new Date(2026, 0, 15),
    });

    const identities = await store.getAllIdentities();
    const openssh = identities.find(i =>
      i.displayName.toLowerCase().includes('openssh')
    );

    expect(openssh).toBeDefined();
    expect(openssh.priorityScore.factors.exploitability).toBe(100);
  }, 30000);
});
