const { test, expect, booking } = require('./fixtures');
const sessionId = 'cs_test_Verified123456';
const verified = mode => ({ success: true, paymentVerified: true, bookingId: 'LH-test',
  purchaseReceipt: { transaction_id: sessionId, value: 75, currency: 'AUD', booking_mode: mode,
    items: [{ item_id: 'lustre_hire_deposit', item_name: 'Candle hire booking deposit', price: 75, quantity: 1 }] } });
const purchases = page => page.evaluate(() => window.dataLayer.filter(e => e[0] === 'event' && e[1] === 'purchase').map(e => e[2]));
async function seed(page, mode = 'direct', cached = false) {
  await page.goto('/');
  await page.evaluate(({ data, cached }) => sessionStorage.setItem(cached ? 'lustreHireConfirmedBookingSaved' : 'lustreHirePendingBooking', JSON.stringify(data)),
    { data: { ...booking, mode, stripeSessionId: sessionId }, cached });
}
for (const mode of ['direct', 'quote']) {
  test(`${mode}: verified purchase, privacy, duplicate callback, refresh and revisit`, async ({ page, backend }) => {
    const result = verified(mode);
    result.purchaseReceipt.email = booking.email;
    result.purchaseReceipt.items[0].customer = booking.fullName;
    backend.replies[mode === 'direct' ? 'saveConfirmedBooking' : 'markQuoteAsConfirmed'] = result;
    backend.replies.getVerifiedPurchaseReceipt = { ...result, alreadyConfirmed: true };
    await seed(page, mode);
    await page.goto(`/payment-success.html?session_id=${sessionId}&quoteToken=test-token`);
    await expect(page.locator('#payment-success-status')).toContainText('deposit has been received');
    expect(await purchases(page)).toEqual([expect.objectContaining({ transaction_id: sessionId, value: 75, currency: 'AUD', booking_mode: mode,
      items: [{ item_id: 'lustre_hire_deposit', item_name: 'Candle hire booking deposit', price: 75, quantity: 1 }], send_to: 'G-1RPLQ8LZ48' })]);
    const payload = JSON.stringify(await purchases(page));
    for (const secret of [booking.fullName, booking.email, 'test-token', 'hireFee', 'bondAmount', '?session_id']) expect(payload).not.toContain(secret);
    await page.evaluate(result => { window.trackLustrePurchase(result); window.trackLustreEvent('purchase', result.purchaseReceipt); }, result);
    expect(await purchases(page)).toHaveLength(1);
    await page.reload();
    await expect.poll(() => backend.calls.length).toBe(2);
    expect(await purchases(page)).toHaveLength(0);
    await page.goto('/');
    await page.goto(`/payment-success.html?session_id=${sessionId}`);
    await expect.poll(() => backend.calls.length).toBe(3);
    expect(await purchases(page)).toHaveLength(0);
    expect(backend.calls.map(c => c.action)).toEqual([mode === 'direct' ? 'saveConfirmedBooking' : 'markQuoteAsConfirmed', 'getVerifiedPurchaseReceipt', 'getVerifiedPurchaseReceipt']);
    await expect(page.locator('script[src*="gtm.js"], script[src*="fbevents.js"], script[src*="clarity"]')).toHaveCount(0);
  });
}
const invalid = {
  'missing receipt': r => { delete r.purchaseReceipt; },
  'unverified payment': r => { r.paymentVerified = false; },
  'nonboolean success': r => { r.success = 'true'; },
  'zero amount': r => { r.purchaseReceipt.value = 0; },
  'negative amount': r => { r.purchaseReceipt.value = -75; },
  'string amount': r => { r.purchaseReceipt.value = '75'; },
  'invalid currency': r => { r.purchaseReceipt.currency = 'USD'; },
  'invalid session': r => { r.purchaseReceipt.transaction_id = 'pi_secret'; },
  'mismatched session': r => { r.purchaseReceipt.transaction_id = 'cs_test_Other123'; },
  'inconsistent deposit': r => { r.purchaseReceipt.items[0].price = 150; },
  'invalid item': r => { r.purchaseReceipt.items[0].item_name = booking.fullName; },
  'invalid quantity': r => { r.purchaseReceipt.items[0].quantity = 2; },
};
for (const [name, mutate] of Object.entries(invalid)) {
  test(`no purchase: ${name}`, async ({ page, backend }) => {
    const result = verified('direct'); mutate(result);
    backend.replies.saveConfirmedBooking = result;
    if (result.paymentVerified !== true || result.success !== true) backend.expectedErrors.push(/^Confirmed booking save error:/);
    await seed(page);
    await page.goto(`/payment-success.html?session_id=${sessionId}`);
    await expect(page.locator('#payment-success-status')).not.toHaveClass(/status-loading/);
    expect(await purchases(page)).toHaveLength(0);
    if (result.paymentVerified !== true || result.success !== true) {
      await expect(page.locator('#payment-success-status')).toContainText('could not finish confirming');
      expect(await page.evaluate(() => sessionStorage.getItem('lustreHirePendingBooking'))).not.toBeNull();
    }
  });
}
for (const success of [true, false]) {
  test(`cached confirmation uses only read-only receipt lookup: ${success}`, async ({ page, backend }) => {
    backend.replies.getVerifiedPurchaseReceipt = success ? verified('direct') : { success: false };
    await seed(page, 'direct', true);
    await page.goto(`/payment-success.html?session_id=${sessionId}`);
    await expect.poll(() => backend.calls.length).toBe(1);
    await expect(page.locator('#payment-success-summary')).toContainText(booking.fullName);
    expect(backend.calls[0]).toEqual({ action: 'getVerifiedPurchaseReceipt', stripeSessionId: sessionId });
    await expect.poll(async () => (await purchases(page)).length).toBe(success ? 1 : 0);
    expect(await page.evaluate(() => sessionStorage.getItem('lustreHireConfirmedBookingSaved'))).not.toBeNull();
  });
}
test('nonfinite amounts rejected; memory guard survives blocked storage', async ({ page }) => {
  await page.goto('/payment-success.html');
  const result = verified('direct');
  expect(await page.evaluate(result => {
    result.purchaseReceipt.value = Infinity;
    return window.trackLustrePurchase(result);
  }, result)).toBe(false);
  await page.evaluate(result => {
    Storage.prototype.setItem = () => { throw Error('blocked'); };
    window.trackLustrePurchase(result); window.trackLustrePurchase(result);
  }, result);
  expect(await purchases(page)).toHaveLength(1);
});
test('cache without a valid session is never payment proof', async ({ page, backend }) => {
  await seed(page, 'direct', true);
  await page.evaluate(() => {
    const key = 'lustreHireConfirmedBookingSaved';
    const data = JSON.parse(sessionStorage.getItem(key));
    delete data.stripeSessionId;
    sessionStorage.setItem(key, JSON.stringify(data));
  });
  await page.goto('/payment-success.html?session_id=invalid');
  await expect(page.locator('#payment-success-status')).toContainText('previously saved');
  expect(backend.calls).toEqual([]);
  expect(await purchases(page)).toHaveLength(0);
});
test('receipt recovery without browser booking details never saves a booking', async ({ page, backend }) => {
  backend.replies.getVerifiedPurchaseReceipt = verified('quote');
  await page.goto(`/payment-success.html?session_id=${sessionId}`);
  await expect.poll(async () => (await purchases(page)).length).toBe(1);
  expect(backend.calls.map(c => c.action)).toEqual(['getVerifiedPurchaseReceipt']);
  await expect(page.locator('#payment-success-status')).toContainText('contact us');
});
test('failed network receipt lookup preserves cached confirmation', async ({ page, backend }) => {
  await seed(page, 'direct', true);
  await page.route('https://script.google.com/**', route => route.abort());
  backend.expectedErrors.push(/^Failed to load resource:/);
  await page.goto(`/payment-success.html?session_id=${sessionId}`);
  await expect(page.locator('#payment-success-summary')).toContainText(booking.fullName);
  expect(await purchases(page)).toHaveLength(0);
  expect(await page.evaluate(() => sessionStorage.getItem('lustreHireConfirmedBookingSaved'))).not.toBeNull();
});
test('throwing analytics preserves verified booking and confirmation', async ({ page, backend }) => {
  backend.replies.saveConfirmedBooking = verified('direct');
  await seed(page);
  await page.route('**/lustre-tracking.js', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: (await response.text()) + '\nwindow.trackLustrePurchase = () => { throw Error("analytics unavailable"); };' });
  });
  await page.goto(`/payment-success.html?session_id=${sessionId}`);
  await expect(page.locator('#payment-success-status')).toContainText('deposit has been received');
  await expect(page.locator('#payment-success-summary')).toContainText(booking.fullName);
  expect(await page.evaluate(() => sessionStorage.getItem('lustreHirePendingBooking'))).toBeNull();
});
