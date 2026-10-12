const { test, expect, checkDate } = require('./fixtures');

const sensitiveContainers = ['availability-feedback', 'availability-result', 'availability-booking-summary', 'availability-booking-feedback', 'availability-review-feedback', 'availability-step-4-panel', 'contact-modal-status'];

test('public text is not blanket-masked and sensitive content is masked before GTM runs', async ({ page }) => {
  await page.route('https://www.googletagmanager.com/gtm.js*', route => route.fulfill({ contentType: 'application/javascript', body: `
    window.maskingAtGtmStart = {
      bodyMasked: document.body.hasAttribute('data-clarity-mask'),
      unmaskedFields: [...document.querySelectorAll('input, textarea, select')].filter(e => e.getAttribute('data-clarity-mask') !== 'true').length,
      containersMasked: ${JSON.stringify(sensitiveContainers)}.every(id => document.getElementById(id).getAttribute('data-clarity-mask') === 'true')
    };
  ` }));
  await page.goto('/');
  await expect.poll(() => page.evaluate(() => window.maskingAtGtmStart)).toEqual({ bodyMasked: false, unmaskedFields: 0, containersMasked: true });
  for (const selector of ['html', 'body', '#main-content', 'header', 'h1', '#faq', '#how-it-works', '#candle-packages', '#availability-form button[type="submit"]', '#contact-modal-title', '#contact-modal-form label', '#contact-modal-form button']) {
    expect(await page.locator(selector).first().evaluate(el => !!el.closest('[data-clarity-mask="true"]')), selector).toBe(false);
  }
  await expect(page.locator('[data-clarity-unmask]')).toHaveCount(0);
});

test('customer details remain inside a masked container after actual summary re-renders', async ({ page }) => {
  await checkDate(page);
  await expect(page.locator('#availability-ready-button')).toBeVisible();
  const details = {
    'availability-full-name': 'Private Customer', 'availability-email': 'private@example.test',
    'availability-phone': '0400000000', 'availability-address': '123 Private Street',
    'availability-notes': 'Private event instructions',
  };
  // Exercise the existing legacy in-page review renderer, including hidden
  // booking fields, without changing its handlers or submitting a payment.
  for (const suffix of ['', ' updated']) {
    await page.evaluate(({ details, suffix }) => {
      for (const [id, value] of Object.entries(details)) document.getElementById(id).value = value + suffix;
      document.getElementById('availability-switch-to-booking').click();
    }, { details, suffix });
    const summary = page.locator('#availability-booking-summary');
    await expect(summary).toHaveAttribute('data-clarity-mask', 'true');
    for (const value of Object.values(details)) await expect(summary).toContainText(value + suffix);
    expect(await summary.locator('strong').evaluateAll(elements => elements.every(el => !!el.closest('[data-clarity-mask="true"]')))).toBe(true);
  }
  await expect(page.locator('body')).not.toHaveAttribute('data-clarity-mask');
  await expect(page.locator('[data-clarity-unmask]')).toHaveCount(0);
});

for (const path of ['book.html?quoteToken=test-token', 'quote.html?quoteToken=test-token', 'payment-success.html?session_id=cs_test_private', 'payment-cancelled.html']) {
  test(`${path}: private pages still exclude GTM and Clarity`, async ({ page }) => {
    await page.goto('/' + path);
    await expect(page.locator('script[src*="gtm.js"], script[src*="clarity.ms"], script[src*="fbevents.js"]')).toHaveCount(0);
    expect(await page.evaluate(() => window.dataLayer.some(e => e.lustre_clarity_eligible === true))).toBe(false);
    await expect(page.locator('script[src*="gtag/js"]')).toHaveCount(1);
  });
}
