const { test, expect, booking, reviewBooking } = require('./fixtures');
const googleClick = 'EAIaIQobChMI1234567890AbCdEfGhIjKlMn';
const facebookClick = 'IwAR1234567890AbCdEfGhIjKlMnOpQrStUv';
async function events(page, name) {
  return page.evaluate(name => window.dataLayer.filter(e => e[0] === 'event' && e[1] === name).map(e => e[2]), name);
}
async function marketingLoaded(page) {
  await expect(page.locator('script[src*="gtag/js"]')).toHaveCount(1);
  await expect(page.locator('script[src*="gtm.js"]')).toHaveCount(1);
  await expect(page.locator('script[src*="fbevents.js"]')).toHaveCount(1);
  expect(await page.evaluate(() => window.dataLayer.filter(e => e.event === 'lustre_tracking_ready').at(-1).lustre_clarity_eligible)).toBe(true);
  await expect(page.locator('body')).not.toHaveAttribute('data-clarity-mask');
  expect(await events(page, 'page_view')).toHaveLength(1);
}
for (const [label, query] of [
  ['clean homepage', ''],
  ['Facebook UTM campaign', `?utm_source=facebook&utm_medium=paid_social&utm_campaign=spring_weddings&fbclid=${facebookClick}`],
  ['Google Ads click', `?gclid=${googleClick}`],
  ['Instagram UTM campaign', '?utm_source=instagram&utm_medium=paid_social&utm_campaign=wedding_candles'],
  ['Microsoft advertising click', '?msclkid=abcdef1234567890abcdef1234567890'],
]) {
  test(`${label}: eligible marketing and Clarity without duplicate installs`, async ({ page }) => {
    await page.goto('/' + query);
    await marketingLoaded(page);
    const view = (await events(page, 'page_view'))[0];
    for (const [key, value] of new URLSearchParams(query)) expect(new URL(view.page_location).searchParams.get(key)).toBe(value);
    await page.addScriptTag({ url: '/lustre-tracking.js' });
    await marketingLoaded(page);
    expect(await page.evaluate(() => window.fbq.queue.filter(e => e[1] === 'PageView').length)).toBe(1);
  });
}

test('Facebook referral is retained as an origin, not blocked', async ({ page }) => {
  await page.goto('/?utm_source=facebook&utm_medium=social', { referer: 'https://www.facebook.com/' });
  await marketingLoaded(page);
  expect((await events(page, 'page_view'))[0].page_referrer).toBe('https://www.facebook.com/');
});

test('sensitive referrer gets a clean landing hop before any vendor loads', async ({ page }) => {
  const requests = [];
  page.on('request', r => { if (/gtag\/js|gtm\.js|fbevents\.js/.test(r.url())) requests.push(r.url()); });
  await page.goto('/?utm_source=facebook&utm_medium=paid_social&utm_campaign=spring_weddings', {
    referer: 'https://www.facebook.com/customer-name?email=private@example.test',
  });
  await marketingLoaded(page);
  expect(requests).toHaveLength(3);
  expect(await page.evaluate(() => document.referrer)).toBe('');
  const view = (await events(page, 'page_view'))[0];
  expect(view.page_referrer).toBe('https://www.facebook.com/');
  expect(view.campaign_name).toBe('spring_weddings');
  expect(await page.evaluate(() => JSON.stringify(window.dataLayer))).not.toContain('private@example.test');
});

test('public URL is sanitised before vendor scripts can observe it', async ({ page }) => {
  await page.route(/gtag\/js|gtm\.js|fbevents\.js/, route => route.fulfill({
    contentType: 'application/javascript', body: 'window.vendorObservedUrls = (window.vendorObservedUrls || []).concat(location.href);',
  }));
  await page.goto(`/?utm_source=facebook&utm_medium=paid_social&utm_campaign=spring_weddings&fbclid=${facebookClick}&email=private%40example.test&phone=0400000000&name=Jane-Smith&quoteToken=private-token&session_id=cs_test_private&unexpected=address#private`);
  await marketingLoaded(page);
  await expect.poll(() => page.evaluate(() => window.vendorObservedUrls?.length)).toBe(3);
  const observed = await page.evaluate(() => JSON.stringify([window.vendorObservedUrls, window.dataLayer, window.fbq.queue]));
  for (const secret of ['private', '0400000000', 'Jane-Smith', 'address']) expect(observed).not.toContain(secret);
  expect(observed).toContain(facebookClick);
  expect(observed).toContain('spring_weddings');
});

