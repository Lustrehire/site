(function () {
  if (window.lustreTrackingLoaded) return;
  window.lustreTrackingLoaded = true;
  const measurementId = 'G-1RPLQ8LZ48';
  const paths = ['/', '/index.html', '/book.html', '/quote.html', '/payment-success.html', '/payment-cancelled.html'];
  const pagePath = paths.includes(location.pathname) ? location.pathname : '/';
  const publicPage = ['/', '/index.html'].includes(location.pathname);
  const originalParams = new URLSearchParams(location.search);
  const sources = new Set(['facebook', 'instagram', 'google', 'bing', 'microsoft', 'meta', 'fb', 'ig', 'linkedin', 'pinterest', 'tiktok', 'youtube']);
  const media = new Set(['cpc', 'ppc', 'paid_social', 'paid-social', 'paid_search', 'paid-search', 'social', 'organic', 'referral', 'email', 'display', 'affiliate', 'video']);
  const utmKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_id', 'utm_content', 'utm_term'];
  const clickKeys = ['gclid', 'dclid', 'gbraid', 'wbraid', 'fbclid', 'msclkid'];
  // Compare campaign text with sensitive values already known to this browser.
  // These values stay local and are never included in tracking payloads.
  const normalise = value => String(value).toLowerCase().replace(/[^a-z0-9]/g, '');
  const privateValues = [];
  const privateKeys = /^(full_?name|first_?name|last_?name|name|email|phone|address|quote_?token|booking_?id|stripe_?session_?id|session_?id)$/i;
  function rememberPrivate(source) {
    for (const [key, value] of Object.entries(source || {})) {
      if (privateKeys.test(key) && typeof value === 'string' && normalise(value).length >= 3) privateValues.push(normalise(value));
    }
  }
  originalParams.forEach((value, key) => rememberPrivate({ [key]: value }));
  for (const key of ['lustreHirePendingBooking', 'lustreHirePendingQuote', 'lustreHireConfirmedBookingSaved']) {
    try { rememberPrivate(JSON.parse(sessionStorage.getItem(key))); } catch { /* Storage is optional. */ }
  }
  function containsPrivate(value) {
    const normalised = normalise(value);
    return privateValues.some(privateValue => normalised.includes(privateValue)) ||
      /(?:cs_|pi_|sk_|pk_|qt_|quote[_ -]?token|booking[_ -]?id|session[_ -]?id)/i.test(value) ||
      /(?:\d[ _.-]*){7,}/.test(value) ||
      /\b\d+[ _-]+[a-z]+(?:[ _-]+[a-z]+)*[ _-]+(?:street|st|road|rd|avenue|ave|drive|dr|lane|ln|way|close|court|ct)\b/i.test(value);
  }
  function safeValue(key, value) {
    if (typeof value !== 'string' || value.length > 256) return '';
    if (privateValues.some(privateValue => normalise(value).includes(privateValue))) return '';
    if (key === 'utm_source') return sources.has(value.toLowerCase()) ? value.toLowerCase() : '';
    if (key === 'utm_medium') return media.has(value.toLowerCase()) ? value.toLowerCase() : '';
    if (utmKeys.includes(key)) {
      // Bounded campaign labels, not arbitrary URLs, email or free-form data.
      return value.length <= 100 && /^[a-zA-Z0-9][a-zA-Z0-9 _-]*$/.test(value) && !containsPrivate(value) ? value.trim() : '';
    }
    if (key === 'msclkid') return /^[a-fA-F0-9]{32}$/.test(value) ? value : '';
    if (clickKeys.includes(key)) {
      // Reject obvious private IDs/PII as well as malformed or repeated params.
      return /^(?!cs_|pi_|sk_|pk_|qt_|quote|session)[A-Za-z0-9_-]{20,256}$/.test(value) && /[A-Za-z]/.test(value) && /[0-9]/.test(value) ? value : '';
    }
    return '';
  }
  function campaignFrom(params) {
    const result = {};
    for (const key of [...utmKeys, ...clickKeys]) {
      if (params.getAll(key).length !== 1) continue;
      const value = safeValue(key, params.get(key));
      if (value) result[key] = value;
    }
    return result;
  }
  const landingCampaign = campaignFrom(originalParams);
  function referrerOrigin(value) {
    try {
      const url = new URL(value);
      // Never forward referrer paths, userinfo, queries or fragments.
      return /^https?:$/.test(url.protocol) ? url.origin + '/' : '';
    } catch { return ''; }
  }
  const safeReferrer = referrerOrigin(document.referrer);
  // Existing booking/quote/payment URL parameters remain untouched. On the
  // public homepage, remove everything except validated campaign parameters
  // and the existing, fixed navigation target before any vendor is loaded.
  let publicUrlSafe = publicPage;
  if (publicPage) {
    const url = new URL(location.origin + pagePath);
    for (const [key, value] of Object.entries(landingCampaign)) url.searchParams.set(key, value);
    if (originalParams.get('scrollTo') === 'availability-checker') url.searchParams.set('scrollTo', 'availability-checker');
    // Existing anchor navigation is functional; only known section IDs survive.
    const anchors = ['#availability-checker', '#candle-packages', '#how-it-works', '#faq', '#contact', '#testimonials'];
    if (anchors.includes(location.hash)) url.hash = location.hash;
    try { if (url.href !== location.href) history.replaceState(history.state, '', url.href); }
    catch { publicUrlSafe = false; }
  }
  // Vendor pixels can read document.referrer independently. An origin-only
  // referral is safe; a path/query-bearing referral needs a clean landing hop.
  // Do not discard its attribution or reject the referring site itself.
  const needsCleanReferrer = Boolean(document.referrer && document.referrer !== safeReferrer);
  const events = new Set(['availability_check', 'availability_result', 'quote_generated', 'booking_started', 'booking_details_completed', 'begin_checkout', 'checkout_started', 'checkout_error', 'payment_cancelled']);
  const memory = {};
  const read = key => { try { return JSON.parse(sessionStorage.getItem('lustreTracking:' + key)) || memory[key]; } catch { return memory[key]; } };
  const write = (key, value) => { memory[key] = value; try { if (value === null) sessionStorage.removeItem('lustreTracking:' + key); else sessionStorage.setItem('lustreTracking:' + key, JSON.stringify(value)); } catch { /* Tracking must not block booking. */ } };
  const once = key => { if (read(key)) return false; write(key, true); return true; };
  const number = value => Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : 0;
  let attribution = {};
  let googleLoaded = false, gaLoaded = false, adsLoaded = false, metaLoaded = false, gtmLoaded = false;
  const campaignFields = { utm_source: 'campaign_source', utm_medium: 'campaign_medium', utm_campaign: 'campaign_name', utm_id: 'campaign_id', utm_content: 'campaign_content', utm_term: 'campaign_term' };
  function pageParams() {
    const url = new URL(location.origin + pagePath);
    // Put click IDs only on the actual public landing view, not every step.
    for (const [key, value] of Object.entries(landingCampaign)) {
      url.searchParams.set(key, value);
    }
    const params = { page_path: pagePath, page_location: url.href, page_referrer: attribution.referrer || safeReferrer };
    for (const [key, field] of Object.entries(campaignFields)) if (attribution[key]) params[field] = attribution[key];
    return params;
  }
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
  window.gtag('set', 'ads_data_redaction', true);
  window.gtag('set', 'url_passthrough', false);
  function load(src) {
    const script = document.createElement('script');
    script.async = true;
    script.src = src;
    script.referrerPolicy = 'no-referrer';
    document.head.appendChild(script);
  }
  function deliver(command) {
    if (metaLoaded && command[0] === 'meta') window.fbq.apply(null, command.slice(1));
  }
  function captureAttribution() {
    const hop = read('referrerHop');
    if (hop) write('referrerHop', null);
    const hopReferrer = hop?.url === location.href && Date.now() - hop.savedAt >= 0 && Date.now() - hop.savedAt < 60000 ? referrerOrigin(hop.referrer) : '';
    const stored = read('attribution');
    const previous = stored && Date.now() - stored.savedAt >= 0 && Date.now() - stored.savedAt < 30 * 60 * 1000 ? stored : {};
    const previousCampaign = campaignFrom(new URLSearchParams(previous.campaign || {}));
    const incoming = { ...landingCampaign };
    // A new campaign replaces the old one as a unit. Internal steps do not
    // overwrite it or mix an earlier Facebook click with a newer Google click.
    const externalReferrer = safeReferrer && safeReferrer !== location.origin + '/';
    const campaign = Object.keys(incoming).length ? incoming : externalReferrer ? {} : previousCampaign;
    const referrer = externalReferrer ? safeReferrer : hopReferrer || (Object.keys(incoming).length ? '' : referrerOrigin(previous.referrer));
    attribution = { ...campaign, referrer };
    write('attribution', { campaign, referrer, savedAt: Date.now() });
  }
  let cleanNavigationRequested = false;
  function startProviders() {
    captureAttribution();
    if (publicUrlSafe && needsCleanReferrer) {
      // A no-referrer navigation removes an unsafe immutable document.referrer.
      // No provider/page-view runs in this first document. Only sanitised
      // attribution survives the hop; the functional URL is retained.
      if (!cleanNavigationRequested) {
        cleanNavigationRequested = true;
        write('referrerHop', { url: location.href, referrer: attribution.referrer, savedAt: Date.now() });
        location.replace(location.href);
      }
      return;
    }
    const page = pageParams();
    window.gtag('set', page);
    if (!googleLoaded) { window.gtag('js', new Date()); googleLoaded = true; }
    if (!gaLoaded) {
      gaLoaded = true;
      window.gtag('config', measurementId, { ...page, send_page_view: false, allow_google_signals: false, allow_ad_personalization_signals: false });
      window.gtag('event', 'page_view', { ...page, send_to: measurementId });
    }
    if (publicUrlSafe && !needsCleanReferrer && !adsLoaded) {
      adsLoaded = true;
      window.gtag('config', 'AW-18047450478', page);
    }
    if (!document.querySelector('script[data-lustre-google]')) {
      load('https://www.googletagmanager.com/gtag/js?id=' + measurementId);
      document.head.lastElementChild.dataset.lustreGoogle = 'true';
    }
    if (publicUrlSafe && !needsCleanReferrer && !metaLoaded) {
      metaLoaded = true;
      const fbq = window.fbq = function () {
        if (fbq.callMethod) fbq.callMethod.apply(fbq, arguments);
        else fbq.queue.push(arguments);
      };
      window._fbq = fbq; fbq.queue = []; fbq.push = fbq; fbq.loaded = true; fbq.version = '2.0';
      fbq('set', 'autoConfig', false, '1271538364415253');
      fbq('init', '1271538364415253');
      fbq('track', 'PageView');
      load('https://connect.facebook.net/en_US/fbevents.js');
    }
    const startGtm = () => {
      if (!publicUrlSafe || needsCleanReferrer) return;
      // Mask all DOM text for any future Clarity tag before GTM can run.
      document.body.setAttribute('data-clarity-mask', 'true');
      window.clarity = window.clarity || function () { (window.clarity.q = window.clarity.q || []).push(arguments); };
      window.dataLayer.push({ event: 'lustre_tracking_ready', lustre_clarity_eligible: true });
      if (gtmLoaded) return;
      gtmLoaded = true;
      window.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' });
      load('https://www.googletagmanager.com/gtm.js?id=GTM-MTQH9ZRG');
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startGtm, { once: true });
    else startGtm();
  }
  function clean(source = {}) {
    const params = pageParams();
    for (const key of ['quantity', 'hire_fee', 'bond_amount', 'total_due', 'value']) {
      if (source[key] !== undefined && Number.isFinite(Number(source[key])) && Number(source[key]) >= 0) params[key] = Number(source[key]);
    }
    if (['direct', 'quote'].includes(source.booking_mode)) params.booking_mode = source.booking_mode;
    if (['available', 'partial', 'partial_available', 'limited', 'unavailable', 'below_minimum', 'notice_period'].includes(source.availability_status)) params.availability_status = source.availability_status;
    if (source.error_code === 'checkout_preparation_failed') params.error_code = source.error_code;
    if (source.currency === 'AUD') params.currency = 'AUD';
    return params;
  }
  function journey(source) {
    // Private browser-only identity. Never put identifiers/dates in provider data.
    return [read('journey') || 0, source.booking_mode, source._journey_key || source.event_date, source.quantity].join('|');
  }
  function track(eventName, source = {}) {
    try {
      if (cleanNavigationRequested || !events.has(eventName)) return false;
      if (eventName === 'availability_check') write('journey', (read('journey') || 0) + 1);
      if (['booking_started', 'booking_details_completed'].includes(eventName) && !once(eventName + ':' + journey(source))) return false;
      const params = clean(source);
      window.gtag('event', eventName, { ...params, send_to: measurementId });
      deliver(['meta', 'trackCustom', eventName, params]);
      return true;
    } catch { return false; }
  }
  window.trackLustreEvent = track;
  window.buildLustreBookingTrackingParams = (source = {}, extra = {}) => {
    const hireFee = number(source.hireFee);
    return { _journey_key: source.quoteToken || '', event_date: source.eventDate || source.event_date || '', quantity: number(source.quantity || source.requestedQuantity), hire_fee: hireFee,
      bond_amount: number(source.bondAmount ?? source.refundableBond), total_due: window.LustreHirePayment?.calculate(hireFee).depositAmount || 0,
      booking_mode: source.mode || source.bookingMode || source.booking_mode, ...extra };
  };
  window.trackLustreQuoteGenerated = source => {
    if (!source.bookingId || !once('quote:' + source.bookingId)) return;
    track('quote_generated', window.buildLustreBookingTrackingParams(source, { booking_mode: 'quote' }));
  };
  window.trackLustreCheckoutReady = (url, params = {}) => {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'https:' || parsed.username || parsed.password) {
        track('checkout_error', { booking_mode: params.booking_mode, error_code: 'checkout_preparation_failed' });
        return;
      }
      // URL is used only as a local deduplication key, never sent to analytics.
      if (!once('checkout:' + url)) return;
      write('checkoutPending', { booking_mode: params.booking_mode });
      // Preparation is not a charge: deliberately omit monetary value until
      // the backend supplies the actual amount charged in a verified response.
      const safe = { booking_mode: params.booking_mode, quantity: params.quantity };
      track('begin_checkout', safe);
      track('checkout_started', safe); // Legacy funnel name; not a conversion.
      deliver(['meta', 'track', 'InitiateCheckout', { ...clean(safe), currency: 'AUD' }]);
    } catch { track('checkout_error', { error_code: 'checkout_preparation_failed' }); }
  };
  window.trackLustreCancellation = () => {
    const checkout = read('checkoutPending');
    if (!checkout) return;
    write('checkoutPending', null);
    track('payment_cancelled', checkout);
  };
  window.captureLustreAttribution = captureAttribution;
  window.getLustreAttribution = () => ({ ...attribution });
  startProviders();
})();
