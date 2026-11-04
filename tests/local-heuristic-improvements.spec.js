const {test,expect}=require('./fixtures');

test('mobile menu opens the estimator, announces its first question and returns focus',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/');
  await page.locator('.menu-toggle').click();
  await page.getByRole('button',{name:'Estimate candle quantity',exact:true}).click();
  await expect(page.locator('#estimator-dialog')).toBeVisible();
  await expect(page.locator('.menu-toggle')).toHaveAttribute('aria-expanded','false');
  await expect(page.locator('.calculator-step[data-step="1"] legend')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('.menu-toggle')).toBeFocused();
});

test('estimator edit preserves answers, focuses questions and carries the displayed exact quantity',async({page,backend})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/');
  await page.locator('#estimator-cta button').click();
  await page.locator('input[name="calculator_knowledge"][value="tables"]').check();
  await page.locator('#calculator-next').click();
  await expect(page.locator('.calculator-step:not(.calculator-hidden) legend')).toBeFocused();
  await page.locator('#calculator-table-count').fill('10');
  await page.getByRole('radio',{name:'Round',exact:true}).check();
  await page.locator('#calculator-next').click();
  await page.locator('.calculator-visual-choice').nth(1).click();
  await page.locator('#calculator-next').click();
  await page.getByRole('checkbox',{name:'Welcome table',exact:true}).check();
  await page.locator('#calculator-next').click();
  await expect(page.locator('#calculator-result-title')).toBeFocused();
  await page.locator('#calculator-edit').click();
  await expect(page.locator('input[name="calculator_knowledge"][value="tables"]')).toBeChecked();
  await page.locator('#calculator-next').click();
  await expect(page.locator('#calculator-table-count')).toHaveValue('10');
  await page.locator('#calculator-table-count').fill('12');
  await page.locator('#calculator-next').click();
  await expect(page.locator('.calculator-visual-choice').nth(1).locator('input')).toBeChecked();
  await page.locator('#calculator-next').click();
  await expect(page.getByRole('checkbox',{name:'Welcome table',exact:true})).toBeChecked();
  await page.locator('#calculator-next').click();
  await expect(page.locator('#calculator-result-panel')).toBeVisible();
  const label=await page.locator('#calculator-check-date').innerText();
  const quantity=label.match(/Use (\d+) candles/)[1];
  await page.locator('#calculator-check-date').click();
  await expect(page.locator('#availability-quantity')).toHaveValue(quantity);
  expect(backend.calls).toHaveLength(0);
});
