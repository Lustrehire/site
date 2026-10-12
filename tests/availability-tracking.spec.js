const { test, expect, available, checkDate } = require('./fixtures');

// Mirrors Apps Script: availability fields, not a generic success envelope.
const { success, ...responseFields } = available;
const resultEvents = page => page.evaluate(() => window.dataLayer
  .filter(e => e[0] === 'event' && e[1] === 'availability_result').map(e => e[2]));

for (const [status, isAvailable, partialAvailable, expected] of [
  ['available', true, false, 'available'],
  ['partial', false, true, 'partial'],
  ['partial_available', false, true, 'partial'],
  ['limited', false, true, 'partial'],
  ['unavailable', false, false, 'unavailable'],
  ['notice_period', false, false, 'notice_period'],
  ['below_minimum', false, false, 'below_minimum'],
  [undefined, false, true, 'partial'],
]) {
  test(`availability result without success: ${status || 'boolean flags'}`, async ({ page, backend }) => {
    backend.replies.checkAvailability = {
      ...responseFields, status, available: isAvailable, partialAvailable,
      requestedQuantity: 50, maxAvailable: isAvailable ? 500 : partialAvailable ? 30 : 0,
      message: 'Backend message private@example.test',
      email: 'private@example.test', quoteToken: 'private-token', stripeSessionId: 'cs_test_private',
    };
    await checkDate(page);
    await expect.poll(() => resultEvents(page)).toMatchObject([{ availability_status: expected, quantity: 50 }]);
    expect(await resultEvents(page)).toHaveLength(1);
    expect(await page.evaluate(() => window.dataLayer.filter(e => e[0] === 'event' && e[1] === 'availability_check').length)).toBe(1);
    const sent = await page.evaluate(() => JSON.stringify([window.dataLayer, window.fbq.queue]));
    for (const secret of ['private@example.test', 'private-token', 'cs_test_private', 'Backend message']) expect(sent).not.toContain(secret);
    expect(await page.evaluate(() => window.fbq.queue.filter(e => e[0] === 'trackCustom' && e[1] === 'availability_result').length)).toBe(1);
    if (isAvailable) await expect(page.locator('#availability-ready-button')).toBeVisible();
    else await expect(page.locator('#availability-ready-button')).toBeHidden();
  });
}

for (const [label, reply] of [
  ['empty object', {}],
  ['array', []],
  ['unknown backend error', { ...responseFields, status: 'server_error', message: 'Internal failure' }],
  ['explicit failure', { ...responseFields, success: false }],
  ['error field', { ...responseFields, error: 'unrecognised failure' }],
  ['invalid flag types', { ...responseFields, available: 'true', partialAvailable: 'false' }],
  ['success without availability', { success: true }],
]) {
  test(`no availability result for ${label}`, async ({ page, backend }) => {
    backend.replies.checkAvailability = reply;
    await checkDate(page);
    // Wait until the existing handler has rendered and completed its finally block.
    await expect(page.locator('#availability-form button[type="submit"]')).toBeEnabled();
    expect(backend.calls.filter(e => e.action === 'checkAvailability')).toHaveLength(1);
    expect(await resultEvents(page)).toEqual([]);
  });
}

for (const failure of ['network', 'invalid JSON', 'HTTP error']) {
  test(`no availability result for ${failure}`, async ({ page, backend }) => {
    backend.expectedErrors.push(/^Availability check error:/, /^Malformed JSON response:/, /^Failed to load resource:/);
    await page.route('https://script.google.com/**', route => {
      if (failure === 'network') return route.abort('failed');
      if (failure === 'invalid JSON') return route.fulfill({ contentType: 'application/json', body: '{not-json' });
      return route.fulfill({ status: 500, json: responseFields });
    });
    await checkDate(page);
    await expect(page.locator('[data-availability-action="retry-check"]')).toBeVisible();
    expect(await resultEvents(page)).toEqual([]);
    expect(await page.evaluate(() => window.dataLayer.filter(e => e[0] === 'event' && e[1] === 'availability_check').length)).toBe(1);
  });
}
