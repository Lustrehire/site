const { test, expect, available } = require('./fixtures');

test.describe('seven full days between today and the event', () => {
  test.use({ browserNow: '2026-09-20T04:00:00Z' });

  for (const day of [20, 21, 26, 27, 28, 29]) {
    test(`20 September: event on ${day} September is ${day < 28 ? 'blocked' : 'allowed'}`, async ({ page, backend }) => {
      await page.goto('/');
      const date = page.locator('#availability-date');
      await expect(date).toHaveAttribute('min', '2026-09-28');
      await date.fill(`2026-09-${day}`);
      await page.locator('#availability-quantity').fill('15');
      await page.locator('#availability-form button[type="submit"]').click();
      if (day < 28) {
        expect(backend.calls).toEqual([]);
        await expect(page.locator('#availability-feedback')).toContainText("We require at least 7 days' notice");
        await expect(page.locator('#availability-feedback')).toContainText(/28 Sept? 2026/);
        await expect(page.locator('#availability-ready-button')).toBeHidden();
        await expect(page.locator('#availability-continue-button')).toBeHidden();
      } else {
        await expect(page.locator('#availability-ready-button')).toBeVisible();
        expect(backend.calls[0]).toEqual({ action: 'checkAvailability', eventDate: `2026-09-${day}`, quantity: 15 });
      }
    });
  }

  test('manual removal of picker limits cannot bypass submission validation', async ({ page, backend }) => {
    await page.goto('/');
    await page.locator('#availability-date').evaluate(input => {
      input.removeAttribute('min');
      input.value = '2026-09-27';
      input.setCustomValidity('');
    });
    await page.locator('#availability-quantity').fill('15');
    await page.locator('#availability-form').evaluate(form => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
    expect(backend.calls).toEqual([]);
    await expect(page.locator('#availability-feedback')).toContainText(/28 Sept? 2026/);
  });

  test('backend notice response blocks booking and displays its message', async ({ page, backend }) => {
    backend.replies.checkAvailability = { ...available, status: 'notice_period', available: false, minimumNoticeDays: 8, earliestAllowedEventDate: '2026-09-30', message: 'Please select 30 September or later.' };
    await page.goto('/');
    await page.locator('#availability-date').fill('2026-09-28');
    await page.locator('#availability-quantity').fill('15');
    await page.locator('#availability-form button[type="submit"]').click();
    await expect(page.locator('#availability-result')).toContainText('Please select 30 September or later.');
    await expect(page.locator('#availability-date')).toHaveAttribute('min', '2026-09-30');
    await expect(page.locator('#availability-ready-button')).toBeHidden();
    await expect(page.locator('#availability-continue-button')).toBeHidden();
  });

  test('an earlier backend limit cannot relax the eight-day minimum', async ({ page, backend }) => {
    backend.replies.checkAvailability = { ...available, minimumNoticeDays: 3, earliestAllowedEventDate: '2026-09-23' };
    await page.goto('/');
    await page.locator('#availability-date').fill('2026-09-28');
    await page.locator('#availability-quantity').fill('15');
    await page.locator('#availability-form button[type="submit"]').click();
    await expect(page.locator('#availability-ready-button')).toBeVisible();
    await expect(page.locator('#availability-date')).toHaveAttribute('min', '2026-09-28');
  });

  test('an open page refreshes its minimum when the local date changes', async ({ page, backend }) => {
    await page.goto('/');
    await page.locator('#availability-date').fill('2026-09-28');
    await page.clock.install({ time: new Date('2026-09-21T04:00:00Z') });
    await page.evaluate(() => window.dispatchEvent(new Event('pageshow')));
    await expect(page.locator('#availability-date')).toHaveAttribute('min', '2026-09-29');
    await page.locator('#availability-quantity').fill('15');
    await page.locator('#availability-form button[type="submit"]').click();
    expect(backend.calls).toEqual([]);
    await expect(page.locator('#availability-feedback')).toContainText(/29 Sept? 2026/);
  });
});

for (const [today, earliest, blockedDate] of [
  ['2026-09-21T04:00:00Z', '2026-09-29', '2026-09-28'],
  ['2026-10-01T04:00:00Z', '2026-10-09', '2026-10-08'],
  ['2026-09-26T04:00:00Z', '2026-10-04', '2026-10-03'],
  ['2026-12-26T04:00:00Z', '2027-01-03', '2027-01-02'],
  ['2028-02-22T04:00:00Z', '2028-03-01', '2028-02-29'],
]) {
  test.describe(`calendar boundary from ${today}`, () => {
    test.use({ browserNow: today });
    test('picker and submission enforce the current local date plus eight days', async ({ page, backend }) => {
      await page.goto('/');
      await expect(page.locator('#availability-date')).toHaveAttribute('min', earliest);
      await page.locator('#availability-date').fill(blockedDate);
      await page.locator('#availability-quantity').fill('15');
      await page.locator('#availability-form button[type="submit"]').click();
      expect(backend.calls).toEqual([]);
      await expect(page.locator('#availability-feedback')).toContainText("We require at least 7 days' notice");
      await page.locator('#availability-date').fill(earliest);
      await page.locator('#availability-form button[type="submit"]').click();
      await expect(page.locator('#availability-ready-button')).toBeVisible();
      expect(backend.calls[0]).toEqual({ action: 'checkAvailability', eventDate: earliest, quantity: 15 });
    });
  });
}

for (const [timezoneId, browserNow, expected] of [
  ['Australia/Sydney', '2026-10-03T13:30:00Z', '2026-10-11'],
  ['America/Los_Angeles', '2026-03-08T07:30:00Z', '2026-03-15'],
  ['America/Los_Angeles', '2026-11-01T06:30:00Z', '2026-11-08'],
]) {
  test.describe(`local calendar across DST in ${timezoneId} at ${browserNow}`, () => {
    test.use({ timezoneId, browserNow });
    test('date differs from UTC where appropriate and stays eight calendar days ahead', async ({ page }) => {
      await page.goto('/');
      await expect(page.locator('#availability-date')).toHaveAttribute('min', expected);
    });
  });
}
