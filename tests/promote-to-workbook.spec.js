// @ts-check
const { test, expect } = require('@playwright/test');
const { waitForAppLoad, navigateToModule, navigateToWorkbook, createTestSystem, navigateToSystem, clearAllData } = require('./helpers');

// ═══════════════════════════════════════════════════════════════
// PROMOTE FINDING TO POA&M WORKBOOK TESTS
// ═══════════════════════════════════════════════════════════════

test.describe('Promote Finding to Workbook', () => {

  test.beforeEach(async ({ page }) => {
    await waitForAppLoad(page);
  });

  test('single finding promotion: creates workbook item and marks finding as promoted', async ({ page }) => {
    // 1. Seed a finding into poamDB
    const findingId = await page.evaluate(async () => {
      if (!window.poamDB) window.poamDB = poamDB;
      if (!poamDB.db) await poamDB.init();

      const id = `FIND-TEST-${Date.now()}`;
      const finding = {
        id,
        vulnerabilityName: 'Test SQL Injection for Promotion',
        findingDescription: 'A critical SQL injection flaw found in login form.',
        riskLevel: 'critical',
        risk: 'critical',
        findingStatus: 'open',
        status: 'open',
        source: 'Qualys Scan',
        controlFamily: 'SI',
        dueDate: '2026-06-01',
        poc: 'Application Security Team',
        firstDetected: '2026-03-01',
        affectedAssets: [
          { name: 'web-server-01', ipv4: '10.0.0.1', os: 'Linux', status: 'affected' },
          { name: 'web-server-02', ipv4: '10.0.0.2', os: 'Linux', status: 'affected' },
          { name: 'api-gw-01', ipv4: '10.0.0.3', os: 'Linux', status: 'affected' }
        ],
        totalAffectedAssets: 3,
        mitigation: 'Parameterize all SQL queries',
        title: 'Test SQL Injection for Promotion'
      };
      await poamDB.savePOAM(finding);
      return id;
    });

    // 2. Navigate to workbook to ensure DB is initialized, then create a system
    await navigateToWorkbook(page);
    const systemId = await createTestSystem(page, 'Promote Test System', 'Test system for promotion');

    // 3. Navigate to Findings module
    await navigateToModule(page, 'vulnerability-tracking');
    // Wait for the table to render
    await page.waitForFunction(() => {
      const tbody = document.getElementById('vulnerability-poam-list');
      return tbody && tbody.querySelectorAll('tr').length > 0;
    }, { timeout: 15000 });
    await page.waitForTimeout(500);

    // 4. Find the Promote button for our finding and click it
    const promoteBtn = page.locator(`button[onclick="promoteToWorkbook('${findingId}')"]`);
    await expect(promoteBtn).toBeVisible({ timeout: 10000 });
    await promoteBtn.click();

    // 5. Verify the modal appears
    const modal = page.locator('#promote-to-workbook-modal');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // 6. Select the target system
    await page.selectOption('#promote-system-select', systemId);

    // 7. Click confirm
    await page.click('#promote-modal-confirm');
    await page.waitForTimeout(1000);

    // 8. Verify the modal closed
    await expect(modal).not.toBeVisible({ timeout: 5000 });

    // 9. Verify the finding now shows "Promoted" badge
    const promotedBadge = page.locator(`tr:has(td:text("${findingId}")) >> text=Promoted`);
    // The finding row should contain "Promoted" text
    const findingRow = await page.evaluate((fid) => {
      const tbody = document.getElementById('vulnerability-poam-list');
      if (!tbody) return null;
      const rows = tbody.querySelectorAll('tr');
      for (const r of rows) {
        if (r.innerHTML.includes(fid)) {
          return r.innerHTML;
        }
      }
      return null;
    }, findingId);
    expect(findingRow).not.toBeNull();
    expect(findingRow).toContain('Promoted');

    // 10. Verify the finding in the DB is marked as promoted
    const promotedState = await page.evaluate(async (fid) => {
      const f = await poamDB.getPOAM(fid);
      return {
        promotedToWorkbook: f?.promotedToWorkbook,
        promotedSystemId: f?.promotedSystemId,
        hasPromotedDate: !!f?.promotedDate
      };
    }, findingId);
    expect(promotedState.promotedToWorkbook).toBe(true);
    expect(promotedState.promotedSystemId).toBe(systemId);
    expect(promotedState.hasPromotedDate).toBe(true);

    // 11. Verify the workbook item was created
    const workbookItem = await page.evaluate(async (sysId) => {
      const items = await window.poamWorkbookDB.getItemsBySystem(sysId);
      const promoted = items.find(i => i['Vulnerability Name'] === 'Test SQL Injection for Promotion');
      if (!promoted) return null;
      return {
        name: promoted['Vulnerability Name'],
        severity: promoted['Severity Value'],
        status: promoted['Status'],
        source: promoted['Identifying Detecting Source'],
        controls: promoted['Impacted Security Controls'],
        poc: promoted['POC Name'],
        mitigations: promoted['Mitigations'],
        affected: promoted['Affected Components/URLs'],
        hasItemNumber: !!promoted['Item number']
      };
    }, systemId);
    expect(workbookItem).not.toBeNull();
    expect(workbookItem.name).toBe('Test SQL Injection for Promotion');
    expect(workbookItem.severity).toBe('Critical');
    expect(workbookItem.status).toBe('Open');
    expect(workbookItem.source).toBe('Qualys Scan');
    expect(workbookItem.controls).toBe('SI');
    expect(workbookItem.poc).toBe('Application Security Team');
    expect(workbookItem.mitigations).toBe('Parameterize all SQL queries');
    expect(workbookItem.affected).toContain('web-server-01');
    expect(workbookItem.hasItemNumber).toBe(true);
  });

  test('already-promoted finding shows badge and cannot be promoted again', async ({ page }) => {
    // Seed an already-promoted finding
    const findingId = await page.evaluate(async () => {
      if (!poamDB.db) await poamDB.init();
      const id = `FIND-PROMOTED-${Date.now()}`;
      const finding = {
        id,
        vulnerabilityName: 'Already Promoted Finding',
        findingDescription: 'This was already promoted.',
        riskLevel: 'medium',
        risk: 'medium',
        findingStatus: 'open',
        status: 'open',
        title: 'Already Promoted Finding',
        promotedToWorkbook: true,
        promotedDate: new Date().toISOString(),
        promotedSystemId: 'default'
      };
      await poamDB.savePOAM(finding);
      return id;
    });

    await navigateToModule(page, 'vulnerability-tracking');
    await page.waitForFunction(() => {
      const tbody = document.getElementById('vulnerability-poam-list');
      return tbody && tbody.querySelectorAll('tr').length > 0;
    }, { timeout: 15000 });
    await page.waitForTimeout(500);

    // Check that the row has "Promoted" badge instead of "Promote" button
    const rowHtml = await page.evaluate((fid) => {
      const tbody = document.getElementById('vulnerability-poam-list');
      if (!tbody) return '';
      for (const r of tbody.querySelectorAll('tr')) {
        if (r.innerHTML.includes(fid)) return r.innerHTML;
      }
      return '';
    }, findingId);

    expect(rowHtml).toContain('Promoted');
    expect(rowHtml).not.toContain(`promoteToWorkbook('${findingId}')`);
  });

  test('bulk promote: promotes multiple findings at once', async ({ page }) => {
    // Seed multiple findings
    const findingIds = await page.evaluate(async () => {
      if (!poamDB.db) await poamDB.init();
      const ids = [];
      for (let i = 0; i < 3; i++) {
        const id = `FIND-BULK-${Date.now()}-${i}`;
        await poamDB.savePOAM({
          id,
          vulnerabilityName: `Bulk Test Finding ${i}`,
          findingDescription: `Test finding ${i} for bulk promotion`,
          riskLevel: ['critical', 'high', 'medium'][i],
          risk: ['critical', 'high', 'medium'][i],
          findingStatus: 'open',
          status: 'open',
          title: `Bulk Test Finding ${i}`,
          dueDate: '2026-07-01'
        });
        ids.push(id);
      }
      return ids;
    });

    // Create a target system
    await navigateToWorkbook(page);
    const systemId = await createTestSystem(page, 'Bulk Promote System', 'Bulk test');

    await navigateToModule(page, 'vulnerability-tracking');
    await page.waitForFunction(() => {
      const tbody = document.getElementById('vulnerability-poam-list');
      return tbody && tbody.querySelectorAll('tr').length >= 3;
    }, { timeout: 15000 });
    await page.waitForTimeout(500);

    // Select the findings using JS (since checkboxes are rendered dynamically)
    await page.evaluate((ids) => {
      ids.forEach(id => {
        selectedPOAMs.add(id);
      });
      updateBulkActionsToolbar();
    }, findingIds);

    // Verify bulk toolbar shows
    await expect(page.locator('#bulk-actions-toolbar')).toBeVisible({ timeout: 5000 });

    // Click "Promote Selected" — use the onclick handler directly to avoid visibility issues
    await page.evaluate(() => {
      bulkPromoteToWorkbook();
    });

    // Verify bulk promotion modal appears
    const bulkModal = page.locator('#bulk-promote-modal');
    await expect(bulkModal).toBeVisible({ timeout: 5000 });

    // Select system
    await page.selectOption('#bulk-promote-system-select', systemId);

    // Click confirm
    await page.click('#bulk-promote-confirm');
    await page.waitForTimeout(2000);

    // Verify all findings are now promoted
    const promotedCount = await page.evaluate(async (ids) => {
      let count = 0;
      for (const id of ids) {
        const f = await poamDB.getPOAM(id);
        if (f?.promotedToWorkbook) count++;
      }
      return count;
    }, findingIds);
    expect(promotedCount).toBe(3);

    // Verify workbook items were created
    const wbItemCount = await page.evaluate(async (sysId) => {
      const items = await window.poamWorkbookDB.getItemsBySystem(sysId);
      return items.filter(i => i['Vulnerability Name']?.startsWith('Bulk Test Finding')).length;
    }, systemId);
    expect(wbItemCount).toBe(3);
  });
});
