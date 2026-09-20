const { test, expect, booking, available, checkoutUrl, checkDate, fillBooking, reviewBooking } = require('./fixtures');

test('homepage smoke @critical', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Lustre Hire/);
  await expect(page.getByRole('link', { name: 'Check Date & Get Quote', exact: true })).toBeVisible();
  await expect(page.locator('#availability-checker')).toBeVisible();
  await expect(page.locator('#availability-form').getByRole('button', { name: /check/i })).toBeVisible();
});

test('available date allows continuing @critical', async ({ page, backend }) => {
  await checkDate(page);
  await expect(page.locator('#availability-result')).toContainText('Your date is available');
  await expect(page.locator('#availability-ready-button')).toBeVisible();
  await expect(page.locator('#availability-continue-button')).toBeVisible();
  expect(backend.calls[0]).toEqual({ action: 'checkAvailability', eventDate: booking.eventDate, quantity: 50 });
});

test('minimum order prevents continuing below 15 candles', async ({ page }) => {
  await checkDate(page, 14);
  // Test the requirement, not the current implementation. Do not mark a product bug as expected.
  await expect(page.locator('#availability-feedback')).toContainText(/minimum|at least|15/i);
  await expect(page.locator('#availability-ready-button')).toBeHidden();
  await expect(page.locator('#availability-continue-button')).toBeHidden();
});

test('unavailable date blocks booking', async ({ page, backend }) => {
  backend.replies.checkAvailability = { ...available, available: false, partialAvailable: false, status: 'unavailable', maxAvailable: 0 };
  await checkDate(page);
  await expect(page.locator('#availability-result')).toContainText('fully booked');
  await expect(page.locator('#availability-ready-button')).toBeHidden();
  await expect(page.locator('#availability-continue-button')).toBeHidden();
});

test('partial availability offers the available quantity', async ({ page, backend }) => {
  backend.replies.checkAvailability = { ...available, available: false, partialAvailable: true, maxAvailable: 30 };
  await checkDate(page);
  await expect(page.locator('#availability-result')).toContainText('almost booked out');
  await expect(page.locator('[data-availability-action="continue-limited"]')).toContainText('30');
  await expect(page.locator('#availability-ready-button')).toBeHidden();
});

test('email quote collects customer and event details', async ({ page, backend }) => {
  await checkDate(page);
  await page.locator('#availability-continue-button').click();
  await page.locator('#availability-full-name').fill(booking.fullName);
  await page.locator('#availability-email').fill(booking.email);
  await page.locator('#availability-step-2-submit').click();
  await expect(page.locator('#availability-step-4-panel')).toBeVisible();
  await expect(page.locator('#availability-step-4-panel')).toContainText('Quote emailed');
  expect(backend.calls.filter(call => call.action === 'saveQuoteBooking')).toHaveLength(1);
  expect(backend.calls.find(call => call.action === 'saveQuoteBooking').bookingData).toMatchObject({
    fullName: booking.fullName, email: booking.email, eventDate: booking.eventDate,
    quantity: 50, pickupDate: booking.pickupDate, returnDate: booking.returnDate, mode: 'quote',
  });
  expect(backend.calls.some(call => /Checkout/.test(call.action))).toBe(false);
});

