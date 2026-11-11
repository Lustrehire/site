const { test, expect, booking } = require('./fixtures');
async function open(page) {
  await page.goto('/');
  if (page.viewportSize().width < 768) await page.locator('.hero-quote-button').click();
  await page.getByRole('button', { name: 'Already have a quote or booking?' }).click();
  await expect(page.locator('#existing-record-dialog')).toBeVisible();
  await expect(page.locator('#existing-record-reference')).toBeFocused();
}
test('reference and email retrieval opens a matching modal and Escape returns focus', async ({ page }) => {
  await open(page);
  await expect(page.locator('#existing-record-dialog input')).toHaveCount(2);
  await expect(page.locator('#existing-record-next')).toHaveText('Next →');
  await page.keyboard.press('Escape');
  await expect(page.locator('#existing-record-dialog')).toBeHidden();
  await expect(page.locator('#existing-record-open')).toBeFocused();
});
test('live lookup posts both details, shows generic mismatch and sends no PII to analytics', async ({ page, backend }) => {
  backend.replies.lookupExistingRecord = {success: true, status: 'missing'};
  await open(page);
  await page.locator('#existing-record-reference').fill(booking.bookingId);
  await page.locator('#existing-record-email').fill(booking.email);
  await page.locator('#existing-record-next').click();
  await expect(page.locator('#existing-record-result')).toContainText('We couldn’t find a matching quote or booking');
  expect(backend.calls).toEqual([{action: 'lookupExistingRecord', reference: booking.bookingId, email: booking.email}]);
  const events = await page.evaluate(() => JSON.stringify(window.dataLayer));
  expect(events).not.toContain(booking.email);
  expect(events).not.toContain(booking.bookingId);
});
test('simulated quote shows pricing then continues through existing token checks and prefilling', async ({ page, backend }) => {
  await page.addInitScript(data => { window.lustrePreviewFindRecord = async () => ({ status: 'quote', booking: data }); }, booking);
  await open(page);
  await page.locator('#existing-record-reference').fill(booking.bookingId);
  await page.locator('#existing-record-email').fill(booking.email);
  await page.locator('#existing-record-next').click();
  const result = page.locator('#existing-record-result');
  await expect(result).toBeVisible();
  await expect(result).toContainText('Candle hire $321');
  await expect(result).toHaveAttribute('data-clarity-mask', 'true');
  await result.getByRole('link', { name: 'Book now' }).click();
  await expect(page).toHaveURL(/book.html\?quoteToken=test-token/);
  await expect(page.locator('#book-email')).toHaveValue(booking.email);
  expect(backend.calls.map(c => c.action)).toEqual(['getQuoteByToken', 'checkAvailability']);
});
test('confirmed sample shows booking details and never offers a new deposit', async ({ page }) => {
  await page.addInitScript(data => { window.lustrePreviewFindRecord = async () => ({ status: 'confirmed', booking: data }); }, booking);
  await open(page);
  await page.locator('#existing-record-reference').fill(booking.bookingId);
  await page.locator('#existing-record-email').fill(booking.email);
  await page.locator('#existing-record-next').click();
  await expect(page.locator('#existing-record-result')).toContainText('Your booking is confirmed');
  await expect(page.locator('#existing-record-result')).toContainText('do not need to pay another booking deposit');
  await expect(page.locator('#existing-record-result').getByRole('link', { name: 'Book now' })).toHaveCount(0);
});
for (const fails of [false, true]) test(`lookup ${fails ? 'error' : 'no match'} supports retry and preserves the email`, async ({ page }) => {
  await page.addInitScript(fails => { window.lustrePreviewFindRecord = async () => { if (fails) throw new Error(); return null; }; }, fails);
  await open(page);
  await page.locator('#existing-record-reference').fill(booking.bookingId);
  await page.locator('#existing-record-email').fill(booking.email);
  await page.locator('#existing-record-next').click();
  await expect(page.locator('#existing-record-result')).toContainText(fails ? 'please try again' : 'Check your details');
  await expect(page.locator('#existing-record-email')).toHaveValue(booking.email);
  await expect(page.locator('#existing-record-next')).toBeEnabled();
});

