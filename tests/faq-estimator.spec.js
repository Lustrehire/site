const { test, expect } = require('./fixtures');
test('homepage FAQ opens the original estimator in a modal and returns focus', async ({ page }) => {
  await page.goto('/');
  await page.locator('#faq-question-0').click();
  const trigger = page.locator('#faq-answer-0 [data-open-estimator]');
  await trigger.click();
  await expect(page.locator('#estimator-dialog')).toBeVisible();
  await expect(page.locator('#estimator-dialog #calculator-flow-panel')).toBeVisible();
  await expect(page.locator('#candle-calculator')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(page.locator('#estimator-dialog')).toBeHidden();
  await expect(trigger).toBeFocused();
});
test('FAQ page links directly to the existing homepage estimator modal', async ({ page }) => {
  await page.goto('/faq.html');
  await page.locator('#faq-question-0').click();
  await page.locator('#faq-answer-0').getByRole('link', { name: /Wedding Candle Estimator/ }).click();
  await expect(page.locator('#estimator-dialog')).toBeVisible();
  await expect(page.locator('#calculator-flow-panel')).toBeVisible();
});
test('modal estimate hands quantity back to availability and survives a breakpoint change', async ({ page }) => {
  await page.goto('/');
  await page.locator('#faq-question-0').click();
  await page.locator('#faq-answer-0 [data-open-estimator]').click();
  await page.locator('input[name="calculator_knowledge"][value="final-guests"]').check();
  await page.locator('#calculator-final-guests').fill('100');
  await page.locator('#calculator-next').click();
  await page.locator('input[name="calculator_table_style_guess"]').first().check();
  await page.locator('#calculator-next').click();
  await page.locator('#estimator-dialog .calculator-visual-choice').first().click();
  await page.locator('#calculator-next').click();
  await page.locator('#calculator-next').click();
  await expect(page.locator('#calculator-result-panel')).toBeVisible();
  await expect(page.locator('#calculator-result-panel')).not.toContainText(/\$[0-9]/);
  await page.setViewportSize({ width: 1200, height: 900 });
  await expect(page.locator('#estimator-dialog #candle-calculator')).toHaveCount(1);
  await page.locator('#calculator-check-date').click();
  await expect(page.locator('#estimator-dialog')).toBeHidden();
  await expect(page.locator('#availability-quantity')).not.toHaveValue('');
});

test('mobile estimator keeps its first screen compact and navigation side by side', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.locator('#faq-question-0').click();
  await page.locator('#faq-answer-0 [data-open-estimator]').click();
  await expect(page.locator('#calculator-flow-panel')).toBeVisible();
  await expect(page.locator('#calculator-cancel')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Close candle estimator' })).toBeVisible();
  expect(await page.locator('#estimator-dialog').evaluate(el => el.scrollHeight <= el.clientHeight + 1)).toBe(true);
  await page.locator('input[name="calculator_knowledge"][value="final-guests"]').check();
  await page.locator('#calculator-final-guests').fill('100');
  await page.locator('#calculator-next').click();
  const back = await page.locator('#calculator-back').boundingBox();
  const next = await page.locator('#calculator-next').boundingBox();
  expect(Math.abs(back.y - next.y)).toBeLessThanOrEqual(1);
  expect(back.x + back.width).toBeLessThanOrEqual(next.x);
  await page.locator('#calculator-back').click();
  await expect(page.locator('#calculator-final-guests')).toHaveValue('100');
});

test('mobile styling cards put larger photos beside text and remain keyboard-selectable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.locator('#faq-question-0').click();
  await page.locator('#faq-answer-0 [data-open-estimator]').click();
  await page.locator('input[name="calculator_knowledge"][value="final-guests"]').check();
  await page.locator('#calculator-final-guests').fill('100');
  await page.locator('#calculator-next').click();
  await page.locator('input[name="calculator_table_style_guess"]').first().check();
  await page.locator('#calculator-next').click();
  const cards = page.locator('#estimator-dialog .calculator-visual-choice');
  for (const card of await cards.all()) {
    const image = await card.locator('img').boundingBox();
    const title = await card.locator('.calculator-visual-title').boundingBox();
    const copy = await card.locator('.calculator-visual-copy').boundingBox();
    expect(image.width).toBeGreaterThanOrEqual(76);
    expect(title.x).toBeGreaterThanOrEqual(image.x + image.width);
    expect(copy.x).toBe(title.x);
    expect(copy.y).toBeGreaterThan(title.y);
  }
  await cards.nth(1).click();
  await expect(cards.nth(1).locator('input')).toBeChecked();
  await cards.nth(1).locator('input').focus();
  await page.keyboard.press('ArrowDown');
  await expect(cards.nth(2).locator('input')).toBeChecked();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('mobile result is compact with recommendation, summary and unchanged availability handoff', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.locator('#faq-question-0').click();
  await page.locator('#faq-answer-0 [data-open-estimator]').click();
  await page.locator('input[name="calculator_knowledge"][value="final-guests"]').check();
  await page.locator('#calculator-final-guests').fill('100');
  await page.locator('#calculator-next').click();
  await page.locator('input[name="calculator_table_style_guess"]').first().check();
  await page.locator('#calculator-next').click();
  await page.locator('#estimator-dialog .calculator-visual-choice').first().click();
  await page.locator('#calculator-next').click();
  await page.locator('#calculator-next').click();
  await expect(page.locator('#calculator-result-panel')).toBeVisible();
  expect(await page.locator('#calculator-result-range').evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeLessThanOrEqual(34);
  await expect(page.locator('#estimator-dialog .estimator-result-short-note')).toBeVisible();
  await expect(page.locator('#estimator-dialog .estimator-result-full-note')).toBeHidden();
  expect(await page.locator('#estimator-dialog').evaluate(el => el.scrollHeight <= el.clientHeight + 1)).toBe(true);
  await page.locator('#calculator-check-date').click();
  await expect(page.locator('#availability-quantity')).not.toHaveValue('');
});

test('dedicated estimator CTA follows benefits and replaces the link under the date form', async ({ page }) => {
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await expect(page.locator('#availability-checker #calculator-start')).toBeHidden();
    expect(await page.locator('#benefits').evaluate(el => el.nextElementSibling.id)).toBe('estimator-cta');
    await page.locator('#estimator-cta').getByRole('button', { name: /Estimate my candle quantity/ }).click();
    await expect(page.locator('#estimator-dialog')).toBeVisible();
    await expect(page.locator('#calculator-flow-panel')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#estimator-cta button')).toBeFocused();
    await expect(page.locator('#availability-checker #candle-calculator')).toBeHidden();
  }
});

test('desktop estimator CTA matches occasion CTA alignment and content width', async ({ page }) => {
  for (const width of [1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/');
    const values = await page.evaluate(() => {
      const estimator = document.querySelector('#estimator-cta');
      const reference = document.querySelector('.cro-ready:not(#estimator-cta)');
      const measure = section => {
        const box = section.getBoundingClientRect();
        const content = section.firstElementChild.getBoundingClientRect();
        const button = section.querySelector('.booking-button').getBoundingClientRect();
        return { contentWidth: content.width, gutter: content.left - box.left,
          buttonOffset: Math.abs(button.left + button.width / 2 - box.left - box.width / 2),
          padding: getComputedStyle(section).padding,
          headingAlign: getComputedStyle(section.querySelector('h2')).textAlign };
      };
      return { estimator: measure(estimator), reference: measure(reference) };
    });
    expect(values.estimator.contentWidth).toBe(values.reference.contentWidth);
    expect(values.estimator.gutter).toBeCloseTo(values.reference.gutter, 0);
    expect(values.estimator.padding).toBe(values.reference.padding);
    expect(values.estimator.headingAlign).toBe(values.reference.headingAlign);
    expect(values.estimator.buttonOffset).toBeLessThanOrEqual(1);
  }
});
