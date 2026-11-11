const {test,expect,booking}=require('./fixtures');
test('mobile hero CTA opens the shared date workflow and returns focus on close without losing fields',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/');const cta=page.locator('.hero-buttons a');
 await expect(page.locator('#availability-form')).toBeHidden();await expect(cta).toBeVisible();await cta.click();
 await expect(page.locator('#availability-dialog')).toBeVisible();await expect(page.locator('#availability-date')).toBeFocused();await page.locator('#availability-date').fill(booking.eventDate);await page.locator('#availability-quantity').fill('45');
 await page.keyboard.press('Escape');await expect(page.locator('#availability-dialog')).toBeHidden();await expect(cta).toBeFocused();await cta.click();await expect(page.locator('#availability-quantity')).toHaveValue('45');
 await page.locator('#availability-form button[type="submit"]').click();await expect(page.locator('#availability-full-name')).toBeVisible();
 await page.locator('#availability-back-to-step-1').click();await expect(page.locator('#availability-dialog')).toBeVisible();await expect(page.locator('#availability-form')).toBeVisible();await expect(page.locator('#availability-date')).toHaveValue(booking.eventDate);
});
test('mobile pricing CTA and estimator handoff open the entry modal; laptop keeps the inline form',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/');await page.locator('.pricing-quote-button').click();await expect(page.locator('#availability-dialog')).toBeVisible();await page.keyboard.press('Escape');
 await page.locator('#estimator-cta button').click();await page.locator('input[name="calculator_knowledge"][value="tables"]').check();await page.locator('#calculator-next').click();await page.locator('#calculator-table-count').fill('10');await page.getByRole('radio',{name:'Round',exact:true}).check();await page.locator('#calculator-next').click();await page.locator('.calculator-visual-choice').nth(1).click();await page.locator('#calculator-next').click();await page.locator('#calculator-next').click();await page.locator('#calculator-check-date').click();
 await expect(page.locator('#availability-dialog')).toBeVisible();await expect(page.locator('#estimator-dialog')).toBeHidden();await expect(page.locator('#availability-quantity')).not.toHaveValue('');
 await page.setViewportSize({width:1280,height:900});await expect(page.locator('#availability-dialog')).toBeHidden();await expect(page.locator('.hero #availability-form')).toBeVisible();await expect(page.locator('#availability-form')).toHaveCount(1);
});
test('responsive hero retains its image and aligned offer action across phones, tablets and laptops',async({page,backend})=>{
 backend.replies.getPublicPricing=()=>({success:true,serverTime:new Date().toISOString(),minimumQuantity:15,saleActive:true,pricing:{kind:'flat',version:1,unitCents:700,minimum:15,name:'Sale',endsAt:new Date(Date.now()+3600000).toISOString()}});
 for(const width of [320,390,767,768,820,1024,1280,1440]){
 await page.setViewportSize({width,height:1000});await page.goto('/');await expect(page.locator('.hero')).toHaveAttribute('data-hero-slide','sale');
 await expect.poll(()=>page.locator('.hero-image img').evaluateAll(nodes=>nodes.filter(n=>getComputedStyle(n).opacity==='1'&&n.complete&&n.naturalWidth>0).length)).toBe(1);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 const placement=await page.locator('#sale-banner').evaluate(el=>({clock:el.querySelector('.sale-banner-clock').getBoundingClientRect().left,button:document.querySelector('.hero h1').getBoundingClientRect().left}));expect(Math.abs(placement.clock-placement.button)).toBeLessThan(2);
 }
});

