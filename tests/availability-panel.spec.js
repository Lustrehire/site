const { test, expect, checkDate } = require('./fixtures');

test('availability result replaces entry form and Edit Details restores its values', async ({ page }) => {
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await checkDate(page, 45);
    await expect(page.locator('#availability-step-2-panel')).toBeVisible();
    await expect(page.locator('#availability-result .availability-price-hire')).toHaveCount(0);
    await expect(page.locator('#availability-form')).toBeHidden();
    await expect(page.locator('#mobile-price-preview')).toBeHidden();
    await expect(page.locator('#availability-step-2-panel')).toBeVisible();
    const date = await page.locator('#availability-date').inputValue();
    await page.locator('#availability-back-to-step-1').click();
    await expect(page.locator('#availability-result')).toBeHidden();
    await expect(page.locator('#availability-form')).toBeVisible();
    await expect(page.locator('#availability-date')).toHaveValue(date);
    await expect(page.locator('#availability-quantity')).toHaveValue('45');
    await expect(page.locator('#availability-checker .availability-price')).toHaveCount(0);
    await expect(page.locator('#availability-date')).toBeFocused();
  }
});
