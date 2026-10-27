const { test, expect, booking, checkoutUrl, checkDate, reviewBooking } = require('./fixtures');

async function events(page, name) {
  return page.evaluate(name => (window.dataLayer || []).filter(e => e[0] === 'event' && e[1] === name).map(e => e[2]), name);
}
for (const path of ['index.html', 'book.html', 'quote.html', 'payment-success.html', 'payment-cancelled.html']) {
  test(`${path}: one GA page view and sanitised payloads`, async ({ page }) => {
    await page.goto(`/${path}?email=private@example.test&session_id=secret-session&quoteToken=test-token#private`);
    const views = await events(page, 'page_view');
    expect(views).toHaveLength(1);
    expect(views[0]).toMatchObject({ page_location: `http://127.0.0.1:4173/${path}`, page_referrer: '', send_to: 'G-1RPLQ8LZ48' });
    await page.evaluate(() => window.trackLustreEvent('availability_result', {
      page_location: location.href, page_url: location.href, email: 'private@example.test', stripe_session_id: 'secret-session',
      quoteToken: 'test-token', booking_id: 'private@example.test', utm_campaign: 'private@example.test', availability_status: 'available', quantity: 50,
    }));
    const payloads = await page.evaluate(() => JSON.stringify(window.dataLayer));
    for (const secret of ['private@example.test', 'secret-session', 'test-token', '#private']) expect(payloads).not.toContain(secret);
    expect(await page.locator('script[src*="gtag/js"]').count()).toBe(1);
    expect(await page.locator('script[src*="gtm.js"], script[src*="fbevents.js"]').count()).toBe(path === 'index.html' ? 2 : 0);
    if (path === 'index.html') expect(page.url()).not.toContain('quoteToken');
    else expect(page.url()).toContain('quoteToken=test-token');
  });
}

test('availability is not a quote; saved quote is not a purchase', async ({ page }) => {
  await checkDate(page);
  await expect(page.locator('#availability-ready-button')).toBeVisible();
  expect(await events(page, 'availability_check')).toHaveLength(1);
  expect(await events(page, 'availability_result')).toMatchObject([{ availability_status: 'available' }]);
  expect(await events(page, 'quote_generated')).toHaveLength(0);
  await page.locator('#availability-continue-button').click();
  await page.locator('#availability-full-name').fill(booking.fullName);
  await page.locator('#availability-email').fill(booking.email);
  await page.locator('#availability-step-2-submit').click();
  await expect(page.locator('#availability-step-4-panel')).toBeVisible();
  expect(await events(page, 'quote_generated')).toHaveLength(1);
  await page.evaluate(data => window.trackLustreQuoteGenerated(data), booking);
  expect(await events(page, 'quote_generated')).toHaveLength(1);
  expect(await events(page, 'purchase')).toHaveLength(0);
});

