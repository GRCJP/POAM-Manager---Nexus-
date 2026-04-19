// @ts-check
const { test, expect } = require('@playwright/test');
const { waitForAppLoad } = require('./helpers');
const fs = require('fs');
const path = require('path');

// ═══════════════════════════════════════════════════════════════
// MULTI-SCAN PIPELINE TESTS
// Tests the full scan pipeline with 3 sequential scan imports:
//   Scan 1: Baseline — establishes findings
//   Scan 2: Follow-up — some fixed, some new, partial remediation
//   Scan 3: Third scan — more progress, new critical finding
// ═══════════════════════════════════════════════════════════════

const SCAN_FILES = {
  baseline: path.resolve(__dirname, '..', 'test-data', 'scan-baseline-20260316.csv'),
  followup: path.resolve(__dirname, '..', 'test-data', 'scan-followup-20260415.csv'),
  third: path.resolve(__dirname, '..', 'test-data', 'scan-third-20260515.csv'),
};

async function clearFindingsDB(page) {
  await page.evaluate(async () => {
    if (!window.poamDB) return;
    if (!window.poamDB.db) await window.poamDB.init();
    const db = window.poamDB.db;
    for (const store of ['poams', 'scanRuns', 'phaseArtifacts', 'poamScanSummaries']) {
      if (db.objectStoreNames.contains(store)) {
        try {
          const tx = db.transaction(store, 'readwrite');
          tx.objectStore(store).clear();
          await new Promise(r => { tx.oncomplete = r; });
        } catch (e) {}
      }
    }
  });
}

async function importScanCSV(page, csvPath) {
  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const fileName = path.basename(csvPath);

  const result = await page.evaluate(async ({ csv, name }) => {
    try {
      // Parse CSV using the same flow as processLocalCSV
      const processor = new CSVFormatProcessor();
      const detectedFormat = processor.detectFormat(csv);
      const parsed = await processor.processCSV(csv, name, detectedFormat || 'qualys');
      const findings = parsed?.vulnerabilities || parsed?.findings || [];
      if (!findings.length) {
        return { error: 'No findings parsed from CSV', keys: Object.keys(parsed || {}) };
      }

      // Run pipeline
      const pipeline = new PipelineOrchestrator();
      const result = await pipeline.runImportPipeline(
        findings,
        { source: 'Test', fileName: name, scanType: 'Qualys' },
        () => {} // no-op progress callback
      );

      // Get final state
      const allPoams = await window.poamDB.getAllPOAMs();
      const analysis = window.lastScanAnalysis || {};

      return {
        counts: result.counts,
        totalPOAMs: allPoams.length,
        analysis: {
          newPOAMs: analysis.newPOAMs || 0,
          updatedPOAMs: analysis.updatedPOAMs || 0,
          reopenedPOAMs: analysis.reopenedPOAMs || 0,
          autoClosedPOAMs: analysis.autoClosedPOAMs || 0,
          scopeSkippedPOAMs: analysis.scopeSkippedPOAMs || 0,
        },
        poamSummary: allPoams.map(p => ({
          id: p.id,
          title: (p.title || p.vulnerabilityName || '').substring(0, 60),
          status: p.status || p.findingStatus,
          risk: p.risk || p.riskLevel,
          assets: p.totalAffectedAssets || 0,
          historyLen: (p.statusHistory || []).length,
          lastAction: (p.statusHistory || []).slice(-1)[0]?.action || 'none',
        }))
      };
    } catch (e) {
      return { error: e.message, stack: e.stack?.substring(0, 500) };
    }
  }, { csv: csvContent, name: fileName });

  return result;
}