for (const revalidated of [false, true]) {
  test(`${revalidated ? 'old revalidated' : 'current'} quote continues to booking @critical`, async ({ page, backend }) => {
    backend.replies.getQuoteByToken = {
      success: true, status: 'valid', quoteRevalidated: revalidated,
      booking: { ...booking, quoteExpiresAt: revalidated ? '2030-01-08T00:00:00Z' : '2030-06-07T00:00:00Z' },
    };
    await page.goto('/quote.html?quoteToken=test-token');
    const summary = page.locator('#quote-review-summary');
    await expect(summary).toContainText(booking.bookingId);
    await expect(summary).toContainText(booking.fullName);
    await expect(summary).toContainText('Candle hire $321');
    await expect(summary).toContainText('Refundable bond $321');
    await expect(summary).toContainText('Total $642');
    await expect(page.getByText('Your quote is still available', { exact: true })).toHaveCount(revalidated ? 1 : 0);
    if (revalidated) await expect(page.locator('#quote-review-result')).toContainText('We’ve rechecked your date and candle availability');
    await expect(page.locator('main')).not.toContainText(/expired/i);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole('link', { name: 'I’m ready to secure booking' }).click();
    await expect(page).toHaveURL(/book.html\?quoteToken=test-token/);
    await expect(page.locator('#book-form-panel')).toBeVisible();
    await expect(page.locator('main')).not.toContainText(/expired/i);
    // Includes the mobile project; detect clipped or horizontally overflowing content.
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

for (const file of ['quote.html', 'book.html']) {
  for (const status of ['unavailable', 'paid', 'missing', 'notice_period']) {
    test(`${file}: ${status} quote blocks checkout`, async ({ page, backend }) => {
      backend.replies.getQuoteByToken = {
        success: status !== 'missing', status, quoteRevalidated: true,
        message: 'Test backend status message', ...(status === 'missing' ? {} : { booking }),
      };
      await page.goto(`/${file}?quoteToken=test-token`);
      const main = page.locator('main');
      await expect(main).toContainText(status === 'paid' ? /already.*paid/ : 'Test backend status message');
      await expect(page.getByRole('link', { name: 'I’m ready to secure booking' })).toHaveCount(0);
      if (file === 'book.html') await expect(page.locator('#book-form-panel')).toBeHidden();
      if (status === 'unavailable') await expect(main.getByRole(file === 'book.html' ? 'button' : 'link', { name: 'Contact us', exact: true })).toBeVisible();
      expect(backend.calls.map(call => call.action)).toEqual(['getQuoteByToken']);
    });
  }
}

test('quote page without token shows recovery actions', async ({ page, backend }) => {
  await page.goto('/quote.html');
  await expect(page.locator('#quote-page-error-actions')).toBeVisible();
  expect(backend.calls).toEqual([]);
});

for (const field of ['full-name', 'email', 'address', 'phone', 'pickup-time-window', 'dropoff-time-window']) {
  test(`booking requires ${field}`, async ({ page, backend }) => {
    await page.goto('/book.html?quoteToken=test-token');
    await fillBooking(page);
    const input = page.locator(`#book-${field}`);
    if (field.endsWith('window')) await input.selectOption('');
    else await input.fill('');
    await page.locator('#book-review-button').click();
    await expect(page.locator('#book-form-feedback')).toContainText('Enter your name, email, address, phone number, and both time windows');
    await expect(page.locator('#book-review-panel')).toBeHidden();
    expect(backend.calls.some(call => /Checkout/.test(call.action))).toBe(false);
  });
}

test('booking review and terms @critical', async ({ page, backend }) => {
  await page.goto('/book.html?quoteToken=test-token');
  await reviewBooking(page);
  const summary = page.locator('#book-review-summary');
  for (const text of ['15 June 2030', '14 June 2030', '16 June 2030', /Candle quantity\s*50/, 'Candle hire $321', 'Refundable bond $321', '$642']) {
    await expect(summary).toContainText(text);
  }
  await expect(page.locator('#book-payment-button')).toBeDisabled();
  expect(backend.calls.some(call => /Checkout/.test(call.action))).toBe(false);
  await page.locator('#book-terms-checkbox').check();
  await expect(page.locator('#book-payment-button')).toBeEnabled();
  await page.locator('#book-terms-checkbox').uncheck();
  await expect(page.locator('#book-payment-button')).toBeDisabled();
});

for (const mode of ['quote', 'direct']) {
  test(`${mode} checkout uses fake destination only @critical`, async ({ page, backend }) => {
    if (mode === 'quote') {
      backend.replies.getQuoteByToken = { success: true, status: 'valid', quoteRevalidated: true, booking };
      await page.goto('/quote.html?quoteToken=test-token');
      await page.getByRole('link', { name: 'I’m ready to secure booking' }).click();
    } else {
      await checkDate(page);
      await page.locator('#availability-ready-button').click();
    }
    await reviewBooking(page);
    await expect(page.locator('#book-payment-button')).toBeDisabled();
    expect(backend.calls.some(call => /Checkout/.test(call.action))).toBe(false);
    await page.locator('#book-terms-checkbox').check();
    await page.locator('#book-payment-button').click();
    await expect(page).toHaveURL(checkoutUrl);
    await expect(page.getByRole('heading')).toHaveText('Mock checkout destination');
    const checkout = backend.calls.filter(call => /Checkout/.test(call.action));
    expect(checkout).toHaveLength(1);
    expect(checkout[0].action).toBe(mode === 'quote' ? 'createQuoteCheckoutSession' : 'createCheckoutSession');
    expect(checkout[0].bookingData).toMatchObject({ fullName: booking.fullName, email: booking.email, address: '123 Test Street, Perth', phone: '0400000000', quantity: 50, eventDate: booking.eventDate, pickupTimeWindow: '9:00 AM to 11:00 AM', dropoffTimeWindow: '1:00 PM to 3:00 PM', hireFee: mode === 'quote' ? 321 : 494 });
    expect(checkout[0].bookingData.successUrl).toBe('http://127.0.0.1:4173/payment-success.html');
    expect(checkout[0].bookingData.cancelUrl).toBe('http://127.0.0.1:4173/payment-cancelled.html');
    if (mode === 'quote') expect(checkout[0].quoteToken).toBe('test-token');
  });
}

test('checkout failure preserves details and allows retry @critical', async ({ page, backend }) => {
  backend.replies.createQuoteCheckoutSession = { success: false, message: 'Checkout temporarily unavailable' };
  backend.expectedErrors.push(/^Checkout session preparation error: Error: checkout_preparation_failed$/);
  await page.goto('/book.html?quoteToken=test-token');
  await reviewBooking(page);
  await page.locator('#book-terms-checkbox').check();
  await page.locator('#book-payment-button').click();
  await expect(page.locator('#book-review-feedback')).toContainText('We couldn’t start secure payment right now');
  await expect(page.locator('#book-retry-payment-button')).toBeVisible();
  await expect(page.locator('#book-review-summary')).toContainText('123 Test Street, Perth');
  await page.locator('#book-review-back-button').click();
  await expect(page.locator('#book-address')).toHaveValue('123 Test Street, Perth');
  await page.locator('#book-review-button').click();
  await page.locator('#book-terms-checkbox').check();
  await page.locator('#book-payment-button').click();
  await expect(page.locator('#book-retry-payment-button')).toBeVisible();
  backend.replies.createQuoteCheckoutSession = { success: true, checkoutUrl };
  await page.locator('#book-retry-payment-button').click();
  await expect(page).toHaveURL(checkoutUrl);
});

test('booking blocks a failed fresh availability check', async ({ page, backend }) => {
  backend.replies.checkAvailability = { ...available, available: false, message: 'Stock changed before booking' };
  await page.goto('/book.html?quoteToken=test-token');
  await expect(page.locator('#book-page-status')).toHaveText('Stock changed before booking');
  await expect(page.locator('#book-form-panel')).toBeHidden();
});
