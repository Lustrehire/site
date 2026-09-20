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
  await expect(page.locator('.availability-price')).toHaveCount(0);
  await expect(page.locator('#availability-ready-button')).toBeHidden();
  await expect(page.locator('#availability-continue-button')).toBeHidden();
});

test('unavailable date blocks booking', async ({ page, backend }) => {
  backend.replies.checkAvailability = { ...available, available: false, partialAvailable: false, status: 'unavailable', maxAvailable: 0 };
  await checkDate(page);
  await expect(page.locator('#availability-result')).toContainText('fully booked');
  await expect(page.locator('.availability-price')).toHaveCount(0);
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
    await expect(summary).toContainText('Final payment $481.50');
    await expect(page.getByText('Your quote is still available', { exact: true })).toHaveCount(revalidated ? 1 : 0);
    if (revalidated) await expect(page.locator('#quote-review-result')).toContainText('We’ve rechecked your date and candle availability');
    await expect(page.locator('main')).not.toContainText(/expired/i);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole('link', { name: 'Pay Deposit & Secure My Date' }).click();
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
      await expect(main).toContainText(status === 'paid' ? /booking.*confirmed/i : 'Test backend status message');
      await expect(page.getByRole('link', { name: 'Pay Deposit & Secure My Date' })).toHaveCount(0);
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
  for (const text of ['15 June 2030', '14 June 2030', '16 June 2030', /Candle quantity\s*50/, 'Total candle hire: $321', 'Refundable bond: $321', 'Pay $160.50 today', '$481.50 is due 7 days before pickup']) {
    await expect(summary).toContainText(text);
  }
  await expect(page.locator('#book-payment-button')).toHaveText('Pay $160.50 Deposit');
  await expect(summary.getByRole('region', { name: 'Payment today' })).toContainText('$160.50');
  await expect(summary.getByRole('region', { name: 'Payment later' })).toContainText('$481.50');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
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
      await page.getByRole('link', { name: 'Pay Deposit & Secure My Date' }).click();
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

for (const [hire, deposit, remaining, final] of [[150,75,75,225],[600,300,300,900],[1000,500,500,1500],[150.01,75.01,75,225.01]]) {
  test(`staged payment rounding for $${hire}`, async ({ page }) => {
    await page.goto('/book.html');
    expect(await page.evaluate(hire => window.LustreHirePayment.calculate(hire), hire)).toEqual({
      depositAmount: deposit, remainingHireAmount: remaining, bondAmount: hire, finalPaymentAmount: final,
    });
  });
}

for (const mode of ['direct', 'quote']) {
  test(`${mode} deposit confirmation and reopening`, async ({ page, backend }) => {
    backend.replies.saveConfirmedBooking = { success: true, bookingId: booking.bookingId };
    backend.replies.markQuoteAsConfirmed = { success: true, bookingId: booking.bookingId };
    await page.goto('/');
    await page.evaluate(data => sessionStorage.setItem('lustreHirePendingBooking', JSON.stringify(data)), { ...booking, mode });
    await page.goto('/payment-success.html?session_id=test-session');
    await expect(page.locator('#payment-success-status')).toContainText('50% booking deposit has been received');
    const summary = page.locator('#payment-success-summary');
    await expect(summary).toContainText('Deposit paid today $160.50');
    await expect(summary).toContainText('Final payment $481.50');
    await expect(summary).toContainText(/7 June? 2030/);
    expect(backend.calls.map(call => call.action)).toEqual([mode === 'direct' ? 'saveConfirmedBooking' : 'markQuoteAsConfirmed']);
    expect(await page.evaluate(() => window.dataLayer.find(event => event.event === 'booking_confirmed').total_due)).toBe(160.50);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.reload();
    await expect(summary).toContainText('Deposit paid today $160.50');
    expect(backend.calls).toHaveLength(1);
  });
}

test('cancelled deposit preserves retry details', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(data => sessionStorage.setItem('lustreHirePendingBooking', JSON.stringify(data)), { ...booking, mode: 'direct' });
  await page.goto('/payment-cancelled.html');
  await expect(page.locator('main')).toContainText('your date has not been reserved');
  await expect(page.locator('#payment-cancelled-summary')).toContainText('Due today $160.50');
  await expect(page.locator('#payment-cancelled-summary')).toContainText('Final payment $481.50');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator('a[href*="book.html"]').first().click();
  await expect(page.locator('#book-form-panel')).toBeVisible();
});

test('expired quote retains recovery state', async ({ page, backend }) => {
  backend.replies.getQuoteByToken = { success: true, status: 'expired', booking, message: 'Your quote has expired. Check your date again.' };
  await page.goto('/quote.html?quoteToken=test-token');
  await expect(page.locator('main')).toContainText('Your quote has expired');
  await expect(page.getByRole('link', { name: 'Pay Deposit & Secure My Date' })).toHaveCount(0);
});

test('partial quote recalculates deposit after quantity adjustment', async ({ page, backend }) => {
  backend.replies.checkAvailability = { ...available, available: false, partialAvailable: true, maxAvailable: 30 };
  await page.goto('/quote.html?quoteToken=test-token');
  await page.locator('#quote-update-quantity-button').click();
  const summary = page.locator('#quote-review-summary');
  await expect(summary).toContainText('Due today $150');
  await expect(summary).toContainText('Final payment $450');
  await page.reload();
  await expect(page.locator('#quote-update-quantity-button')).toBeVisible();
});

for (const [quantity, hire, deposit] of [[15, '$150', '$75'], [50, '$494', '$247']]) {
  test(`availability immediately prices ${quantity} candles without personal details`, async ({ page }) => {
    await checkDate(page, quantity);
    const price = page.locator('.availability-price');
    await expect(price).toBeVisible();
    await expect(price).toContainText(`Candle hire ${hire}`);
    await expect(price).toContainText(`Secure today with a ${deposit} deposit.`);
    await expect(page.locator('#availability-full-name')).toHaveValue('');
    await expect(page.locator('#availability-email')).toHaveValue('');
    await expect(page.locator('#availability-success-actions button').first()).toHaveText(`Secure My Date for ${deposit}`);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test('partial availability prices resolved stock before and after adjustment', async ({ page, backend }) => {
  backend.replies.checkAvailability = { ...available, available: false, partialAvailable: true, maxAvailable: 45 };
  await checkDate(page, 80);
  const price = page.locator('.availability-price');
  await expect(price).toHaveAttribute('aria-label', 'Price for 45 candles');
  await expect(price).toContainText('Candle hire $449');
  await expect(price).toContainText('Secure today with a $224.50 deposit.');
  await page.locator('[data-availability-action="continue-limited"]').click();
  await expect(price).toContainText('Candle hire $449');
  await expect(page.locator('#availability-ready-button')).toBeVisible();
  await expect(page.locator('#availability-continue-button')).toBeVisible();
  await expect(page.locator('#availability-ready-button')).toHaveText('Secure My Date for $224.50');
  await expect(price).toContainText('Refundable bond $449');
  await expect(price).toContainText('Total $898');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('payment typography uses existing UI fonts and gives today priority', async ({ page }) => {
  await page.goto('/book.html?quoteToken=test-token');
  await reviewBooking(page);
  const today = page.locator('#book-review-summary .booking-payment-card-today');
  const later = page.locator('#book-review-summary .booking-payment-card:not(.booking-payment-card-today)');
  for (const element of [today.locator('h5'), today.locator('strong'), later.locator('strong'), page.locator('.booking-payment-reassurance')]) {
    await expect(element).toHaveCSS('font-family', '"Kumbh Sans", sans-serif');
  }
  const todaySize = await today.locator('strong').evaluate(el => parseFloat(getComputedStyle(el).fontSize));
  const laterSize = await later.locator('strong').evaluate(el => parseFloat(getComputedStyle(el).fontSize));
  expect(todaySize).toBeGreaterThan(laterSize);
  for (const file of ['quote.html?quoteToken=test-token', 'payment-success.html?session_id=test-session']) {
    if (file.startsWith('payment-success')) {
      await page.evaluate(data => sessionStorage.setItem('lustreHireConfirmedBookingSaved', JSON.stringify(data)), { ...booking, stripeSessionId: 'test-session' });
    }
    await page.goto(`/${file}`);
    await expect(page.locator('.staged-payment-summary')).toHaveCSS('font-family', '"Kumbh Sans", sans-serif');
    await expect(page.locator('.staged-payment-summary h4')).toHaveCSS('font-family', '"Kumbh Sans", sans-serif');
  }
});

test('font imports remain limited to existing site families', async ({ page }) => {
  const requests = [];
  page.on('request', request => { if (request.url().includes('fonts.googleapis.com')) requests.push(request.url()); });
  for (const file of ['index.html', 'book.html', 'quote.html', 'payment-success.html']) await page.goto(`/${file}`);
  for (const url of requests) {
    for (const family of new URL(url).searchParams.getAll('family')) {
      for (const name of family.split('|')) expect(['Kumbh Sans', 'Cutive', 'Syne']).toContain(name.split(':')[0]);
    }
  }
});

test('hire bond total and deposit callout are visible before personal details', async ({ page }) => {
  await checkDate(page, 15);
  const price = page.locator('.availability-price');
  for (const row of ['Candle hire $150', 'Refundable bond $150', 'Total $300']) {
    await expect(price.locator(':scope > div').filter({ hasText: row })).toBeVisible();
  }
  await expect(price.locator(':scope > div')).toHaveCount(3);
  await expect(price.getByRole('region', { name: 'Booking deposit' })).toHaveText('Secure today with a $75 deposit.');
  await expect(price).toContainText('The refundable bond is returned after the candles are returned and checked, subject to the hire terms.');
  await expect(price).not.toContainText('Due later');
  await expect(price.getByRole('button')).toHaveCount(0);
  await expect(page.locator('#availability-full-name')).toHaveValue('');
  await expect(page.locator('#availability-ready-button')).toHaveText('Secure My Date for $75');
  await expect(page.locator('#availability-continue-button')).toHaveText('Email My Quote');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
