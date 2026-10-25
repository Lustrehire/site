const { test, expect } = require('./fixtures');

test('both understated section CTAs reach the original form without submitting it', async ({ page, backend }) => {
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/');
    await expect(page.locator('.journey-booking-cta')).toHaveCount(2);
    for (const section of ['benefits', 'testimonials']) {
      const cta = page.locator(`#${section} .journey-booking-cta`);
      await expect(cta).toBeVisible();
      expect((await cta.boundingBox()).height).toBeGreaterThanOrEqual(48);
      await cta.click();
      await expect(page.locator('#availability-form')).toBeInViewport();
      if (width >= 768) await expect(page.locator('#availability-date')).toBeFocused();
      await expect(page.locator('#availability-form')).toHaveCount(1);
      await expect(page.locator('#availability-result')).toBeHidden();
    }
    expect(backend.calls).toHaveLength(0);
  }
});
