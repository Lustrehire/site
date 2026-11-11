/* Public pricing only. No customer details, cookies, analytics or persistent cache. */
(() => {
  const endpoint = 'https://script.google.com/macros/s/AKfycbxajjPE4vCpTJZSIHRXWy_IZk5Sw3Rkpe4eKthR_0dw6eSoCKjMNqZjKiLZcjTwDy5ZgA/exec';
  let config, inFlight, boundaryTimer, serverNow = 0, syncedAt = 0;
  const standard = q => q <= 44 ? q * 10 : q <= 89 ? 440 + (q - 44) * 9 : 845 + (q - 89) * 8;
  const now = () => serverNow + performance.now() - syncedAt;
  const rule = () => {
    if (!config) throw Error('Pricing is unavailable. Please try again.');
    return config.pricing.kind === 'flat' && now() >= Date.parse(config.pricing.endsAt) ? {kind:'standard',version:1} : config.pricing;
  };
  const priceForRule = (quantity, saved) => {
    const q = Number(quantity), r = typeof saved === 'string' ? JSON.parse(saved) : saved;
    if (!Number.isInteger(q) || q < 15) throw Error('Choose at least 15 candles.');
    if (r?.kind === 'flat' && r.version === 1 && Number.isSafeInteger(r.unitCents) && r.unitCents > 0) {
      if (q < r.minimum) throw Error(`Choose at least ${r.minimum} candles for this sale.`);
      return q * r.unitCents / 100;
    }
    if (r && (r.kind !== 'standard' || r.version !== 1)) throw Error('Please refresh this quote.');
    return standard(q);
  };
  const money = n => new Intl.NumberFormat('en-AU',{style:'currency',currency:'AUD',maximumFractionDigits:2}).format(n).replace(/\.00$/,'');
  const panel = document.getElementById('candle-packages');
  const heroPrice=document.querySelector('.hero-price');
  const heroOriginal=heroPrice?.innerHTML;
  const targets = panel ? [...panel.querySelectorAll('.pricing-rates,.pricing-example-cards,.pricing-tier-note')] : [];
  const original = new Map(targets.map(el=>[el,el.innerHTML]));
  const heading = panel?.querySelector('.cro-section-heading h2'), intro = panel?.querySelector('.cro-section-heading p');
  const originalHeading = heading?.textContent, originalIntro = intro?.textContent;
  let offerDialog, popupTimer, countdownTimer, autoAttempted=false, returnFocus;
  const element = (tag, className, text) => {const el=document.createElement(tag);if(className)el.className=className;if(text!==undefined)el.textContent=text;return el;};
  const formatEnd = r => new Intl.DateTimeFormat('en-AU',{timeZone:'Australia/Perth',dateStyle:'medium',timeStyle:'short'}).format(new Date(r.endsAt))+' Perth time';
  const toAvailability = event => {
    event?.preventDefault();
    const trigger = event?.currentTarget;
    // The offer closes before the date form opens. Return focus to a visible
    // action when the date dialog closes, rather than a link in a closed dialog.
    const returnTo = trigger?.closest('dialog') ? document.querySelector('.hero-quote-button') : trigger;
    closeOffer();
    if(window.LustreOpenAvailability?.(returnTo))return;
    const input=document.getElementById('availability-date');input?.scrollIntoView({block:'center',behavior:'instant'});input?.focus({preventScroll:true});
  };
  const closeOffer = () => {if(offerDialog?.open){offerDialog.close();if(returnFocus?.isConnected)returnFocus.focus({preventScroll:true});}};
  const countdown = () => {
    const wrap=element('div','sale-countdown');wrap.setAttribute('role','timer');
    ['days','hours','minutes','seconds'].forEach(unit=>{const cell=element('span','sale-countdown-cell');const value=element('b','', '00');value.dataset.saleUnit=unit;cell.append(value,element('small','',unit));wrap.append(cell);});return wrap;
  };
  const seenKey = r => 'lustre-sale-seen:'+r.name+':'+r.unitCents+':'+(r.startsAt||'current');
  const openOffer = automatic => {
    if(!config||rule().kind!=='flat'||document.querySelector('dialog[open]'))return;
    if(automatic && (document.activeElement?.closest('form') || document.visibilityState!=='visible'))return;
    clearTimeout(popupTimer);popupTimer=undefined;autoAttempted=true;
    returnFocus=document.activeElement;
    try{sessionStorage.setItem(seenKey(rule()),'true');}catch{}
    offerDialog.showModal();offerDialog.querySelector('.sale-offer-close').focus({preventScroll:true});
  };
  const updateCountdown = () => {
    if(!config||rule().kind!=='flat'){clearInterval(countdownTimer);closeOffer();return;}
    const r=rule(),seconds=Math.max(0,Math.ceil((Date.parse(r.endsAt)-now())/1000));
    const values={days:Math.floor(seconds/86400),hours:Math.floor(seconds/3600)%24,minutes:Math.floor(seconds/60)%60,seconds:seconds%60};
    document.querySelectorAll('[data-sale-unit]').forEach(el=>el.textContent=String(values[el.dataset.saleUnit]).padStart(2,'0'));
    document.querySelectorAll('.sale-countdown').forEach(el=>el.setAttribute('aria-label',`${values.days} days, ${values.hours} hours, ${values.minutes} minutes and ${values.seconds} seconds remaining`));
  };

  let banner, status;
  if (panel) {
    banner = document.createElement('aside'); banner.id = 'sale-banner'; banner.hidden = true; banner.setAttribute('aria-label','Current candle hire offer');
    const bannerCopy=element('div','sale-banner-copy');bannerCopy.append(element('span','sale-eyebrow'),element('a','sale-banner-price'),element('span','sale-banner-minimum'));
    bannerCopy.querySelector('a').href='#availability';bannerCopy.querySelector('a').addEventListener('click',toAvailability);
    const bannerClock=element('div','sale-banner-clock');bannerClock.append(element('span','sale-countdown-label','Offer ends in'),countdown());
    banner.append(bannerCopy,bannerClock);
    offerDialog=element('dialog','sale-offer-dialog');offerDialog.id='sale-offer-dialog';offerDialog.setAttribute('aria-labelledby','sale-offer-title');
    offerDialog.innerHTML='<button type="button" class="sale-offer-close" aria-label="Close sale offer">×</button><div class="sale-offer-ornament" aria-hidden="true">✧</div><p class="sale-eyebrow"></p><h2 id="sale-offer-title">A little more glow.<br>A little less spend.</h2><div class="sale-offer-price"></div><p class="sale-offer-description"></p><div class="sale-offer-clock"><span class="sale-countdown-label">Offer ends in</span></div><a class="sale-offer-cta" href="#availability">Check my date <span aria-hidden="true">→</span></a><p class="sale-offer-terms"></p><button type="button" class="sale-offer-dismiss">Keep exploring</button>';
    offerDialog.querySelector('.sale-offer-clock').append(countdown());
    offerDialog.querySelector('.sale-offer-close').addEventListener('click',closeOffer);offerDialog.querySelector('.sale-offer-dismiss').addEventListener('click',closeOffer);
    offerDialog.querySelector('a').addEventListener('click',toAvailability);
    offerDialog.addEventListener('cancel',event=>{event.preventDefault();closeOffer();});
    offerDialog.addEventListener('click',event=>{const r=offerDialog.getBoundingClientRect();if(event.target===offerDialog&&(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom))closeOffer();});
    document.body.append(offerDialog);
    document.querySelector('.hero-intro')?.after(banner);
    status=document.createElement('p');status.className='pricing-load-status';status.setAttribute('role','status');status.textContent='Loading current pricing…';
    const retry=document.createElement('button');retry.type='button';retry.textContent='Retry pricing';retry.hidden=true;retry.addEventListener('click',()=>refresh().catch(()=>{}));status.append(retry);panel.querySelector('.cro-section-heading').after(status);
    targets.forEach(el=>el.hidden=true);if(heroPrice)heroPrice.hidden=true;
  }
  const render = () => {
    if (!panel || !config) return;
    const r=rule(),sale=r.kind==='flat';
    targets.forEach(el=>{el.innerHTML=original.get(el);el.hidden=false;});
    if(heroPrice){heroPrice.innerHTML=heroOriginal;heroPrice.hidden=false;if(sale){heroPrice.querySelectorAll('span').forEach((el,i)=>el.textContent=i===0?`From ${money(priceForRule(r.minimum,r))} hire · ${r.minimum} candle minimum`:`Hire from ${money(priceForRule(r.minimum,r))}`);}}
    heading.textContent=sale ? 'More candlelight. Less to spend.' : originalHeading;
    intro.textContent=sale ? `${money(r.unitCents/100)} per candle · ${r.minimum} candle minimum` : originalIntro;
    const rates=panel.querySelector('.pricing-rates');rates.classList.toggle('sale-rate',sale);
    if(sale){
      rates.querySelectorAll('article').forEach((card,i)=>{const old=[10,9,8][i],p=card.querySelector('p'),value=p.querySelector('strong');value.textContent=money(r.unitCents/100);if(r.unitCents/100<old){const before=element('del','sale-was',money(old));before.setAttribute('aria-label',`Regular rate ${money(old)}`);p.prepend(before);}card.classList.add('sale-price-card');});
    }
    panel.querySelectorAll('.pricing-example-cards article').forEach(el=>{const q=Number(el.querySelector('h4').textContent.match(/\d+/)?.[0]);el.querySelector('strong').textContent=money(priceForRule(q,r));if(sale&&priceForRule(q,r)<standard(q)){const old=element('del','sale-example-was',money(standard(q)));old.setAttribute('aria-label',`Regular hire ${money(standard(q))}`);el.querySelector('p').prepend(old);}});
    const note=panel.querySelector('.pricing-tier-note');if(sale)note.textContent=`Sale applies to new quotes created during the offer. Your event can take place later. Ends ${new Intl.DateTimeFormat('en-AU',{timeZone:'Australia/Perth',dateStyle:'medium',timeStyle:'short'}).format(new Date(r.endsAt))} Perth time.`;
    banner.hidden=!sale;
    let offerTiming=panel.querySelector('.sale-pricing-timing');
    if(sale){
      banner.querySelector('.sale-eyebrow').textContent=r.name||'Limited-time offer';banner.querySelector('.sale-banner-price').textContent=`${money(r.unitCents/100)} per candle`;banner.querySelector('.sale-banner-minimum').textContent=`${r.minimum} candle minimum · Any quantity`;
      offerDialog.querySelector('.sale-eyebrow').textContent=r.name||'Limited-time offer';offerDialog.querySelector('.sale-offer-price').textContent=money(r.unitCents/100)+' each';
      offerDialog.querySelector('.sale-offer-description').textContent=`Ready-to-light sand wax candles, matching glass included. ${r.minimum} candle minimum.`;
      offerDialog.querySelector('.sale-offer-terms').textContent=`Request your quote by ${formatEnd(r)}. Your event can take place later. A quote does not reserve stock; a paid deposit secures your date.`;
      if(!offerTiming){offerTiming=element('div','sale-pricing-timing');offerTiming.append(element('span','sale-countdown-label','Offer ends in'),countdown());rates.after(offerTiming);}
      let pricingDetails=panel.querySelector('.sale-pricing-details');
      if(!pricingDetails){pricingDetails=element('button','sale-pricing-details','Sale information');pricingDetails.type='button';pricingDetails.setAttribute('aria-haspopup','dialog');pricingDetails.addEventListener('click',()=>openOffer(false));panel.querySelector('.pricing-process').append(pricingDetails);}
      let seen=false;try{seen=sessionStorage.getItem(seenKey(r))==='true';}catch{}
      if(!seen&&!autoAttempted&&!popupTimer)popupTimer=setTimeout(()=>{popupTimer=undefined;autoAttempted=true;openOffer(true);},4500);
      updateCountdown();clearInterval(countdownTimer);countdownTimer=setInterval(updateCountdown,1000);
    }else{offerTiming?.remove();panel.querySelector('.sale-pricing-details')?.remove();clearTimeout(popupTimer);popupTimer=undefined;clearInterval(countdownTimer);closeOffer();}
    window.dispatchEvent(new CustomEvent('lustre:public-pricing', {detail:{pricing:r,saleActive:sale}}));
    status.hidden=true;
    const quantity=document.getElementById('availability-quantity');if(quantity)quantity.min=String(sale?r.minimum:config.minimumQuantity);
    clearTimeout(boundaryTimer);
    if(sale)boundaryTimer=setTimeout(()=>{render();refresh().catch(()=>{});},Math.min(2147483647,Math.max(1,Date.parse(r.endsAt)-now())));
  };
  const refresh = () => {
    if(inFlight)return inFlight;
    inFlight=(async()=>{
      const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
      try {
        const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'getPublicPricing'}),signal:controller.signal});
        const data=await response.json();const r=data?.pricing;
        if(!response.ok||data.success!==true||!r||r.version!==1||!['standard','flat'].includes(r.kind)||!Number.isFinite(Date.parse(data.serverTime)))throw Error('Pricing unavailable');
        if(r.kind==='flat'&&(!Number.isSafeInteger(r.unitCents)||r.unitCents<=0||!Number.isInteger(r.minimum)||r.minimum<15||!Number.isFinite(Date.parse(r.endsAt))))throw Error('Invalid pricing');
        config=data;serverNow=Date.parse(data.serverTime);syncedAt=performance.now();render();return data;
      } catch(error) {
        config=undefined;window.dispatchEvent(new CustomEvent('lustre:public-pricing',{detail:{saleActive:false,pricing:null}}));clearTimeout(popupTimer);clearInterval(countdownTimer);closeOffer();if(panel){targets.forEach(el=>el.hidden=true);if(heroPrice)heroPrice.hidden=true;banner.hidden=true;status.hidden=false;status.firstChild.textContent='Current pricing couldn’t be loaded. Please retry. ';status.querySelector('button').hidden=false;}
        throw Error('We couldn’t load current pricing. Your details are still here. Please try again.');
      } finally {clearTimeout(timer);inFlight=undefined;}
    })();return inFlight;
  };
  window.LustrePricing={refresh,ready:()=>inFlight||Promise.resolve(config),rule,calculate:q=>priceForRule(q,rule()),forQuote:(q,booking)=>priceForRule(q,booking?.pricingSnapshot||{kind:'standard',version:1})};
  if(panel){refresh().catch(()=>{});setInterval(()=>{if(document.visibilityState==='visible')refresh().catch(()=>{});},60000);document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')refresh().catch(()=>{});});}
})();
