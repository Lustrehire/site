const { test, expect } = require('./fixtures');

test('mobile homepage adapts without duplicate forms or horizontal overflow', async ({ page }) => {
  for (const width of [320, 360, 375, 390, 430, 767]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Beautiful candles, minus all the prep\./);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    for (const id of ['availability-form', 'availability-booking-form', 'contact-modal-form']) {
      await expect(page.locator(`#${id}`)).toHaveCount(1);
    }
    const positions = await page.evaluate(() => ['availability-checker', 'benefits', 'gallery-preview', 'candle-sizes', 'testimonials', 'how-it-works'].map(id => document.getElementById(id).getBoundingClientRect().top));
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    const image = await page.locator('.hero-image').boundingBox();
    const text = await page.locator('.hero-text').boundingBox();
    expect(text.y).toBeGreaterThanOrEqual(image.y);
    expect(text.y + text.height).toBeLessThanOrEqual(image.y + image.height + 1);
    const form = await page.locator('#availability-checker').boundingBox();
    expect(form.y).toBeLessThan(image.y + image.height);
    const button = page.locator('.cro-ready .booking-button');
    expect((await button.boundingBox()).height).toBeGreaterThanOrEqual(48);
    expect(await button.evaluate(e => getComputedStyle(e).color)).toBe('rgb(40, 94, 62)');
  }
});

test('breakpoint restores desktop section order and retains form state', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto('/');
  await page.locator('#availability-quantity').fill('63');
  await page.setViewportSize({ width: 1024, height: 900 });
  await expect(page.locator('#availability-quantity')).toHaveValue('63');
  await expect.poll(() => page.locator('#main-content > section').evaluateAll(nodes => nodes.filter(n => ['gallery-preview', 'how-it-works', 'benefits', 'testimonials', 'candle-sizes'].includes(n.id)).map(n => n.id))).toEqual(['benefits', 'gallery-preview', 'candle-sizes', 'testimonials', 'how-it-works']);
  await expect(page.locator('h1 .mobile-v3-only')).toBeHidden();
  for (const width of [768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.locator('h1 .mobile-v3-desktop')).toBeVisible();
    await expect(page.locator('h1 .mobile-v3-only')).toBeHidden();
  }
  await page.setViewportSize({ width: 390, height: 900 });
  await expect(page.locator('#availability-quantity')).toHaveValue('63');
});

test('date and quantity entry do not show pricing or request availability before submit', async ({ page, backend }) => {
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await page.locator('#availability-date').fill('2030-06-15');
    await page.locator('#availability-quantity').pressSequentially('45');
    await expect(page.locator('#availability-result')).toBeHidden();
    await expect(page.locator('#availability-form')).toBeVisible();
    await expect(page.locator('#availability-checker .availability-price')).toHaveCount(0);
    await expect(page.locator('#mobile-price-preview')).toHaveCount(0);
    expect(backend.calls).toHaveLength(0);
  }
});

test('compact mobile disclosures retain gallery content and the original contact form', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto('/');
  await expect(page.locator('#main-content > #benefits')).toBeVisible();
  await expect(page.locator('#benefits .benefit')).toHaveCount(4);
  await expect(page.locator('details #benefits')).toHaveCount(0);
  await expect(page.locator('#gallery-preview [data-gallery-image] img')).toHaveCount(6);
  await expect(page.locator('#contact-modal-form')).toBeHidden();
  await page.locator('#contact .mobile-more > summary').click();
  await expect(page.locator('#contact-modal-form')).toBeVisible();
  await expect(page.locator('#contact-modal-form')).toHaveCount(1);
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.locator('#contact .mobile-more')).toHaveCount(0);
  await expect(page.locator('#contact-modal-form')).toBeVisible();
});

test('tablet and desktop show full content, matching mobile copy and the entry form', async ({ page }) => {
  for (const width of [768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await expect(page.locator('#main-content .mobile-more')).toHaveCount(0);
    await expect(page.locator('#contact-modal-form')).toBeVisible();
    await expect(page.locator('#benefits')).toBeVisible();
    await expect(page.locator('#gallery-preview .cro-gallery-preview img')).toHaveCount(6);
    for (const card of await page.locator('.testimonial-card').all()) await expect(card).toBeVisible();
    expect(await page.locator('.testimonials-grid').evaluate(e => e.scrollWidth > e.clientWidth)).toBe(true);
    await expect(page.locator('#candle-packages h2 .mobile-v3-only')).toBeVisible();
    await expect(page.locator('h1 .mobile-v3-only')).toBeHidden();
    await page.locator('#availability-quantity').fill('45');
    await expect(page.locator('#availability-result')).toBeHidden();
    await expect(page.locator('#availability-form')).toBeVisible();
  }
});

test('homepage journey and booking anchors remain correct across breakpoints', async ({ page }) => {
  for (const width of [390, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/');
    const expected = ['candle-packages', 'benefits', 'gallery-preview', 'candle-sizes', 'testimonials', 'how-it-works', 'faq', 'booking-cta', 'contact'];
    expect(await page.locator('#main-content > section').evaluateAll(nodes => nodes.filter(n => !['availability-checker', 'wedding-estimator-panel'].includes(n.id)).map(n => n.id || (n.classList.contains('cro-ready') ? 'booking-cta' : '')))).toEqual(expected);
    await page.locator('.cro-ready a[href="#availability"]').click();
    await expect(page.locator('#availability-form')).toBeInViewport();
    for (const target of ['pricing', 'how-it-works']) {
      await page.locator(`.site-footer a[href="#${target}"]`).click();
      await expect(page.locator(`#${target}`)).toBeInViewport();
    }
  }
});

test('homepage gallery preview follows the managed gallery selection and order', async ({ page }) => {
  const gallery = require('../content/gallery.json');
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/');
    const images = page.locator('#gallery-preview .cro-gallery-preview img');
    expect(await images.evaluateAll(nodes => nodes.map(node => node.getAttribute('src')))).toEqual(gallery.slice(-6).reverse().map(item => item.preview));
    await expect(page.locator('#gallery-preview > a[href="/gallery.html"]')).toBeVisible();
  }
});
