const { test, expect, booking } = require('./fixtures');
async function show(page, data) {
  await page.addInitScript(data => { window.lustrePreviewFindRecord = async () => data; }, data);
  await page.goto('/');
  if (page.viewportSize().width <= 1100) await page.getByRole('button', { name: 'Toggle navigation' }).click();
  await page.getByRole('button', { name: 'Find my quote or booking', exact: true }).click();
  await page.locator('#existing-record-reference').fill(booking.bookingId);
  await page.locator('#existing-record-email').fill(booking.email);
  await page.locator('#existing-record-next').click();
  await expect(page.locator('#existing-record-result')).toBeVisible();
}
for (const [status, title, action] of [
  ['missing', 'Let’s find your quote', 'Check your details'],
  ['unavailable', 'This date is now fully booked', 'Try another date'],
  ['past', 'This event date has passed', 'Get a new quote'],
  ['notice_period', 'Let’s confirm this with you', 'Contact us'],
  ['cancelled', 'This booking was cancelled', 'Get a new quote'],
]) test(`${status} has a clear recovery action and cannot charge a deposit`, async ({ page, backend }) => {
  await show(page, { status, ...(status === 'missing' ? {} : { booking }) });
  const result = page.locator('#existing-record-result');
  await expect(result.getByRole('heading', { name: title })).toBeVisible();
  await expect(result.getByRole('button', { name: action, exact: true })).toBeVisible();
  await expect(result.getByRole('link', { name: /Book now/ })).toHaveCount(0);
  expect(backend.calls).toHaveLength(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
test('price change clearly compares prices and requires review before continuing', async ({ page }) => {
  await show(page, { status: 'price_updated', previousHireFee: 300, booking: { ...booking, hireFee: 330 } });
  const result = page.locator('#existing-record-result');
  await expect(result).toContainText('Previous candle hire: $300');
  await expect(result).toContainText('Updated candle hire: $330');
  const link = result.getByRole('link', { name: /Book now/ });
  // Without href it has no implicit link role until accepted.
  await expect(result.locator('.record-book-quote')).not.toHaveAttribute('href');
  await result.getByRole('checkbox', { name: 'I’ve reviewed the updated price.' }).check();
  await expect(link).toHaveAttribute('href', /book.html\?quoteToken=test-token/);
});
test('partial stock uses an explicit quantity and the existing adjusted-quantity route', async ({ page }) => {
  await show(page, { status: 'partial', booking: { ...booking, quantity: 50 }, adjustedBooking: { ...booking, quantity: 30, hireFee: 300 } });
  const result = page.locator('#existing-record-result');
  await expect(result).toContainText('original quote was for 50 candles');
  await expect(result).toContainText('now have 30 available');
  await expect(result.getByRole('link', { name: 'Continue with 30 candles →' })).toHaveAttribute('href', /adjustedQuantity=30/);
  await expect(result.locator('.record-deposit-total')).toHaveText('$150');
});

test('older quote automatically uses the existing revalidation route without an expiry screen', async ({ page, backend }) => {
  await page.addInitScript(data => { window.lustrePreviewFindRecord = async () => ({ status: 'expired', booking: data }); }, booking);
  backend.replies.getQuoteByToken = { success: true, status: 'valid', quoteRevalidated: true, booking };
  await page.goto('/');
  if (page.viewportSize().width <= 1100) await page.getByRole('button', { name: 'Toggle navigation' }).click();
  await page.getByRole('button', { name: 'Find my quote or booking', exact: true }).click();
  await page.locator('#existing-record-reference').fill(booking.bookingId);
  await page.locator('#existing-record-email').fill(booking.email);
  await page.locator('#existing-record-next').click();
  await expect(page).toHaveURL(/quote.html\?quoteToken=test-token/);
  await expect(page.locator('#quote-review-summary')).toBeVisible();
  expect(backend.calls.map(c => c.action)).toEqual(['getQuoteByToken', 'checkAvailability']);
  await expect(page.locator('main')).not.toContainText(/expired/i);
});

test('event too soon has exactly one contact action', async ({ page }) => {
  await show(page, { status: 'notice_period', booking });
  const result = page.locator('#existing-record-result');
  await expect(result.getByRole('button', { name: 'Contact us', exact: true })).toHaveCount(1);
  await expect(result.getByRole('link', { name: 'Contact us', exact: true })).toHaveCount(0);
});
test('lookup loading is clear and closing prevents stale results on reopening', async ({ page }) => {
  await page.addInitScript(data => {
    window.lustrePreviewFindRecord = () => new Promise(resolve => { window.finishPreviewLookup = () => resolve({ status: 'quote', booking: data }); });
  }, booking);
  await page.goto('/');
  if (page.viewportSize().width <= 1100) await page.getByRole('button', { name: 'Toggle navigation' }).click();
  await page.getByRole('button', { name: 'Find my quote or booking', exact: true }).click();
  await page.locator('#existing-record-reference').fill(booking.bookingId);
  await page.locator('#existing-record-email').fill(booking.email);
  await page.locator('#existing-record-next').click();
  await expect(page.locator('#existing-record-next')).toHaveText('Checking…');
  await expect(page.locator('#existing-record-email-form')).toHaveAttribute('aria-busy', 'true');
  await page.keyboard.press('Escape');
  if (page.viewportSize().width <= 1100) await page.getByRole('button', { name: 'Toggle navigation' }).click();
  await page.getByRole('button', { name: 'Find my quote or booking', exact: true }).click();
  await page.evaluate(() => window.finishPreviewLookup());
  await expect(page.locator('#existing-record-email-panel')).toBeVisible();
  await expect(page.locator('#existing-record-result')).toBeHidden();
  await expect(page.locator('#existing-record-next')).toBeEnabled();
});
