const { test, expect, checkDate } = require('./fixtures');

test('desktop uses one hero availability form and a separate, initially simple estimator', async ({ page }) => {
  for (const width of [1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/');
    await expect(page.locator('.hero #availability-form')).toBeVisible();
    await expect(page.locator('.hero .hero-buttons')).toBeHidden();
    await expect(page.locator('.hero #candle-calculator')).toHaveCount(0);
    await expect(page.locator('#wedding-estimator-panel #calculator-start')).toBeVisible();
    await expect(page.locator('#calculator-flow-panel')).toBeHidden();
    await expect(page.locator('#availability-form')).toHaveCount(1);
    await expect(page.locator('#candle-calculator')).toHaveCount(1);
    await expect(page.locator('#other-event-quantity')).toHaveCount(0);
    if (width >= 1100) {
      const edges = await page.evaluate(() => ({
        heading: document.querySelector('#candle-packages h2').getBoundingClientRect().top,
        panel: document.querySelector('#wedding-estimator-panel').getBoundingClientRect(),
        headingBottom: document.querySelector('#wedding-estimator-panel .cro-section-heading').getBoundingClientRect().top,
        buttonBottom: document.querySelector('.estimator-highlights').getBoundingClientRect().bottom,
      }));
      expect(Math.abs(edges.panel.top - edges.heading)).toBeLessThanOrEqual(1);
      expect(edges.headingBottom - edges.panel.top).toBeLessThanOrEqual(36);
      expect(edges.panel.bottom - edges.buttonBottom).toBeLessThanOrEqual(36);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.locator('#calculator-start').click();
    await expect(page.locator('#calculator-flow-panel')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

test('result modal restores the hero form, including after resizing to mobile', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await checkDate(page, 45);
  await expect(page.locator('#availability-dialog #availability-form')).toHaveCount(1);
  await page.locator('#availability-edit-button').click();
  await expect(page.locator('.hero #availability-form')).toBeVisible();
  await expect(page.locator('#availability-quantity')).toHaveValue('45');
  await page.locator('#availability-form button[type="submit"]').click();
  await expect(page.locator('#availability-dialog')).toBeVisible();
  await page.setViewportSize({ width: 390, height: 900 });
  await expect(page.locator('#availability-dialog #availability-form')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(page.locator('#main-content > #availability-checker #availability-form')).toBeVisible();
  await expect(page.locator('#availability-checker #candle-calculator')).toHaveCount(1);
  await expect(page.locator('#wedding-estimator-panel')).toBeHidden();
  await expect(page.locator('.hero .hero-buttons')).toBeHidden();
  await expect(page.locator('#availability-quantity')).toHaveValue('45');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(page.locator('.hero #availability-form')).toBeVisible();
  await expect(page.locator('#wedding-estimator-panel #candle-calculator')).toHaveCount(1);
});