test('retrieved quote uses compact pricing and a keyboard-accessible later-payment disclosure', async ({ page }) => {
  await page.addInitScript(data => { window.lustrePreviewFindRecord = async () => ({ status: 'quote', booking: { ...data, quantity: 400, hireFee: 3333 } }); }, booking);
  await open(page);
  await page.locator('#existing-record-reference').fill(booking.bookingId);
  await page.locator('#existing-record-email').fill(booking.email);
  await page.locator('#existing-record-next').click();
  const result = page.locator('#existing-record-result');
  await expect(result.locator('.quote-summary-prices')).toContainText('$8.33');
  await expect(result.locator('.record-deposit-total')).toHaveText('$1,666.50');
  await expect(result.locator('.quote-later-body')).toBeHidden();
  await result.locator('summary').focus();
  await page.keyboard.press('Enter');
  await expect(result.locator('.quote-later-body')).toBeVisible();
  await expect(result.locator('.quote-later-body')).toContainText('$4,999.50');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('multiple verified sample records offer a chooser before pricing', async ({ page }) => {
  await page.addInitScript(data => {
    window.lustrePreviewFindRecord = async (_, id) => id
      ? { status: 'quote', booking: data }
      : { status: 'multiple', records: [{ id: 'q1', status: 'quote', reference: data.bookingId, eventDate: data.eventDate, quantity: data.quantity }, { id: 'b1', status: 'confirmed', reference: 'BOOK-2', eventDate: data.eventDate, quantity: 30 }] };
  }, booking);
  await open(page);
  await page.locator('#existing-record-reference').fill(booking.bookingId);
  await page.locator('#existing-record-email').fill(booking.email);
  await page.locator('#existing-record-next').click();
  await expect(page.getByRole('heading', { name: 'Which record would you like?' })).toBeVisible();
  await expect(page.locator('#existing-record-result .record-book-quote')).toHaveCount(0);
  await page.locator('#existing-record-result').getByRole('button', { name: /Quote ·/ }).click();
  await expect(page.locator('#existing-record-result .record-book-quote')).toBeVisible();
});
for (const balance of [0, 123, undefined]) test(`confirmed balance ${balance ?? 'unknown'} is authoritative, never a calculated schedule`, async ({ page }) => {
  await page.addInitScript(({ booking, balance }) => {
    window.lustrePreviewFindRecord = async () => ({ status: 'confirmed', booking, payment: balance === undefined ? {} : { balanceDue: balance, depositPaid: 160.50, totalPaid: 642 } });
  }, { booking, balance });
  await open(page);
  await page.locator('#existing-record-reference').fill(booking.bookingId);
  await page.locator('#existing-record-email').fill(booking.email);
  await page.locator('#existing-record-next').click();
  const result = page.locator('#existing-record-result');
  await expect(result.locator('.record-deposit-total')).toHaveText(balance === undefined ? 'Not available' : `$${balance}`);
  await expect(result.locator('.quote-later-details')).toHaveCount(0);
  await expect(result.getByRole('link', { name: /Book now/ })).toHaveCount(0);
  await expect(result).not.toContainText('$481.50');
});

test('both fields are required and masked before any live lookup', async ({ page, backend }) => {
  await open(page);
  await page.locator('#existing-record-email').fill(booking.email);
  await page.locator('#existing-record-next').click();
  expect(backend.calls).toHaveLength(0);
  await expect(page.locator('#existing-record-reference')).toHaveAttribute('data-clarity-mask','true');
  await expect(page.locator('#existing-record-email')).toHaveAttribute('data-clarity-mask','true');
  await expect(page.locator('#existing-record-result')).toHaveAttribute('data-clarity-mask','true');
});
test('connected quote lookup continues directly through existing token booking route', async ({ page, backend }) => {
  backend.replies.lookupExistingRecord={success:true,status:'quote',booking};
  await open(page);
  await page.locator('#existing-record-reference').fill(booking.bookingId);
  await page.locator('#existing-record-email').fill(booking.email);
  await page.locator('#existing-record-next').click();
  await expect(page.locator('#existing-record-result')).toContainText('Your quote');
  await page.locator('#existing-record-result').getByRole('link',{name:'Book now →'}).click();
  await expect(page).toHaveURL(/book.html\?quoteToken=test-token/);
  await expect(page.locator('#book-email')).toHaveValue(booking.email);
  expect(backend.calls.map(call=>call.action)).toEqual(['lookupExistingRecord','getQuoteByToken','checkAvailability']);
});
for(const scenario of ['error','rate_limited']) test(`connected lookup ${scenario} preserves both fields and allows recovery`,async({page,backend})=>{
  backend.replies.lookupExistingRecord=scenario==='rate_limited'?{success:false,status:'rate_limited'}:{success:false};
  await open(page);
  await page.locator('#existing-record-reference').fill(booking.bookingId);
  await page.locator('#existing-record-email').fill(booking.email);
  await page.locator('#existing-record-next').click();
  await expect(page.locator(scenario==='rate_limited'?'#existing-record-email-feedback':'#existing-record-result')).toContainText(scenario==='rate_limited'?'Too many attempts':'please try again');
  await expect(page.locator('#existing-record-reference')).toHaveValue(booking.bookingId);
  await expect(page.locator('#existing-record-email')).toHaveValue(booking.email);
  backend.replies.lookupExistingRecord={success:true,status:'quote',booking};
  if(scenario==='error') await page.getByRole('button',{name:'Try again',exact:true}).click();
  else await page.locator('#existing-record-next').click();
  await expect(page.locator('#existing-record-result')).toContainText('Your quote');
});
test('connected confirmed booking shows unknown balance honestly and never offers deposit',async({page,backend})=>{
  backend.replies.lookupExistingRecord={success:true,status:'confirmed',booking:{...booking,bookingStatus:'confirmed',quoteToken:undefined},payment:{depositPaid:160.50}};
  await open(page);
  await page.locator('#existing-record-reference').fill(booking.bookingId);
  await page.locator('#existing-record-email').fill(booking.email);
  await page.locator('#existing-record-next').click();
  await expect(page.locator('#existing-record-result')).toContainText('Your booking is confirmed');
  await expect(page.locator('#existing-record-result')).toContainText('Not available');
  await expect(page.locator('#existing-record-result .record-book-quote')).toHaveCount(0);
});

test('main menu opens existing lookup directly and returns focus on close', async ({ page }) => {
  await page.goto('/');
  const mobileMenu = page.viewportSize().width <= 1100;
  if (mobileMenu) await page.getByRole('button', { name: 'Toggle navigation' }).click();
  const trigger = page.locator(mobileMenu ? '.mobile-nav [data-open-existing-record]' : '.desktop-nav [data-open-existing-record]');
  await trigger.click();
  await expect(page.locator('#existing-record-dialog')).toBeVisible();
  await expect(page.locator('#existing-record-reference')).toBeFocused();
  await expect(page.locator('#availability-dialog')).toBeHidden();
  if (mobileMenu) await expect(page.locator('.menu-toggle')).toHaveAttribute('aria-expanded', 'false');
  await page.keyboard.press('Escape');
  await expect(page.locator('#existing-record-dialog')).toBeHidden();
  await expect(mobileMenu ? page.locator('.menu-toggle') : trigger).toBeFocused();
});

test('new quote recovery from the main menu exposes the date form on every device', async ({ page, backend }) => {
  backend.replies.lookupExistingRecord = { success: true, status: 'missing' };
  await page.goto('/');
  if (page.viewportSize().width <= 1100) await page.getByRole('button', { name: 'Toggle navigation' }).click();
  await page.getByRole('button', { name: 'Find my quote or booking', exact: true }).click();
  await page.locator('#existing-record-reference').fill(booking.bookingId);
  await page.locator('#existing-record-email').fill(booking.email);
  await page.locator('#existing-record-next').click();
  await page.getByRole('button', { name: 'Get a new quote', exact: true }).click();
  await expect(page.locator('#existing-record-dialog')).toBeHidden();
  await expect(page.locator('#availability-form')).toBeVisible();
  await expect(page.locator('#availability-date')).toBeFocused();
});
