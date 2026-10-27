const fs = require('node:fs');
const path = require('node:path');
const { test, expect, booking } = require('./fixtures');
const root = path.resolve(__dirname, '..');
const privatePages = ['book.html', 'quote.html', 'payment-success.html', 'payment-cancelled.html'];
const htmlFiles = ['', 'blog'].flatMap(dir => fs.readdirSync(path.join(root, dir))
  .filter(name => name.endsWith('.html')).map(name => dir ? `${dir}/${name}` : name));
const publicPages = htmlFiles.filter(file => !privatePages.includes(file) &&
  !fs.readFileSync(path.join(root, file), 'utf8').includes('name="lustre-private-page"'));
const template = fs.readFileSync(path.join(root, 'templates/public-page.html.template'), 'utf8');
const views = page => page.evaluate(() => (window.dataLayer || []).filter(e => e[0] === 'event' && e[1] === 'page_view').map(e => e[2]));

async function assertPublic(page, pathname) {
  await expect(page.locator('script[src*="gtag/js"]')).toHaveCount(1);
  await expect(page.locator('script[src*="gtm.js"]')).toHaveCount(1);
  await expect(page.locator('script[src*="fbevents.js"]')).toHaveCount(1);
  expect(await views(page)).toMatchObject([{ page_path: pathname, send_to: 'G-1RPLQ8LZ48' }]);
  expect(await page.evaluate(() => window.dataLayer.filter(e => e.event === 'lustre_tracking_ready')))
    .toEqual([{ event: 'lustre_tracking_ready', lustre_clarity_eligible: true }]);
  await expect(page.locator('script[src*="clarity.ms"]')).toHaveCount(0); // Installation belongs to GTM.
  await expect(page.locator('body')).not.toHaveAttribute('data-clarity-mask');
  await expect(page.locator('[data-clarity-unmask]')).toHaveCount(0);
  expect(await page.locator('input, textarea, select, [contenteditable="true"]').evaluateAll(els =>
    els.every(el => el.closest('[data-clarity-mask="true"]')))).toBe(true);
}

for (const file of publicPages) {
  test(`${file}: explicitly public, sanitised and initialised once`, async ({ page, backend }) => {
    const missingResources = [];
    page.on('response', response => { if (response.status() === 404) missingResources.push(new URL(response.url()).pathname); });
    const html = fs.readFileSync(path.join(root, file), 'utf8');
    const pathname = ['gallery.html', 'faq.html'].includes(file) ? '/' + file.replace('.html', '') : '/' + file;
    expect(html).toContain(`<meta name="lustre-public-page" content="${['gallery.html', 'faq.html'].includes(file) ? '/' + file : pathname}">`);
    expect(html.indexOf('name="referrer"')).toBeLessThan(html.indexOf('lustre-tracking.js'));
    expect(html.indexOf('name="lustre-public-page"')).toBeLessThan(html.indexOf('lustre-tracking.js'));
    await page.route(/gtag\/js|gtm\.js|fbevents\.js/, route => route.fulfill({
      contentType: 'application/javascript', body: 'window.observedUrls = (window.observedUrls || []).concat(location.href);',
    }));
    await page.goto(`/${file}?utm_source=google&utm_medium=cpc&utm_campaign=public_pages&email=private%40example.test&quoteToken=secret-token&session_id=cs_secret#private`);
    await assertPublic(page, pathname);
    await expect.poll(() => page.evaluate(() => window.observedUrls?.length)).toBe(3);
    expect((await views(page))[0].campaign_name).toBe('public_pages');
    const sent = await page.evaluate(() => JSON.stringify([window.dataLayer, window.fbq.queue, window.observedUrls]));
    for (const secret of ['private', 'secret-token', 'cs_secret']) expect(sent).not.toContain(secret);
    await page.addScriptTag({ url: '/lustre-tracking.js' });
    await assertPublic(page, pathname);
    expect(await page.evaluate(() => window.fbq.queue.filter(e => e[1] === 'PageView').length)).toBe(1);
    expect(missingResources).toEqual([]);
  });
}

function futurePage(pathname) {
  return template.replaceAll('{{PUBLIC_PAGE_PATH}}', pathname).replaceAll('{{TITLE}}', 'Future public article')
    .replace('<!-- PUBLIC_CONTENT -->', '<p>Public article content</p><input data-clarity-mask="true" value="Private Person"><div id="personal-output" data-clarity-mask="true"></div>');
}

test('future template page inherits tracking and protects dynamically rendered personal content', async ({ page }) => {
  await page.route('**/guides/future-public-article.html*', route => route.fulfill({ contentType: 'text/html', body: futurePage('/guides/future-public-article.html') }));
  await page.goto('/guides/future-public-article.html?utm_source=instagram&utm_medium=paid_social&fbclid=IwAR1234567890AbCdEfGhIjKlMnOpQrStUv');
  await assertPublic(page, '/guides/future-public-article.html');
  expect((await views(page))[0]).toMatchObject({ campaign_source: 'instagram', campaign_medium: 'paid_social' });
  await page.locator('#personal-output').evaluate(el => { el.innerHTML = '<span>private@example.test</span>'; });
  expect(await page.locator('#personal-output span').evaluate(el => !!el.closest('[data-clarity-mask="true"]'))).toBe(true);
  expect(await page.locator('h1').evaluate(el => !!el.closest('[data-clarity-mask]'))).toBe(false);
});

