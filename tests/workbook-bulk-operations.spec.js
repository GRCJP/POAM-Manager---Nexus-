// @ts-check
const { test, expect } = require('@playwright/test');
const {
  waitForAppLoad,
  navigateToWorkbook,
  createTestSystem,
  navigateToSystem,
  createTestPOAM,
  getVisibleTableRowCount,
} = require('./helpers');

test.describe('Workbook Bulk Operations', () => {
  let systemId;
  let itemIds;

  test.beforeEach(async ({ page }) => {
    await waitForAppLoad(page);
    await navigateToWorkbook(page);
    systemId = await createTestSystem(page, 'Bulk Ops System', 'For bulk ops tests');

    itemIds = [];
    for (let i = 0; i < 4; i++) {
      const id = await createTestPOAM(page, systemId, {
        'Vulnerability Name': `Bulk Test Item ${i + 1}`,
        'Severity Value': i % 2 === 0 ? 'High' : 'Medium',
        'Status': 'Open',
      });
      itemIds.push(id);
    }

    await navigateToSystem(page, systemId);
  });

  test('select multiple POAMs via checkboxes shows bulk action bar', async ({ page }) => {
    // Select two items
    await page.evaluate((ids) => {
      ids.forEach(id => {
        window.poamWorkbookState.selectedItemIds.add(id);
      });
      poamWorkbookUpdateBulkActionBar();
    }, [itemIds[0], itemIds[1]]);
    await page.waitForTimeout(300);

    // Bulk action bar should be visible
    const bar = page.locator('#poam-workbook-bulk-actions');
    await expect(bar).not.toHaveClass(/hidden/);

    // Count should show "2"
    const countEl = page.locator('#poam-workbook-selected-count');
    await expect(countEl).toHaveText('2');
  });

  test('bulk update status changes selected items', async ({ page }) => {
    // Select first two items
    await page.evaluate((ids) => {
      ids.forEach(id => window.poamWorkbookState.selectedItemIds.add(id));
      poamWorkbookUpdateBulkActionBar();
    }, [itemIds[0], itemIds[1]]);
    await page.waitForTimeout(300);

    // Open bulk edit modal
    await page.evaluate(() => {
      poamWorkbookOpenBulkEditModal({ mode: 'status' });
    });
    await page.waitForTimeout(500);

    // Set status to "In Progress"
    const statusSelect = page.locator('#wb-bulk-status');
    await expect(statusSelect).toBeVisible();
    await statusSelect.selectOption('In Progress');

    // Click Apply
    const applyBtn = page.locator('#wb-bulk-apply');
    await applyBtn.click();
    await page.waitForTimeout(500);

    // Verify the items were updated in DB
    const updatedItems = await page.evaluate(async (ids) => {
      const results = [];
      for (const id of ids) {
        const item = await window.poamWorkbookDB.getItem(id);
        results.push({ id: item.id, status: item['Status'] });
      }
      return results;
    }, [itemIds[0], itemIds[1]]);

    expect(updatedItems[0].status).toBe('In Progress');
    expect(updatedItems[1].status).toBe('In Progress');

    // Third item should still be Open
    const thirdItem = await page.evaluate(async (id) => {
      return await window.poamWorkbookDB.getItem(id);
    }, itemIds[2]);
    expect(thirdItem['Status']).toBe('Open');
  });

  test('select-all checkbox selects all items', async ({ page }) => {
    // Use the toggle-select-all function
    await page.evaluate(async () => {
      await poamWorkbookToggleSelectAll(true);
    });
    await page.waitForTimeout(500);

    const selectedCount = await page.evaluate(() => {
      return window.poamWorkbookState.selectedItemIds.size;
    });

    expect(selectedCount).toBe(4);

    // Bulk bar should show "4"
    const countEl = page.locator('#poam-workbook-selected-count');
    await expect(countEl).toHaveText('4');
  });

  test('bulk delete removes selected items', async ({ page }) => {
    // Select all items
    await page.evaluate(async () => {
      await poamWorkbookToggleSelectAll(true);
    });
    await page.waitForTimeout(300);

    // Accept the confirm dialog
    page.on('dialog', dialog => dialog.accept());

    // Perform bulk delete
    await page.evaluate(async () => {
      await poamWorkbookBulkDeleteSelected();
    });
    await page.waitForTimeout(500);

    // Verify items are gone from DB
    const remainingItems = await page.evaluate(async (sysId) => {
      return await window.poamWorkbookDB.getItemsBySystem(sysId);
    }, systemId);

    expect(remainingItems.length).toBe(0);

    // Table should show empty state
    const rowCount = await getVisibleTableRowCount(page);
    expect(rowCount).toBe(0);
  });

  test('deselecting items updates bulk action bar', async ({ page }) => {
    // Select all
    await page.evaluate(async () => {
      await poamWorkbookToggleSelectAll(true);
    });
    await page.waitForTimeout(300);

    // Deselect all
    await page.evaluate(async () => {
      await poamWorkbookToggleSelectAll(false);
    });
    await page.waitForTimeout(300);

    // Bulk action bar should be hidden
    const bar = page.locator('#poam-workbook-bulk-actions');
    await expect(bar).toHaveClass(/hidden/);

    const selectedCount = await page.evaluate(() => {
      return window.poamWorkbookState.selectedItemIds.size;
    });
    expect(selectedCount).toBe(0);
  });
});
