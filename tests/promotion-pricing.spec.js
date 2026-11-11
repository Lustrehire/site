const {test,expect,booking,checkDate}=require('./fixtures');
const sale=(ends=Date.now()+3600000)=>({success:true,serverTime:new Date().toISOString(),minimumQuantity:15,saleActive:true,pricing:{kind:'flat',version:1,unitCents:700,minimum:15,name:'End-of-year sale',banner:'End-of-year sale: $7 per candle · 15 candle minimum',endsAt:new Date(ends).toISOString()}});
test('active sale banner, public examples and new quote use one $7 rate without leaking price before contact',async({page,backend})=>{
 backend.replies.getPublicPricing=()=>sale();await checkDate(page,45);
 await expect(page.locator('#sale-banner')).toBeVisible();
 await expect(page.locator('.pricing-example-cards article')).toHaveText(['30 candles$300$210 hire','45 candles$449$315 hire','90 candles$853$630 hire']);
 await expect(page.locator('#availability-step-4-panel')).toBeHidden();
 await page.locator('#availability-full-name').fill(booking.fullName);await page.locator('#availability-email').fill(booking.email);await page.locator('#availability-step-2-submit').click();
 await expect(page.locator('#availability-created-quote')).toContainText('$315');
 expect(backend.calls.find(c=>c.action==='saveQuoteBooking').bookingData.hireFee).toBe(315);
 await page.locator('#availability-complete-button').click();await page.getByRole('button',{name:'Show sale offer',exact:true}).click();await page.locator('.pricing-process:not([open]) > summary').click();await page.locator('.sale-pricing-details').click();await page.locator('.sale-offer-cta').click();await expect(page.locator('#availability-date')).toBeFocused();
});
test('a sale ends automatically while the page stays open and normal pricing returns',async({page,backend})=>{
 const end=Date.now()+1800;backend.replies.getPublicPricing=()=>sale(end);await page.goto('/');
 await expect(page.locator('#sale-banner')).toBeVisible();await expect(page.locator('#sale-banner')).toBeHidden({timeout:5000});
 await expect(page.locator('.pricing-rates article')).toHaveCount(3);await expect(page.locator('.pricing-example-cards article').first()).toContainText('$300');
});
test('pricing failure preserves details, blocks quote submission and offers retry',async({page,backend})=>{
 await checkDate(page);backend.replies.getPublicPricing={success:false};
 await page.locator('#availability-full-name').fill(booking.fullName);await page.locator('#availability-email').fill(booking.email);await page.locator('#availability-step-2-submit').click();
 await expect(page.locator('#availability-booking-feedback')).toContainText('Your details are still here');
 expect(backend.calls.some(c=>c.action==='saveQuoteBooking')).toBe(false);await expect(page.locator('#availability-email')).toHaveValue(booking.email);
 backend.replies.getPublicPricing=()=>sale();await page.locator('#availability-step-2-submit').click();await expect(page.locator('#availability-step-4-panel')).toBeVisible();
});
test('valid sale quote retains its saved rate for reduced quantity in the emailed quote route',async({page,backend})=>{
 backend.replies.getQuoteByToken={success:true,status:'valid',booking:{...booking,hireFee:350,bondAmount:350,pricingSnapshot:JSON.stringify(sale().pricing)}};
 backend.replies.checkAvailability={success:true,available:false,partialAvailable:true,status:'partial',maxAvailable:30,remainingStock:30};
 await page.goto('/quote.html?quoteToken=test-token');await page.locator('#quote-update-quantity-button').click();
 await expect(page.locator('body')).toContainText('$210');
});

