// Injected ONLY by the local design-preview server; never included in site HTML.
(() => {
  const response = data => Promise.resolve(new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } }));
  const shift = (date, days) => {
    const d = new Date(date + 'T12:00:00Z');
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  };
  window.fetch = (input, options = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url, location.href);
    if (url.hostname === 'script.google.com') {
      let body;
      try { body = JSON.parse(options.body); } catch { return response({ success: false }); }
      if (body.action === 'checkAvailability') {
        return response({ success: true, status: 'available', available: true, partialAvailable: false,
          eventDate: body.eventDate, pickupDate: shift(body.eventDate, -1), returnDate: shift(body.eventDate, 1),
          requestedQuantity: body.quantity, remainingStock: 500, maxAvailable: 500, minimumNoticeDays: 8 });
      }
      if (body.action === 'saveQuoteBooking') return response({ success: true, bookingId: 'PREVIEW-QUOTE', quoteToken: 'preview-only', quoteStatus: 'sent' });
      // Checkout, confirmation and all other writes are disabled in the preview.
      return response({ success: false, message: 'This is a design preview. No booking or payment was created.' });
    }
    if (url.hostname === 'formspree.io') return response({ ok: true });
    // Fail closed even if a later change introduces another external API.
    return Promise.reject(new Error('Network calls are disabled in this design preview.'));
  };
  document.addEventListener('DOMContentLoaded', () => {
    const notice = document.createElement('div');
    notice.setAttribute('role', 'note');
    notice.style.cssText = 'width:100%;box-sizing:border-box;padding:12px 16px;background:#173409;color:#fff;font:12px/1.5 sans-serif;text-align:center';
    notice.textContent = 'LOCAL DESIGN PREVIEW · Availability and forms are simulated. No emails, bookings or payments are sent.';
    document.body.prepend(notice);
  });
})();
