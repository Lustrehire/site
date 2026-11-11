const {test,expect}=require('./fixtures');
const sale=()=>({success:true,serverTime:new Date().toISOString(),minimumQuantity:15,saleActive:true,pricing:{kind:'flat',version:1,unitCents:700,minimum:15,name:'End-of-year sale',endsAt:new Date(Date.now()+3600000).toISOString()}});
test('active sale leads within the hero, with no separate top banner and one unchanged form',async({page,backend})=>{
 backend.replies.getPublicPricing=sale;await page.goto('/');
 await expect(page.locator('.hero')).toHaveAttribute('data-hero-slide','sale');
 await expect(page.locator('.hero h1')).toContainText('$7 per candle');await expect(page.locator('body > #sale-banner')).toHaveCount(0);await expect(page.locator('.hero #sale-banner')).toBeVisible();
 await expect(page.locator('.hero-slide-choice')).toHaveCount(3);await expect(page.locator('#availability-form')).toHaveCount(1);
 await page.locator('.pricing-process > summary').click();await page.locator('.sale-pricing-details').click();await expect(page.locator('#sale-offer-dialog')).toBeVisible();await page.locator('.sale-offer-cta').click();await expect(page.locator('#availability-date')).toBeFocused();
});
test('manual and keyboard slide choices preserve autoplay and entered availability',async({page,backend})=>{
 backend.replies.getPublicPricing=sale;await page.setViewportSize({width:390,height:844});await page.goto('/');await expect(page.locator('.hero')).toHaveAttribute('data-hero-slide','sale');
 await page.locator('.hero-buttons a').click();await page.locator('#availability-quantity').fill('45');await page.keyboard.press('Escape');
 const before=await page.locator('.hero').boundingBox();
 await page.getByRole('button',{name:'Show candle benefits',exact:true}).click();await expect(page.locator('.hero h1')).toContainText('Less to organise');await expect(page.getByRole('button',{name:'Pause hero slideshow',exact:true})).toBeVisible();
 const after=await page.locator('.hero').boundingBox();expect(Math.abs(after.height-before.height)).toBeLessThan(2);
 await page.getByRole('button',{name:'Show candle benefits',exact:true}).focus();await page.keyboard.press('ArrowLeft');await expect(page.locator('.hero')).toHaveAttribute('data-hero-slide','main');await expect(page.locator('#availability-quantity')).toHaveValue('45');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('normal hero rotates automatically; reduced motion starts paused',async({page})=>{
 await page.goto('/');await expect(page.locator('.hero')).toHaveAttribute('data-hero-slide','main');await expect(page.locator('.hero')).toHaveAttribute('data-hero-slide','benefits',{timeout:5500});
 await page.emulateMedia({reducedMotion:'reduce'});await page.reload();await expect(page.getByRole('button',{name:'Play hero slideshow',exact:true})).toBeVisible();await expect(page.locator('.hero')).toHaveAttribute('data-hero-slide','main');
});
test('sale-off removes the sale slide and restores introduction without losing the form',async({page,backend})=>{
 backend.replies.getPublicPricing=sale;await page.goto('/');await expect(page.locator('.hero')).toHaveAttribute('data-hero-slide','sale');
 backend.replies.getPublicPricing={success:true,serverTime:new Date().toISOString(),minimumQuantity:15,pricing:{kind:'standard',version:1},saleActive:false};
 await page.evaluate(()=>window.LustrePricing.refresh());await expect(page.locator('.hero')).toHaveAttribute('data-hero-slide','main');await expect(page.locator('.hero-slide-choice')).toHaveCount(2);await expect(page.locator('.hero #sale-banner')).toBeHidden();await expect(page.locator('#availability-form')).toHaveCount(1);
});
test('Play explicitly resumes after choosing a slide even while the play button keeps focus',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Show candle benefits',exact:true}).click();await expect(page.locator('.hero')).toHaveAttribute('data-hero-slide','benefits');
 await page.getByRole('button',{name:'Pause hero slideshow',exact:true}).click();await page.getByRole('button',{name:'Play hero slideshow',exact:true}).click();await expect(page.locator('.hero')).toHaveAttribute('data-hero-slide','main',{timeout:5500});
});
