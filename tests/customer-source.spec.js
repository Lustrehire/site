const { test, expect, booking, checkoutUrl, checkDate, reviewBooking } = require('./fixtures');

for (const customerSource of ['Facebook Marketplace', '']) {
  test(`email quote saves optional source: ${customerSource || 'unanswered'}`, async ({ page, backend }) => {
    await checkDate(page);
    await page.locator('#availability-continue-button').click();
    await page.locator('#availability-full-name').fill(booking.fullName);
    await page.locator('#availability-email').fill(booking.email);
    await page.getByLabel('How did you first hear about Lustre Hire?').selectOption(customerSource);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.locator('#availability-step-2-submit').click();
    await expect(page.locator('#availability-step-4-panel')).toBeVisible();
    expect(backend.calls.find(call => call.action === 'saveQuoteBooking').bookingData.customerSource).toBe(customerSource);
    expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem('lustreHirePendingBooking')).customerSource)).toBe(customerSource);
  });
}

for (const mode of ['quote', 'direct']) {
  for (const initialSource of ['Facebook Marketplace', undefined]) {
    test(`${mode} source survives checkout, cancellation and confirmation: ${initialSource || 'legacy'}`, async ({ page, backend }) => {
      const data = { ...booking, mode, customerSource: initialSource };
      if (mode === 'quote') {
        backend.replies.getQuoteByToken = { success: true, status: 'valid', booking: data };
        await page.goto('/quote.html?quoteToken=test-token');
        await page.getByRole('link', { name: 'Pay Deposit & Secure My Date' }).click();
      } else {
        await page.goto('/');
        await page.evaluate(data => sessionStorage.setItem('lustreHirePendingBooking', JSON.stringify(data)), data);
        await page.goto('/book.html');
      }
      const source = page.getByLabel('How did you first hear about Lustre Hire?');
      await expect(source).toHaveValue(initialSource || '');
      await expect(source).not.toHaveAttribute('required');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      // Legacy quotes may remain unanswered; existing answers can be changed.
      const selected = initialSource ? 'Instagram' : '';
      await source.selectOption(selected);
      const action = mode === 'quote' ? 'createQuoteCheckoutSession' : 'createCheckoutSession';
      // A backend returning booking data without this new field must not erase it.
      backend.replies[action] = { success: true, checkoutUrl, bookingData: booking };
      await reviewBooking(page);
      await page.locator('#book-terms-checkbox').check();
      await page.locator('#book-payment-button').click();
      await expect(page).toHaveURL(checkoutUrl);
      expect(backend.calls.find(call => call.action === action).bookingData.customerSource).toBe(selected);
      await page.goto('/payment-cancelled.html');
      await page.locator('#payment-cancelled-resume-link').click();
      await expect(source).toBeVisible();
      await expect(source).toHaveValue(selected);
      const confirmAction = mode === 'quote' ? 'markQuoteAsConfirmed' : 'saveConfirmedBooking';
      backend.replies[confirmAction] = { success: true, paymentVerified: true, bookingId: booking.bookingId };
      await page.goto('/payment-success.html?session_id=test-session');
      await expect(page.locator('#payment-success-status')).toContainText('50% booking deposit has been received');
      expect(backend.calls.find(call => call.action === confirmAction).bookingData.customerSource).toBe(selected);
    });
  }
}

test('direct booking collects Facebook Marketplace at checkout', async ({ page, backend }) => {
  await checkDate(page);
  await page.locator('#availability-continue-button').click();
  await page.getByLabel('How did you first hear about Lustre Hire?').selectOption('Facebook Marketplace');
  await page.locator('#availability-back-to-step-1').click();
  await page.locator('#availability-ready-button').click();
  await expect(page.getByLabel('How did you first hear about Lustre Hire?')).toHaveValue('Facebook Marketplace');
  await reviewBooking(page);
  await page.locator('#book-terms-checkbox').check();
  await page.locator('#book-payment-button').click();
  await expect(page).toHaveURL(checkoutUrl);
  expect(backend.calls.find(call => call.action === 'createCheckoutSession').bookingData.customerSource).toBe('Facebook Marketplace');
  await page.goto('/payment-cancelled.html');
  await page.locator('#payment-cancelled-resume-link').click();
  await expect(page.getByLabel('How did you first hear about Lustre Hire?')).toHaveValue('Facebook Marketplace');
});