for (const [label, html] of [
  ['unmarked page', futurePage('/future.html').replace('<meta name="lustre-public-page" content="/future.html">', '')],
  ['mismatched path / fallback', futurePage('/another.html')],
  ['explicitly private page', futurePage('/future.html').replace('<head>', '<head><meta name="lustre-private-page" content="true">')],
  ['unfilled template', template],
]) {
  test(`${label} stays excluded`, async ({ page }) => {
    await page.route('**/future.html*', route => route.fulfill({ contentType: 'text/html', body: html }));
    await page.goto('/future.html?quoteToken=secret');
    await expect(page.locator('script[src*="gtag/js"], script[src*="gtm.js"], script[src*="fbevents.js"]')).toHaveCount(0);
    expect(await views(page)).toEqual([]);
    expect(page.url()).toContain('quoteToken=secret');
  });
}

for (const file of privatePages) {
  test(`${file}: public marker cannot override private exclusion`, async ({ page }) => {
    const html = fs.readFileSync(path.join(root, file), 'utf8').replace(/<head>/, `<head><meta name="lustre-public-page" content="/${file}">`);
    await page.route(`**/${file}*`, route => route.fulfill({ contentType: 'text/html', body: html }));
    await page.goto(`/${file}?quoteToken=test-token&session_id=cs_secret`);
    await expect(page.locator('script[src*="gtm.js"], script[src*="fbevents.js"], script[src*="clarity.ms"]')).toHaveCount(0);
    expect(await views(page)).toMatchObject([{ page_path: '/' + file }]);
    expect(await page.evaluate(() => window.dataLayer.some(e => e.lustre_clarity_eligible))).toBe(false);
    expect(JSON.stringify(await views(page))).not.toContain('cs_secret');
  });
}

test('blog to homepage to booking keeps safe navigation context and campaign attribution', async ({ page }) => {
  await page.goto('/blog/blog.html?utm_source=facebook&utm_medium=paid_social&utm_campaign=blog_journey');
  await page.locator('a[href="burn-time-calculator.html"]').first().click();
  await expect.poll(async () => (await views(page))[0]).toMatchObject({ page_path: '/blog/burn-time-calculator.html', previous_page_path: '/blog/blog.html' });
  await page.locator('.blog-post-cta a[href="../index.html?scrollTo=availability-checker"]').click();
  await expect.poll(async () => (await views(page))[0]).toMatchObject({ previous_page_path: '/blog/burn-time-calculator.html', campaign_name: 'blog_journey' });
  await page.locator('#availability-date').fill(booking.eventDate);
  await page.locator('#availability-quantity').fill('50');
  await page.locator('#availability-form').getByRole('button', { name: /check/i }).click();
  expect(await page.evaluate(() => window.dataLayer.find(e => e[1] === 'availability_check')[2])).toMatchObject({ previous_page_path: '/blog/burn-time-calculator.html', campaign_name: 'blog_journey' });
  await page.locator('#availability-ready-button').click();
  await expect(page.locator('#book-form-panel')).toBeVisible();
  expect((await views(page))[0]).toMatchObject({ page_path: '/book.html', previous_page_path: '/index.html', campaign_name: 'blog_journey' });
  await expect(page.locator('script[src*="gtm.js"]')).toHaveCount(0);
});

test('public expansion preserves queued provider consent denials without fabricating grants', async ({ page }) => {
  await page.addInitScript(() => {
    window.dataLayer = [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('consent', 'default', { analytics_storage: 'denied', ad_storage: 'denied' });
    window.fbq = function () { window.fbq.queue.push(arguments); };
    window.fbq.queue = [];
    window.fbq('consent', 'revoke');
    window.clarity = function () { window.clarity.q.push(arguments); };
    window.clarity.q = [];
    window.clarity('consentv2', { analytics_Storage: 'denied', ad_Storage: 'denied' });
  });
  await page.goto('/blog/blog.html');
  expect(await page.evaluate(() => window.dataLayer.filter(e => e[0] === 'consent').map(e => Array.from(e))))
    .toEqual([['consent', 'default', { analytics_storage: 'denied', ad_storage: 'denied' }]]);
  expect(await page.evaluate(() => window.fbq.queue.filter(e => e[0] === 'consent').map(e => Array.from(e))))
    .toEqual([['consent', 'revoke']]);
  expect(await page.evaluate(() => window.clarity.q.map(e => Array.from(e))))
    .toEqual([['consentv2', { analytics_Storage: 'denied', ad_Storage: 'denied' }]]);
});
