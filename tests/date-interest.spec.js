const { test, expect, checkDate, available } = require('./fixtures');

test('weekend demand wording stays stable across rechecks and reloads, with no fabricated counts', async ({ page }) => {
  await page.goto('/');
  if (page.viewportSize().width < 768) await page.locator('.hero-quote-button').click();
  await page.locator('#availability-date').fill('2030-06-15');
  await page.locator('#availability-quantity').fill('30');
  await page.locator('#availability-form button[type="submit"]').click();
  const message = page.locator('.availability-date-interest');
  await expect(message).toBeVisible();
  const copy = await message.innerText();
  expect(copy).toMatch(/🔥.*popular date/);
  expect(copy).not.toMatch(/\d|enquir|sample/);
  await page.locator('#availability-back-to-step-1').click();
  await page.locator('#availability-form button[type="submit"]').click();
  await expect(message).toHaveText(copy);
  await page.reload();
  if (page.viewportSize().width < 768) await page.locator('.hero-quote-button').click();
  await page.locator('#availability-date').fill('2030-06-15');
  await page.locator('#availability-quantity').fill('30');
  await page.locator('#availability-form button[type="submit"]').click();
  await expect(message).toHaveText(copy);
});

test('weekday and unavailable results do not show weekend demand messaging', async ({ page, backend }) => {
  await checkDate(page, 30);
  await expect(page.locator('#availability-step-2-panel')).toBeVisible();
  await page.locator('#availability-back-to-step-1').click();
  await page.locator('#availability-date').fill('2030-06-17'); // Monday.
  await page.locator('#availability-form button[type="submit"]').click();
  await expect(page.locator('#availability-step-2-panel')).toBeVisible();
  await expect(page.locator('.availability-date-interest')).toBeHidden();
  backend.replies.checkAvailability = { ...available, available: false, partialAvailable: false, maxAvailable: 0 };
  await checkDate(page, 30);
  await expect(page.locator('.availability-date-interest')).toBeHidden();
});