test('known PII in UTM fields and malformed click IDs are rejected', async ({ page }) => {
  await page.goto('/?name=Jane-Smith&utm_source=Jane-Smith&utm_medium=private%40example.test&utm_campaign=Jane-Smith&utm_term=0400000000&utm_content=123-Test-Street&gclid=cs_test_1234567890abcdefghijkl&fbclid=bad&msclkid=not-a-click&new_id=secret');
  await marketingLoaded(page);
  expect(new URL(page.url()).search).toBe('');
  const sent = await page.evaluate(() => JSON.stringify(window.dataLayer));
  for (const value of ['Jane-Smith', 'private', '0400000000', '123-Test-Street', 'cs_test_', 'not-a-click', 'secret']) expect(sent).not.toContain(value);
});

test('campaign attribution survives direct and private quote booking steps', async ({ page, backend }) => {
  await page.goto(`/?utm_source=facebook&utm_medium=paid_social&utm_campaign=spring_weddings&fbclid=${facebookClick}`);
  await page.locator('#availability-date').fill(booking.eventDate);
  await page.locator('#availability-quantity').fill('50');
  await page.locator('#availability-form').getByRole('button', { name: /check/i }).click();
  await expect(page.locator('#availability-ready-button')).toBeVisible();
  expect((await events(page, 'availability_check'))[0]).toMatchObject({ campaign_source: 'facebook', campaign_name: 'spring_weddings' });
  await page.locator('#availability-ready-button').click();
  await expect(page.locator('#book-form-panel')).toBeVisible();
  await reviewBooking(page);
  expect((await events(page, 'booking_details_completed'))[0]).toMatchObject({ campaign_source: 'facebook', campaign_name: 'spring_weddings' });
  await page.goto('/quote.html?quoteToken=test-token');
  await expect(page.locator('#quote-review-summary')).toContainText(booking.fullName);
  expect(backend.calls.find(e => e.action === 'getQuoteByToken').quoteToken).toBe('test-token');
  expect((await events(page, 'page_view'))[0]).toMatchObject({ campaign_source: 'facebook', campaign_name: 'spring_weddings', page_location: 'http://127.0.0.1:4173/quote.html' });
  await expect(page.locator('script[src*="gtm.js"], script[src*="fbevents.js"]')).toHaveCount(0);
  expect(page.url()).toContain('quoteToken=test-token');
  expect(await page.evaluate(() => JSON.stringify(window.dataLayer))).not.toContain('test-token');
  backend.replies.getVerifiedPurchaseReceipt = { success: false };
  backend.replies.saveConfirmedBooking = { success: true, paymentVerified: true, bookingId: booking.bookingId };
  await page.evaluate(data => sessionStorage.setItem('lustreHirePendingBooking', JSON.stringify({ ...data, mode: 'direct' })), booking);
  await page.goto('/payment-success.html?session_id=cs_test_private');
  await expect(page.locator('#payment-success-status')).toContainText('deposit has been received');
  expect(backend.calls.find(e => e.action === 'saveConfirmedBooking').bookingData.stripeSessionId).toBe('cs_test_private');
  expect((await events(page, 'page_view'))[0].campaign_name).toBe('spring_weddings');
  expect(await page.evaluate(() => JSON.stringify(window.dataLayer))).not.toContain('cs_test_private');
  expect(await events(page, 'purchase')).toHaveLength(0);
  await page.reload();
  expect(await events(page, 'purchase')).toHaveLength(0);
});

test('new campaign replaces attribution without mixing click IDs', async ({ page }) => {
  await page.goto(`/?utm_source=facebook&utm_medium=paid_social&fbclid=${facebookClick}`);
  await page.goto(`/?utm_source=google&utm_medium=cpc&gclid=${googleClick}`);
  const attribution = await page.evaluate(() => window.getLustreAttribution());
  expect(attribution.utm_source).toBe('google');
  expect(attribution.gclid).toBe(googleClick);
  expect(attribution).not.toHaveProperty('fbclid');
});

