const { test, expect, checkDate } = require('./fixtures');

test('successful availability stays aligned across requested viewport widths', async ({ page }, testInfo) => {
  for (const width of [1280, 768, 375, 430]) {
    await page.setViewportSize({ width, height: 1000 });
    await checkDate(page, 15);
    const result = page.locator('#availability-result');
    await expect(result).toBeVisible();
    const geometry = await result.evaluate(root => {
      const rect = selector => root.querySelector(selector).getBoundingClientRect();
      const icon = rect('.availability-success-icon');
      const heading = rect('h4');
      const labels = [...root.querySelectorAll('.availability-success-summary-label')].map(el => el.getBoundingClientRect());
      const values = [...root.querySelectorAll('.availability-success-summary-item strong')].map(el => el.getBoundingClientRect());
      return {
        centered: Math.abs(icon.y + icon.height / 2 - heading.y - heading.height / 2) < 1,
        headingLines: heading.height / parseFloat(getComputedStyle(root.querySelector('h4')).lineHeight),
        headingSize: parseFloat(getComputedStyle(root.querySelector('h4')).fontSize),
        labelsAligned: Math.abs(labels[0].y - labels[1].y) < 1,
        valuesAligned: Math.abs(values[0].y - values[1].y) < 1,
        stackedAligned: Math.abs(labels[0].x - labels[1].x) < 1,
        fits: [...root.querySelectorAll('*')].every(el => {
          const r = el.getBoundingClientRect();
          return r.left >= 0 && r.right <= innerWidth + 1 && el.scrollWidth <= el.clientWidth + 1;
        }),
      };
    });
    expect(geometry.centered).toBe(true);
    expect(geometry.headingLines).toBeLessThanOrEqual(2.1);
    expect(geometry.fits).toBe(true);
    if (width >= 1280) {
      expect(geometry.labelsAligned).toBe(true);
      expect(geometry.valuesAligned).toBe(true);
    } else {
      expect(geometry.stackedAligned).toBe(true);
    }
    if (width <= 430) expect(geometry.headingSize).toBe(18);
    await expect(page.locator('#availability-ready-button')).toHaveText('Secure My Date for $75');
    await page.locator('#availability-step-1-panel').screenshot({ path: `/tmp/lustre-polish-${testInfo.project.name}-${width}.png` });
  }
});
