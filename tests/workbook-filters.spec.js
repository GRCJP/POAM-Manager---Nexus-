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

test.describe('Workbook Filters', () => {
  let systemId;

  test.beforeEach(async ({ page }) => {
    await waitForAppLoad(page);
    await navigateToWorkbook(page);
    systemId = await createTestSystem(page, 'Filter Test System', 'For filter tests');

    // Create POAMs with various statuses and severities
    const today = new Date();
    const pastDate = new Date(today);
    pastDate.setDate(pastDate.getDate() - 30);
    const futureDate = new Date(today);
    futureDate.setDate(futureDate.getDate() + 30);

    await createTestPOAM(page, systemId, {
      'Vulnerability Name': 'Open Bug Alpha',
      'Severity Value': 'Critical',
      'Status': 'Open',
      'Impacted Security Controls': 'AC-2',
      'Scheduled Completion Date': futureDate.toISOString().split('T')[0],
    });
    await createTestPOAM(page, systemId, {
      'Vulnerability Name': 'In Progress Issue',
      'Severity Value': 'High',
      'Status': 'In Progress',
      'Impacted Security Controls': 'AU-3',
      'Scheduled Completion Date': futureDate.toISOString().split('T')[0],
    });
    await createTestPOAM(page, systemId, {
      'Vulnerability Name': 'Completed Fix',
      'Severity Value': 'Medium',
      'Status': 'Completed',
      'Impacted Security Controls': 'CM-6',
      'Actual Completion Date': today.toISOString().split('T')[0],
    });
    await createTestPOAM(page, systemId, {
      'Vulnerability Name': 'Overdue Vulnerability',
      'Severity Value': 'High',
      'Status': 'Open',
      'Impacted Security Controls': 'AC-6',
      'Scheduled Completion Date': pastDate.toISOString().split('T')[0],
    });
    await createTestPOAM(page, systemId, {
      'Vulnerability Name': 'Risk Accepted Item',
      'Severity Value': 'Low',
      'Status': 'Risk Accepted',
      'Impacted Security Controls': 'AU-6',
    });

    await navigateToSystem(page, systemId);
  });

  test('status filter: show only open items', async ({ page }) => {
    // Set filter to Open
    await page.evaluate(async () => {
      window.poamWorkbookState.filters.status = 'Open';
      await poamWorkbookApplyFilters();
    });
    await page.waitForTimeout(500);

    // Get items from DB that match
    const items = await page.evaluate(async (sysId) => {
      const allItems = await window.poamWorkbookDB.getItemsBySystem(sysId);
      const filtered = window.poamWorkbookFilterItems(allItems);
      return filtered.map(i => i['Vulnerability Name']);
    }, systemId);

    // Should include Open and Ongoing items
    expect(items).toContain('Open Bug Alpha');
    expect(items).toContain('Overdue Vulnerability');
    expect(items).not.toContain('In Progress Issue');
    expect(items).not.toContain('Completed Fix');
  });

  test('status filter: show only in-progress items', async ({ page }) => {
    await page.evaluate(async () => {
      window.poamWorkbookState.filters.status = 'In Progress';
      await poamWorkbookApplyFilters();
    });
    await page.waitForTimeout(500);

    const items = await page.evaluate(async (sysId) => {
      const allItems = await window.poamWorkbookDB.getItemsBySystem(sysId);
      const filtered = window.poamWorkbookFilterItems(allItems);
      return filtered.map(i => i['Vulnerability Name']);
    }, systemId);

    expect(items).toContain('In Progress Issue');
    expect(items).not.toContain('Open Bug Alpha');
  });

  test('status filter: show completed items', async ({ page }) => {
    await page.evaluate(async () => {
      window.poamWorkbookState.filters.status = 'Completed';
      await poamWorkbookApplyFilters();
    });
    await page.waitForTimeout(500);

    const items = await page.evaluate(async (sysId) => {
      const allItems = await window.poamWorkbookDB.getItemsBySystem(sysId);
      const filtered = window.poamWorkbookFilterItems(allItems);
      return filtered.map(i => i['Vulnerability Name']);
    }, systemId);

    expect(items).toContain('Completed Fix');
    expect(items).not.toContain('Open Bug Alpha');
  });

  test('status filter: show risk accepted items', async ({ page }) => {
    await page.evaluate(async () => {
      window.poamWorkbookState.filters.status = 'Risk Accepted';
      await poamWorkbookApplyFilters();
    });
    await page.waitForTimeout(500);

    const items = await page.evaluate(async (sysId) => {
      const allItems = await window.poamWorkbookDB.getItemsBySystem(sysId);
      const filtered = window.poamWorkbookFilterItems(allItems);
      return filtered.map(i => i['Vulnerability Name']);
    }, systemId);

    expect(items).toContain('Risk Accepted Item');
    expect(items).not.toContain('Open Bug Alpha');
  });

  test('status filter: show all items', async ({ page }) => {
    await page.evaluate(async () => {
      window.poamWorkbookState.filters.status = 'all';
      await poamWorkbookApplyFilters();
    });
    await page.waitForTimeout(500);

    const items = await page.evaluate(async (sysId) => {
      const allItems = await window.poamWorkbookDB.getItemsBySystem(sysId);
      const filtered = window.poamWorkbookFilterItems(allItems);
      return filtered.map(i => i['Vulnerability Name']);
    }, systemId);

    // All items should be included
    expect(items.length).toBe(5);
  });

  test('overdue filter shows only overdue items', async ({ page }) => {
    await page.evaluate(async () => {
      window.poamWorkbookState.filters.status = 'all';
      window.poamWorkbookState.filters.dateRange = 'overdue';
      await poamWorkbookApplyFilters();
    });
    await page.waitForTimeout(500);

    const items = await page.evaluate(async (sysId) => {
      const allItems = await window.poamWorkbookDB.getItemsBySystem(sysId);
      const filtered = window.poamWorkbookFilterItems(allItems);
      return filtered.map(i => i['Vulnerability Name']);
    }, systemId);

    expect(items).toContain('Overdue Vulnerability');
    expect(items).not.toContain('Open Bug Alpha');
    expect(items).not.toContain('Completed Fix');
  });

  test('control family filter works (AC)', async ({ page }) => {
    await page.evaluate(async () => {
      window.poamWorkbookState.filters.status = 'all';
      window.poamWorkbookState.filters.controlFamily = 'AC';
      await poamWorkbookApplyFilters();
    });
    await page.waitForTimeout(500);

    const items = await page.evaluate(async (sysId) => {
      const allItems = await window.poamWorkbookDB.getItemsBySystem(sysId);
      const filtered = window.poamWorkbookFilterItems(allItems);
      return filtered.map(i => i['Vulnerability Name']);
    }, systemId);

    // Only AC-prefixed items
    expect(items).toContain('Open Bug Alpha');      // AC-2
    expect(items).toContain('Overdue Vulnerability'); // AC-6
    expect(items).not.toContain('In Progress Issue'); // AU-3
    expect(items).not.toContain('Completed Fix');     // CM-6
  });

  test('search filter matches vulnerability name', async ({ page }) => {
    await page.evaluate(async () => {
      window.poamWorkbookState.filters.status = 'all';
      window.poamWorkbookState.filters.searchText = 'Alpha';
      await poamWorkbookApplyFilters();
    });
    await page.waitForTimeout(500);

    const items = await page.evaluate(async (sysId) => {
      const allItems = await window.poamWorkbookDB.getItemsBySystem(sysId);
      const filtered = window.poamWorkbookFilterItems(allItems);
      return filtered.map(i => i['Vulnerability Name']);
    }, systemId);

    expect(items).toContain('Open Bug Alpha');
    expect(items.length).toBe(1);
  });

  test('clear search returns all items', async ({ page }) => {
    // First apply a search
    await page.evaluate(async () => {
      window.poamWorkbookState.filters.searchText = 'NonExistent';
    });

    const filteredItems = await page.evaluate(async (sysId) => {
      const allItems = await window.poamWorkbookDB.getItemsBySystem(sysId);
      return window.poamWorkbookFilterItems(allItems);
    }, systemId);
    expect(filteredItems.length).toBe(0);

    // Clear search
    await page.evaluate(async () => {
      window.poamWorkbookState.filters.searchText = '';
    });

    const allItems = await page.evaluate(async (sysId) => {
      const allItems = await window.poamWorkbookDB.getItemsBySystem(sysId);
      return window.poamWorkbookFilterItems(allItems);
    }, systemId);
    expect(allItems.length).toBe(5);
  });

  test('severity filter works', async ({ page }) => {
    await page.evaluate(async () => {
      window.poamWorkbookState.filters.status = 'all';
      window.poamWorkbookState.filters.severity = 'Critical';
      await poamWorkbookApplyFilters();
    });
    await page.waitForTimeout(500);

    const items = await page.evaluate(async (sysId) => {
      const allItems = await window.poamWorkbookDB.getItemsBySystem(sysId);
      const filtered = window.poamWorkbookFilterItems(allItems);
      return filtered.map(i => i['Vulnerability Name']);
    }, systemId);

    expect(items).toContain('Open Bug Alpha');
    expect(items.length).toBe(1);
  });

  test('quick status panel metric filter works', async ({ page }) => {
    // Test the filterByMetric function for overdue
    await page.evaluate(async () => {
      window.poamWorkbookFilterByMetric('overdue');
    });
    await page.waitForTimeout(500);

    const filters = await page.evaluate(() => {
      return { ...window.poamWorkbookState.filters };
    });
    expect(filters.dateRange).toBe('overdue');
  });
});