for (const mode of ['direct', 'quote']) {
  test(`${mode}: journey, review, failed checkout, retry and cancellation`, async ({ page, backend }) => {
    if (mode === 'direct') {
      await checkDate(page);
      await page.locator('#availability-ready-button').click();
    } else {
      await page.goto('/quote.html?quoteToken=test-token');
      await page.getByRole('link', { name: 'Pay Deposit & Secure My Date' }).click();
    }
    await expect(page.locator('#book-form-panel')).toBeVisible();
    // Start fired on the previous page; navigation must not repeat it.
    expect(await events(page, 'booking_started')).toHaveLength(0);
    await page.reload();
    await expect(page.locator('#book-form-panel')).toBeVisible();
    expect(await events(page, 'booking_started')).toHaveLength(0);
    expect(await events(page, 'booking_details_completed')).toHaveLength(0);
    await reviewBooking(page);
    expect(await events(page, 'booking_details_completed')).toHaveLength(1);
    const action = mode === 'quote' ? 'createQuoteCheckoutSession' : 'createCheckoutSession';
    backend.replies[action] = { success: false };
    backend.expectedErrors.push(/^Checkout session preparation error:/);
    await page.locator('#book-terms-checkbox').check();
    await page.locator('#book-payment-button').click();
    await expect(page.locator('#book-review-feedback')).toContainText('couldn’t start');
    expect(await events(page, 'begin_checkout')).toHaveLength(0);
    expect(await events(page, 'checkout_error')).toHaveLength(1);
    backend.replies[action] = { success: true, checkoutUrl };
    // Observe queued events before the mock navigation replaces the document.
    const tracked = [];
    await page.exposeFunction('recordTracking', value => tracked.push(value));
    await page.evaluate(() => {
      const original = window.gtag;
      window.gtag = (...args) => { window.recordTracking(args); original(...args); };
    });
    await page.locator('#book-payment-button').click();
    await expect(page).toHaveURL(checkoutUrl);
    expect(tracked.filter(e => e[1] === 'begin_checkout')).toHaveLength(1);
    expect(tracked.find(e => e[1] === 'begin_checkout')[2]).not.toHaveProperty('value');
    await page.goto('/payment-cancelled.html?session_id=secret');
    expect(await events(page, 'payment_cancelled')).toHaveLength(1);
    await page.reload();
    expect(await events(page, 'payment_cancelled')).toHaveLength(0);
  });
}

test('bare cancellation, invalid checkout URL and duplicate checkout response', async ({ page }) => {
  await page.goto('/payment-cancelled.html');
  expect(await events(page, 'payment_cancelled')).toHaveLength(0);
  await page.evaluate(() => {
    window.trackLustreCheckoutReady('javascript:alert(1)', {});
    window.trackLustreCheckoutReady('https://checkout.stripe.com/c/pay/secret', { booking_mode: 'direct' });
    window.trackLustreCheckoutReady('https://checkout.stripe.com/c/pay/secret', { booking_mode: 'direct' });
  });
  expect(await events(page, 'checkout_error')).toHaveLength(1);
  expect(await events(page, 'begin_checkout')).toHaveLength(1);
  expect(await page.evaluate(() => JSON.stringify(window.dataLayer))).not.toContain('/pay/secret');
});

test('storage failure never breaks tracking or booking scripts', async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => { throw new Error('storage blocked'); };
  });
  await page.goto('/');
  await page.evaluate(() => {
    window.trackLustreEvent('booking_started', { booking_mode: 'direct', quantity: 50 });
    window.trackLustreEvent('booking_started', { booking_mode: 'direct', quantity: 50 });
  });
  expect(await events(page, 'booking_started')).toHaveLength(1);
});

test('homepage preserves existing marketing IDs without a second GA loader', async ({ page }) => {
  await page.goto('/');
  expect(await page.locator('script[src*="gtag/js"]').count()).toBe(1);
  expect(await page.locator('script[src*="GTM-MTQH9ZRG"]').count()).toBe(1);
  expect(await page.evaluate(() => window.dataLayer.filter(e => e[0] === 'config').map(e => e[1]))).toEqual(['G-1RPLQ8LZ48', 'AW-18047450478']);
  expect(await page.evaluate(() => window.fbq.queue.map(e => Array.from(e)))).toContainEqual(['init', '1271538364415253']);
  await page.evaluate(() => window.trackLustreEvent('availability_check', { quantity: 50 }));
  expect(await page.evaluate(() => window.fbq.queue.filter(e => e[1] === 'availability_check').length)).toBe(1);
  expect(await page.evaluate(() => window.dataLayer.filter(e => e.event === 'availability_check').length)).toBe(0);
});

