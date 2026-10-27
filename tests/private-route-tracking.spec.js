const { test, expect, booking, checkoutUrl, checkDate, reviewBooking } = require('./fixtures');
const aliases = ['book', 'quote', 'payment-success', 'payment-cancelled'];
const events = (page, name) => page.evaluate(name => (window.dataLayer || []).filter(e => e[0] === 'event' && e[1] === name).map(e => e[2]), name);

async function cloudflareRedirects(page) {
  await page.route(/\/(book|quote|payment-success|payment-cancelled)\.html(?:\?|$)/, route => {
    const url = new URL(route.request().url());
    return route.fulfill({ status: 308, headers: { location: url.pathname.slice(0, -5) + url.search } });
  });
}

for (const alias of aliases) {
  test(`private alias /${alias}: sanitized GA remains active, public vendors excluded`, async ({ page }) => {
    await page.goto(`/${alias}?email=private@example.test&session_id=invalid&quoteToken=test-token`);
    expect(await events(page, 'page_view')).toEqual([expect.objectContaining({
      page_path: `/${alias}.html`, page_location: `http://127.0.0.1:4173/${alias}.html`, send_to: 'G-1RPLQ8LZ48',
    })]);
    await expect(page.locator('script[src*="gtag/js"]')).toHaveCount(1);
    await expect(page.locator('script[src*="gtm.js"],script[src*="fbevents.js"],script[src*="clarity"]')).toHaveCount(0);
    const sent = await page.evaluate(() => JSON.stringify(window.dataLayer));
    for (const secret of ['private@example.test', 'test-token', 'session_id', 'quoteToken']) expect(sent).not.toContain(secret);
    expect(await events(page, 'purchase')).toHaveLength(0);
  });
}

for (const mode of ['direct', 'quote']) {
  test(`${mode}: Cloudflare redirects retain details-completed and checkout`, async ({ page, backend }) => {
    await cloudflareRedirects(page);
    if (mode === 'direct') {
      await checkDate(page);
      await page.locator('#availability-ready-button').click();
    } else {
      await page.goto('/quote.html?quoteToken=test-token');
      await page.getByRole('link', { name: 'Pay Deposit & Secure My Date' }).click();
    }
    await expect(page).toHaveURL(/\/book(?:\?|$)/);
    await reviewBooking(page);
    expect(await events(page, 'booking_details_completed')).toHaveLength(1);
    expect((await events(page, 'page_view'))[0].page_path).toBe('/book.html');
    await page.locator('#book-terms-checkbox').check();
    const seen = [];
    await page.exposeFunction('recordAliasCheckout', value => seen.push(value));
    await page.evaluate(() => {
      const original = window.gtag;
      window.gtag = (...args) => { window.recordAliasCheckout(args); original(...args); };
    });
    await page.locator('#book-payment-button').click();
    await expect(page).toHaveURL(checkoutUrl);
    expect(seen.filter(e => e[1] === 'begin_checkout')).toHaveLength(1);
    expect(seen.filter(e => e[1] === 'checkout_started')).toHaveLength(1);
    expect(backend.calls.filter(c => c.action === (mode === 'direct' ? 'createCheckoutSession' : 'createQuoteCheckoutSession'))).toHaveLength(1);
    await page.goto('/payment-cancelled.html');
    await expect(page).toHaveURL(/\/payment-cancelled$/);
    expect(await events(page, 'payment_cancelled')).toHaveLength(1);
    await page.reload();
    expect(await events(page, 'payment_cancelled')).toHaveLength(0);
  });

  test(`${mode}: Cloudflare success alias retains verified purchase and read-only recovery`, async ({ page, backend }) => {
    await cloudflareRedirects(page);
    const session = 'cs_test_AliasReceipt123';
    const result = { success: true, paymentVerified: true, bookingId: 'OFFLINE-ALIAS', purchaseReceipt: {
      transaction_id: session, value: 75, currency: 'AUD', booking_mode: mode,
      items: [{ item_id: 'lustre_hire_deposit', item_name: 'Candle hire booking deposit', price: 75, quantity: 1 }],
    } };
    backend.replies[mode === 'direct' ? 'saveConfirmedBooking' : 'markQuoteAsConfirmed'] = result;
    backend.replies.getVerifiedPurchaseReceipt = result;
    await page.goto('/');
    await page.evaluate(data => sessionStorage.setItem('lustreHirePendingBooking', JSON.stringify(data)), { ...booking, mode });
    await page.goto(`/payment-success.html?session_id=${session}`);
    await expect(page).toHaveURL(new RegExp('/payment-success\\?session_id=' + session));
    await expect(page.locator('#payment-success-status')).toContainText('deposit has been received');
    expect(await events(page, 'purchase')).toEqual([expect.objectContaining({ transaction_id: session, value: 75, booking_mode: mode, page_path: '/payment-success.html' })]);
    await page.reload();
    await expect.poll(() => backend.calls.length).toBe(2);
    expect(backend.calls[1].action).toBe('getVerifiedPurchaseReceipt');
    expect(await events(page, 'purchase')).toHaveLength(0);
    await expect(page.locator('script[src*="gtm.js"],script[src*="fbevents.js"],script[src*="clarity"]')).toHaveCount(0);
  });
}

test('unknown private prefixes and marked fallbacks remain excluded', async ({ page }) => {
  const html = '<!doctype html><html><head><meta name="lustre-private-page" content="true"><script src="/lustre-tracking.js"></script></head><body>Private fallback</body></html>';
  for (const path of ['/book/customer', '/payment-success-unknown']) {
    await page.route('**' + path, route => route.fulfill({ contentType: 'text/html', body: html }));
    await page.goto(path);
    expect(await events(page, 'page_view')).toHaveLength(0);
    await expect(page.locator('script[src*="gtag/js"],script[src*="gtm.js"],script[src*="fbevents.js"]')).toHaveCount(0);
  }
});
