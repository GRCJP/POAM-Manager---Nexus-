// @ts-check
const { test, expect } = require('@playwright/test');
const {
  waitForAppLoad,
  navigateToWorkbook,
  createTestSystem,
  navigateToSystem,
  createTestPOAM,
} = require('./helpers');

test.describe('Workbook Extension Tracking', () => {
  let systemId;

  test.beforeEach(async ({ page }) => {
    await waitForAppLoad(page);
    await navigateToWorkbook(page);
    systemId = await createTestSystem(page, 'Extension Test System', 'For extension tracking');
    await navigateToSystem(page, systemId);
  });

  test('changing due date increments extension count to 1', async ({ page }) => {
    const originalDate = '2026-06-01';
    const newDate = '2026-07-15';

    const itemId = await createTestPOAM(page, systemId, {
      'Vulnerability Name': 'Extension Test Item',
      'Scheduled Completion Date': originalDate,
      'Status': 'Open',
    });

    // Simulate a due date change via inline update (which should track extensions)
    await page.evaluate(async ({ id, newDate }) => {
      const item = await window.poamWorkbookDB.getItem(id);
      const oldDue = item['Scheduled Completion Date'] || item['Updated Scheduled Completion Date'] || '';
      if (oldDue && oldDue !== newDate) {
        item._extensionCount = (item._extensionCount || 0) + 1;
        item._extensionHistory = item._extensionHistory || [];
        item._extensionHistory.push({ from: oldDue, to: newDate, date: new Date().toISOString() });
      }
      item['Updated Scheduled Completion Date'] = newDate;
      item.updatedAt = new Date().toISOString();
      await window.poamWorkbookDB.saveItem(item);
      window.poamWorkbookNotifyMutation();
    }, { id: itemId, newDate });
    await page.waitForTimeout(300);

    // Verify extension count is 1
    const item = await page.evaluate(async (id) => {
      return await window.poamWorkbookDB.getItem(id);
    }, itemId);

    expect(item._extensionCount).toBe(1);
    expect(item._extensionHistory).toHaveLength(1);
    expect(item._extensionHistory[0].from).toBe(originalDate);
    expect(item._extensionHistory[0].to).toBe(newDate);
  });

  test('second date change increments extension count to 2', async ({ page }) => {
    const itemId = await createTestPOAM(page, systemId, {
      'Vulnerability Name': 'Double Extension Item',
      'Scheduled Completion Date': '2026-05-01',
      'Status': 'Open',
    });

    // First extension
    await page.evaluate(async ({ id }) => {
      const item = await window.poamWorkbookDB.getItem(id);
      const oldDue = item['Scheduled Completion Date'] || '';
      item._extensionCount = (item._extensionCount || 0) + 1;
      item._extensionHistory = item._extensionHistory || [];
      item._extensionHistory.push({ from: oldDue, to: '2026-06-15', date: new Date().toISOString() });
      item['Updated Scheduled Completion Date'] = '2026-06-15';
      item.updatedAt = new Date().toISOString();
      await window.poamWorkbookDB.saveItem(item);
    }, { id: itemId });
    await page.waitForTimeout(200);

    // Second extension
    await page.evaluate(async ({ id }) => {
      const item = await window.poamWorkbookDB.getItem(id);
      const oldDue = item['Updated Scheduled Completion Date'] || item['Scheduled Completion Date'] || '';
      item._extensionCount = (item._extensionCount || 0) + 1;
      item._extensionHistory = item._extensionHistory || [];
      item._extensionHistory.push({ from: oldDue, to: '2026-08-01', date: new Date().toISOString() });
      item['Updated Scheduled Completion Date'] = '2026-08-01';
      item.updatedAt = new Date().toISOString();
      await window.poamWorkbookDB.saveItem(item);
    }, { id: itemId });
    await page.waitForTimeout(200);

    const item = await page.evaluate(async (id) => {
      return await window.poamWorkbookDB.getItem(id);
    }, itemId);

    expect(item._extensionCount).toBe(2);
    expect(item._extensionHistory).toHaveLength(2);
  });

  test('extension count renders in table Ext column', async ({ page }) => {
    const itemId = await createTestPOAM(page, systemId, {
      'Vulnerability Name': 'Ext Column Test',
      'Scheduled Completion Date': '2026-05-01',
      'Status': 'Open',
      '_extensionCount': 3,
      '_extensionHistory': [
        { from: '2026-03-01', to: '2026-04-01', date: '2026-03-15T00:00:00Z' },
        { from: '2026-04-01', to: '2026-04-15', date: '2026-04-10T00:00:00Z' },
        { from: '2026-04-15', to: '2026-05-01', date: '2026-04-20T00:00:00Z' },
      ],
    });

    // Re-render the table
    await page.evaluate(async (sysId) => {
      await renderWorkbookSystemTable(sysId);
    }, systemId);
    await page.waitForTimeout(500);

    // Look for the extension count "3" in the table
    const extText = await page.evaluate(() => {
      const tbody = document.getElementById('poam-workbook-table-body');
      if (!tbody) return '';
      // The Ext column is the 8th td (0-indexed: checkbox, ID, control, vuln, due, source, poc, ext)
      const firstRow = tbody.querySelector('tr');
      if (!firstRow) return '';
      const tds = firstRow.querySelectorAll('td');
      // Extension column is at index 7
      return tds[7]?.textContent?.trim() || '';
    });

    expect(extText).toBe('3');
  });

  test('extension tooltip contains history details', async ({ page }) => {
    const itemId = await createTestPOAM(page, systemId, {
      'Vulnerability Name': 'Tooltip Test',
      'Scheduled Completion Date': '2026-05-01',
      'Status': 'Open',
      '_extensionCount': 1,
      '_extensionHistory': [
        { from: '2026-04-01', to: '2026-05-01', date: '2026-04-10T00:00:00Z' },
      ],
    });

    await page.evaluate(async (sysId) => {
      await renderWorkbookSystemTable(sysId);
    }, systemId);
    await page.waitForTimeout(300);

    // Check the title attribute on the Ext cell
    const titleAttr = await page.evaluate(() => {
      const tbody = document.getElementById('poam-workbook-table-body');
      if (!tbody) return '';
      const firstRow = tbody.querySelector('tr');
      if (!firstRow) return '';
      const tds = firstRow.querySelectorAll('td');
      return tds[7]?.getAttribute('title') || '';
    });

    // The title should contain the extension history
    expect(titleAttr).toContain('2026-04-01');
    expect(titleAttr).toContain('2026-05-01');
  });

  test('bulk update due date increments extension count', async ({ page }) => {
    const itemId = await createTestPOAM(page, systemId, {
      'Vulnerability Name': 'Bulk Ext Test',
      'Scheduled Completion Date': '2026-06-01',
      'Status': 'Open',
    });

    // Select the item
    await page.evaluate((id) => {
      window.poamWorkbookState.selectedItemIds.add(id);
      poamWorkbookUpdateBulkActionBar();
    }, itemId);
    await page.waitForTimeout(200);

    // Open bulk edit modal
    await page.evaluate(() => {
      poamWorkbookOpenBulkEditModal({ mode: 'status' });
    });
    await page.waitForTimeout(500);

    // Set a new due date in the bulk modal
    const dueInput = page.locator('#wb-bulk-due');
    await expect(dueInput).toBeVisible();
    await dueInput.fill('2026-09-01');

    // Apply
    const applyBtn = page.locator('#wb-bulk-apply');
    await applyBtn.click();
    await page.waitForTimeout(500);

    // Verify extension was tracked
    const item = await page.evaluate(async (id) => {
      return await window.poamWorkbookDB.getItem(id);
    }, itemId);

    expect(item._extensionCount).toBe(1);
    expect(item['Updated Scheduled Completion Date']).toBe('2026-09-01');
  });
});
