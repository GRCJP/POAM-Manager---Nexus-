// Shared test helpers for POAM Nexus Playwright tests

/**
 * Wait for the app to fully load (partials fetched, DOMContentLoaded complete).
 */
async function waitForAppLoad(page) {
  await page.goto('/');
  // Wait for the dashboard module to be present (partials loaded)
  await page.waitForSelector('#dashboard-module', { timeout: 15000 });
  // Give the app a moment to finish initialization
  await page.waitForTimeout(500);
}

/**
 * Navigate to a specific module by calling showModule() and waiting for it to appear.
 */
async function navigateToModule(page, moduleName) {
  await page.evaluate((mod) => showModule(mod), moduleName);
  await page.waitForSelector(`#${moduleName}-module:not(.hidden)`, { timeout: 10000 });
  await page.waitForTimeout(300);
}

/**
 * Navigate to the workbook module and wait for IndexedDB initialization.
 */
async function navigateToWorkbook(page) {
  await navigateToModule(page, 'security-control-monitoring');
  // Wait for the DB to be ready
  await page.waitForFunction(() => {
    return window.poamWorkbookDB && window.poamWorkbookDB.db;
  }, { timeout: 10000 });
  await page.waitForTimeout(500);
}

/**
 * Create a test system via the app's JS API and return its ID.
 */
async function createTestSystem(page, name, description) {
  const systemId = await page.evaluate(async ({ name, description }) => {
    await window.poamWorkbookDB.init();
    const id = `sys-test-${Date.now()}`;
    await window.poamWorkbookDB.saveSystem({ id, name, description: description || '' });
    window.poamWorkbookNotifyMutation();
    return id;
  }, { name, description });
  await page.waitForTimeout(300);
  return systemId;
}

/**
 * Navigate to a specific system in the workbook.
 */
async function navigateToSystem(page, systemId) {
  await page.evaluate(async (id) => {
    await poamWorkbookOpenSystem(id);
  }, systemId);
  await page.waitForSelector('#poam-workbook-view-system:not(.hidden)', { timeout: 10000 });
  await page.waitForTimeout(500);
}

/**
 * Create a POAM item directly via the DB for testing purposes.
 */
async function createTestPOAM(page, systemId, overrides) {
  const itemId = await page.evaluate(async ({ systemId, overrides }) => {
    const now = new Date().toISOString();
    const nextNum = typeof window.poamWorkbookDB.reserveNextWorkbookItemNumber === 'function'
      ? await window.poamWorkbookDB.reserveNextWorkbookItemNumber(systemId)
      : await window.poamWorkbookDB.getNextItemNumber(systemId);

    const item = {
      id: `WB-test-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      systemId,
      createdAt: now,
      updatedAt: now,
      'Item number': String(nextNum),
      'Status': 'Open',
      'Severity Value': 'Medium',
      'POC Name': 'Test User',
      'Vulnerability Name': 'Test Vulnerability',
      'Identifying Detecting Source': 'Continuous Monitoring',
      'Impacted Security Controls': 'AC-2',
      'Scheduled Completion Date': '',
      'Updated Scheduled Completion Date': '',
      ...overrides,
    };

    await window.poamWorkbookDB.saveItem(item);
    window.poamWorkbookNotifyMutation();
    return item.id;
  }, { systemId, overrides: overrides || {} });
  await page.waitForTimeout(200);
  return itemId;
}

/**
 * Clear all IndexedDB data for a clean test slate.
 */
async function clearAllData(page) {
  await page.evaluate(async () => {
    // Clear localStorage
    localStorage.clear();
    // Clear IndexedDB
    if (window.poamWorkbookDB && window.poamWorkbookDB.db) {
      const db = window.poamWorkbookDB.db;
      const storeNames = Array.from(db.objectStoreNames);
      for (const storeName of storeNames) {
        try {
          const tx = db.transaction(storeName, 'readwrite');
          const store = tx.objectStore(storeName);
          store.clear();
          await new Promise((resolve, reject) => {
            tx.oncomplete = resolve;
            tx.onerror = reject;
          });
        } catch (e) {
          // ignore stores that can't be cleared
        }
      }
    }
  });
  await page.waitForTimeout(300);
}

/**
 * Get the count of visible rows in the workbook table.
 */
async function getVisibleTableRowCount(page) {
  return page.evaluate(() => {
    const tbody = document.getElementById('poam-workbook-table-body');
    if (!tbody) return 0;
    const rows = tbody.querySelectorAll('tr');
    // Subtract empty-state rows
    let count = 0;
    for (const row of rows) {
      if (row.querySelector('td[colspan]')) continue;
      count++;
    }
    return count;
  });
}

module.exports = {
  waitForAppLoad,
  navigateToModule,
  navigateToWorkbook,
  createTestSystem,
  navigateToSystem,
  createTestPOAM,
  clearAllData,
  getVisibleTableRowCount,
};
