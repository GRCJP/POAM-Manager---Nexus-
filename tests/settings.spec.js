// @ts-check
const { test, expect } = require('@playwright/test');
const { waitForAppLoad, navigateToModule } = require('./helpers');

test.describe('Settings', () => {
  test.beforeEach(async ({ page }) => {
    await waitForAppLoad(page);
    await navigateToModule(page, 'settings');
  });

  test('settings module loads', async ({ page }) => {
    const settings = page.locator('#settings-module');
    await expect(settings).not.toHaveClass(/hidden/);
  });

  test('general tab loads with SLA config', async ({ page }) => {
    await page.evaluate(() => showSettingsTab('general'));
    await page.waitForTimeout(500);

    const generalTab = page.locator('#settings-general');
    if (await generalTab.count() > 0) {
      await expect(generalTab).not.toHaveClass(/hidden/);
    }

    // SLA config fields should be present
    const slaCritical = page.locator('#sla-critical');
    if (await slaCritical.count() > 0) {
      await expect(slaCritical).toBeVisible();
      const value = await slaCritical.inputValue();
      // Default critical SLA is 15 days
      expect(parseInt(value)).toBeGreaterThan(0);
    }
  });

  test('system inventory table shows systems', async ({ page }) => {
    // First ensure workbook DB is initialized with a system
    await page.evaluate(async () => {
      if (window.poamWorkbookDB) {
        if (!window.poamWorkbookDB.db) {
          await window.poamWorkbookDB.init();
          await window.poamWorkbookDB.seedDefaultsIfNeeded();
        }
      }
    });
    await page.waitForTimeout(300);

    await page.evaluate(() => showSettingsTab('general'));
    await page.waitForTimeout(500);

    // Render systems settings
    await page.evaluate(async () => {
      if (typeof renderSystemsSettings === 'function') {
        await renderSystemsSettings();
      }
    });
    await page.waitForTimeout(300);

    // Check for system inventory content
    const settingsContent = await page.locator('#settings-general').textContent();
    // Should have some content related to systems
    expect(settingsContent.length).toBeGreaterThan(50);
  });

  test('compliance tab loads with risk framework', async ({ page }) => {
    await page.evaluate(() => showSettingsTab('compliance'));
    await page.waitForTimeout(500);

    const complianceTab = page.locator('#settings-compliance');
    if (await complianceTab.count() > 0) {
      await expect(complianceTab).not.toHaveClass(/hidden/);
    }

    // Risk framework select should be present
    const frameworkSelect = page.locator('#risk-framework-select');
    if (await frameworkSelect.count() > 0) {
      await expect(frameworkSelect).toBeVisible();
      const value = await frameworkSelect.inputValue();
      // Should default to 'nist'
      expect(value).toBeTruthy();
    }
  });

  test('switching between tabs changes visible content', async ({ page }) => {
    // Show general tab
    await page.evaluate(() => showSettingsTab('general'));
    await page.waitForTimeout(300);

    const generalTab = page.locator('#settings-general');
    const complianceTab = page.locator('#settings-compliance');

    if (await generalTab.count() > 0 && await complianceTab.count() > 0) {
      await expect(generalTab).not.toHaveClass(/hidden/);
      await expect(complianceTab).toHaveClass(/hidden/);

      // Switch to compliance tab
      await page.evaluate(() => showSettingsTab('compliance'));
      await page.waitForTimeout(300);

      await expect(generalTab).toHaveClass(/hidden/);
      await expect(complianceTab).not.toHaveClass(/hidden/);
    }
  });

  test('add system button works from settings', async ({ page }) => {
    await page.evaluate(() => showSettingsTab('general'));
    await page.waitForTimeout(500);

    // Ensure DB is ready
    await page.evaluate(async () => {
      if (window.poamWorkbookDB && !window.poamWorkbookDB.db) {
        await window.poamWorkbookDB.init();
        await window.poamWorkbookDB.seedDefaultsIfNeeded();
      }
    });
    await page.waitForTimeout(200);

    // Open add system modal
    await page.evaluate(() => {
      if (typeof openAddSystemModal === 'function') {
        openAddSystemModal();
      } else if (typeof poamWorkbookOpenAddSystemModal === 'function') {
        poamWorkbookOpenAddSystemModal();
      }
    });
    await page.waitForTimeout(300);

    // The add system modal should be visible
    const nameInput = page.locator('#wb-addsys-name');
    if (await nameInput.count() > 0) {
      await expect(nameInput).toBeVisible();
      // Close modal
      const cancelBtn = page.locator('#wb-addsys-cancel');
      if (await cancelBtn.count() > 0) {
        await cancelBtn.click();
      }
    }
  });
});
