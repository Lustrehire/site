const fs = require('node:fs');
const path = require('node:path');
const { test, expect, checkDate, booking } = require('./fixtures');
const baseline = JSON.parse(fs.readFileSync(path.join(__dirname, '../audit/cro/content-baseline.json'), 'utf8'));

test('full FAQ preserves every answer, supports categories/search and opens accessibly', async ({ page }) => {
  await page.goto('/faq');
  await expect(page.locator('.faq-item')).toHaveCount(baseline.faqs.length);
  for (const [i, item] of baseline.faqs.entries()) {
    await expect(page.locator('.faq-question strong').nth(i)).toHaveText(item.question);
    expect(await page.locator('.answer p').nth(i).innerHTML()).toBe(item.answerHTML);
  }
  const question = page.locator('.faq-question').first();
  await question.click();
  await expect(question).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('.answer').first()).toBeVisible();
  await page.getByRole('button', { name: 'Care', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Care', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.faq-item:not([hidden])')).toHaveCount(baseline.faqs.filter(i => i.categories.includes('care')).length);
  await page.locator('#faq-search').fill('nothing matches 123');
  await expect(page.locator('#faq-empty')).toBeVisible();
  await page.locator('#faq-search').fill('');
  await page.getByRole('button', { name: 'All', exact: true }).click();
  await expect(page.locator('.faq-item:not([hidden])')).toHaveCount(16);
});

test('homepage keeps six complete FAQ previews and all five instructional steps', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#faq .faq-item')).toHaveCount(6);
  await expect(page.locator('.cro-steps li')).toHaveCount(5);
  const questions = await page.locator('#faq .faq-question strong').allTextContents();
  for (const [i, question] of questions.entries()) {
    const source = baseline.faqs.find(f => f.question === question);
    expect(await page.locator('#faq .answer p').nth(i).innerHTML()).toBe(source.answerHTML);
  }
  await page.locator('#faq .faq-question').first().click();
  await expect(page.locator('#faq .answer').first()).toBeVisible();
  await expect(page.locator('#faq a[href="/faq.html"]')).toBeVisible();
});

test('gallery uses the managed selection and keyboard lightbox restores focus', async ({ page }) => {
  await page.goto('/gallery');
  const links = page.locator('[data-gallery-image]');
  const gallery = JSON.parse(fs.readFileSync(path.join(__dirname, '../content/gallery.json'), 'utf8'));
  for (const original of baseline.gallery) expect(fs.existsSync(path.join(__dirname, '..', original.path))).toBe(true);
  expect(await links.evaluateAll(nodes => nodes.map(n => n.getAttribute('href')))).toEqual(JSON.parse(fs.readFileSync(path.join(__dirname, '../content/gallery.json'), 'utf8')).map(i => i.src));
  await links.first().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(page.locator('#gallery-caption')).toHaveText(`1 of ${gallery.length}`);
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('#gallery-caption')).toHaveText(`${gallery.length} of ${gallery.length}`);
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#gallery-full-image')).toHaveAttribute('src', new URL(gallery[0].src, page.url()).href);
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(links.first()).toBeFocused();
});

test('homepage photos open locally in a modal and only full gallery navigates', async ({ page }) => {
  await page.goto('/');
  const photo = page.locator('#gallery-preview [data-gallery-image]').first();
  const source = await photo.getAttribute('href');
  await photo.click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator('#gallery-lightbox')).toBeVisible();
  await expect(page.locator('#gallery-full-image')).toHaveAttribute('src', new URL(source, page.url()).href);
  await expect(page.locator('#gallery-original')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(photo).toBeFocused();
  await page.locator('#gallery-preview > a.cro-outline-link').click();
  await expect(page).toHaveURL(/\/gallery\.html$/);
  await page.locator('[data-gallery-image]').first().click();
  await expect(page.locator('#gallery-lightbox')).toBeVisible();
  await expect(page.locator('#gallery-original')).toHaveCount(0);
});

test('estimator handoff retains date/customer details and invalidates stale availability', async ({ page }) => {
  await checkDate(page, 50);
  await page.locator('#availability-edit-button').click();
  await page.evaluate(() => {
    // Existing details may remain from a quote/back interaction.
    document.getElementById('availability-full-name').value = 'Test Customer';
    document.getElementById('availability-email').value = 'customer@example.test';
    document.getElementById('availability-customer-source').value = 'Instagram';
  });
  const source = await page.locator('#availability-customer-source').inputValue();
  await page.locator('#calculator-start').click();
  await page.locator('input[name="calculator_knowledge"][value="final-guests"]').check();
  await page.locator('#calculator-final-guests').fill('100');
  await page.locator('#calculator-next').click();
  await page.locator('input[name="calculator_table_style_guess"]').first().check();
  await page.locator('#calculator-next').click();
  await page.locator('input[name="calculator_fullness"]').first().check();
  await page.locator('#calculator-next').click();
  await page.locator('#calculator-next').click();
  await expect(page.locator('#calculator-result-panel')).toBeVisible();
  await page.locator('#calculator-check-date').click();
  await expect(page.locator('#availability-date')).toHaveValue(booking.eventDate);
  await expect(page.locator('#availability-full-name')).toHaveValue('Test Customer');
  await expect(page.locator('#availability-email')).toHaveValue('customer@example.test');
  await expect(page.locator('#availability-customer-source')).toHaveValue(source);
  await expect(page.locator('#availability-quantity')).not.toHaveValue('50');
  await expect(page.locator('#availability-result')).not.toBeVisible();
  await expect(page.locator('#availability-ready-button')).not.toBeVisible();
  await page.locator('#availability-form button[type="submit"]').click();
  await expect(page.locator('#availability-result')).toBeVisible();
});

