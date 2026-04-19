// @ts-check
const { test, expect } = require('@playwright/test');
const { waitForAppLoad, navigateToWorkbook, clearAllData } = require('./helpers');

test.describe('Workbook System Management', () => {
  test.beforeEach(async ({ page }) => {
    await waitForAppLoad(page);
    await navigateToWorkbook(page);
  });

  test('system dropdown shows All Systems Overview by default', async ({ page }) => {
    const select = page.locator('#poam-system-select');
    await expect(select).toBeVisible();

    // The default selected option should be "all" (All Systems - Overview)
    const selectedValue = await select.inputValue();
    expect(selectedValue).toBe('all');

    // Overview view should be visible
    const overview = page.locator('#poam-workbook-view-overview');
    await expect(overview).not.toHaveClass(/hidden/);
  });

  test('add system via modal, verify it appears in dropdown', async ({ page }) => {
    // Look for an "Add System" button
    const addBtn = page.locator('button, a').filter({ hasText: /Add System/i }).first();
    if (await addBtn.count() > 0) {
      await addBtn.click();
    } else {
      // Call the function directly
      await page.evaluate(() => openAddSystemModal());
    }

    await page.waitForTimeout(300);

    // Modal should be open with input fields
    const nameInput = page.locator('#wb-addsys-name');
    await expect(nameInput).toBeVisible();

    const descInput = page.locator('#wb-addsys-desc');
    await expect(descInput).toBeVisible();

    // Fill in system details
    await nameInput.fill('Test System Alpha');
    await descInput.fill('A test system for automated testing');

    // Click Save
    const saveBtn = page.locator('#wb-addsys-save');
    await saveBtn.click();
    await page.waitForTimeout(500);

    // Verify system appears in the dropdown
    const select = page.locator('#poam-system-select');
    const optionTexts = await select.locator('option').allTextContents();
    const hasSystem = optionTexts.some(t => t.includes('Test System Alpha'));
    expect(hasSystem).toBeTruthy();
  });

  test('select a system and verify system view loads', async ({ page }) => {
    // Create a system first
    const systemId = await page.evaluate(async () => {
      const id = `sys-test-nav-${Date.now()}`;
      await window.poamWorkbookDB.saveSystem({ id, name: 'Navigation Test System', description: 'For testing' });
      window.poamWorkbookNotifyMutation();
      await renderWorkbookSidebarSystems();
      return id;
    });
    await page.waitForTimeout(300);

    // Select the system from dropdown
    const select = page.locator('#poam-system-select');
    await select.selectOption(systemId);
    await page.waitForTimeout(800);

    // System view should be visible
    const systemView = page.locator('#poam-workbook-view-system');
    await expect(systemView).not.toHaveClass(/hidden/);

    // Overview should be hidden
    const overview = page.locator('#poam-workbook-view-overview');
    await expect(overview).toHaveClass(/hidden/);

    // System name should be displayed
    const sysNameEl = page.locator('#poam-workbook-active-system-name');
    if (await sysNameEl.count() > 0) {
      await expect(sysNameEl).toContainText('Navigation Test System');
    }
  });

  test('edit system name via edit modal', async ({ page }) => {
    // Create a system
    const systemId = await page.evaluate(async () => {
      const id = `sys-test-edit-${Date.now()}`;
      await window.poamWorkbookDB.saveSystem({ id, name: 'Edit Me System', description: 'Original desc' });
      window.poamWorkbookNotifyMutation();
      await renderWorkbookSidebarSystems();
      return id;
    });
    await page.waitForTimeout(300);

    // Open the edit modal
    await page.evaluate(async (id) => {
      await poamWorkbookOpenEditSystemModal(id);
    }, systemId);
    await page.waitForTimeout(300);

    // Edit the name
    const nameInput = page.locator('#wb-editsys-name');
    await expect(nameInput).toBeVisible();
    await nameInput.fill('Renamed System');

    // Save
    const saveBtn = page.locator('#wb-editsys-save');
    await saveBtn.click();
    await page.waitForTimeout(500);

    // Verify the name changed in the dropdown
    const select = page.locator('#poam-system-select');
    const optionTexts = await select.locator('option').allTextContents();
    const hasRenamed = optionTexts.some(t => t.includes('Renamed System'));
    expect(hasRenamed).toBeTruthy();
  });

  test('delete system from settings', async ({ page }) => {
    // Create a system
    const systemId = await page.evaluate(async () => {
      const id = `sys-test-delete-${Date.now()}`;
      await window.poamWorkbookDB.saveSystem({ id, name: 'Delete Me System', description: '' });
      window.poamWorkbookNotifyMutation();
      return id;
    });
    await page.waitForTimeout(300);

    // Navigate to settings general tab (which has system inventory)
    await page.evaluate(() => showModule('settings'));
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

    // Delete the system via JS (the button uses onclick with confirm dialog)
    page.on('dialog', dialog => dialog.accept());
    await page.evaluate(async (id) => {
      await deleteSystemFromSettings(id, 'Delete Me System');
    }, systemId);
    await page.waitForTimeout(500);

    // Verify system is gone from the DB
    const exists = await page.evaluate(async (id) => {
      const sys = await window.poamWorkbookDB.getSystemById(id);
      return !!sys;
    }, systemId);
    expect(exists).toBeFalsy();
  });
});
