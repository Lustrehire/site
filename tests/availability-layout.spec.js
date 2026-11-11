const { test, expect, checkDate, captureQuote } = require('./fixtures');

test('contact and generated quote fit mobile through desktop', async ({ page }) => {
  for (const width of [320, 375, 430, 768, 1280, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await checkDate(page, 15);
    await expect(page.locator('#availability-step-2-panel')).toBeVisible();
    await expect(page.locator('.availability-price')).toHaveCount(0);
    await captureQuote(page);
    await expect(page.locator('#availability-created-quote')).toContainText('Candle hire $150');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

test('generated hire totals change with the quantity after contact submission', async ({ page }) => {
  for (const [quantity, hire, deposit, bond] of [[15, '$150', '$75', '$150'], [45, '$449', '$224.50', '$449'], [90, '$853', '$426.50', '$853']]) {
    await checkDate(page, quantity);
    await captureQuote(page);
    const result = page.locator('#availability-created-quote');
    await expect(result).toContainText(`Candle hire ${hire}`);
    await expect(result).toContainText(`Book with a deposit ${deposit}`);
    await expect(result).toContainText(`Refundable bond ${bond}`);
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
      expect(await heading.evaluate(el => getComputedStyle(el).fontFamily)).toContain('Georgia');
      const fits = await dialog.locator('.availability-result-actions button').evaluateAll(buttons => buttons.every(button => button.scrollWidth <= button.clientWidth + 1 && button.getBoundingClientRect().height >= 48));
      expect(fits).toBe(true);
      await expect(dialog.locator('.availability-price')).toHaveCount(0);
      if (!limited) await expect(dialog.locator('[data-availability-action="contact-us"]')).toHaveCSS('color', 'rgb(49, 91, 61)');
      await dialog.locator('[data-availability-action="change-date"]').click();
      if (width < 768) await expect(dialog).toBeVisible();
      else await expect(dialog).toBeHidden();
      await expect(page.locator('#availability-date')).toBeFocused();
    }
  }
});