for (const route of ['/gallery', '/faq']) {
  test(`${route}: static file and clean alias retain campaign and pageview fires once`, async ({ page }) => {
    await page.goto(`${route}.html?utm_source=facebook&utm_medium=paid_social&utm_campaign=cro_review`);
    expect(new URL(page.url()).pathname).toBe(route + '.html');
    const views = await page.evaluate(() => window.dataLayer.filter(e => e[0] === 'event' && e[1] === 'page_view').map(e => e[2]));
    expect(views).toMatchObject([{ page_path: route, campaign_source: 'facebook', campaign_name: 'cro_review' }]);
    expect(views).toHaveLength(1);
    await page.goto(route + '/');
    expect(new URL(page.url()).pathname).toBe(route);
  });
}

test('unapproved extensionless fallback remains excluded from tracking', async ({ page }) => {
  const template = fs.readFileSync(path.join(__dirname, '../templates/public-page.html.template'), 'utf8');
  await page.route('**/unapproved-route', route => route.fulfill({ contentType: 'text/html', body: template.replaceAll('{{PUBLIC_PAGE_PATH}}', '/unapproved-route').replaceAll('{{TITLE}}', 'Unapproved') }));
  await page.goto('/unapproved-route');
  await expect(page.locator('script[src*="gtag/js"], script[src*="gtm.js"], script[src*="fbevents.js"]')).toHaveCount(0);
});

