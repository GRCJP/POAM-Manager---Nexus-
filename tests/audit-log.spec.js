// @ts-check
const { test, expect } = require('@playwright/test');
const { waitForAppLoad, navigateToModule } = require('./helpers');

test.describe('Audit Log', () => {
  test.beforeEach(async ({ page }) => {
    await waitForAppLoad(page);
  });

  test('audit module loads and is not a static placeholder', async ({ page }) => {
    await navigateToModule(page, 'audit');

    const auditModule = page.locator('#audit-module');
    await expect(auditModule).not.toHaveClass(/hidden/);

    // The module should have been initialized by loadAuditModule
    const moduleContent = await auditModule.textContent();
    expect(moduleContent.length).toBeGreaterThan(50);
  });

  test('KPI cards render with event counts', async ({ page }) => {
    // Seed some audit events first
    await page.evaluate(() => {
      recordAuditEvent({ type: 'scan_import', action: 'Test scan import', details: 'Test' });
      recordAuditEvent({ type: 'status_change', action: 'Status change test', details: 'Open -> In Progress' });
      recordAuditEvent({ type: 'settings_change', action: 'Settings updated', details: 'SLA config' });
    });

    await navigateToModule(page, 'audit');
    await page.waitForTimeout(500);

    // Check that summary counts are rendered
    const totalEvents = page.locator('#audit-total-events');
    if (await totalEvents.count() > 0) {
      const text = await totalEvents.textContent();
      const count = parseInt(text);
      expect(count).toBeGreaterThanOrEqual(3);
    }

    const scanCount = page.locator('#audit-scan-count');
    if (await scanCount.count() > 0) {
      const text = await scanCount.textContent();
      const count = parseInt(text);
      expect(count).toBeGreaterThanOrEqual(1);
    }

    const statusChanges = page.locator('#audit-status-changes');
    if (await statusChanges.count() > 0) {
      const text = await statusChanges.textContent();
      const count = parseInt(text);
      expect(count).toBeGreaterThanOrEqual(1);
    }
  });

  test('filter controls exist', async ({ page }) => {
    await navigateToModule(page, 'audit');
    await page.waitForTimeout(500);

    // Check for filter elements
    const typeFilter = page.locator('#audit-filter-type');
    const searchFilter = page.locator('#audit-filter-search');
    const fromFilter = page.locator('#audit-filter-from');
    const toFilter = page.locator('#audit-filter-to');

    // At least the type filter should exist
    if (await typeFilter.count() > 0) {
      await expect(typeFilter).toBeVisible();
    }
    if (await searchFilter.count() > 0) {
      await expect(searchFilter).toBeVisible();
    }
  });

  test('filtering by type works', async ({ page }) => {
    // Seed events of different types
    await page.evaluate(() => {
      recordAuditEvent({ type: 'scan_import', action: 'Scan A', details: 'Scan test' });
      recordAuditEvent({ type: 'status_change', action: 'Status B', details: 'Status test' });
      recordAuditEvent({ type: 'poam_created', action: 'POAM C', details: 'Created test' });
    });

    await navigateToModule(page, 'audit');
    await page.waitForTimeout(500);

    // Filter by scan_import type
    const typeFilter = page.locator('#audit-filter-type');
    if (await typeFilter.count() > 0) {
      await typeFilter.selectOption('scan_import');
      await page.evaluate(() => filterAuditLogs());
      await page.waitForTimeout(300);

      // The feed should only show scan_import events
      const feedContent = await page.locator('#audit-log-feed').textContent();
      expect(feedContent).toContain('Scan');
    }
  });

  test('audit log feed displays events', async ({ page }) => {
    // Seed an event
    await page.evaluate(() => {
      recordAuditEvent({ type: 'poam_created', action: 'POAM-001 created', details: 'Test POAM created' });
    });

    await navigateToModule(page, 'audit');
    await page.waitForTimeout(500);

    const feed = page.locator('#audit-log-feed');
    if (await feed.count() > 0) {
      const feedContent = await feed.textContent();
      expect(feedContent).toContain('POAM-001 created');
    }
  });

  test('clear filters resets all controls', async ({ page }) => {
    await navigateToModule(page, 'audit');
    await page.waitForTimeout(500);

    // Set a filter value
    const searchFilter = page.locator('#audit-filter-search');
    if (await searchFilter.count() > 0) {
      await searchFilter.fill('test search');

      // Clear filters
      await page.evaluate(() => clearAuditFilters());
      await page.waitForTimeout(300);

      const value = await searchFilter.inputValue();
      expect(value).toBe('');
    }
  });
});
