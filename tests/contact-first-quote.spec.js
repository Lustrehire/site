const { test, expect, booking, available, checkoutUrl, checkDate, reviewBooking } = require('./fixtures');

async function submitContact(page) {
  await page.locator('#availability-full-name').fill(booking.fullName);
  await page.locator('#availability-email').fill(booking.email);
  await page.getByRole('button', { name: 'Continue to my quote', exact: true }).click();
  await expect(page.locator('#availability-step-4-panel')).toBeVisible();
}

test('availability leads to contact before any personalised pricing; quote is immediate and emailed once', async ({ page, backend }) => {
  await checkDate(page, 45);
  const contact = page.locator('#availability-step-2-panel');
  await expect(page.locator('#availability-dialog-title')).toHaveText('Your date is available!');
  await expect(contact).toContainText('No unrelated marketing');
  await expect(page.locator('#availability-result .availability-price')).toHaveCount(0);
  await expect(page.locator('#availability-step-4-panel')).toBeHidden();
  await expect(page.locator('#availability-ready-button')).toBeHidden();
  await expect(page.locator('#candle-packages')).toContainText('$449');
  expect(backend.calls.map(c => c.action)).toEqual(['checkAvailability']);
  await submitContact(page);
  const quote = page.locator('#availability-step-4-panel');
  await expect(quote).toContainText('A copy has been emailed to you.');
  await expect(quote).toContainText('Candle hire $449');
  await expect(quote).toContainText('Book with a deposit $224.50');
  await expect(quote).toContainText('Remaining hire balance $224.50');
  await expect(quote).toContainText('Refundable bond $449');
  await expect(quote).toContainText('Your paid deposit secures your date');
  await expect(quote.getByText('Email My Quote', { exact: true })).toHaveCount(0);
  expect(backend.calls.filter(c => c.action === 'saveQuoteBooking')).toHaveLength(1);
  expect(backend.calls.find(c => c.action === 'saveQuoteBooking').bookingData.customerSource).toBe('');
  const events = await page.evaluate(() => window.dataLayer.filter(e => e[0] === 'event').map(e => e[1]));
  expect(events).toEqual(expect.arrayContaining(['availability_result', 'quote_contact_viewed', 'quote_generated']));
  const sent = await page.evaluate(() => JSON.stringify([window.dataLayer, window.fbq?.queue]));
  expect(sent).not.toContain(booking.email);
  expect(sent).not.toContain(booking.fullName);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('Book now uses saved quote, carries details, retains rechecks, terms, quote checkout and verified confirmation', async ({ page, backend }) => {
  backend.replies.getQuoteByToken = { success: true, status: 'valid', booking: { ...booking, quantity: 45, hireFee: 449, refundableBond: 449 } };
  await checkDate(page, 45);
  await submitContact(page);
  await page.getByRole('link', { name: 'Book now' }).click();
  await expect(page).toHaveURL(/book.html\?quoteToken=test-token/);
  await expect(page.locator('#book-full-name')).toHaveValue(booking.fullName);
  await expect(page.locator('#book-email')).toHaveValue(booking.email);
  await expect(page.locator('#book-context-summary')).toContainText('45');
  await reviewBooking(page);
  await expect(page.locator('#book-payment-button')).toBeDisabled();
  await page.locator('#book-terms-checkbox').check();
  await page.locator('#book-payment-button').click();
  await expect(page).toHaveURL(checkoutUrl);
  expect(backend.calls.find(c => c.action === 'createQuoteCheckoutSession').quoteToken).toBe('test-token');
  expect(backend.calls.filter(c => c.action === 'checkAvailability').length).toBeGreaterThan(1);
  backend.replies.markQuoteAsConfirmed = { success: true, paymentVerified: true, bookingId: booking.bookingId };
  await page.goto('/payment-success.html?session_id=test-session');
  await expect(page.locator('#payment-success-heading')).toHaveText('Your date is secured');
  expect(backend.calls.filter(c => c.action === 'markQuoteAsConfirmed')).toHaveLength(1);
  expect(backend.calls.some(c => c.action === 'saveConfirmedBooking')).toBe(false);
});

test('double submission and revisiting the same quote do not send it again', async ({ page, backend }) => {
  await checkDate(page);
  await page.locator('#availability-full-name').fill(booking.fullName);
  await page.locator('#availability-email').fill(booking.email);
  await page.locator('#availability-booking-form').evaluate(form => {
    form.requestSubmit(); form.requestSubmit();
  });
  await expect(page.locator('#availability-step-4-panel')).toBeVisible();
  await page.locator('#availability-complete-button').click();
  await page.locator('#availability-form').getByRole('button', { name: /check/i }).click();
  await submitContact(page);
  expect(backend.calls.filter(c => c.action === 'saveQuoteBooking')).toHaveLength(1);
  await page.reload();
  await page.locator('#availability-date').fill(booking.eventDate);
  await page.locator('#availability-quantity').fill('50');
  await page.locator('#availability-form').getByRole('button', { name: /check/i }).click();
  await submitContact(page);
  expect(backend.calls.filter(c => c.action === 'saveQuoteBooking')).toHaveLength(1);
});

test('save failure preserves contact details and retry identity without revealing a price', async ({ page, backend }) => {
  backend.replies.saveQuoteBooking = { success: false };
  await checkDate(page);
  await page.locator('#availability-full-name').fill(booking.fullName);
  await page.locator('#availability-email').fill(booking.email);
  await page.locator('#availability-step-2-submit').click();
  await expect(page.locator('#availability-booking-feedback')).toContainText('Please try again');
  await expect(page.locator('#availability-full-name')).toHaveValue(booking.fullName);
  await expect(page.locator('#availability-email')).toHaveValue(booking.email);
  await expect(page.locator('#availability-step-4-panel')).toBeHidden();
  backend.replies.saveQuoteBooking = { success: true, bookingId: booking.bookingId, quoteToken: 'test-token' };
  await page.locator('#availability-step-2-submit').click();
  await expect(page.locator('#availability-step-4-panel')).toBeVisible();
  const calls = backend.calls.filter(c => c.action === 'saveQuoteBooking');
  expect(calls).toHaveLength(2);
  expect(calls[0].requestId).toBe(calls[1].requestId);
});

for (const limited of [false, true]) test(`${limited ? 'limited' : 'unavailable'} quantities need no lead and reveal no calculated price`, async ({ page, backend }) => {
  backend.replies.checkAvailability = { ...available, status: limited ? 'partial' : 'unavailable', available: false, partialAvailable: limited, maxAvailable: limited ? 30 : 0 };
  await checkDate(page);
  await expect(page.locator('#availability-step-2-panel')).toBeHidden();
  await expect(page.locator('#availability-result .availability-price')).toHaveCount(0);
  expect(backend.calls.some(c => c.action === 'saveQuoteBooking')).toBe(false);
  if (limited) {
    await page.locator('[data-availability-action="continue-limited"]').click();
    await expect(page.locator('#availability-contact-context')).toContainText('30 candles');
    await submitContact(page);
    expect(backend.calls.find(c => c.action === 'saveQuoteBooking').bookingData.quantity).toBe(30);
  } else await expect(page.locator('[data-availability-action="change-date"]')).toBeVisible();
});

for (const failure of ['network', 'invalid JSON', 'HTTP error']) test(`quote ${failure} preserves details and can be retried`, async ({ page, backend }) => {
  backend.expectedErrors.push(/^Failed to load resource:/, /^Malformed JSON response:/);
  await checkDate(page);
  await page.route('https://script.google.com/**', route => {
    const payload = route.request().postDataJSON();
    if (payload.action !== 'saveQuoteBooking') return route.fallback();
    if (failure === 'network') return route.abort('failed');
    if (failure === 'invalid JSON') return route.fulfill({ contentType: 'application/json', body: '{broken' });
    return route.fulfill({ status: 503, json: { success: false } });
  });
  await page.locator('#availability-full-name').fill(booking.fullName);
  await page.locator('#availability-email').fill(booking.email);
  await page.locator('#availability-step-2-submit').click();
  await expect(page.locator('#availability-booking-feedback')).toContainText('Please try again');
  await expect(page.locator('#availability-full-name')).toHaveValue(booking.fullName);
  await expect(page.locator('#availability-email')).toHaveValue(booking.email);
  await expect(page.locator('#availability-step-2-submit')).toBeEnabled();
  await expect(page.locator('#availability-step-4-panel')).toBeHidden();
  await page.unroute('https://script.google.com/**');
  await page.locator('#availability-step-2-submit').click();
  await expect(page.locator('#availability-step-4-panel')).toBeVisible();
});

test('invalid email is caught before any quote request', async ({ page, backend }) => {
  await checkDate(page);
  await page.locator('#availability-full-name').fill(booking.fullName);
  await page.locator('#availability-email').fill('not-an-email');
  await page.locator('#availability-step-2-submit').click();
  expect(await page.locator('#availability-email').evaluate(input => input.validity.typeMismatch)).toBe(true);
  expect(backend.calls.some(c => c.action === 'saveQuoteBooking')).toBe(false);
  await expect(page.locator('#availability-step-4-panel')).toBeHidden();
});

test('closing contact capture during save keeps the entry visible and reuses the eventual saved quote', async ({ page }) => {
  await checkDate(page);
  let pendingRoute;
  let saves = 0;
  await page.route('https://script.google.com/**', async route => {
    if (route.request().postDataJSON().action !== 'saveQuoteBooking') return route.fallback();
    saves++;
    pendingRoute = route;
  });
  await page.locator('#availability-full-name').fill(booking.fullName);
  await page.locator('#availability-email').fill(booking.email);
  await page.locator('#availability-step-2-submit').click();
  await expect.poll(() => !!pendingRoute).toBe(true);
  await page.keyboard.press('Escape');
  await expect(page.locator('#availability-form')).toBeVisible();
  await pendingRoute.fulfill({ json: { success: true, bookingId: booking.bookingId, quoteToken: 'test-token' } });
  await expect(page.locator('#availability-step-2-submit')).toBeEnabled();
  await expect(page.locator('#availability-step-4-panel')).toBeHidden();
  await page.locator('#availability-form').getByRole('button', { name: /check/i }).click();
  await page.locator('#availability-step-2-submit').click();
  await expect(page.locator('#availability-step-4-panel')).toBeVisible();
  expect(saves).toBe(1);
});

test('compact quote shows average hire price and opens later payments with the keyboard', async ({ page }) => {
  await checkDate(page, 400);
  await submitContact(page);
  await expect(page.locator('#quote-hire-total')).toHaveText('$3,333');
  await expect(page.locator('#quote-unit-price')).toHaveText('$8.33');
  await expect(page.locator('#quote-deposit-total')).toHaveText('$1,666.50');
  const later = page.locator('.quote-later-details');
  await expect(later.locator('.quote-later-body')).toBeHidden();
  await later.locator('summary').focus();
  await page.keyboard.press('Enter');
  await expect(later.locator('.quote-later-body')).toBeVisible();
  await expect(page.locator('#quote-final-total')).toHaveText('$4,999.50');
  await expect(page.locator('#quote-remaining-total')).toHaveText('$1,666.50');
  await expect(page.locator('#quote-bond-total')).toHaveText('$3,333');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.keyboard.press('Enter');
  await expect(later.locator('.quote-later-body')).toBeHidden();
  await expect(page.getByRole('link', { name: 'Book now' })).toBeVisible();
});

test('quote saved and emailed after 13 seconds still opens the personalised quote', async ({ page, backend }) => {
  await checkDate(page,45);
  await page.route('https://script.google.com/**', async route => {
    const payload=route.request().postDataJSON();
    if(payload.action!=='saveQuoteBooking') return route.fallback();
    backend.calls.push(payload);
    await new Promise(resolve=>setTimeout(resolve,13000));
    return route.fulfill({json:{success:true,bookingId:booking.bookingId,quoteToken:booking.quoteToken}});
  });
  await page.locator('#availability-full-name').fill(booking.fullName);
  await page.locator('#availability-email').fill(booking.email);
  await page.locator('#availability-step-2-submit').click();
  await expect(page.locator('#availability-step-2-submit')).toBeDisabled();
  const spinner = await page.locator('#availability-step-2-submit').evaluate(button => {
    const style = getComputedStyle(button, '::after');
    return {
      visible: style.content !== 'none' && style.display !== 'none' && parseFloat(style.width) > 0 && parseFloat(style.height) > 0,
      rotating: style.animationName !== 'none',
      ring: parseFloat(style.borderTopWidth) > 0 && style.borderRightColor === 'rgba(0, 0, 0, 0)' && style.clipPath === 'none',
    };
  });
  expect(spinner).toEqual({visible:true,rotating:true,ring:true});
  await expect(page.locator('#availability-booking-feedback')).toBeEmpty();
  await expect(page.locator('#availability-step-4-panel')).toBeVisible({timeout:20000});
  await expect(page.locator('#availability-step-4-panel')).toContainText('A copy has been emailed to you.');
  expect(backend.calls.filter(call=>call.action==='saveQuoteBooking')).toHaveLength(1);
});

for(const failure of ['storage','tracking']) test(`successful quote remains visible when optional ${failure} throws`, async({page,backend})=>{
  await checkDate(page,45);
  await page.evaluate(failure=>{
    if(failure==='tracking') window.trackLustreQuoteGenerated=()=>{throw new Error('Optional analytics failed');};
    else {
      const original=Storage.prototype.setItem;
      Storage.prototype.setItem=function(key,value){
        if(['lustreHirePendingBooking','lustreHirePendingQuote'].includes(key))throw new DOMException('Storage blocked','SecurityError');
        return original.call(this,key,value);
      };
    }
  },failure);
  await submitContact(page);
  await expect(page.locator('#availability-step-4-panel')).toContainText('A copy has been emailed to you.');
  await expect(page.locator('#availability-book-quote')).toHaveAttribute('href',/book.html\?quoteToken=test-token/);
  expect(backend.calls.filter(call=>call.action==='saveQuoteBooking')).toHaveLength(1);
});

test('saved quote with ambiguous email delivery explains review instead of encouraging another quote',async({page,backend})=>{
  backend.replies.saveQuoteBooking={success:false,message:'Your quote is saved, but email delivery needs checking. Please contact Lustre Hire; do not submit a new quote.'};
  await checkDate(page,45);
  await page.locator('#availability-full-name').fill(booking.fullName);
  await page.locator('#availability-email').fill(booking.email);
  await page.locator('#availability-step-2-submit').click();
  await expect(page.locator('#availability-booking-feedback')).toContainText('rather than submitting a new quote');
  await expect(page.locator('#availability-step-4-panel')).toBeHidden();
});
