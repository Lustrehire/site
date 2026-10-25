const { test, expect } = require('./fixtures');

test('desktop reviews show three aligned cards with working arrows, dots and keyboard controls', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  const track = page.locator('#customer-reviews');
  await track.scrollIntoViewIfNeeded();
  const sizes = await track.locator('.testimonial-card').evaluateAll(cards => cards.map(card => ({ width: card.getBoundingClientRect().width, height: card.getBoundingClientRect().height })));
  expect(sizes).toHaveLength(4);
  expect(sizes.every(s => Math.abs(s.width - sizes[0].width) < 1 && Math.abs(s.height - sizes[0].height) < 1)).toBe(true);
  const width = await track.evaluate(el => el.clientWidth);
  expect(Math.abs(sizes[0].width * 3 + 40 - width)).toBeLessThan(2);
  await expect(page.locator('#testimonials .testimonials-link')).toHaveCount(0);
  await expect(page.locator('.review-previous')).toBeDisabled();
  await page.locator('.review-next').click();
  await expect.poll(() => track.evaluate(el => el.scrollLeft)).toBeGreaterThan(100);
  await expect(page.locator('.review-next')).toBeDisabled();
  await page.locator('[data-review-index="0"]').click();
  await expect.poll(() => track.evaluate(el => el.scrollLeft)).toBeLessThan(1);
  await track.focus();
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => track.evaluate(el => el.scrollLeft)).toBeGreaterThan(100);
  await page.setViewportSize({ width: 390, height: 900 });
  await expect(page.locator('[data-review-index="3"]')).toBeVisible();
  await page.locator('[data-review-index="3"]').click();
  await expect(page.locator('[data-review-index="3"]')).toHaveAttribute('aria-pressed', 'true');
});