test('initialises without a consent platform or fabricated consent signals', async ({ page }) => {
  await page.goto('/?utm_source=facebook&utm_campaign=New_Summer_Campaign_2027');
  await marketingLoaded(page);
  expect((await events(page, 'page_view'))[0].campaign_name).toBe('New_Summer_Campaign_2027');
  expect(await page.evaluate(() => typeof window.LustreTrackingConsent)).toBe('undefined');
  expect(await page.evaluate(() => typeof window.setLustreTrackingConsent)).toBe('undefined');
  expect(await page.evaluate(() => window.dataLayer.filter(e => e[0] === 'consent'))).toEqual([]);
  expect(await page.evaluate(() => window.fbq.queue.filter(e => e[0] === 'consent'))).toEqual([]);
  expect(await page.evaluate(() => (window.clarity.q || []).filter(e => /^consent/.test(e[0])))).toEqual([]);
});

test('unrelated referral and expired attribution do not inherit an old campaign', async ({ page }) => {
  await page.goto('/?utm_source=google&utm_medium=cpc&utm_campaign=wedding_candles');
  await page.goto('/', { referer: 'https://www.facebook.com/' });
  await marketingLoaded(page);
  expect((await events(page, 'page_view'))[0]).not.toHaveProperty('campaign_name');
  await page.goto('/?utm_source=google&utm_medium=cpc&utm_campaign=wedding_candles');
  await page.evaluate(() => {
    const saved = JSON.parse(sessionStorage.getItem('lustreTracking:attribution'));
    saved.savedAt -= 31 * 60 * 1000;
    sessionStorage.setItem('lustreTracking:attribution', JSON.stringify(saved));
  });
  await page.goto('/book.html');
  expect((await events(page, 'page_view'))[0]).not.toHaveProperty('campaign_name');
});

test('required navigation remains usable and repeated campaign params are dropped', async ({ page }) => {
  await page.goto('/?scrollTo=availability-checker&utm_source=facebook&utm_source=private&utm_campaign=spring_weddings#faq');
  await marketingLoaded(page);
  expect(new URL(page.url()).searchParams.has('utm_source')).toBe(false);
  await expect(page.locator('#availability-checker')).toBeVisible();
  expect((await events(page, 'page_view'))[0].page_location).not.toContain('scrollTo');
});

test('campaign values use length/character checks without a vocabulary', async ({ page }) => {
  await page.goto('/?utm_source=instagram&utm_medium=paid_social&utm_campaign=Perth%20Summer%202027&utm_content=reel-v2&utm_term=candle_hire&utm_id=launch_2027');
  await marketingLoaded(page);
  expect((await events(page, 'page_view'))[0]).toMatchObject({ campaign_name: 'Perth Summer 2027', campaign_content: 'reel-v2', campaign_term: 'candle_hire', campaign_id: 'launch_2027' });
  await page.goto('/?utm_campaign=' + 'a'.repeat(101) + '&utm_content=private%40example.test&utm_term=https%3A%2F%2Fexample.test%2Fprivate');
  await marketingLoaded(page);
  expect(new URL(page.url()).search).toBe('');
});

test('known customer and booking values cannot be repackaged as campaign labels', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => sessionStorage.setItem('lustreHirePendingBooking', JSON.stringify({
    fullName: 'Jane Smith', address: '123 Test Street', bookingId: 'LH-ABC-123', quoteToken: 'privateQuoteABC', stripeSessionId: 'cs_test_private',
  })));
  await page.goto('/?utm_campaign=Jane-Smith&utm_content=LH-ABC-123&utm_term=privateQuoteABC&utm_id=cs_test_private');
  await marketingLoaded(page);
  expect(new URL(page.url()).search).toBe('');
  const sent = await page.evaluate(() => JSON.stringify(window.dataLayer));
  for (const secret of ['Jane-Smith', 'LH-ABC-123', 'privateQuoteABC', 'cs_test_private']) expect(sent).not.toContain(secret);
});
