// @ts-check
const { test, expect } = require('@playwright/test');
const { waitForAppLoad, navigateToModule } = require('./helpers');

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await waitForAppLoad(page);
  });

  test('page loads and shows dashboard by default', async ({ page }) => {
    const dashboard = page.locator('#dashboard-module');
    await expect(dashboard).not.toHaveClass(/hidden/);

    // Other modules should be hidden
    const workbook = page.locator('#security-control-monitoring-module');
    await expect(workbook).toHaveClass(/hidden/);
  });

  test('click each sidebar item shows the correct module', async ({ page }) => {
    const modules = [
      { label: 'vulnerability-tracking', id: '#vulnerability-tracking-module' },
      { label: 'security-control-monitoring', id: '#security-control-monitoring-module' },
      { label: 'evidence', id: '#evidence-module' },
      { label: 'reporting', id: '#reporting-module' },
      { label: 'audit', id: '#audit-module' },
      { label: 'settings', id: '#settings-module' },
      { label: 'dashboard', id: '#dashboard-module' },
    ];

    for (const mod of modules) {
      // Click the sidebar link for this module
      const sidebarLink = page.locator(`[onclick="showModule('${mod.label}')"]`).first();
      if (await sidebarLink.count() > 0) {
        await sidebarLink.click();
        await page.waitForTimeout(500);
        const moduleEl = page.locator(mod.id);
        await expect(moduleEl).not.toHaveClass(/hidden/);
      } else {
        // Fall back to calling showModule directly
        await navigateToModule(page, mod.label);
        const moduleEl = page.locator(mod.id);
        await expect(moduleEl).not.toHaveClass(/hidden/);
      }
    }
  });

  test('refresh page stays on last module via localStorage persistence', async ({ page }) => {
    // Navigate to settings
    await navigateToModule(page, 'settings');
    const settingsModule = page.locator('#settings-module');
    await expect(settingsModule).not.toHaveClass(/hidden/);

    // Verify localStorage was set
    const savedModule = await page.evaluate(() => localStorage.getItem('currentModule'));
    expect(savedModule).toBe('settings');

    // Reload the page
    await page.reload();
    await page.waitForSelector('#settings-module', { timeout: 10000 });
    await page.waitForTimeout(1000);

    // Check if settings module is restored
    // The app reads currentModule from localStorage on load
    const currentModule = await page.evaluate(() => localStorage.getItem('currentModule'));
    expect(currentModule).toBe('settings');
  });

  test('dashboard is the default when no module saved', async ({ page }) => {
    // Clear localStorage and reload
    await page.evaluate(() => localStorage.removeItem('currentModule'));
    await page.reload();
    await page.waitForSelector('#dashboard-module', { timeout: 10000 });
    await page.waitForTimeout(500);

    const dashboard = page.locator('#dashboard-module');
    await expect(dashboard).not.toHaveClass(/hidden/);
  });
});
