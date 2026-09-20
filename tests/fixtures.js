const { test: base, expect } = require('@playwright/test');

const booking = {
  bookingId: 'TEST-QUOTE-001', quoteToken: 'test-token', quoteStatus: 'sent',
  eventDate: '2030-06-15', pickupDate: '2030-06-14', returnDate: '2030-06-16',
  quantity: 50, hireFee: 321, refundableBond: 321,
  fullName: 'Test Customer', email: 'customer@example.test',
  address: '', phone: '', pickupTimeWindow: '', dropoffTimeWindow: '',
  quoteExpiresAt: '2030-01-08T00:00:00Z',
};
const available = {
  success: true, status: 'available', available: true, partialAvailable: false,
  eventDate: booking.eventDate, pickupDate: booking.pickupDate, returnDate: booking.returnDate,
  requestedQuantity: 50, remainingStock: 500, maxAvailable: 500, minimumNoticeDays: 8,
};
const checkoutUrl = 'https://checkout.example.test/fake-session';

const test = base.extend({
  browserNow: ['2030-06-01T04:00:00Z', { option: true }],
  backend: [async ({ context, browserNow }, use) => {
    const backend = {
      calls: [], unexpected: [], errors: [], expectedErrors: [],
      replies: {
        checkAvailability: available,
        getQuoteByToken: { success: true, status: 'valid', quoteRevalidated: false, booking },
        saveQuoteBooking: { success: true, bookingId: booking.bookingId, quoteToken: 'test-token', quoteStatus: 'sent' },
        createQuoteCheckoutSession: { success: true, checkoutUrl },
        createCheckoutSession: { success: true, checkoutUrl },
      },
    };
    context.on('page', page => {
      page.on('pageerror', error => backend.errors.push(error.message));
      page.on('console', message => {
        if (message.type() === 'error') backend.errors.push(message.text());
      });
    });
    // Fixed browser time keeps notice periods and fixture dates deterministic.
    await context.addInitScript(browserNow => {
      const NativeDate = Date;
      window.Date = class extends NativeDate {
        constructor(...args) { super(...(args.length ? args : [browserNow])); }
        static now() { return new NativeDate(browserNow).getTime(); }
      };
    }, browserNow);
    // Fail closed: only the local read-only site may touch the network.
    // Every external request is fulfilled here, never forwarded or fetched.
    await context.route('**/*', async route => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.origin === 'http://127.0.0.1:4173' && ['GET', 'HEAD'].includes(request.method())) {
        return route.continue();
      }
      if (url.hostname === 'script.google.com' && request.method() === 'POST') {
        let payload;
        try { payload = request.postDataJSON(); } catch { payload = {}; }
        backend.calls.push(payload);
        const reply = backend.replies[payload.action];
        if (!reply) backend.unexpected.push(`Unknown backend action: ${payload.action}`);
        return route.fulfill({ json: typeof reply === 'function' ? reply(payload) : reply || { success: false } });
      }
      if (request.url() === checkoutUrl) {
        return route.fulfill({ contentType: 'text/html', body: '<h1>Mock checkout destination</h1>' });
      }
      const passiveHosts = ['kit.fontawesome.com', 'fonts.googleapis.com', 'fonts.gstatic.com', 'cdn.jsdelivr.net', 'i.imgur.com', 'www.googletagmanager.com', 'www.google-analytics.com', 'connect.facebook.net', 'www.facebook.com', 'googleads.g.doubleclick.net'];
      if (!passiveHosts.includes(url.hostname)) backend.unexpected.push(`${request.method()} ${url.origin}${url.pathname}`);
      if (request.resourceType() === 'image') {
        return route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>' });
      }
      return route.fulfill({ contentType: request.resourceType() === 'stylesheet' ? 'text/css' : 'application/javascript', body: '' });
    });
    await use(backend);
    expect(backend.unexpected, 'Unrecognised external requests (blocked)').toEqual([]);
    expect(backend.errors.filter(error => !backend.expectedErrors.some(pattern => pattern.test(error.split('\n')[0]))), 'Unexpected browser errors').toEqual([]);
  }, { auto: true }],
});

async function checkDate(page, quantity = 50) {
  await page.goto('/index.html');
  await page.locator('#availability-date').fill(booking.eventDate);
  await page.locator('#availability-quantity').fill(String(quantity));
  await page.locator('#availability-form').getByRole('button', { name: /check/i }).click();
}

async function fillBooking(page) {
  for (const [id, value] of Object.entries({ 'full-name': booking.fullName, email: booking.email, address: '123 Test Street, Perth', phone: '0400000000' })) {
    await page.locator(`#book-${id}`).fill(value);
  }
  await page.locator('#book-pickup-time-window').selectOption('9:00 AM to 11:00 AM');
  await page.locator('#book-dropoff-time-window').selectOption('1:00 PM to 3:00 PM');
}

async function reviewBooking(page) {
  await fillBooking(page);
  await page.locator('#book-review-button').click();
  await expect(page.locator('#book-review-panel')).toBeVisible();
}

module.exports = { test, expect, booking, available, checkoutUrl, checkDate, fillBooking, reviewBooking };
