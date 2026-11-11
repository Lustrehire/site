/* Public campaign slides only. The existing availability form is never replaced. */
(() => {
  const hero=document.querySelector('.hero'),copy=hero?.querySelector('.hero-text');
  if(!hero||!copy)return;
  const image=hero.querySelector('.hero-image img'),title=copy.querySelector('h1'),intro=copy.querySelector('.hero-intro'),eyebrow=copy.querySelector('.hero-eyebrow');
  const base={id:'main',name:'Main introduction',image:image.getAttribute('src'),alt:image.alt,eyebrow:eyebrow.textContent,title:[...title.children].map(el=>el.textContent),intro:[...intro.children].map(el=>el.textContent)};
  const benefits={id:'benefits',name:'Candle benefits',image:'/img/balanced-wedding-reception-candle-styling.jpg',alt:'A candlelit outdoor reception table under warm string lights at dusk',eyebrow:'WHY HIRE?',title:['All the glow.\nLess to organise.','All the glow.\nLess to organise.'],intro:['Skip buying glass, filling candles and cleaning wax. Collect, style and return—we handle the preparation and cleaning.','Skip buying glass, filling candles and cleaning wax. Just collect, style and return.']};
  const pictures=new Map([[base.image,{node:image,ready:Promise.resolve(base.image)}]]);
  image.style.opacity='1';
  const prepare=src=>{
    if(!pictures.has(src)){
      const candidate=new Image();candidate.fetchPriority='low';candidate.width=1408;candidate.height=768;candidate.style.opacity='0';candidate.setAttribute('aria-hidden','true');candidate.src=src;image.parentElement.append(candidate);
      pictures.set(src,{node:candidate,ready:candidate.decode().then(()=>src).catch(()=>null)});
    }
    return pictures.get(src).ready;
  };
  prepare(benefits.image);prepare('/img/romantic-candlelit-reception-table-styling.jpg');
  let slides=[base,benefits],current=base,manual=false,receivedPricing=false,timer,paused=false,touchStart;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');paused=reduced.matches;
  hero.classList.add('has-hero-carousel');hero.setAttribute('role','region');hero.setAttribute('aria-roledescription','carousel');hero.setAttribute('aria-label','Candle hire highlights');
  const controls=document.createElement('div');controls.className='hero-carousel-controls';controls.setAttribute('aria-label','Hero slideshow controls');
  const choices=document.createElement('div');choices.className='hero-slide-choices';
  const pause=document.createElement('button');pause.type='button';pause.className='hero-carousel-pause';
  const announcement=document.createElement('span');announcement.className='hero-carousel-announcement';announcement.setAttribute('aria-live','polite');announcement.setAttribute('aria-atomic','true');
  controls.append(choices,pause,announcement);hero.querySelector('.hero-content').append(controls);
  const stop=()=>clearTimeout(timer);
  const schedule=()=>{stop();if(!paused)timer=setTimeout(()=>{if(document.visibilityState==='visible'&&!document.querySelector('dialog[open]')&&(!hero.contains(document.activeElement)||controls.contains(document.activeElement)))show(slides[(slides.indexOf(current)+1)%slides.length],false);else schedule();},4000);};
  const renderControls=()=>{
    if(choices.dataset.slides!==slides.map(s=>s.id).join(',')){
    const focused=document.activeElement?.dataset?.slideId;
    choices.replaceChildren();slides.forEach(slide=>{const button=document.createElement('button');button.type='button';button.className='hero-slide-choice';button.dataset.slideId=slide.id;button.setAttribute('aria-label','Show '+slide.name.toLowerCase());button.setAttribute('aria-current',String(slide.id===current.id));button.innerHTML='<span aria-hidden="true"></span>';button.addEventListener('click',()=>show(slide,true));choices.append(button);});choices.dataset.slides=slides.map(s=>s.id).join(',');if(focused)choices.querySelector(`[data-slide-id="${focused}"]`)?.focus({preventScroll:true});}
    [...choices.children].forEach(button=>button.setAttribute('aria-current',String(button.dataset.slideId===current.id)));
    pause.textContent=paused?'Play slides':'Pause slides';pause.setAttribute('aria-label',paused?'Play hero slideshow':'Pause hero slideshow');
  };
  const show=(slide,user=false)=>{
    current=slide;hero.dataset.heroSlide=slide.id;
    prepare(slide.image).then(src=>{if(src&&current.id===slide.id){pictures.forEach(({node},url)=>{node.style.opacity=url===src?'1':'0';node.setAttribute('aria-hidden',String(url!==src));if(url===src)node.alt=slide.alt;});}});
    eyebrow.textContent=slide.eyebrow;
    [...title.children].forEach((el,i)=>el.textContent=slide.title[i]||slide.title[0]);
    [...intro.children].forEach((el,i)=>el.textContent=slide.intro[i]||slide.intro[0]);
    if(user){manual=true;announcement.textContent=slide.name;}
    renderControls();schedule();
  };
  pause.addEventListener('click',()=>{paused=!paused;renderControls();schedule();pause.focus({preventScroll:true});});
  controls.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight'].includes(event.key))return;event.preventDefault();const direction=event.key==='ArrowRight'?1:-1;show(slides[(slides.indexOf(current)+direction+slides.length)%slides.length],true);choices.querySelector('[aria-current="true"]').focus();});
  copy.addEventListener('touchstart',event=>{touchStart=event.touches[0];},{passive:true});
  copy.addEventListener('touchend',event=>{if(!touchStart)return;const end=event.changedTouches[0],dx=end.clientX-touchStart.clientX,dy=end.clientY-touchStart.clientY;touchStart=null;if(Math.abs(dx)>60&&Math.abs(dx)>Math.abs(dy)*1.5&&!event.target.closest('a,button,input'))show(slides[(slides.indexOf(current)+(dx<0?1:-1)+slides.length)%slides.length],true);},{passive:true});
  hero.addEventListener('focusin',event=>event.target.closest('form')?stop():schedule());hero.addEventListener('focusout',schedule);
  document.addEventListener('visibilitychange',()=>document.visibilityState==='hidden'?stop():schedule());
  reduced.addEventListener('change',()=>{if(reduced.matches){paused=true;renderControls();stop();}});
  window.addEventListener('lustre:public-pricing',event=>{
    const r=event.detail.pricing,sale=event.detail.saleActive;
    const offer=sale?{id:'sale',name:'Sale offer',image:'/img/romantic-candlelit-reception-table-styling.jpg',alt:'A candlelit wedding aisle with glowing candles in glass vessels',eyebrow:r.name||'LIMITED-TIME OFFER',title:[`$${r.unitCents/100} per candle.\nGlass included.`,`$${r.unitCents/100} per candle.\nGlass included.`],intro:[`Ready-to-light sand wax candles. ${r.minimum} candle minimum. Request a sale quote for your future event.`,`Ready-to-light sand wax candles. ${r.minimum} candle minimum. Your event can take place later.`]}:null;
    slides=offer?[offer,base,benefits]:[base,benefits];
    const lead=!receivedPricing&&!manual&&!hero.contains(document.activeElement);receivedPricing=true;
    const selected=slides.find(slide=>slide.id===current.id);
    show(lead&&offer?offer:selected||base,false);
  });
  show(base);
})();
