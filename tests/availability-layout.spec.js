const { test, expect, checkDate } = require('./fixtures');

test('successful availability matches the compact layout across viewport widths', async ({ page }) => {
  for (const width of [320, 375, 430, 768, 1280, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await checkDate(page, 15);
    const result = page.locator('#availability-result');
    await expect(result.locator('h4')).toHaveText('Your date is available!');
    await expect(page.locator('#availability-form')).toBeHidden();
    const geometry = await result.evaluate(root => {
      const rect = selector => root.querySelector(selector).getBoundingClientRect();
      const icon = rect('.availability-success-icon'), copy = rect('.availability-success-copy');
      const hire = rect('.availability-price-hire'), deposit = rect('.available-deposit');
      return { centered: Math.abs(icon.y + icon.height / 2 - copy.y - copy.height / 2) < 1,
        sideBySide: hire.right <= deposit.left,
        fits: document.documentElement.scrollWidth <= innerWidth };
    });
    expect(geometry.centered).toBe(true);
    expect(geometry.sideBySide).toBe(true);
    expect(geometry.fits).toBe(true);
    await result.locator('summary').click();
    await expect(result.locator('.available-payment-body')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(page.locator('#availability-ready-button')).toHaveAccessibleName('Secure My Date — $75');
  }
});

test('limited and unavailable modal actions fit narrow screens and retain compact styling', async ({ page, backend }) => {
  const { available } = require('./fixtures');
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const limited of [true, false]) {
      backend.replies.checkAvailability = { ...available, available: false, partialAvailable: limited, maxAvailable: limited ? 300 : 0 };
      await checkDate(page, 400);
      const dialog = page.locator('#availability-dialog');
      await expect(dialog).toBeVisible();
      const heading = dialog.locator('.availability-success-copy h4');
      expect(await heading.evaluate(el => getComputedStyle(el).fontFamily)).toContain('Arial');
      const fits = await dialog.locator('.availability-result-actions button').evaluateAll(buttons => buttons.every(button => button.scrollWidth <= button.clientWidth + 1 && button.getBoundingClientRect().height >= 48));
      expect(fits).toBe(true);
      if (limited) {
        await expect(dialog.locator('.available-deposit')).toContainText('$1,266.50');
        await dialog.locator('.available-payment-details summary').click();
        await expect(dialog.locator('.available-payment-body')).toContainText('Total paid before event $5,066');
      } else {
        await expect(dialog.locator('.availability-price')).toHaveCount(0);
      }
      await dialog.locator('[data-availability-action="change-date"]').click();
      await expect(dialog).toBeHidden();
      await expect(page.locator('#availability-date')).toBeFocused();
    }
  }
});
