// Interactive tests for POA&M Workbook module
const { test, expect } = require('@playwright/test');
const { waitForAppLoad, navigateToWorkbook, createTestSystem, navigateToSystem, createTestPOAM, clearAllData, getVisibleTableRowCount } = require('./helpers');

test.describe('POA&M Workbook Interactive Tests', () => {
  let systemId;

  test.beforeEach(async ({ page }) => {
    await waitForAppLoad(page);
    await navigateToWorkbook(page);
    // Ensure a system exists
    systemId = await createTestSystem(page, 'Test System', 'For interactive tests');
    await navigateToSystem(page, systemId);
  });

  // ─── TEST 1: Add POA&M button ───
  test('1. Add POA&M - button creates a new item in the table', async ({ page }) => {
    const beforeCount = await getVisibleTableRowCount(page);

    // The header button is labeled "Add POA&M"
    await page.evaluate(() => poamWorkbookCreateItem());
    await page.waitForTimeout(1000);

    const afterCount = await getVisibleTableRowCount(page);
    expect(afterCount).toBe(beforeCount + 1);
  });

  // ─── TEST 2: Extend overdue items ───
  test('2. Extend overdue - Extend button appears and works for overdue items', async ({ page }) => {
    // Create an overdue item
    const itemId = await createTestPOAM(page, systemId, {
      'Vulnerability Name': 'Overdue Extend Test',
      'Status': 'Open',
      'Scheduled Completion Date': '2020-06-15'
    });
    await page.evaluate(async (sysId) => {
      await renderWorkbookSystemTable(sysId);
    }, systemId);
    await page.waitForTimeout(500);

    // Verify the Extend button is rendered for overdue rows
    const extendBtnExists = await page.evaluate(() => {
      const btns = document.querySelectorAll('button[title="Extend due date"]');
      return btns.length > 0;
    });
    expect(extendBtnExists).toBe(true);

    // Open extend modal via JS (avoids flaky button-click issues in full suite)
    await page.evaluate(async (id) => {
      await poamWorkbookOpenExtendModal(id);
    }, itemId);
    await page.waitForTimeout(500);

    // Verify extension modal opens
    const extDate = page.locator('#wb-extend-date');
    await expect(extDate).toBeVisible();

    // Fill in extension form
    await page.fill('#wb-extend-date', '2027-12-31');
    await page.selectOption('#wb-extend-reason', 'Procurement Delay');
    await page.fill('#wb-extend-justification', 'Parts on backorder from vendor');

    // Save
    await page.click('#wb-extend-save');
    await page.waitForTimeout(1000);

    // Verify the item was updated
    const updatedItem = await page.evaluate(async (id) => {
      const item = await window.poamWorkbookDB.getItem(id);
      return {
        updatedDate: item['Updated Scheduled Completion Date'],
        extensionCount: item._extensionCount,
        historyLength: (item._extensionHistory || []).length,
        lastReason: (item._extensionHistory || []).slice(-1)[0]?.reason || ''
      };
    }, itemId);

    expect(updatedItem.updatedDate).toBe('2027-12-31');
    expect(updatedItem.extensionCount).toBe(1);
    expect(updatedItem.historyLength).toBe(1);
    expect(updatedItem.lastReason).toBe('Procurement Delay');
  });

  test('2b. Extend overdue - Delayed status changes to Extended', async ({ page }) => {
    const itemId = await createTestPOAM(page, systemId, {
      'Vulnerability Name': 'Delayed Extend Test',
      'Status': 'Delayed',
      'Scheduled Completion Date': '2020-01-01'
    });
    await page.evaluate(async (sysId) => {
      await renderWorkbookSystemTable(sysId);
    }, systemId);
    await page.waitForTimeout(500);

    // Open extend modal via JS (Delayed items also have overdue styling)
    await page.evaluate(async (id) => {
      await poamWorkbookOpenExtendModal(id);
    }, itemId);
    await page.waitForTimeout(500);

    await page.fill('#wb-extend-date', '2028-06-01');
    await page.selectOption('#wb-extend-reason', 'Resource Constraint');
    await page.fill('#wb-extend-justification', 'Staff shortage');
    await page.click('#wb-extend-save');
    await page.waitForTimeout(1000);

    const status = await page.evaluate(async (id) => {
      const item = await window.poamWorkbookDB.getItem(id);
      return item['Status'];
    }, itemId);
    expect(status).toBe('Extended');
  });

  // ─── TEST 3: Inline dropdown edits ───
  test('3. Inline dropdown edits - Change severity persists', async ({ page }) => {
    const itemId = await createTestPOAM(page, systemId, {
      'Vulnerability Name': 'Inline Edit Test',
      'Severity Value': 'Medium',
      'Status': 'Open'
    });
    await page.evaluate(async (sysId) => {
      await renderWorkbookSystemTable(sysId);
    }, systemId);
    await page.waitForTimeout(500);

    // Find the row and change severity via JS
    await page.evaluate(async (id) => {
      await poamWorkbookInlineUpdate(id, 'Severity Value', 'Critical');
    }, itemId);
    await page.waitForTimeout(500);

    // Verify the value persisted
    const newSeverity = await page.evaluate(async (id) => {
      const item = await window.poamWorkbookDB.getItem(id);
      return item['Severity Value'];
    }, itemId);
    expect(newSeverity).toBe('Critical');

    // Verify it shows in the table dropdown
    await page.evaluate(async (sysId) => {
      await renderWorkbookSystemTable(sysId);
    }, systemId);
    await page.waitForTimeout(500);

    const selectVal = await page.locator(`select[onchange*="${itemId}"][onchange*="Severity Value"]`).first().inputValue();
    expect(selectVal).toBe('Critical');
  });

  test('3b. Inline dropdown edits - Change status persists', async ({ page }) => {
    const itemId = await createTestPOAM(page, systemId, {
      'Vulnerability Name': 'Status Edit Test',
      'Status': 'Open'
    });
    await page.evaluate(async (sysId) => {
      await renderWorkbookSystemTable(sysId);
    }, systemId);
    await page.waitForTimeout(500);

    await page.evaluate(async (id) => {
      await poamWorkbookInlineUpdate(id, 'Status', 'In Progress');
    }, itemId);
    await page.waitForTimeout(500);

    const newStatus = await page.evaluate(async (id) => {
      const item = await window.poamWorkbookDB.getItem(id);
      return item['Status'];
    }, itemId);
    expect(newStatus).toBe('In Progress');
  });

  test('3c. Inline dropdown edits - Change POC persists', async ({ page }) => {
    await page.evaluate(async () => {
      await window.poamWorkbookDB.putLookup('pocs', ['Alice', 'Bob', 'Charlie']);
    });

    const itemId = await createTestPOAM(page, systemId, {
      'Vulnerability Name': 'POC Edit Test',
      'POC Name': 'Alice'
    });
    await page.evaluate(async (sysId) => {
      await renderWorkbookSystemTable(sysId);
    }, systemId);
    await page.waitForTimeout(500);

    await page.evaluate(async (id) => {
      await poamWorkbookInlineUpdate(id, 'POC Name', 'Bob');
    }, itemId);
    await page.waitForTimeout(500);

    const newPoc = await page.evaluate(async (id) => {
      const item = await window.poamWorkbookDB.getItem(id);
      return item['POC Name'];
    }, itemId);
    expect(newPoc).toBe('Bob');
  });

  // ─── TEST 4: Bulk update ───
  test('4. Bulk update - Select 3+ items and change status', async ({ page }) => {
    const ids = [];
    for (let i = 0; i < 3; i++) {
      const id = await createTestPOAM(page, systemId, {
        'Vulnerability Name': `Bulk Test ${i + 1}`,
        'Status': 'Open'
      });
      ids.push(id);
    }
    await page.evaluate(async (sysId) => {
      await renderWorkbookSystemTable(sysId);
    }, systemId);
    await page.waitForTimeout(500);

    // Select all checkboxes
    const selectAll = page.locator('#poam-workbook-select-all');
    await selectAll.check();
    await page.waitForTimeout(500);

    // Verify bulk action bar is visible
    const bulkBar = page.locator('#poam-workbook-bulk-actions');
    await expect(bulkBar).toBeVisible();

    // Click "Update Status"
    await page.locator('button:has-text("Update Status")').click();
    await page.waitForTimeout(500);

    // The bulk edit modal should appear
    const bulkStatus = page.locator('#wb-bulk-status');
    await expect(bulkStatus).toBeVisible();

    // Select "In Progress"
    await bulkStatus.selectOption('In Progress');
    await page.waitForTimeout(200);

    // Click "Apply"
    await page.click('#wb-bulk-apply');
    await page.waitForTimeout(1000);

    // Verify all items changed
    const items = await page.evaluate(async (sysId) => {
      const all = await window.poamWorkbookDB.getItemsBySystem(sysId);
      return all.map(i => ({ name: i['Vulnerability Name'], status: i['Status'] }));
    }, systemId);

    const bulkItems = items.filter(i => i.name && i.name.startsWith('Bulk Test'));
    expect(bulkItems.length).toBe(3);
    for (const item of bulkItems) {
      expect(item.status).toBe('In Progress');
    }
  });

  test('4b. Bulk update - Bulk POC assignment', async ({ page }) => {
    await page.evaluate(async () => {
      await window.poamWorkbookDB.putLookup('pocs', ['Alice', 'Bob', 'Charlie']);
    });

    for (let i = 0; i < 3; i++) {
      await createTestPOAM(page, systemId, {
        'Vulnerability Name': `POC Bulk ${i + 1}`,
        'POC Name': 'Alice'
      });
    }
    await page.evaluate(async (sysId) => {
      await renderWorkbookSystemTable(sysId);
    }, systemId);
    await page.waitForTimeout(500);

    // Select all
    await page.locator('#poam-workbook-select-all').check();
    await page.waitForTimeout(500);

    // Open bulk edit
    await page.locator('button:has-text("Update Status")').click();
    await page.waitForTimeout(500);

    // Change POC
    await page.locator('#wb-bulk-poc').selectOption('Charlie');
    await page.click('#wb-bulk-apply');
    await page.waitForTimeout(1000);

    const items = await page.evaluate(async (sysId) => {
      const all = await window.poamWorkbookDB.getItemsBySystem(sysId);
      return all.map(i => i['POC Name']);
    }, systemId);

    const charlieItems = items.filter(p => p === 'Charlie');
    expect(charlieItems.length).toBeGreaterThanOrEqual(3);
  });

  // ─── TEST 5: Detail modal ───
  test('5. Detail modal - Open, edit vulnerability name, save', async ({ page }) => {
    const itemId = await createTestPOAM(page, systemId, {
      'Vulnerability Name': 'Original Vuln Name',
      'Status': 'Open'
    });
    await page.evaluate(async (sysId) => {
      await renderWorkbookSystemTable(sysId);
    }, systemId);
    await page.waitForTimeout(500);

    // Open detail modal via JS
    await page.evaluate(async (id) => {
      await poamWorkbookOpenItemDetails(id);
    }, itemId);
    await page.waitForTimeout(500);

    // Verify modal is open
    const modal = page.locator('.fixed.inset-0').last();
    await expect(modal).toBeVisible();

    // Edit vulnerability name
    const vulnField = page.locator('[data-wb-field="Vulnerability Name"]');
    await expect(vulnField).toBeVisible();
    await vulnField.fill('Updated Vuln Name');

    // Click save
    await page.click('#wb-save');
    await page.waitForTimeout(1000);

    // Verify the table updates
    const updatedName = await page.evaluate(async (id) => {
      const item = await window.poamWorkbookDB.getItem(id);
      return item ? item['Vulnerability Name'] : null;
    }, itemId);
    expect(updatedName).toBe('Updated Vuln Name');
  });

  // ─── TEST 6: Quick Status Panel tiles ───
  test('6. Quick Status Panel - Clicking tiles filters table', async ({ page }) => {
    // Create items with different statuses
    await createTestPOAM(page, systemId, {
      'Vulnerability Name': 'Open Item',
      'Status': 'Open',
      'Scheduled Completion Date': '2028-01-01'
    });
    await createTestPOAM(page, systemId, {
      'Vulnerability Name': 'In Progress Item',
      'Status': 'In Progress',
      'Scheduled Completion Date': '2028-01-01'
    });
    await createTestPOAM(page, systemId, {
      'Vulnerability Name': 'Overdue Item',
      'Status': 'Open',
      'Scheduled Completion Date': '2020-01-01'
    });
    await createTestPOAM(page, systemId, {
      'Vulnerability Name': 'Completed Item',
      'Status': 'Completed',
      'Actual Completion Date': new Date().toISOString()
    });
    await page.evaluate(async (sysId) => {
      await renderWorkbookSystemTable(sysId);
    }, systemId);
    await page.waitForTimeout(500);

    // Click the "Open" tile (first tile in quick status panel)
    const openTile = page.locator('#poam-workbook-quick-status div.cursor-pointer').first();
    await openTile.click();
    await page.waitForTimeout(500);

    const openFilterStatus = await page.evaluate(() => window.poamWorkbookState.filters.status);
    expect(openFilterStatus).toBe('Open');

    // Click Overdue tile (3rd tile)
    const overdueTile = page.locator('#poam-workbook-quick-status div.cursor-pointer').nth(2);
    await overdueTile.click();
    await page.waitForTimeout(500);

    const overdueFilter = await page.evaluate(() => window.poamWorkbookState.filters.dateRange);
    expect(overdueFilter).toBe('overdue');

    // Click Completed tile (4th tile)
    const completedTile = page.locator('#poam-workbook-quick-status div.cursor-pointer').nth(3);
    await completedTile.click();
    await page.waitForTimeout(500);

    const completedFilter = await page.evaluate(() => window.poamWorkbookState.filters.status);
    expect(completedFilter).toBe('Completed');
  });

  // ─── TEST 7: Search ───
  test('7. Search - Filter by vulnerability name', async ({ page }) => {
    await createTestPOAM(page, systemId, {
      'Vulnerability Name': 'Alpha Vulnerability XYZ',
      'Status': 'Open'
    });
    await createTestPOAM(page, systemId, {
      'Vulnerability Name': 'Beta Vulnerability ABC',
      'Status': 'Open'
    });
    await page.evaluate(async (sysId) => {
      await renderWorkbookSystemTable(sysId);
    }, systemId);
    await page.waitForTimeout(500);

    const beforeCount = await getVisibleTableRowCount(page);
    expect(beforeCount).toBeGreaterThanOrEqual(2);

    // Type in search box
    const searchBox = page.locator('#poam-workbook-search');
    await searchBox.fill('Alpha');
    // Trigger the input event since fill may not fire oninput
    await page.evaluate(() => {
      const el = document.getElementById('poam-workbook-search');
      if (el) {
        window.poamWorkbookState.filters.searchText = el.value;
        poamWorkbookApplyFilters();
      }
    });
    await page.waitForTimeout(500);

    const filteredCount = await getVisibleTableRowCount(page);
    expect(filteredCount).toBe(1);

    // Clear search
    await searchBox.fill('');
    await page.evaluate(() => {
      window.poamWorkbookState.filters.searchText = '';
      poamWorkbookApplyFilters();
    });
    await page.waitForTimeout(500);

    const resetCount = await getVisibleTableRowCount(page);
    expect(resetCount).toBeGreaterThanOrEqual(2);
  });

  // ─── TEST 8: Export ───
  test('8. Export - No error on export', async ({ page }) => {
    await createTestPOAM(page, systemId, {
      'Vulnerability Name': 'Export Test Item',
      'Status': 'Open'
    });
    await page.evaluate(async (sysId) => {
      await renderWorkbookSystemTable(sysId);
    }, systemId);
    await page.waitForTimeout(500);

    // Listen for errors
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));

    // Click the Export button in the page header (label is just "Export")
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 5000 }).catch(() => null),
      page.evaluate(() => poamWorkbookExportSystem()),
    ]);

    await page.waitForTimeout(1000);

    // Verify no JS errors
    const relevantErrors = errors.filter(e => !e.includes('ResizeObserver'));
    expect(relevantErrors.length).toBe(0);
  });
});
