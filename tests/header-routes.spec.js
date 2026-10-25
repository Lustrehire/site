const { test, expect } = require('./fixtures');

test('gallery and FAQ navigation uses real files without extensionless server routing', async ({ page }) => {
  // Model a basic static preview where clean routes are not configured.
  await page.route('**/gallery', route => route.fulfill({ status: 404, body: 'Cannot GET /gallery' }));
  await page.route('**/faq', route => route.fulfill({ status: 404, body: 'Cannot GET /faq' }));
  await page.goto('/');
  await page.locator('#gallery-preview > a[href="/gallery.html"]').click();
  expect(new URL(page.url()).pathname).toBe('/gallery.html');
  await expect(page.locator('h1')).toHaveText('Candle styling gallery.');
  await expect(page.locator('[data-gallery-image]')).toHaveCount(require('../content/gallery.json').length);
  await page.goto('/');
  await page.locator('#faq > a[href="/faq.html"]').click();
  expect(new URL(page.url()).pathname).toBe('/faq.html');
  await expect(page.locator('h1')).toHaveText('Your questions, answered.');
});

test('sticky header stays visible and availability fields remain unobscured', async ({ page }) => {
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of ['/', '/gallery.html', '/faq.html']) {
      await page.goto(route);
      await page.evaluate(() => window.scrollTo(0, 800));
      await expect.poll(() => page.locator('.header-container').evaluate(el => Math.abs(el.getBoundingClientRect().top))).toBeLessThan(1);
      if (width < 1100) {
        await page.locator('.menu-toggle').click();
        await expect(page.locator('.mobile-nav a[href="/gallery.html"]')).toBeVisible();
        await page.keyboard.press('Escape');
      }
    }
    await page.goto('/');
    await page.locator('.cro-ready a[href="#availability"]').click();
    await expect(page.locator('#availability-date')).toBeInViewport();
    await expect.poll(() => page.evaluate(() => document.querySelector('#availability-date').getBoundingClientRect().top - document.querySelector('.header-container').getBoundingClientRect().bottom)).toBeGreaterThanOrEqual(0);
  }
});