test('retry recovered across a sale change displays the saved server quote rather than today’s rate',async({page,backend})=>{
 backend.replies.getPublicPricing=()=>sale();backend.replies.saveQuoteBooking={success:true,reused:true,bookingId:booking.bookingId,quoteToken:'test-token'};
 backend.replies.getQuoteByToken={success:true,status:'valid',booking:{...booking,quantity:45,hireFee:449,bondAmount:449}};
 await checkDate(page,45);await page.locator('#availability-full-name').fill(booking.fullName);await page.locator('#availability-email').fill(booking.email);await page.locator('#availability-step-2-submit').click();
 await expect(page.locator('#availability-created-quote')).toContainText('$449');
});
test('an uncertain quote retry keeps its original pricing intent when a sale starts between attempts',async({page,backend})=>{
 await checkDate(page,45);backend.replies.saveQuoteBooking={success:false};
 await page.locator('#availability-full-name').fill(booking.fullName);await page.locator('#availability-email').fill(booking.email);await page.locator('#availability-step-2-submit').click();
 await expect(page.locator('#availability-booking-feedback')).toContainText('Please try again');
 backend.replies.getPublicPricing=()=>sale();backend.replies.saveQuoteBooking={success:true,reused:true,bookingId:booking.bookingId,quoteToken:'test-token'};
 backend.replies.getQuoteByToken={success:true,status:'valid',booking:{...booking,quantity:45,hireFee:449,bondAmount:449}};
 await page.locator('#availability-step-2-submit').click();await expect(page.locator('#availability-created-quote')).toContainText('$449');
 const saves=backend.calls.filter(c=>c.action==='saveQuoteBooking');expect(saves[0].bookingData.hireFee).toBe(449);expect(saves[1].bookingData.hireFee).toBe(449);expect(saves[0].requestId).toBe(saves[1].requestId);
});

test('sale compares real tier rates and displays a live countdown with offer details',async({page,backend})=>{
 backend.replies.getPublicPricing=()=>sale();await page.goto('/');
 await expect(page.locator('.pricing-rates del')).toHaveText(['$10','$9','$8']);
 await expect(page.locator('.pricing-rates strong')).toHaveText(['$7','$7','$7']);
 await expect(page.locator('.sale-example-was')).toHaveText(['$300','$449','$853']);
 await expect(page.locator('.sale-pricing-timing')).toBeVisible();
 await expect(page.locator('.sale-pricing-details')).toBeHidden();
 await page.locator('.pricing-process > summary').click();
 await page.locator('.sale-pricing-details').click();await expect(page.locator('#sale-offer-dialog')).toBeVisible();
 await expect(page.locator('#sale-offer-dialog')).toContainText('A quote does not reserve stock');
 await page.keyboard.press('Escape');await expect(page.locator('.sale-pricing-details')).toBeFocused();
 await page.locator('.sale-pricing-details').click();await page.locator('.sale-offer-cta').click();await expect(page.locator('#availability-date')).toBeFocused();
 if(page.viewportSize().width<768){await page.keyboard.press('Escape');await expect(page.locator('.hero-quote-button')).toBeFocused();}
});
test('delayed offer is dismissible, once per session, and returns without popping up on reload',async({page,backend})=>{
 backend.replies.getPublicPricing=()=>sale();await page.goto('/');
 await expect(page.locator('#sale-offer-dialog')).toBeHidden();await expect(page.locator('#sale-offer-dialog')).toBeVisible({timeout:6500});
 await page.getByRole('button',{name:'Keep exploring',exact:true}).click();await page.reload();
 await expect(page.locator('#sale-banner')).toBeVisible();await page.waitForTimeout(4700);await expect(page.locator('#sale-offer-dialog')).toBeHidden();
});
test('sale popup never interrupts an active form',async({page,backend})=>{
 backend.replies.getPublicPricing=()=>sale();await page.goto('/');if(page.viewportSize().width<768)await page.locator('.hero-buttons a').click();await page.locator('#availability-quantity').fill('30');
 await page.waitForTimeout(4700);await expect(page.locator('#sale-offer-dialog')).toBeHidden();await expect(page.locator('#availability-quantity')).toBeFocused();
});