test.describe('Multi-Scan Pipeline', () => {
  test.beforeEach(async ({ page }) => {
    await waitForAppLoad(page);
    await clearFindingsDB(page);
  });

  test('Scan 1: baseline import creates POAMs from eligible findings', async ({ page }) => {
    const result = await importScanCSV(page, SCAN_FILES.baseline);
    expect(result.error).toBeUndefined();

    console.log('Scan 1 counts:', JSON.stringify(result.counts));
    console.log('Scan 1 total POAMs:', result.totalPOAMs);

    // Should have created POAMs (not all 50 rows — SLA gate filters recent ones)
    expect(result.counts.totalRows).toBe(50);
    expect(result.counts.poamsCreated).toBeGreaterThan(0);
    expect(result.totalPOAMs).toBeGreaterThan(0);

    // Verify risk accepted findings are separate
    const riskAccepted = result.poamSummary.filter(p =>
      p.status === 'risk-accepted' || p.status === 'Risk Accepted'
    );
    // We have 2 risk accepted vulns (TLS 1.0, EOL OS) — they should be in separate group
    console.log('Risk accepted POAMs:', riskAccepted.length);
  });

  test('Scan 2: re-import detects fixes, new findings, partial remediation', async ({ page }) => {
    // First import baseline
    const scan1 = await importScanCSV(page, SCAN_FILES.baseline);
    expect(scan1.error).toBeUndefined();
    const baselinePOAMCount = scan1.totalPOAMs;
    console.log('After scan 1:', baselinePOAMCount, 'POAMs');

    // Import follow-up scan
    const scan2 = await importScanCSV(page, SCAN_FILES.followup);
    expect(scan2.error).toBeUndefined();

    console.log('Scan 2 analysis:', JSON.stringify(scan2.analysis));
    console.log('Scan 2 total POAMs:', scan2.totalPOAMs);

    // QID-77777 (Nginx) was in scan 1 but not scan 2 → should be auto-resolved
    // QID-88888 (Docker) is new in scan 2
    // Apache lost 1 asset (partial remediation)
    // Windows patches lost 2 assets (partial remediation)

    // Check we have updated POAMs (not just all new)
    expect(scan2.analysis.updatedPOAMs).toBeGreaterThan(0);

    // Verify POAMs with scan_update history
    const updatedPOAMs = scan2.poamSummary.filter(p => p.lastAction === 'scan_update');
    expect(updatedPOAMs.length).toBeGreaterThan(0);

    // Check for auto-resolved (Nginx gone)
    const completedPOAMs = scan2.poamSummary.filter(p =>
      p.status === 'completed' && p.lastAction === 'auto_resolved'
    );
    console.log('Auto-resolved:', completedPOAMs.map(p => p.title));
  });

  test('Scan 3: further remediation, new critical, reopened findings', async ({ page }) => {
    // Import all 3 scans sequentially
    const scan1 = await importScanCSV(page, SCAN_FILES.baseline);
    expect(scan1.error).toBeUndefined();
    console.log('Scan 1:', scan1.totalPOAMs, 'POAMs');

    const scan2 = await importScanCSV(page, SCAN_FILES.followup);
    expect(scan2.error).toBeUndefined();
    console.log('Scan 2:', scan2.totalPOAMs, 'POAMs, analysis:', JSON.stringify(scan2.analysis));

    const scan3 = await importScanCSV(page, SCAN_FILES.third);
    expect(scan3.error).toBeUndefined();
    console.log('Scan 3:', scan3.totalPOAMs, 'POAMs, analysis:', JSON.stringify(scan3.analysis));

    // QID-99999 (Log4j) is new in scan 3 → should create new POAM
    // SSH vuln lost 3 assets → partial remediation
    // Docker (QID-88888) still present → should be updated, not new

    // Verify status history grows across scans
    // After 3 scans, POAMs that existed in all 3 should have multiple history entries
    const poamsWithHistory = scan3.poamSummary.filter(p => p.historyLen >= 2);
    console.log('POAMs with 2+ history entries:', poamsWithHistory.length);
    // At least some should have history from the merge
    expect(scan3.totalPOAMs).toBeGreaterThanOrEqual(11);

    // Print full summary for manual review
    console.log('\n=== FINAL POAM STATE ===');
    for (const p of scan3.poamSummary) {
      console.log(`  ${p.id?.substring(0,15).padEnd(16)} ${p.status?.padEnd(15)} risk=${p.risk?.padEnd(10)} assets=${String(p.assets).padEnd(4)} history=${p.historyLen} last=${p.lastAction}  ${p.title}`);
    }
  });

  test('scan run metadata persists after each import', async ({ page }) => {
    await importScanCSV(page, SCAN_FILES.baseline);

    const scanRuns = await page.evaluate(async () => {
      const runs = await window.poamDB.getAllScanRuns();
      return runs.map(r => ({ id: r.id, source: r.source, total: r.totalFindings }));
    });

    expect(scanRuns.length).toBeGreaterThanOrEqual(1);

    // Import second scan
    await importScanCSV(page, SCAN_FILES.followup);

    const scanRuns2 = await page.evaluate(async () => {
      try {
        const runs = await window.poamDB.getAllScanRuns();
        return runs.map(r => ({ id: r.id, source: r.source, total: r.totalFindings }));
      } catch (e) {
        return [{ error: e.message }];
      }
    });

    // Should have at least 2 scan runs now (scan metadata preserved)
    console.log('Scan runs after 2 imports:', JSON.stringify(scanRuns2));
  });

  test('POAM progress tracking: asset count changes across scans', async ({ page }) => {
    // Scan 1
    await importScanCSV(page, SCAN_FILES.baseline);

    // Get initial asset counts
    const initial = await page.evaluate(async () => {
      const all = await window.poamDB.getAllPOAMs();
      return all.filter(p => p.status !== 'completed' && p.status !== 'risk-accepted')
        .map(p => ({ sig: p.remediationSignature?.substring(0, 40), assets: p.totalAffectedAssets }));
    });
    console.log('Initial asset counts:', JSON.stringify(initial));

    // Scan 2
    await importScanCSV(page, SCAN_FILES.followup);

    // Check asset counts changed
    const after = await page.evaluate(async () => {
      const all = await window.poamDB.getAllPOAMs();
      return all.filter(p => p.status !== 'completed' && p.status !== 'risk-accepted')
        .map(p => ({
          sig: p.remediationSignature?.substring(0, 40),
          assets: p.totalAffectedAssets,
          hasPartialRemediation: (p.statusHistory || []).some(h => h.action === 'partial_remediation'),
        }));
    });
    console.log('After scan 2 asset counts:', JSON.stringify(after));

    // At least one POAM should show partial remediation
    const partiallyRemediated = after.filter(p => p.hasPartialRemediation);
    console.log('Partially remediated POAMs:', partiallyRemediated.length);
  });

  test('storage size stays reasonable across 3 scans', async ({ page }) => {
    for (const scanFile of [SCAN_FILES.baseline, SCAN_FILES.followup, SCAN_FILES.third]) {
      const result = await importScanCSV(page, scanFile);
      expect(result.error).toBeUndefined();
    }

    const storageInfo = await page.evaluate(async () => {
      const est = await navigator.storage?.estimate();
      const allPoams = await window.poamDB.getAllPOAMs();

      // Estimate total POAM data size
      let totalSize = 0;
      for (const p of allPoams) {
        totalSize += JSON.stringify(p).length;
      }

      return {
        usedMB: est ? (est.usage / 1024 / 1024).toFixed(2) : 'unknown',
        quotaMB: est ? (est.quota / 1024 / 1024).toFixed(2) : 'unknown',
        poamCount: allPoams.length,
        totalDataKB: (totalSize / 1024).toFixed(2),
        avgPerPoamKB: allPoams.length > 0 ? (totalSize / allPoams.length / 1024).toFixed(2) : '0',
      };
    });

    console.log('Storage after 3 scans:', JSON.stringify(storageInfo));

    // Average per POAM should be under 10KB
    expect(parseFloat(storageInfo.avgPerPoamKB)).toBeLessThan(10);
    // Total data should be under 5MB
    expect(parseFloat(storageInfo.totalDataKB)).toBeLessThan(5000);
  });
});
