const { execFileSync } = require('node:child_process');
const { test, expect } = require('./fixtures');

test('all static page links, anchors and local assets resolve to nonempty files', async () => {
  const report = JSON.parse(execFileSync('python3', ['scripts/audit-internal-links.py'], { cwd: require('node:path').resolve(__dirname, '..'), encoding: 'utf8' }));
  expect(report.pages).toBeGreaterThan(20);
  expect(report.internal_targets_checked).toBeGreaterThan(1000);
  expect(report.issues).toEqual([]);
});

test('gallery and FAQs match homepage styling and link back to the original availability flow', async ({ page }) => {
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const route of ['/gallery', '/faq']) {
      await page.goto(route);
      await expect(page.locator('main h1')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      expect(await page.locator('body').evaluate(el => getComputedStyle(el).backgroundColor)).toBe('rgb(250, 249, 245)');
      await expect(page.locator('.cro-page-intro a[href="/#availability"]')).toBeVisible();
      await page.locator('.cro-page-intro a[href="/#availability"]').click();
      await expect(page.locator('#availability-form')).toBeInViewport();
    }
  }
});
