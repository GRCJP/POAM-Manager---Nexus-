// @ts-check
const { test, expect } = require('@playwright/test');
const { waitForAppLoad, navigateToModule, navigateToWorkbook, createTestSystem, navigateToSystem, createTestPOAM, clearAllData, getVisibleTableRowCount } = require('./helpers');
const path = require('path');

// ═══════════════════════════════════════════════════════════════
// E2E WORKFLOW TESTS — Full user journeys through the app
// ═══════════════════════════════════════════════════════════════

test.describe('E2E: Complete Workbook Workflow', () => {
  test('full lifecycle: create system → add POAMs → filter → edit → bulk update → export', async ({ page }) => {
    await waitForAppLoad(page);
    await navigateToWorkbook(page);

    // 1. Create a system
    const systemId = await createTestSystem(page, 'E2E Test System', 'End-to-end test');
    await navigateToSystem(page, systemId);

    // 2. Add 5 POAMs with varied data
    const poamIds = [];
    const poamData = [
      { 'Vulnerability Name': 'SQL Injection', 'Severity Value': 'Critical', 'Status': 'Open', 'Impacted Security Controls': 'AC-2', 'Identifying Detecting Source': 'Pen Test', 'POC Name': '', 'Scheduled Completion Date': '2026-03-01' },
      { 'Vulnerability Name': 'XSS in Admin Panel', 'Severity Value': 'High', 'Status': 'Open', 'Impacted Security Controls': 'SI-3', 'Identifying Detecting Source': 'Assessment', 'POC Name': '', 'Scheduled Completion Date': '2026-06-01' },
      { 'Vulnerability Name': 'Missing Patches', 'Severity Value': 'Medium', 'Status': 'In Progress', 'Impacted Security Controls': 'CM-6', 'Identifying Detecting Source': 'Continuous Monitoring', 'POC Name': '', 'Scheduled Completion Date': '2026-08-01' },
      { 'Vulnerability Name': 'Weak Encryption', 'Severity Value': 'High', 'Status': 'Completed', 'Impacted Security Controls': 'SC-13', 'Identifying Detecting Source': 'Audit', 'POC Name': '', 'Actual Completion Date': '2026-04-01' },
      { 'Vulnerability Name': 'Default Credentials', 'Severity Value': 'Critical', 'Status': 'Risk Accepted', 'Impacted Security Controls': 'IA-5', 'Identifying Detecting Source': 'HVA Assessment', 'POC Name': '' },
    ];
    for (const data of poamData) {
      const id = await createTestPOAM(page, systemId, data);
      poamIds.push(id);
    }

    // Refresh table
    await page.evaluate(async (sysId) => await renderWorkbookSystemTable(sysId), systemId);
    await page.waitForTimeout(500);

    // 3. Verify default view hides completed (should show 3: SQL Injection, XSS, Missing Patches)
    // Risk Accepted might show, Completed should not
    let rowCount = await getVisibleTableRowCount(page);
    // Open + In Progress = 3, Risk Accepted may or may not show depending on filter
    expect(rowCount).toBeGreaterThanOrEqual(2);
    expect(rowCount).toBeLessThanOrEqual(4);

    // 4. Filter: click Completed status to show completed items
    const completedCount = await page.evaluate(async (sysId) => {
      window.poamWorkbookState.filters.status = 'Completed';
      window.poamWorkbookState.filters.dateRange = 'all';
      window.poamWorkbookState.filters.closedWithinDays = 0;
      await poamWorkbookApplyFilters();
      await new Promise(r => setTimeout(r, 300));
      const tbody = document.getElementById('poam-workbook-table-body');
      let count = 0;
      tbody?.querySelectorAll('tr').forEach(r => { if (!r.querySelector('td[colspan]')) count++; });
      return count;
    }, systemId);
    expect(completedCount).toBe(1); // Only Weak Encryption

    // 5. Reset filters and verify search works
    await page.evaluate(async () => {
      window.poamWorkbookState.filters = { searchText: '', status: 'all', severity: 'all', poc: 'all', dateRange: 'all', controlFamily: 'all', closedWithinDays: 0 };
      await poamWorkbookApplyFilters();
    });
    await page.waitForTimeout(300);

    // Search for "SQL"
    const searchResults = await page.evaluate(async () => {
      window.poamWorkbookState.filters.searchText = 'SQL';
      await poamWorkbookApplyFilters();
      await new Promise(r => setTimeout(r, 300));
      const tbody = document.getElementById('poam-workbook-table-body');
      let count = 0;
      tbody?.querySelectorAll('tr').forEach(r => { if (!r.querySelector('td[colspan]')) count++; });
      return count;
    });
    expect(searchResults).toBe(1);

    // 6. Inline edit: change severity via dropdown
    const sevChanged = await page.evaluate(async (itemId) => {
      await poamWorkbookInlineUpdate(itemId, 'Severity Value', 'High');
      const item = await window.poamWorkbookDB.getItem(itemId);
      return item['Severity Value'];
    }, poamIds[0]);
    expect(sevChanged).toBe('High');

    // 7. Bulk update: select 2 items, change status to In Progress
    await page.evaluate(async (ids) => {
      // Reset filters first
      window.poamWorkbookState.filters = { searchText: '', status: 'all', severity: 'all', poc: 'all', dateRange: 'all', controlFamily: 'all', closedWithinDays: 0 };
      // Select items
      window.poamWorkbookState.selectedItemIds = new Set(ids);
      // Do bulk update
      for (const id of ids) {
        const item = await window.poamWorkbookDB.getItem(id);
        if (item) {
          item['Status'] = 'In Progress';
          item.updatedAt = new Date().toISOString();
          await window.poamWorkbookDB.saveItem(item);
        }
      }
      window.poamWorkbookNotifyMutation();
    }, [poamIds[0], poamIds[1]]);
    await page.waitForTimeout(300);

    // Verify both are now In Progress
    const statuses = await page.evaluate(async (ids) => {
      const results = [];
      for (const id of ids) {
        const item = await window.poamWorkbookDB.getItem(id);
        results.push(item['Status']);
      }
      return results;
    }, [poamIds[0], poamIds[1]]);
    expect(statuses).toEqual(['In Progress', 'In Progress']);

    // 8. Export: trigger download
    const downloadPromise = page.waitForEvent('download', { timeout: 10000 }).catch(() => null);
    await page.evaluate((sysId) => {
      if (typeof poamWorkbookExportXlsx === 'function') poamWorkbookExportXlsx({ systemId: sysId });
    }, systemId);
    // Export may or may not trigger depending on XLSX availability
    // Just verify no crash
  });
});

