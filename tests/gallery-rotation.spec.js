const { test, expect } = require('./fixtures');

test('inspiration rotates without moving its slots and opens the replacement in the lightbox', async ({ page }) => {
  await page.goto('/');
  const photo = page.locator('#gallery-preview [data-gallery-image]').first();
  await photo.scrollIntoViewIfNeeded();
  await page.mouse.move(0, 0);
  const before = await photo.getAttribute('href');
  const size = await photo.boundingBox();
  await expect.poll(() => photo.getAttribute('href'), { timeout: 12000 }).not.toBe(before);
  const afterSize = await photo.boundingBox();
  expect(afterSize.width).toBeCloseTo(size.width, 0);
  expect(afterSize.height).toBeCloseTo(size.height, 0);
  const replacement = await photo.getAttribute('href');
  await photo.click();
  await expect(page.locator('#gallery-lightbox')).toBeVisible();
  await expect(page.locator('#gallery-full-image')).toHaveAttribute('src', new URL(replacement, page.url()).href);
  await page.waitForTimeout(5200);
  await expect(photo).toHaveAttribute('href', replacement);
});

test('rotation can be paused and reduced motion starts paused', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const control = page.locator('.gallery-rotation-control');
  await expect(control).toBeVisible();
  const photo = page.locator('#gallery-preview [data-gallery-image]').first();
  await photo.scrollIntoViewIfNeeded();
  await page.mouse.move(0, 0);
  const before = await photo.getAttribute('href');
  await page.waitForTimeout(5200);
  await expect(photo).toHaveAttribute('href', before);
  await control.click();
  await expect(control).toHaveText('Pause photo rotation');
  await control.click();
  await expect(control).toHaveText('Play photo rotation');
});