test('invalid availability and failed quote save do not produce success events', async ({ page, backend }) => {
  await checkDate(page, 14);
  expect(await events(page, 'availability_check')).toHaveLength(0);
  expect(await events(page, 'availability_result')).toHaveLength(0);
  backend.replies.saveQuoteBooking = { success: false };
  backend.expectedErrors.push(/^\[QUOTE DEBUG\] saveQuoteBooking error:/);
  await checkDate(page);
  await page.locator('#availability-continue-button').click();
  await page.locator('#availability-full-name').fill(booking.fullName);
  await page.locator('#availability-email').fill(booking.email);
  await page.locator('#availability-step-2-submit').click();
  await expect(page.locator('#availability-booking-feedback')).toContainText('couldn’t complete');
  expect(await events(page, 'quote_generated')).toHaveLength(0);
});

for (const callback of [true, false]) {
  test(`checkout waits for ${callback ? 'provider callback' : 'bounded blocked-provider fallback'}`, async ({ page }) => {
    await page.goto('/book.html');
    const elapsed = await page.evaluate(async callback => {
      let ack;
      const original = window.gtag;
      window.gtag = (...args) => {
        original(...args);
        if (args[1] === 'begin_checkout') ack = args[2].event_callback;
      };
      let resolved = false;
      const start = performance.now();
      const ready = window.trackLustreCheckoutReady('https://checkout.stripe.com/c/pay/mock', { booking_mode: 'direct', quantity: 15 });
      ready.then(() => { resolved = true; });
      await Promise.resolve();
      if (resolved || typeof ack !== 'function') throw new Error('Checkout did not wait for provider');
      if (callback) { ack(); ack(); }
      await ready;
      return performance.now() - start;
    }, callback);
    expect(elapsed).toBeLessThan(3500);
    if (!callback) expect(elapsed).toBeGreaterThanOrEqual(1900);
    expect(await events(page, 'begin_checkout')).toHaveLength(1);
    expect(await events(page, 'checkout_started')).toHaveLength(1);
  });
}

test('funnel events exclude unverified money and refundable bond', async ({ page }) => {
  await page.goto('/book.html');
  await page.evaluate(() => window.trackLustreEvent('booking_details_completed', {
    booking_mode: 'direct', quantity: 15, hire_fee: 150, bond_amount: 150, total_due: 75, value: 75,
  }));
  const [event] = await events(page, 'booking_details_completed');
  expect(event.quantity).toBe(15);
  for (const field of ['hire_fee', 'bond_amount', 'total_due', 'value']) expect(event).not.toHaveProperty(field);
});

for (const mode of ['direct', 'quote']) {
  for (const provider of ['callback', 'blocked', 'throws', 'helper missing']) {
    test(`${mode}: actual checkout redirects with GA ${provider}`, async ({ page, backend }) => {
      if (mode === 'quote') await page.goto('/book.html?quoteToken=test-token');
      else {
        await checkDate(page);
        await page.locator('#availability-ready-button').click();
      }
      await reviewBooking(page);
      await page.locator('#book-terms-checkbox').check();
      await page.evaluate(provider => {
        if (provider === 'helper missing') { delete window.trackLustreCheckoutReady; return; }
        const original = window.gtag;
        window.gtag = (...args) => {
          if (provider === 'throws') throw new Error('Mock blocked provider');
          original(...args);
          if (provider === 'callback' && args[1] === 'begin_checkout') window.releaseCheckoutAnalytics = args[2].event_callback;
        };
      }, provider);
      await page.locator('#book-payment-button').click();
      if (provider === 'callback') {
        await expect.poll(() => page.evaluate(() => typeof window.releaseCheckoutAnalytics)).toBe('function');
        expect(new URL(page.url()).pathname).toBe('/book.html');
        await page.evaluate(() => { window.releaseCheckoutAnalytics(); window.releaseCheckoutAnalytics(); });
      }
      await expect(page).toHaveURL(checkoutUrl, { timeout: 7000 });
      const calls = backend.calls.filter(c => c.action === (mode === 'quote' ? 'createQuoteCheckoutSession' : 'createCheckoutSession'));
      expect(calls).toHaveLength(1);
      expect(calls[0].bookingData).toMatchObject({ fullName: booking.fullName, email: booking.email, phone: '0400000000', quantity: 50 });
    });
  }
}
