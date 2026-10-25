const { test, expect, checkDate, available } = require('./fixtures');

test('quantity retains focus throughout consecutive typing and after returning from a result', async ({ page }) => {
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    const quantity = page.locator('#availability-quantity');
    await quantity.click();
    for (const digit of '150') {
      await page.keyboard.type(digit);
      await expect(quantity).toBeFocused();
    }
    await expect(quantity).toHaveValue('150');
    await checkDate(page, 45);
    await page.locator('#availability-dialog').getByRole('button', { name: 'Close availability' }).click();
    await quantity.fill('');
    for (const digit of '250') {
      await page.keyboard.type(digit);
      await expect(quantity).toBeFocused();
    }
    await expect(quantity).toHaveValue('250');
  }
});

test('available result is modal, keeps quote steps in focus, and Escape restores the entry', async ({ page }) => {
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await checkDate(page, 45);
    const dialog = page.locator('#availability-dialog');
    await expect(dialog).toBeVisible();
    expect(await dialog.evaluate(e => e.matches(':modal'))).toBe(true);
    await expect(dialog.locator('#availability-result')).toContainText('Your date is available');
    await expect(dialog.locator('#availability-form')).toBeHidden();
    await expect(page.locator('#availability-form')).toHaveCount(1);
    await page.keyboard.press('Tab');
    expect(await dialog.evaluate(e => e.contains(document.activeElement))).toBe(true);
    await page.locator('#availability-continue-button').click();
    await expect(dialog.locator('#availability-step-2-panel')).toBeVisible();
    await expect(page.locator('#availability-full-name')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(page.locator('#availability-form')).toBeVisible();
    await expect(page.locator('#availability-quantity')).toHaveValue('45');
    await expect(page.locator('#availability-date')).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.classList.contains('availability-dialog-open'))).toBe(false);
  }
});

test('unavailable result is modal and another date returns to the existing form', async ({ page, backend }) => {
  backend.replies.checkAvailability = { ...available, available: false, partialAvailable: false, maxAvailable: 0 };
  await checkDate(page, 45);
  const dialog = page.locator('#availability-dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('fully booked');
  await dialog.locator('[data-availability-action="change-date"]').click();
  await expect(dialog).toBeHidden();
  await expect(page.locator('#availability-result')).toBeHidden();
  await expect(page.locator('#availability-form')).toBeVisible();
  await expect(page.locator('#availability-date')).toBeFocused();
});

test('limited availability retains its adjustment action inside the modal', async ({ page, backend }) => {
  backend.replies.checkAvailability = { ...available, available: false, partialAvailable: true, maxAvailable: 45 };
  await checkDate(page, 80);
  const dialog = page.locator('#availability-dialog');
  await expect(dialog).toContainText('almost booked out');
  await dialog.locator('[data-availability-action="continue-limited"]').click();
  await expect(dialog).toContainText('Your date is available');
  await expect(page.locator('#availability-quantity')).toHaveValue('45');
  await page.setViewportSize({ width: 390, height: 900 });
  await expect(dialog.locator('#availability-checker')).toHaveCount(1);
  await dialog.getByRole('button', { name: 'Close availability' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.locator('#availability-form')).toBeVisible();
});
