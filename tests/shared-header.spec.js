const fs = require('node:fs');
const path = require('node:path');
const { test, expect } = require('./fixtures');
const root = path.resolve(__dirname, '..');
const pages = fs.readdirSync(root).filter(f => f.endsWith('.html')).concat(fs.readdirSync(path.join(root, 'blog')).filter(f => f.endsWith('.html')).map(f => 'blog/' + f));

test('every page uses the same header dimensions, navigation and accessible mobile menu', async ({ page }) => {
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    let baseline;
    for (const file of pages) {
      await page.goto('/' + file);
      const header = page.locator('.site-header');
      await expect(header).toHaveCount(1);
      await expect(header.locator('.menu-toggle img')).toHaveCount(0);
      const signature = await header.evaluate(el => ({ height: el.getBoundingClientRect().height, logo: el.querySelector('.site-logo').getBoundingClientRect().width, title: getComputedStyle(el.querySelector('.site-title')).fontSize }));
      baseline ||= signature;
      expect(signature, file + ' header at ' + width).toEqual(baseline);
      if (width === 390) {
        await header.locator('.menu-toggle').click();
        await expect(header.locator('.menu-toggle')).toHaveAttribute('aria-expanded', 'true');
        await expect(header.locator('.mobile-nav a[href="/gallery.html"]')).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(header.locator('.menu-toggle')).toHaveAttribute('aria-expanded', 'false');
        await expect(header.locator('.mobile-nav')).toHaveAttribute('inert', '');
      } else {
        await expect(header.locator('.desktop-nav a')).toHaveCount(8);
        await expect(header.locator('.menu-toggle')).toBeHidden();
      }
      await page.evaluate(() => window.scrollTo(0, 700));
      await expect.poll(() => header.evaluate(el => Math.abs(el.getBoundingClientRect().top))).toBeLessThan(1);
    }
  }
});
