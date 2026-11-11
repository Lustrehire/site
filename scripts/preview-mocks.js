// Injected ONLY by the local design-preview server; never included in site HTML.
(() => {
  const response = data => Promise.resolve(new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } }));
  const shift = (date, days) => {
    const d = new Date(date + 'T12:00:00Z');
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  };
  window.lustrePreviewFindRecord = async (email, recordId, reference) => {
    const saved = JSON.parse(sessionStorage.getItem('lustrePreviewQuote') || 'null');
    if (saved && !/^LH-\d{13}-[A-F0-9]{8}$/.test(saved.bookingId || '')) saved.bookingId = 'LH-1793700000000-A1B2C3D4';
    const sample = saved && saved.email?.toLowerCase() === email.toLowerCase() ? saved : {
      mode: 'quote', bookingId: 'LH-1793700000000-A1B2C3D4', quoteToken: 'preview-only', quoteStatus: 'sent',
      eventDate: '2026-12-24', pickupDate: '2026-12-23', returnDate: '2026-12-25',
      quantity: 30, hireFee: 300, refundableBond: 300, fullName: 'Preview Customer', email,
    };
    if (reference?.trim().toUpperCase() !== sample.bookingId.toUpperCase()) return {status: 'missing'};
    sessionStorage.setItem('lustrePreviewQuote', JSON.stringify(sample));
    const status = sessionStorage.getItem('lustrePreviewRecordState') || 'quote';
    if (status === 'multiple') {
      const records = [
        { id: 'sample-quote', status: 'quote', reference: sample.bookingId, eventDate: sample.eventDate, quantity: sample.quantity },
        { id: 'sample-confirmed', status: 'confirmed', reference: 'PREVIEW-BOOKING', eventDate: '2026-12-31', quantity: 45 },
      ];
      if (!recordId) return { status: 'multiple', records };
      if (recordId === 'sample-confirmed') return { status: 'confirmed', booking: { ...sample, bookingId: 'PREVIEW-BOOKING', eventDate: '2026-12-31', pickupDate: '2026-12-30', returnDate: '2027-01-01', quantity: 45, hireFee: 449 }, payment: { balanceDue: 0, depositPaid: 224.50, totalPaid: 898, bondRefunded: 0 } };
      return { status: 'quote', booking: sample };
    }
    if (status === 'confirmed') return { status, booking: sample, payment: { balanceDue: 0, depositPaid: sample.hireFee / 2, totalPaid: sample.hireFee * 2, bondRefunded: 0 } };
    if (status === 'error') throw new Error('Simulated lookup failure');
    if (status === 'missing') return { status: 'missing' };
    if (status === 'expired') {
      const scenario = sessionStorage.getItem('lustrePreviewAvailability') || '300';
      const stock = scenario === 'unavailable' ? 0 : Number(scenario);
      if (stock < 15) return { status: 'unavailable', booking: sample, quoteRevalidated: true };
      const quantity = Math.min(sample.quantity, stock);
      const hireFee = Math.min(quantity,44)*10 + Math.max(0,Math.min(quantity-44,45))*9 + Math.max(0,quantity-89)*8;
      const updated = { ...sample, quantity, hireFee, refundableBond: hireFee };
      if (quantity < sample.quantity) return { status: 'partial', booking: sample, adjustedBooking: updated, quoteRevalidated: true };
      sessionStorage.setItem('lustrePreviewQuote', JSON.stringify(updated));
      return { status: hireFee !== Number(sample.hireFee) ? 'price_updated' : 'quote', booking: updated, previousHireFee: sample.hireFee, quoteRevalidated: true };
    }
    if (status === 'price_updated') {
      const previousHireFee = Number(sample.previewBaseHireFee ?? sample.hireFee);
      const updated = { ...sample, previewBaseHireFee: previousHireFee, hireFee: previousHireFee + 30 };
      sessionStorage.setItem('lustrePreviewQuote', JSON.stringify(updated));
      return { status, booking: updated, previousHireFee };
    }
    if (status === 'partial') {
      const quantity = Math.max(15, Math.floor(sample.quantity / 2));
      const hireFee = Math.min(quantity,44)*10 + Math.max(0,Math.min(quantity-44,45))*9 + Math.max(0,quantity-89)*8;
      return { status, booking: sample, adjustedBooking: { ...sample, quantity, hireFee, refundableBond: hireFee } };
    }
    return { status, booking: sample };
  };
  window.fetch = (input, options = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url, location.href);
    if (url.hostname === 'script.google.com') {
      let body;
      try { body = JSON.parse(options.body); } catch { return response({ success: false }); }
      if (body.action === 'getPublicPricing') {
        const active=sessionStorage.getItem('lustrePreviewSale')==='sale';
        return response({success:true,serverTime:new Date().toISOString(),minimumQuantity:15,saleActive:active,
          pricing:active?{kind:'flat',version:1,unitCents:700,minimum:15,name:'End-of-year sale',banner:'End-of-year sale: $7 per candle · 15 candle minimum',endsAt:new Date(Date.now()+86400000).toISOString()}:{kind:'standard',version:1}});
      }
      if (body.action === 'checkAvailability') {
        const scenario = sessionStorage.getItem('lustrePreviewAvailability') || '300';
        const stock = scenario === 'unavailable' ? 0 : Number(scenario);
        const available = Number(body.quantity) <= stock;
        const partial = !available && stock >= 15;
        return response({ success: true, status: available ? 'available' : partial ? 'partial' : 'unavailable', available, partialAvailable: partial,
          eventDate: body.eventDate, pickupDate: shift(body.eventDate, -1), returnDate: shift(body.eventDate, 1),
          requestedQuantity: body.quantity, remainingStock: stock, maxAvailable: stock, minimumNoticeDays: 8 });
      }
      if (body.action === 'saveQuoteBooking') {
        const booking = { ...body.bookingData, bookingId: 'LH-1793700000000-A1B2C3D4', quoteToken: 'preview-only', quoteStatus: 'sent' };
        sessionStorage.setItem('lustrePreviewQuote', JSON.stringify(booking));
        return response({ success: true, bookingId: booking.bookingId, quoteToken: booking.quoteToken, quoteStatus: 'sent' });
      }
      if (body.action === 'getQuoteByToken') {
        const booking = JSON.parse(sessionStorage.getItem('lustrePreviewQuote') || 'null');
        return response(booking && body.quoteToken === booking.quoteToken
          ? { success: true, status: 'valid', booking }
          : { success: false, status: 'missing' });
      }
      // Checkout, confirmation and all other writes are disabled in the preview.
      return response({ success: false, message: 'This is a design preview. No booking or payment was created.' });
    }
    if (url.hostname === 'formspree.io') return response({ ok: true });
    // Fail closed even if a later change introduces another external API.
    return Promise.reject(new Error('Network calls are disabled in this design preview.'));
  };
  document.addEventListener('DOMContentLoaded', () => {
    const saved = JSON.parse(sessionStorage.getItem('lustrePreviewQuote') || 'null');
    if (saved && !/^LH-\d{13}-[A-F0-9]{8}$/.test(saved.bookingId || '')) saved.bookingId = 'LH-1793700000000-A1B2C3D4';
    const help = document.getElementById('existing-record-reference-help');
    if (help) help.textContent = 'Local preview reference: ' + (saved?.bookingId || 'LH-1793700000000-A1B2C3D4');
    const notice = document.createElement('div');
    notice.setAttribute('role', 'note');
    notice.style.cssText = 'width:100%;box-sizing:border-box;padding:12px 16px;background:#173409;color:#fff;font:12px/1.5 sans-serif;text-align:center';
    notice.textContent = 'LOCAL DESIGN PREVIEW · Availability and forms are simulated. No emails, bookings or payments are sent.';
    const label = document.createElement('label');
    label.textContent = ' Preview stock: ';
    const control = document.createElement('select');
    control.setAttribute('aria-label', 'Simulated candle availability');
    control.setAttribute('data-clarity-mask', 'true');
    control.style.cssText = 'margin:8px;padding:8px;color:#1c291f;background:#fff;border-radius:8px;max-width:100%';
    for (const [value, text] of [['300', '300 candles (limited for 500)'], ['unavailable', 'Fully booked'], ['500', '500 candles available']]) {
      const option = document.createElement('option');
      option.value = value; option.textContent = text; control.append(option);
    }
    control.value = sessionStorage.getItem('lustrePreviewAvailability') || '300';
    control.addEventListener('change', () => sessionStorage.setItem('lustrePreviewAvailability', control.value));
    label.append(control); notice.append(label);
    const recordLabel = document.createElement('label'); recordLabel.textContent = ' Retrieval scenario: ';
    const recordControl = document.createElement('select');
    recordControl.setAttribute('aria-label', 'Simulated retrieval scenario');
    recordControl.setAttribute('data-clarity-mask', 'true'); recordControl.style.cssText = control.style.cssText;
    for (const [value, title] of [['quote','Valid quote'],['missing','No matching record'],['price_updated','Price updated'],['partial','Fewer candles available'],['unavailable','Fully booked'],['expired','Older quote (auto recheck)'],['confirmed','Already confirmed'],['multiple','Multiple records'],['past','Past event'],['notice_period','Event too soon'],['cancelled','Cancelled booking'],['error','Temporary error']]) {
      const option = document.createElement('option'); option.value = value; option.textContent = title; recordControl.append(option);
    }
    recordControl.value = sessionStorage.getItem('lustrePreviewRecordState') || 'quote';
    recordControl.addEventListener('change', () => sessionStorage.setItem('lustrePreviewRecordState', recordControl.value));
    recordLabel.append(recordControl); notice.append(recordLabel);
    const saleLabel=document.createElement('label');saleLabel.textContent=' Pricing: ';
    const saleControl=document.createElement('select');saleControl.setAttribute('aria-label','Simulated sale pricing');saleControl.setAttribute('data-clarity-mask','true');saleControl.style.cssText=control.style.cssText;
    for(const [value,title] of [['standard','Normal pricing'],['sale','$7 sale']]){const option=document.createElement('option');option.value=value;option.textContent=title;saleControl.append(option);}
    saleControl.value=sessionStorage.getItem('lustrePreviewSale')||'standard';saleControl.addEventListener('change',()=>{sessionStorage.setItem('lustrePreviewSale',saleControl.value);window.LustrePricing?.refresh().catch(()=>{});});saleLabel.append(saleControl);notice.append(saleLabel);
    document.body.prepend(notice);
  });
})();
