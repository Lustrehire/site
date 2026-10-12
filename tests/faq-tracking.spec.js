const { test, expect } = require('./fixtures');

const events = page => page.evaluate(() => (window.dataLayer || [])
  .filter(e => e[0] === 'event' && e[1] === 'faq_search').map(e => e[2]));

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.clock.install({ time: new Date('2030-06-01T04:00:00Z') });
  await page.clock.pauseAt(new Date('2030-06-01T04:00:01Z'));
});

test('FAQ search debounces typing, filters immediately and deduplicates topic edits', async ({ page }) => {
  const search = page.locator('#faq-search');
  await search.fill('min');
  await page.clock.fastForward(300);
  await search.fill('minimum');
  await expect(page.locator('.faq-item:not([hidden])')).not.toHaveCount(0);
  await page.clock.fastForward(699);
  expect(await events(page)).toEqual([]);
  await page.clock.fastForward(1);
  expect(await events(page)).toMatchObject([{ faq_topic: 'pricing', send_to: 'G-1RPLQ8LZ48' }]);
  await search.fill('PRICING please');
  await page.clock.fastForward(800);
  expect(await events(page)).toHaveLength(1);
  await search.fill('');
  await page.clock.fastForward(800);
  expect(await events(page)).toHaveLength(1);
  await search.fill('pricing');
  await page.clock.fastForward(800);
  expect(await events(page)).toHaveLength(2);
});

for (const [query, topic] of [
  ['price', 'pricing'], ['pick up', 'pickup'], ['returns', 'returns'], ['bond', 'bond'],
  ['burn time', 'burn_time'], ['safety', 'safety'], ['available', 'availability'],
  ['Private Person private@example.test 0400000000 123 Secret Street', 'other'],
]) {
  test(`FAQ categorises ${topic} without transmitting search text`, async ({ page }) => {
    await page.locator('#faq-search').fill(query);
    await page.clock.fastForward(700);
    expect(await events(page)).toMatchObject([{ faq_topic: topic }]);
    const payloads = await page.evaluate(() => JSON.stringify({ ga: window.dataLayer, meta: window.fbq?.queue }));
    if (query !== topic) expect(payloads).not.toContain(query);
    expect(await page.evaluate(() => JSON.stringify(window.fbq?.queue))).not.toContain('faq_search');
    await expect(page.locator('#faq-search')).toHaveAttribute('data-clarity-mask', 'true');
    await expect(page.locator('[data-clarity-unmask]')).toHaveCount(0);
  });
}

test('blank, cleared, composing searches and filter clicks do not emit premature events', async ({ page }) => {
  const search = page.locator('#faq-search');
  await search.fill('bond');
  await search.fill(' ');
  await page.clock.fastForward(800);
  await page.locator('.faq-filter').first().click();
  await search.fill('pricing');
  await search.dispatchEvent('compositionstart');
  await page.clock.fastForward(800);
  expect(await events(page)).toEqual([]);
  await search.dispatchEvent('compositionend');
  await page.clock.fastForward(700);
  expect(await events(page)).toHaveLength(1);
});

test('shared helper drops unrecognised topics and personal search parameters', async ({ page }) => {
  await page.evaluate(() => window.trackLustreEvent('faq_search', {
    faq_topic: 'private@example.test', search_term: 'Private Person', email: 'private@example.test',
  }));
  const result = await events(page);
  expect(result[0]).not.toHaveProperty('faq_topic');
  expect(JSON.stringify(result)).not.toContain('Private Person');
  expect(JSON.stringify(result)).not.toContain('private@example.test');
});