test('public pages fit all requested widths and navigation is reachable', async ({ page }) => {
  for (const width of [360, 390, 430, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of ['/', '/gallery', '/faq']) {
      await page.goto(route);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${route} at ${width}px`).toBe(true);
      expect(await page.locator('h1').evaluate(el => {
        const rect = el.getBoundingClientRect();
        return rect.left >= 0 && rect.right <= innerWidth && el.scrollWidth <= el.clientWidth + 1;
      }), `${route} heading at ${width}px`).toBe(true);
      if (route === '/') {
        const headingsFit = await page.locator('#main-content > .cro-section').evaluateAll(sections => sections.filter(section => section.getClientRects().length).every(section => {
          const heading = section.querySelector('h2');
          if (!heading || !heading.getClientRects().length) return true;
          const bounds = section.getBoundingClientRect();
          const text = heading.getBoundingClientRect();
          return text.left >= bounds.left - 1 && text.right <= bounds.right + 1 && heading.scrollWidth <= heading.clientWidth + 1;
        }));
        expect(headingsFit, `Homepage headings fit their sections at ${width}px`).toBe(true);
      }
      const toggle = page.locator('.menu-toggle');
      if (await toggle.isVisible()) await toggle.click();
      const nav = page.locator(width <= 1100 ? '.mobile-nav' : '.desktop-nav');
      for (const label of ['Home', 'Gallery', 'Pricing', 'How It Works', 'FAQs', 'Blog', 'Contact', 'Check Date & Get Quote']) {
        await expect(nav.getByRole('link', { name: label, exact: true })).toBeVisible();
      }
    }
  }
});

test('public content reflows at 320px with increased user text spacing', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  for (const route of ['/', '/gallery', '/faq']) {
    await page.goto(route);
    await page.addStyleTag({ content: '* { line-height: 1.5 !important; letter-spacing: .12em !important; word-spacing: .16em !important; } p { margin-bottom: 2em !important; }' });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), route).toBe(true);
    expect(await page.locator('h1').evaluate(el => el.scrollWidth <= el.clientWidth + 1), `${route} title`).toBe(true);
    if (route === '/faq') {
      await page.locator('.faq-question').last().click();
      await expect(page.locator('.answer').last()).toBeVisible();
      expect(await page.locator('.answer').last().evaluate(el => el.scrollHeight <= el.clientHeight + 1)).toBe(true);
    }
  }
});

test('old and new quote anchors scroll without reloading or losing form inputs', async ({ page }) => {
  for (const hash of ['availability-checker', 'availability', 'candle-packages', 'pricing', 'how-it-works', 'faq', 'diy-practical', 'contact']) {
    await page.goto('/gallery');
    await page.goto('/#' + hash);
    // Near the footer the browser clamps scrolling at the document end.
    await expect.poll(() => page.locator('#' + hash).evaluate(el => {
      const top = el.getBoundingClientRect().top + scrollY;
      const headerHeight = document.querySelector(".header-container .logoName")?.getBoundingClientRect().height || 0;
      const expected = Math.min(Math.max(top - headerHeight - 12, 0), document.documentElement.scrollHeight - innerHeight);
      return Math.abs(scrollY - expected);
    })).toBeLessThan(3);
  }
  await page.goto('/');
  await page.locator('#availability-date').fill(booking.eventDate);
  await page.locator('.cro-ready a[href="#availability"]').click();
  await expect(page.locator('#availability-date')).toHaveValue(booking.eventDate);
});

test('inline contact keeps its masked submission and remains visible on Escape', async ({ page }) => {
  const submitted = [];
  await page.route('https://formspree.io/f/moverenq', route => { submitted.push(route.request().postData()); return route.fulfill({ json: { ok: true } }); });
  await page.goto('/');
  if (await page.locator('#contact .mobile-more > summary').isVisible()) await page.locator('#contact .mobile-more > summary').click();
  await expect(page.locator('#contact-modal-form')).toBeVisible();
  expect(await page.locator('#contact-modal-form').evaluate(form => {
    const field = form.querySelector('input').getBoundingClientRect();
    return Math.abs(field.width - form.getBoundingClientRect().width) < 2;
  })).toBe(true);
  await page.locator('#contact-modal-name').focus();
  await page.keyboard.press('Escape');
  await expect(page.locator('#contact-modal-form')).toBeVisible();
  await page.locator('#contact-modal-name').fill('Test Customer');
  await page.locator('#contact-modal-email').fill('customer@example.test');
  await page.locator('#contact-modal-message').fill('Synthetic review message');
  await page.locator('.contact-modal-submit').click();
  await expect(page.locator('#contact-modal-status')).toContainText(/thank|sent/i);
  expect(submitted).toHaveLength(1);
  await expect(page.locator('#contact-modal-status')).toHaveAttribute('data-clarity-mask', 'true');
});

test('compact pricing keeps full payment details accessible and estimator text readable', async ({ page }) => {
  await page.goto('/');
  const pricing = page.locator('.cro-pricing-details');
  await pricing.locator('summary').click();
  await expect(pricing).toHaveAttribute('open', '');
  await expect(pricing).toContainText('First 44 candles: $10 each');
  await expect(pricing).toContainText('50% booking deposit');
  await expect(pricing).toContainText('refundable bond equal to your hire fee');
  expect(await page.locator('#calculator-start').evaluate(button => {
    const channels = value => value.match(/[\d.]+/g).slice(0, 3).map(Number).map(v => {
      v /= 255;
      return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4;
    });
    const luminance = value => { const [r, g, b] = channels(value); return .2126 * r + .7152 * g + .0722 * b; };
    const ink = luminance(getComputedStyle(button).color);
    let surface = button;
    while (surface.parentElement && getComputedStyle(surface).backgroundColor === 'rgba(0, 0, 0, 0)') surface = surface.parentElement;
    const paper = luminance(getComputedStyle(surface).backgroundColor);
    return (Math.max(ink, paper) + .05) / (Math.min(ink, paper) + .05);
  })).toBeGreaterThanOrEqual(4.5);
});

test('mobile review controls retain all four reviews and support keyboard browsing', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto('/');
  await expect(page.locator('#customer-reviews .testimonial-card')).toHaveCount(4);
  const last = page.getByRole('button', { name: 'Show review 4', exact: true });
  await last.click();
  await expect.poll(() => page.locator('#customer-reviews').evaluate(track => {
    const last = track.querySelector('.testimonial-card:last-child').getBoundingClientRect();
    return Math.abs(last.left - track.getBoundingClientRect().left);
  })).toBeLessThan(3);
  await expect(last).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#customer-reviews').focus();
  await page.keyboard.press('ArrowLeft');
  await expect(page.getByRole('button', { name: 'Show review 3', exact: true })).toHaveAttribute('aria-pressed', 'true');
});

test('hero fills its desktop container with equal gutters and a landscape image', async ({ page }) => {
  for (const width of [390, 769, 1024, 1440, 2048, 2560]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/');
    await expect(page.locator('.hero-image img')).toBeVisible();
    const layout = await page.evaluate(() => {
      const hero = document.querySelector('.hero').getBoundingClientRect();
      const image = document.querySelector('.hero-image img');
      const photo = image.getBoundingClientRect();
      const content = document.querySelector('.hero-content').getBoundingClientRect();
      return { left: hero.left, right: innerWidth - hero.right, width: hero.width,
        gutter: parseFloat(getComputedStyle(document.body).paddingLeft),
        contentWidth: content.width, photoWidth: photo.width, photoHeight: photo.height,
        contentHeight: content.height, src: image.currentSrc };
    });
    expect(Math.abs(layout.left - layout.right)).toBeLessThan(2);
    expect(Math.abs(layout.photoWidth - layout.contentWidth)).toBeLessThan(2);
    expect(Math.abs(layout.photoHeight - layout.contentHeight)).toBeLessThan(2);
    if (width > 768) {
      expect(Math.abs(layout.left - layout.gutter)).toBeLessThan(2);
      expect(layout.src).toContain('/img/spring-hero.jpg');
    } else {
      expect(layout.width).toBe(width);
      expect(layout.src).toContain('/img/spring-hero.jpg');
    }
  }
});