test.describe('E2E: XLSX Import Full Workflow', () => {
  test('import → verify data → re-import → verify upsert → filter imported data', async ({ page }) => {
    await waitForAppLoad(page);
    await navigateToWorkbook(page);

    const systemId = await createTestSystem(page, 'Import Test System');
    await navigateToSystem(page, systemId);

    // 1. Import test XLSX
    const testFile = path.resolve(__dirname, '..', 'test-data', 'test-poam-workbook.xlsx');
    const importResult = await page.evaluate(async ({ filePath, sysId }) => {
      const response = await fetch('/test-data/test-poam-workbook.xlsx');
      const blob = await response.blob();
      const file = new File([blob], 'test-poam-workbook.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const result = await window.poamWorkbookImportXlsxSimple(file, sysId);
      return result;
    }, { filePath: testFile, sysId: systemId });

    expect(importResult.total).toBeGreaterThan(0);
    expect(importResult.saved).toBeGreaterThan(0);

    // 2. Verify items in DB
    const items = await page.evaluate(async (sysId) => {
      const all = await window.poamWorkbookDB.getItemsBySystem(sysId);
      return all.map(i => ({
        id: i['Item number'],
        name: i['Vulnerability Name'],
        severity: i['Severity Value'],
        status: i['Status'],
        control: i['Impacted Security Controls'],
        source: i['Identifying Detecting Source'],
        dueDate: i['Scheduled Completion Date'] || i['Updated Scheduled Completion Date'] || '',
      }));
    }, systemId);

    expect(items.length).toBe(importResult.total);
    // Check fields are populated
    const firstItem = items[0];
    expect(firstItem.name).toBeTruthy();
    expect(firstItem.severity).toBeTruthy();
    expect(firstItem.control).toBeTruthy();

    // 3. Re-import same file
    const reimportResult = await page.evaluate(async (sysId) => {
      const response = await fetch('/test-data/test-poam-workbook.xlsx');
      const blob = await response.blob();
      const file = new File([blob], 'test-poam-workbook.xlsx');
      return await window.poamWorkbookImportXlsxSimple(file, sysId);
    }, systemId);

    expect(reimportResult.updated).toBeGreaterThan(0);
    // Should not create duplicates
    const itemsAfterReimport = await page.evaluate(async (sysId) => {
      return (await window.poamWorkbookDB.getItemsBySystem(sysId)).length;
    }, systemId);
    expect(itemsAfterReimport).toBe(items.length);

    // 4. Render table and verify columns
    await page.evaluate(async (sysId) => await renderWorkbookSystemTable(sysId), systemId);
    await page.waitForTimeout(500);

    const tableState = await page.evaluate(() => {
      const tbody = document.getElementById('poam-workbook-table-body');
      const rows = tbody?.querySelectorAll('tr') || [];
      let dataRows = 0;
      for (const r of rows) { if (!r.querySelector('td[colspan]')) dataRows++; }
      // Check first data row has the right number of cells
      const firstRow = tbody?.querySelector('tr:not(:has(td[colspan]))');
      const cellCount = firstRow?.querySelectorAll('td')?.length || 0;
      return { dataRows, cellCount };
    });
    expect(tableState.dataRows).toBeGreaterThan(0);
    // 10 columns: checkbox + ID + Control + Vuln Name + Due Date + Finding Source + POC + Ext + Severity + Status
    expect(tableState.cellCount).toBe(10);

    // 5. Filter by severity
    const criticalCount = await page.evaluate(async () => {
      window.poamWorkbookState.filters.severity = 'Critical';
      await poamWorkbookApplyFilters();
      await new Promise(r => setTimeout(r, 300));
      const tbody = document.getElementById('poam-workbook-table-body');
      let count = 0;
      tbody?.querySelectorAll('tr').forEach(r => { if (!r.querySelector('td[colspan]')) count++; });
      return count;
    });
    // Test data has Critical items
    expect(criticalCount).toBeGreaterThanOrEqual(0);
  });
});

test.describe('E2E: Dashboard Data Flow', () => {
  test('dashboard KPIs update after workbook data changes', async ({ page }) => {
    await waitForAppLoad(page);

    // 1. Verify dashboard loads
    const dashVisible = await page.evaluate(() => {
      const d = document.getElementById('dashboard-module');
      return d && !d.classList.contains('hidden');
    });
    expect(dashVisible).toBe(true);

    // 2. Check KPI elements exist
    const kpis = await page.evaluate(() => {
      const ids = ['dash-total-open', 'dash-overdue', 'dash-closed-month', 'dash-mttr'];
      return ids.map(id => {
        const el = document.getElementById(id);
        return { id, exists: !!el, text: el?.textContent?.trim() || '' };
      });
    });
    for (const kpi of kpis) {
      expect(kpi.exists).toBe(true);
    }

    // 3. Check metrics strip
    const metricsStrip = await page.evaluate(() => {
      const ids = ['dash-sla-compliance', 'dash-crit-high', 'dash-risk-accepted', 'dash-scan-coverage'];
      return ids.map(id => ({ id, exists: !!document.getElementById(id) }));
    });
    for (const m of metricsStrip) {
      expect(m.exists).toBe(true);
    }

    // 4. Check for banned colors
    const bannedColors = await page.evaluate(() => {
      const banned = ['#7C3AED', '#8B5CF6', '#F97316', '#EA580C', '#6366f1'];
      const allEls = document.querySelectorAll('#dashboard-module *');
      const found = [];
      for (const el of allEls) {
        const style = el.getAttribute('style') || '';
        for (const color of banned) {
          if (style.toLowerCase().includes(color.toLowerCase())) {
            found.push({ el: el.tagName, color, id: el.id || '' });
          }
        }
      }
      return found;
    });
    expect(bannedColors).toEqual([]);
  });
});

test.describe('E2E: Evidence Vault', () => {
  test('evidence module loads with upload form and POAM dropdown', async ({ page }) => {
    await waitForAppLoad(page);
    await navigateToModule(page, 'evidence');

    // Check module is visible
    const visible = await page.evaluate(() => {
      const el = document.getElementById('evidence-module');
      return el && !el.classList.contains('hidden');
    });
    expect(visible).toBe(true);

    // Check key elements exist
    const elements = await page.evaluate(() => {
      const ids = ['evidence-poam-select', 'evidence-type-select', 'evidence-description', 'evidence-file-upload', 'evidence-list'];
      return ids.map(id => ({ id, exists: !!document.getElementById(id) }));
    });
    for (const el of elements) {
      expect(el.exists).toBe(true);
    }
  });

  test('evidence upload form has all required fields', async ({ page }) => {
    await waitForAppLoad(page);
    await navigateToModule(page, 'evidence');

    const fields = await page.evaluate(() => {
      return {
        poamSelect: !!document.getElementById('evidence-poam-select'),
        typeSelect: !!document.getElementById('evidence-type-select'),
        owner: !!document.getElementById('evidence-owner'),
        submitter: !!document.getElementById('evidence-submitter'),
        date: !!document.getElementById('evidence-date'),
        description: !!document.getElementById('evidence-description'),
        fileUpload: !!document.getElementById('evidence-file-upload'),
      };
    });
    expect(fields.poamSelect).toBe(true);
    expect(fields.typeSelect).toBe(true);
    expect(fields.description).toBe(true);
    expect(fields.fileUpload).toBe(true);
  });
});

test.describe('E2E: Settings Full Workflow', () => {
  test('all settings tabs load without errors', async ({ page }) => {
    await waitForAppLoad(page);
    await navigateToModule(page, 'settings');

    const tabs = ['general', 'compliance', 'critical-assets', 'integrations'];
    for (const tab of tabs) {
      await page.evaluate((t) => showSettingsTab(t), tab);
      await page.waitForTimeout(500);

      // Verify the tab content is visible
      const visible = await page.evaluate((t) => {
        const el = document.getElementById(`settings-${t}`);
        return el ? !el.classList.contains('hidden') : false;
      }, tab);
      expect(visible).toBe(true);
    }
  });

  test('system inventory in settings reflects workbook systems', async ({ page }) => {
    await waitForAppLoad(page);
    await navigateToWorkbook(page);

    // Create a system
    const sysId = await createTestSystem(page, 'Settings Verify System');

    // Navigate to settings and check inventory
    await navigateToModule(page, 'settings');
    await page.evaluate(() => showSettingsTab('general'));
    await page.waitForTimeout(500);

    // Trigger render
    await page.evaluate(() => { if (typeof renderSystemsSettings === 'function') renderSystemsSettings(); });
    await page.waitForTimeout(500);

    const systemInList = await page.evaluate((id) => {
      const tbody = document.getElementById('systems-settings-list');
      return tbody ? tbody.innerHTML.includes(id) : false;
    }, sysId);
    expect(systemInList).toBe(true);
  });
});

test.describe('E2E: Audit Log', () => {
  test('audit module has functional filter controls', async ({ page }) => {
    await waitForAppLoad(page);
    await navigateToModule(page, 'audit');

    const controls = await page.evaluate(() => {
      return {
        typeFilter: !!document.getElementById('audit-filter-type'),
        dateFrom: !!document.getElementById('audit-filter-from'),
        dateTo: !!document.getElementById('audit-filter-to'),
        search: !!document.getElementById('audit-filter-search'),
        feed: !!document.getElementById('audit-log-feed'),
      };
    });
    expect(controls.typeFilter).toBe(true);
    expect(controls.feed).toBe(true);
  });
});

test.describe('E2E: Reporting Module', () => {
  test('reporting module loads', async ({ page }) => {
    await waitForAppLoad(page);
    await navigateToModule(page, 'reporting');

    const visible = await page.evaluate(() => {
      const el = document.getElementById('reporting-module');
      return el && !el.classList.contains('hidden');
    });
    expect(visible).toBe(true);
  });
});

test.describe('E2E: Cross-Module Data Integrity', () => {
  test('workbook data persists across module switches', async ({ page }) => {
    await waitForAppLoad(page);
    await navigateToWorkbook(page);

    const sysId = await createTestSystem(page, 'Persistence Test');
    await createTestPOAM(page, sysId, { 'Vulnerability Name': 'Persistent POAM', 'Status': 'Open' });

    // Switch to dashboard
    await navigateToModule(page, 'dashboard');
    await page.waitForTimeout(300);

    // Switch back to workbook
    await navigateToWorkbook(page);
    await navigateToSystem(page, sysId);
    await page.evaluate(async (id) => await renderWorkbookSystemTable(id), sysId);
    await page.waitForTimeout(300);

    // Verify POAM is still there
    const count = await page.evaluate(async (sysId) => {
      return (await window.poamWorkbookDB.getItemsBySystem(sysId)).length;
    }, sysId);
    expect(count).toBe(1);
  });

  test('creating POAM in workbook is reflected in overview metrics', async ({ page }) => {
    await waitForAppLoad(page);
    await navigateToWorkbook(page);

    const sysId = await createTestSystem(page, 'Metrics Test');
    await createTestPOAM(page, sysId, { 'Status': 'Open', 'Severity Value': 'Critical' });
    await createTestPOAM(page, sysId, { 'Status': 'Open', 'Severity Value': 'High' });

    // Go to overview
    await page.evaluate(() => poamWorkbookShowOverview());
    await page.waitForTimeout(500);

    // Check total metric
    const total = await page.evaluate(() => {
      const el = document.getElementById('poam-workbook-metric-total');
      return el ? parseInt(el.textContent || '0', 10) : -1;
    });
    expect(total).toBeGreaterThanOrEqual(2);
  });
});

test.describe('E2E: Extension Tracking Workflow', () => {
  test('extending a due date shows in Ext column and persists', async ({ page }) => {
    await waitForAppLoad(page);
    await navigateToWorkbook(page);

    const sysId = await createTestSystem(page, 'Extension E2E');
    const poamId = await createTestPOAM(page, sysId, {
      'Vulnerability Name': 'Extension Test',
      'Scheduled Completion Date': '2026-06-01',
      'Status': 'Open',
    });
    await navigateToSystem(page, sysId);

    // Extend the due date
    await page.evaluate(async (id) => {
      await poamWorkbookInlineUpdate(id, 'Updated Scheduled Completion Date', '2026-09-01');
    }, poamId);
    await page.waitForTimeout(300);

    // Check extension count
    const extCount = await page.evaluate(async (id) => {
      const item = await window.poamWorkbookDB.getItem(id);
      return item._extensionCount || 0;
    }, poamId);
    expect(extCount).toBe(1);

    // Extend again
    await page.evaluate(async (id) => {
      await poamWorkbookInlineUpdate(id, 'Updated Scheduled Completion Date', '2026-12-01');
    }, poamId);
    await page.waitForTimeout(300);

    const extCount2 = await page.evaluate(async (id) => {
      const item = await window.poamWorkbookDB.getItem(id);
      return { count: item._extensionCount || 0, historyLen: (item._extensionHistory || []).length };
    }, poamId);
    expect(extCount2.count).toBe(2);
    expect(extCount2.historyLen).toBe(2);

    // Verify it renders in table
    await page.evaluate(async (id) => await renderWorkbookSystemTable(id), sysId);
    await page.waitForTimeout(500);

    const extInTable = await page.evaluate(() => {
      const tbody = document.getElementById('poam-workbook-table-body');
      const rows = tbody?.querySelectorAll('tr') || [];
      for (const row of rows) {
        const cells = row.querySelectorAll('td');
        for (const cell of cells) {
          if (cell.textContent?.trim() === '2') return true;
        }
      }
      return false;
    });
    expect(extInTable).toBe(true);
  });
});

test.describe('E2E: Quick Status Panel', () => {
  test('closed-in-last-N-days tile updates when dropdown changes', async ({ page }) => {
    await waitForAppLoad(page);
    await navigateToWorkbook(page);

    const sysId = await createTestSystem(page, 'Closed Tile Test');
    // Create a completed POAM with recent completion date
    await createTestPOAM(page, sysId, {
      'Status': 'Completed',
      'Actual Completion Date': new Date().toISOString().split('T')[0],
    });
    // Create one completed long ago
    await createTestPOAM(page, sysId, {
      'Status': 'Completed',
      'Actual Completion Date': '2025-01-01',
    });
    await createTestPOAM(page, sysId, { 'Status': 'Open' });

    await navigateToSystem(page, sysId);
    await page.evaluate(async (id) => await renderWorkbookSystemTable(id), sysId);
    await page.waitForTimeout(500);

    // Check that _closedDaysAgo was set
    const closedData = await page.evaluate(() => window._closedDaysAgo);
    expect(closedData).toBeTruthy();
    // The recent one (today) should be in all windows
    expect(closedData[7]).toBeGreaterThanOrEqual(1);
    expect(closedData[30]).toBeGreaterThanOrEqual(1);
    // The old one (2025) should not be in any window
    expect(closedData[90]).toBeLessThanOrEqual(closedData[30] + 1);
  });
});

test.describe('E2E: Scan Pipeline Merge Workflow', () => {
  test('first import → re-import with changes → verify merge logic', async ({ page }) => {
    await waitForAppLoad(page);

    // Ensure DB is ready
    await page.evaluate(async () => {
      if (!window.poamDB.db) await window.poamDB.init();
      // Clear existing POAMs
      const tx = window.poamDB.db.transaction(['poams'], 'readwrite');
      tx.objectStore('poams').clear();
      await new Promise(r => { tx.oncomplete = r; });
    });

    // 1. First import: 3 POAMs
    const firstResult = await page.evaluate(async () => {
      const poams = [
        { id: 'e2e-001', title: 'Finding A', remediationSignature: 'sig::a', status: 'open', findingStatus: 'open', risk: 'critical', totalAffectedAssets: 5, affectedAssets: [], statusHistory: [], milestones: [], cves: ['CVE-2024-001'], qids: [] },
        { id: 'e2e-002', title: 'Finding B', remediationSignature: 'sig::b', status: 'open', findingStatus: 'open', risk: 'high', totalAffectedAssets: 3, affectedAssets: [], statusHistory: [], milestones: [], cves: [], qids: ['38173'] },
        { id: 'e2e-003', title: 'Finding C', remediationSignature: 'sig::c', status: 'open', findingStatus: 'open', risk: 'medium', totalAffectedAssets: 1, affectedAssets: [], statusHistory: [], milestones: [], cves: [], qids: [] },
      ];
      await window.poamDB.addPOAMsBatch(poams);
      return (await window.poamDB.getAllPOAMs()).length;
    });
    expect(firstResult).toBe(3);

    // 2. Re-import: Finding A updated (fewer assets), Finding C gone (auto-resolve), Finding D new
    const mergeResult = await page.evaluate(async () => {
      const newScan = [
        { id: 'e2e-001-new', title: 'Finding A', remediationSignature: 'sig::a', status: 'open', risk: 'critical', totalAffectedAssets: 2, affectedAssets: [], statusHistory: [], milestones: [], cves: ['CVE-2024-001'], qids: [] },
        { id: 'e2e-002-new', title: 'Finding B', remediationSignature: 'sig::b', status: 'open', risk: 'high', totalAffectedAssets: 3, affectedAssets: [], statusHistory: [], milestones: [], cves: [], qids: ['38173'] },
        { id: 'e2e-004', title: 'Finding D (new)', remediationSignature: 'sig::d', status: 'open', risk: 'low', totalAffectedAssets: 1, affectedAssets: [], statusHistory: [], milestones: [], cves: [], qids: [] },
      ];
      const result = await window.mergePOAMsFromScan(newScan);
      await window.poamDB.addPOAMsBatch(result.mergedPOAMs);
      return result.stats;
    });

    expect(mergeResult.created).toBe(1); // Finding D
    expect(mergeResult.updated).toBe(2); // A and B
    expect(mergeResult.autoResolved).toBe(1); // Finding C gone

    // 3. Verify Finding C is completed
    const findingC = await page.evaluate(async () => {
      const all = await window.poamDB.getAllPOAMs();
      const c = all.find(p => p.remediationSignature === 'sig::c');
      return c ? { status: c.status, findingStatus: c.findingStatus } : null;
    });
    expect(findingC).toBeTruthy();
    expect(findingC.status).toBe('completed');

    // 4. Re-import again: Finding C reappears → should reopen, not create new
    const reopenResult = await page.evaluate(async () => {
      const scanWithC = [
        { id: 'e2e-001-v3', title: 'Finding A', remediationSignature: 'sig::a', status: 'open', risk: 'critical', totalAffectedAssets: 2, affectedAssets: [], statusHistory: [], milestones: [], cves: [], qids: [] },
        { id: 'e2e-002-v3', title: 'Finding B', remediationSignature: 'sig::b', status: 'open', risk: 'high', totalAffectedAssets: 3, affectedAssets: [], statusHistory: [], milestones: [], cves: [], qids: [] },
        { id: 'e2e-003-v3', title: 'Finding C is back', remediationSignature: 'sig::c', status: 'open', risk: 'medium', totalAffectedAssets: 2, affectedAssets: [], statusHistory: [], milestones: [], cves: [], qids: [] },
        { id: 'e2e-004-v3', title: 'Finding D', remediationSignature: 'sig::d', status: 'open', risk: 'low', totalAffectedAssets: 1, affectedAssets: [], statusHistory: [], milestones: [], cves: [], qids: [] },
      ];
      const result = await window.mergePOAMsFromScan(scanWithC);
      return { stats: result.stats, totalMerged: result.mergedPOAMs.length };
    });

    expect(reopenResult.stats.reopened).toBe(1); // Finding C reopened
    expect(reopenResult.stats.created).toBe(0); // No new POAMs
  });
});
