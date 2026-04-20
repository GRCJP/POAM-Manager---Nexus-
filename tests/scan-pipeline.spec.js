// @ts-check
const { test, expect } = require('@playwright/test');
const { waitForAppLoad, navigateToModule } = require('./helpers');
const path = require('path');
const fs = require('fs');

test.describe('Scan Import Pipeline', () => {
  test.beforeEach(async ({ page }) => {
    await waitForAppLoad(page);
  });

  test('vulnerability tracking module loads', async ({ page }) => {
    await navigateToModule(page, 'vulnerability-tracking');
    const moduleEl = page.locator('#vulnerability-tracking-module');
    await expect(moduleEl).not.toHaveClass(/hidden/);
  });

  test('pipeline classes are available', async ({ page }) => {
    const available = await page.evaluate(() => ({
      PipelineOrchestrator: typeof PipelineOrchestrator,
      PipelineProgressUI: typeof PipelineProgressUI !== 'undefined' ? typeof PipelineProgressUI : typeof window.PipelineProgressUI,
      poamDB: typeof window.poamDB,
      poamDBInit: typeof window.poamDB?.init,
      mergePOAMsFromScan: typeof window.mergePOAMsFromScan,
    }));
    expect(available.PipelineOrchestrator).toBe('function');
    expect(available.poamDB).toBe('object');
    expect(available.poamDBInit).toBe('function');
    expect(available.mergePOAMsFromScan).toBe('function');
  });

  test('poamDB initializes and can read/write POAMs', async ({ page }) => {
    const result = await page.evaluate(async () => {
      if (!window.poamDB.db) await window.poamDB.init();
      // Write a test POAM
      const testPoam = {
        id: 'test-pipeline-001',
        title: 'Test Pipeline POAM',
        vulnerabilityName: 'Test Vuln',
        status: 'open',
        findingStatus: 'open',
        risk: 'high',
        riskLevel: 'high',
        remediationSignature: 'test::sig::001',
        totalAffectedAssets: 2,
        affectedAssets: [],
        statusHistory: [{ date: new Date().toISOString(), action: 'created', details: 'test' }],
        milestones: [],
        cves: [],
        qids: [],
      };
      await window.poamDB.addPOAMsBatch([testPoam]);
      const allPoams = await window.poamDB.getAllPOAMs();
      const found = allPoams.find(p => p.id === 'test-pipeline-001');
      return { count: allPoams.length, found: !!found, title: found?.title };
    });
    expect(result.found).toBe(true);
    expect(result.title).toBeTruthy();
  });

  test('mergePOAMsFromScan creates new POAMs', async ({ page }) => {
    const result = await page.evaluate(async () => {
      if (!window.poamDB.db) await window.poamDB.init();
      // Clear existing
      const tx = window.poamDB.db.transaction(['poams'], 'readwrite');
      tx.objectStore('poams').clear();
      await new Promise(r => { tx.oncomplete = r; });

      const newPoams = [
        { id: 'scan-new-001', title: 'New Finding 1', remediationSignature: 'sig::new1', status: 'open', risk: 'high', totalAffectedAssets: 3, affectedAssets: [], statusHistory: [], milestones: [], cves: [], qids: [] },
        { id: 'scan-new-002', title: 'New Finding 2', remediationSignature: 'sig::new2', status: 'open', risk: 'medium', totalAffectedAssets: 1, affectedAssets: [], statusHistory: [], milestones: [], cves: [], qids: [] },
      ];
      const result = await window.mergePOAMsFromScan(newPoams);
      return result.stats;
    });
    expect(result.created).toBe(2);
    expect(result.updated).toBe(0);
    expect(result.autoResolved).toBe(0);
  });

  test('mergePOAMsFromScan updates existing POAMs on re-import', async ({ page }) => {
    const result = await page.evaluate(async () => {
      if (!window.poamDB.db) await window.poamDB.init();
      // Clear and seed
      const tx = window.poamDB.db.transaction(['poams'], 'readwrite');
      tx.objectStore('poams').clear();
      await new Promise(r => { tx.oncomplete = r; });

      // First import
      const initial = [
        { id: 'merge-001', title: 'Existing Finding', remediationSignature: 'sig::merge1', status: 'open', findingStatus: 'open', risk: 'high', totalAffectedAssets: 5, affectedAssets: [], statusHistory: [{ action: 'created', date: new Date().toISOString() }], milestones: [], cves: [], qids: [] },
      ];
      await window.poamDB.addPOAMsBatch(initial);

      // Re-import with same signature but different asset count
      const reimport = [
        { id: 'merge-001-new', title: 'Existing Finding', remediationSignature: 'sig::merge1', status: 'open', risk: 'high', totalAffectedAssets: 3, affectedAssets: [], statusHistory: [], milestones: [], cves: [], qids: [] },
      ];
      const result = await window.mergePOAMsFromScan(reimport);
      return { stats: result.stats, historyLen: result.mergedPOAMs[0]?.statusHistory?.length || 0 };
    });
    expect(result.stats.created).toBe(0);
    expect(result.stats.updated).toBe(1);
    // Should have original 'created' + new 'scan_update'
    expect(result.historyLen).toBeGreaterThanOrEqual(2);
  });

  test('mergePOAMsFromScan auto-resolves missing POAMs', async ({ page }) => {
    const result = await page.evaluate(async () => {
      if (!window.poamDB.db) await window.poamDB.init();
      const tx = window.poamDB.db.transaction(['poams'], 'readwrite');
      tx.objectStore('poams').clear();
      await new Promise(r => { tx.oncomplete = r; });

      // First: create an existing POAM
      const existing = [
        { id: 'resolve-001', title: 'Will Disappear', remediationSignature: 'sig::disappear', status: 'open', findingStatus: 'open', risk: 'medium', totalAffectedAssets: 1, affectedAssets: [], statusHistory: [{ action: 'created', date: new Date().toISOString() }], milestones: [], cves: [], qids: [] },
      ];
      await window.poamDB.addPOAMsBatch(existing);

      // Re-import with DIFFERENT signature (old one disappears)
      const newScan = [
        { id: 'resolve-new', title: 'New Finding', remediationSignature: 'sig::new', status: 'open', risk: 'low', totalAffectedAssets: 1, affectedAssets: [], statusHistory: [], milestones: [], cves: [], qids: [] },
      ];
      const result = await window.mergePOAMsFromScan(newScan);
      const resolved = result.mergedPOAMs.find(p => p.id === 'resolve-001');
      return { stats: result.stats, resolvedStatus: resolved?.status, resolvedFindingStatus: resolved?.findingStatus };
    });
    expect(result.stats.autoResolved).toBe(1);
    expect(result.stats.created).toBe(1);
    expect(result.resolvedStatus).toBe('completed');
  });

  test('mergePOAMsFromScan reopens previously completed POAMs', async ({ page }) => {
    const result = await page.evaluate(async () => {
      if (!window.poamDB.db) await window.poamDB.init();
      const tx = window.poamDB.db.transaction(['poams'], 'readwrite');
      tx.objectStore('poams').clear();
      await new Promise(r => { tx.oncomplete = r; });

      // Seed a completed POAM
      const completed = [
        { id: 'reopen-001', title: 'Was Completed', remediationSignature: 'sig::reopen', status: 'completed', findingStatus: 'completed', risk: 'high', totalAffectedAssets: 0, affectedAssets: [], actualCompletionDate: '2026-01-01', statusHistory: [{ action: 'created' }, { action: 'auto_resolved' }], milestones: [], cves: [], qids: [] },
      ];
      await window.poamDB.addPOAMsBatch(completed);

      // New scan has the same signature — should reopen, not create new
      const newScan = [
        { id: 'reopen-new', title: 'Was Completed', remediationSignature: 'sig::reopen', status: 'open', risk: 'high', totalAffectedAssets: 2, affectedAssets: [], statusHistory: [], milestones: [], cves: [], qids: [] },
      ];
      const result = await window.mergePOAMsFromScan(newScan);
      const reopened = result.mergedPOAMs.find(p => p.id === 'reopen-001');
      return {
        stats: result.stats,
        reopenedId: reopened?.id,
        reopenedStatus: reopened?.status,
        hasReopenHistory: reopened?.statusHistory?.some(h => h.action === 'reopened'),
      };
    });
    expect(result.stats.reopened).toBe(1);
    expect(result.stats.created).toBe(0);
    expect(result.reopenedId).toBe('reopen-001');
    expect(result.reopenedStatus).toBe('open');
    expect(result.hasReopenHistory).toBe(true);
  });

  test('addPOAMsBatch clears poams store but preserves scanRuns store', async ({ page }) => {
    const result = await page.evaluate(async () => {
      if (!window.poamDB.db) await window.poamDB.init();
      // Save a scan run first
      try {
        await window.poamDB.saveScanRun({ id: 'test-scanrun-001', runId: 'test-scanrun-001', scanId: 'test-scanrun-001', importedAt: new Date().toISOString(), totalFindings: 100 });
      } catch (e) { /* store might not exist */ }

      // Now do addPOAMsBatch
      await window.poamDB.addPOAMsBatch([
        { id: 'batch-001', title: 'Batch Test', status: 'open', remediationSignature: 'sig::batch', affectedAssets: [], statusHistory: [], milestones: [], cves: [], qids: [] },
      ]);

      // Check scan run still exists (addPOAMsBatch only clears poams, not scanRuns)
      try {
        const scanRun = await window.poamDB.getScanRun('test-scanrun-001');
        return { scanRunPreserved: !!scanRun };
      } catch (e) {
        return { scanRunPreserved: false, error: e.message };
      }
    });
    expect(result.scanRunPreserved).toBe(true);
  });

  test('full pipeline Phase 5 commit and persist succeeds', async ({ page }) => {
    const result = await page.evaluate(async () => {
      if (!window.poamDB.db) await window.poamDB.init();
      // Clear POAMs
      const tx = window.poamDB.db.transaction(['poams'], 'readwrite');
      tx.objectStore('poams').clear();
      await new Promise(r => { tx.oncomplete = r; });

      // Simulate what Phase 5 does
      const poamDrafts = [
        { id: 'phase5-001', title: 'Phase 5 Test', vulnerabilityName: 'Test', remediationSignature: 'sig::phase5', status: 'open', findingStatus: 'open', risk: 'critical', totalAffectedAssets: 1, affectedAssets: [], statusHistory: [{ action: 'created', date: new Date().toISOString() }], milestones: [], cves: ['CVE-2024-0001'], qids: [] },
      ];

      // This is the same sequence Phase 5 does
      const existingPOAMs = await window.poamDB.getAllPOAMs();
      let saved;
      if (existingPOAMs.length > 0 && typeof window.mergePOAMsFromScan === 'function') {
        const mergeResult = await window.mergePOAMsFromScan(poamDrafts);
        saved = await window.poamDB.addPOAMsBatch(mergeResult.mergedPOAMs);
      } else {
        saved = await window.poamDB.addPOAMsBatch(poamDrafts);
      }

      // Now save scan run (this is what was failing)
      const scanRunRecord = {
        id: 'scanrun-phase5-test',
        scanId: 'scanrun-phase5-test',
        importedAt: new Date().toISOString(),
        timestamp: new Date().toISOString(),
        source: 'Test',
        fileName: 'test.csv',
        totalFindings: 1,
        poamsGenerated: 1,
      };
      await window.poamDB.saveScanRun(scanRunRecord);

      // Verify everything persisted
      const allPoams = await window.poamDB.getAllPOAMs();
      const scanRun = await window.poamDB.getScanRun('scanrun-phase5-test');
      return {
        poamCount: allPoams.length,
        poamSaved: saved?.saved || 0,
        scanRunSaved: !!scanRun,
      };
    });
    expect(result.poamCount).toBeGreaterThan(0);
    expect(result.scanRunSaved).toBe(true);
  });

  test('addPOAMsBatch handles 500 POAMs with large asset arrays', async ({ page }) => {
    const result = await page.evaluate(async () => {
      if (!window.poamDB.db) await window.poamDB.init();

      // Generate 500 POAMs each with 50 assets and long text — simulates real Qualys scan
      const bigPoams = [];
      for (let i = 0; i < 500; i++) {
        const assets = [];
        for (let a = 0; a < 50; a++) {
          assets.push({
            assetName: `server-${i}-${a}.example.com`,
            ipv4: `10.${Math.floor(i/256)}.${i%256}.${a}`,
            os: 'Windows Server 2019 Standard',
            results: 'FAILED: Port 443 SSL certificate expired on 2025-01-15. Remediation: Renew certificate. '.repeat(5),
          });
        }
        bigPoams.push({
          id: `STRESS-${String(i+1).padStart(4,'0')}`,
          title: `Stress Test Vulnerability ${i+1} — A Moderately Long Title For Testing Purposes`,
          vulnerabilityName: `Stress Test Vulnerability ${i+1}`,
          description: 'This is a test finding description that is moderately long to simulate real data. '.repeat(10),
          findingDescription: 'This is a test finding description that is moderately long to simulate real data. '.repeat(10),
          mitigation: 'Apply vendor patch when available. Monitor for exploitation. Implement compensating controls. '.repeat(10),
          remediationSignature: `sig::stress::${i}`,
          status: 'open',
          findingStatus: 'open',
          risk: ['critical','high','medium','low'][i % 4],
          totalAffectedAssets: 50,
          affectedAssets: assets,
          statusHistory: [{ action: 'created', date: new Date().toISOString() }],
          milestones: [],
          cves: [`CVE-2024-${String(i).padStart(4,'0')}`],
          qids: [`${10000+i}`],
        });
      }

      // Measure raw size
      const rawSize = JSON.stringify(bigPoams).length;
      const rawMB = (rawSize / 1024 / 1024).toFixed(2);

      const saved = await window.poamDB.addPOAMsBatch(bigPoams);
      const allPoams = await window.poamDB.getAllPOAMs();

      return {
        rawDataMB: rawMB,
        inputCount: bigPoams.length,
        savedCount: saved.saved,
        storedCount: allPoams.length,
        errorCount: saved.errors.length,
      };
    });

    console.log('Stress test results:', result);
    expect(result.savedCount).toBe(500);
    expect(result.storedCount).toBe(500);
  });
});