test('mobile hero reuses the existing booking button palette and aligns its copy and offer details',async({page,backend})=>{
 backend.replies.getPublicPricing=()=>({success:true,serverTime:new Date().toISOString(),minimumQuantity:15,saleActive:true,pricing:{kind:'flat',version:1,unitCents:700,minimum:15,name:'Sale',endsAt:new Date(Date.now()+3600000).toISOString()}});
 await page.setViewportSize({width:390,height:844});await page.goto('/');await expect(page.locator('.hero')).toHaveAttribute('data-hero-slide','sale');
 const styles=await page.evaluate(()=>{const cta=document.querySelector('.hero-quote-button'),existing=document.querySelector('.contact-open-button'),heading=document.querySelector('.hero h1'),details=document.querySelector('.hero #sale-banner .sale-banner-clock');return {cta:getComputedStyle(cta).backgroundColor,existing:getComputedStyle(existing).backgroundColor,color:getComputedStyle(cta).color,family:getComputedStyle(cta).fontFamily,existingFamily:getComputedStyle(existing).fontFamily,offset:Math.abs(heading.getBoundingClientRect().left-details.getBoundingClientRect().left)};});
 expect(styles.cta).toBe(styles.existing);expect(styles.family).toBe(styles.existingFamily);expect(styles.offset).toBeLessThan(1);expect(styles.color).toBe('rgb(255, 253, 245)');
});
test('mobile keeps review trust inside the hero and hides the starting price; desktop retains pricing',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/');
 await expect(page.locator('.hero .cro-trust-link')).toBeVisible();await expect(page.locator('.hero .cro-trust-link')).toContainText('5-star Google reviews');await expect(page.locator('.hero .hero-price')).toBeHidden();await expect(page.locator('.mobile-hero-trust')).toHaveCount(0);
 const type=await page.locator('.hero-intro').evaluate(el=>({body:parseFloat(getComputedStyle(el).fontSize),heading:parseFloat(getComputedStyle(document.querySelector('.hero h1')).fontSize)}));expect(type.body).toBe(17);expect(type.heading).toBeGreaterThan(34);
 await page.setViewportSize({width:1280,height:900});await expect(page.locator('.hero .hero-price')).toBeVisible();await expect(page.locator('.hero .cro-trust-link')).toBeVisible();
});

test('mobile reviews precede the quote button and eyebrow labels are readable',async({page,backend})=>{
 backend.replies.getPublicPricing=()=>({success:true,serverTime:new Date().toISOString(),minimumQuantity:15,saleActive:true,pricing:{kind:'flat',version:1,unitCents:700,minimum:15,name:'Sale',endsAt:new Date(Date.now()+3600000).toISOString()}});
 await page.setViewportSize({width:390,height:844});await page.goto('/');await expect(page.locator('.hero')).toHaveAttribute('data-hero-slide','sale');
 const positions=await page.evaluate(()=>{const hero=document.querySelector('.hero');return {countdown:hero.querySelector('#sale-banner').getBoundingClientRect().bottom,reviewTop:hero.querySelector('.cro-trust-link').getBoundingClientRect().top,reviewBottom:hero.querySelector('.cro-trust-link').getBoundingClientRect().bottom,button:hero.querySelector('.hero-buttons').getBoundingClientRect().top,label:parseFloat(getComputedStyle(hero.querySelector('.hero-eyebrow')).fontSize)};});
 expect(positions.reviewTop).toBeGreaterThanOrEqual(positions.countdown);expect(positions.reviewBottom).toBeLessThanOrEqual(positions.button);expect(positions.label).toBeGreaterThanOrEqual(12);
});
test('hero review stars share the heading left edge on phones, tablets and laptops',async({page})=>{
 for(const width of [320,390,767,768,820,1024,1280,1440]){
  await page.setViewportSize({width,height:1000});await page.goto('/');await expect(page.locator('.hero .cro-trust-link')).toBeVisible();
  const offset=await page.evaluate(()=>Math.abs(document.querySelector('.hero h1').getBoundingClientRect().left-document.querySelector('.hero .cro-trust-link .cro-stars').getBoundingClientRect().left));
  expect(offset,`Review alignment at ${width}px`).toBeLessThanOrEqual(1);
 }
});
test('product and hire labels are larger while the sale label retains its size',async({page,backend})=>{
 backend.replies.getPublicPricing=()=>({success:true,serverTime:new Date().toISOString(),minimumQuantity:15,saleActive:true,pricing:{kind:'flat',version:1,unitCents:700,minimum:15,name:'Sale',endsAt:new Date(Date.now()+3600000).toISOString()}});
 await page.setViewportSize({width:390,height:844});await page.goto('/');await expect(page.locator('.hero')).toHaveAttribute('data-hero-slide','sale');
 expect(await page.locator('.hero-eyebrow').evaluate(el=>parseFloat(getComputedStyle(el).fontSize))).toBe(12);
 for(const name of ['Show main introduction','Show candle benefits']){await page.getByRole('button',{name,exact:true}).click();expect(await page.locator('.hero-eyebrow').evaluate(el=>parseFloat(getComputedStyle(el).fontSize))).toBe(15);expect(await page.locator('.hero-intro').evaluate(el=>parseFloat(getComputedStyle(el).fontSize))).toBe(17);}
});
