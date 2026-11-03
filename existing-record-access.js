// Reference + email retrieval. The optional simulation adapter is injected only
// by the local design-preview server; production posts to the existing backend.
document.addEventListener('DOMContentLoaded', () => {
  const dialog = document.getElementById('existing-record-dialog');
  const opener = document.getElementById('existing-record-open');
  const form = document.getElementById('existing-record-email-form');
  const email = document.getElementById('existing-record-email');
  const reference = document.getElementById('existing-record-reference');
  const feedback = document.getElementById('existing-record-email-feedback');
  const panel = document.getElementById('existing-record-email-panel');
  const result = document.getElementById('existing-record-result');
  const next = document.getElementById('existing-record-next');
  let pending = false;
  let lookupVersion = 0;
  let selectedRecordId = null;
  const idleLabel = next.innerHTML;
  const clearLoading = () => { pending = false; next.disabled = false; next.innerHTML = idleLabel; form.removeAttribute('aria-busy'); };
  const reset = () => { selectedRecordId = null; lookupVersion++; clearLoading(); panel.hidden = false; result.hidden = true; result.replaceChildren(); feedback.textContent = ''; dialog.setAttribute('aria-labelledby', 'existing-record-title'); };
  opener.addEventListener('click', () => { reset(); dialog.showModal(); reference.focus(); });
  const close = () => { lookupVersion++; clearLoading(); dialog.close(); opener.focus(); };
  document.getElementById('existing-record-close').addEventListener('click', close);
  dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
  dialog.addEventListener('click', event => {
    const rect = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) close();
  });
  const text = (tag, value, className) => {
    const node = document.createElement(tag); node.textContent = value;
    if (className) node.className = className;
    return node;
  };
  const showResult = heading => {
    panel.hidden = true; result.hidden = false;
    heading.id = 'existing-record-result-title';
    dialog.setAttribute('aria-labelledby', heading.id);
    dialog.scrollTop = 0; heading.tabIndex = -1; heading.focus({ preventScroll: true });
  };
  const again = () => { reset(); reference.focus(); };
  const action = (label, callback, primary = false) => {
    const button = text('button', label, primary ? 'booking-button' : 'calculator-nav-button');
    button.type = 'button'; button.addEventListener('click', callback); return button;
  };
  const startFresh = booking => {
    close();
    const date = document.getElementById('availability-date');
    const quantity = document.getElementById('availability-quantity');
    date.value = booking?.eventDate || ''; quantity.value = booking?.quantity || '';
    date.dispatchEvent(new Event('input', { bubbles: true }));
    date.scrollIntoView({ block: 'center', behavior: 'smooth' }); date.focus({ preventScroll: true });
  };
  const showEdge = (title, copy, booking, primaryLabel, primaryAction) => {
    result.replaceChildren();
    const icon = text('span', '!', 'record-state-icon'); icon.setAttribute('aria-hidden', 'true');
    const heading = text('h2', title);
    result.append(icon, heading, text('p', copy));
    if (booking) result.append(text('p', `${booking.quantity} candles · ${window.LustreHireDate.formatDisplayDate(booking.eventDate, '')}`, 'record-state-context'));
    const actions = text('div', '', 'record-state-actions');
    actions.append(action(primaryLabel, primaryAction, true));
    const contact = text('a', 'Contact us', 'calculator-nav-button'); contact.href = 'mailto:lustrehire@gmail.com';
    if (primaryLabel !== 'Contact us') actions.append(contact);
    actions.append(primaryLabel === 'Check your details' ? action('Get a new quote', () => startFresh(null)) : action('Use another reference', again)); result.append(actions);
    showResult(heading);
  };
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (pending || !form.reportValidity()) return;
    feedback.textContent = '';
    const version = ++lookupVersion;
    pending = true; next.disabled = true; next.textContent = 'Checking…'; form.setAttribute('aria-busy', 'true');
    try {
      let found;
      if (typeof window.lustrePreviewFindRecord === 'function') {
        found = await window.lustrePreviewFindRecord(email.value.trim(), selectedRecordId, reference.value.trim());
      } else {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);
        try {
          const response = await fetch(form.dataset.lookupEndpoint, {
            method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({action: 'lookupExistingRecord', reference: reference.value.trim(), email: email.value.trim()}),
            signal: controller.signal, credentials: 'omit', referrerPolicy: 'no-referrer',
          });
          if (!response.ok) throw new Error('Lookup unavailable');
          found = await response.json();
          if (!found || typeof found !== 'object') throw new Error('Invalid lookup response');
          if (found.status === 'rate_limited') {
            if (version === lookupVersion && dialog.open) feedback.textContent = 'Too many attempts. Please wait 15 minutes before trying again, or contact lustrehire@gmail.com.';
            return;
          }
          if (found.success !== true) throw new Error('Lookup unavailable');
        } finally { clearTimeout(timeout); }
      }
      if (version !== lookupVersion || !dialog.open) return;
      if (found?.status === 'multiple' && Array.isArray(found.records) && found.records.length) {
        result.replaceChildren();
        const heading = text('h2', 'Which record would you like?');
        result.append(heading, text('p', 'Choose the quote or booking for your event.'));
        const choices = text('div', '', 'record-state-actions');
        for (const record of found.records) {
          if (!record.id) continue;
          const label = `${record.status === 'confirmed' ? 'Confirmed booking' : 'Quote'} · ${window.LustreHireDate.formatDisplayDate(record.eventDate, '')} · ${record.quantity} candles · ${record.reference}`;
          choices.append(action(label, () => {
            selectedRecordId = record.id;
            feedback.textContent = 'Opening your record…';
            form.requestSubmit();
          }));
        }
        choices.append(action('Use another reference', again)); result.append(choices); showResult(heading); return;
      }
      if (!found?.booking || found.status === 'missing') {
        showEdge('Let’s find your quote', 'We couldn’t find a matching quote or booking. Check your full reference and email address, or start a new quote.', null, 'Check your details', again);
        return;
      }
      if (!dialog.open) return;
      const status = found.status === 'cancelled' ? 'cancelled' : found.status === 'paid' || found.booking.bookingStatus === 'confirmed' || found.booking.quoteStatus === 'paid' ? 'confirmed' : found.status;
      if (status === 'expired') {
        // Reuse the existing token lookup/revalidation flow, never a dead-end expiry screen.
        if (!found.booking.quoteToken) throw new Error('Missing secure quote token');
        const destination = new URL('/quote.html', location.origin);
        destination.searchParams.set('quoteToken', found.booking.quoteToken);
        location.href = destination.href;
        return;
      }
      if (['unavailable', 'past', 'notice_period', 'cancelled', 'needs_refresh'].includes(status)) {
        const messages = {
          needs_refresh: ['Let’s update your quote', 'This quote needs a fresh price check. Start a new quote with your date and quantity, or contact us for help.', 'Get a new quote'],
          unavailable: ['This date is now fully booked', 'Availability has changed since your quote. We can help you find another date.', 'Try another date'],
          past: ['This event date has passed', 'This record is for a past event. You can start a quote for your next occasion.', 'Get a new quote'],
          notice_period: ['Let’s confirm this with you', 'Your event is too close for standard online booking. Contact us to check what is possible.', 'Contact us'],
          cancelled: ['This booking was cancelled', 'This record cannot be used to make another payment. Start a new quote or contact us for help.', 'Get a new quote'],
        };
        const [title, copy, label] = messages[status];
        showEdge(title, copy, found.booking, label, () => {
          if (status === 'notice_period') location.href = 'mailto:lustrehire@gmail.com';
          else startFresh(status === 'past' ? null : found.booking);
        });
        return;
      }
      if (!['quote', 'confirmed', 'price_updated', 'partial'].includes(status)) throw new Error('Unknown lookup outcome');
      const booking = status === 'partial' ? found.adjustedBooking : found.booking;
      if (!booking || !Number.isFinite(Number(booking.hireFee)) || Number(booking.quantity) < 15) throw new Error('Invalid record');
      const paid = status === 'confirmed';
      if (!paid && !booking.quoteToken) throw new Error('Missing secure quote token');
      result.replaceChildren();
      const heading = text('h2', paid ? 'Your booking is confirmed' : 'Your quote');
      heading.tabIndex = -1;
      result.append(heading, text('p', `Reference ${booking.bookingId}`),
        text('p', `${booking.quantity} candles · ${window.LustreHireDate.formatDisplayDate(booking.eventDate, '')}`));
      if (status === 'partial' || status === 'price_updated') {
        const notice = text('div', '', 'record-change-notice');
        notice.append(text('strong', status === 'partial' ? 'Your available quantity has changed' : 'Your quote price has changed'));
        notice.append(text('p', status === 'partial'
          ? `Your original quote was for ${found.booking.quantity} candles. We now have ${booking.quantity} available. The price below is for the smaller quantity.`
          : `Previous candle hire: ${window.LustreHirePayment.currency(found.previousHireFee)}. Updated candle hire: ${window.LustreHirePayment.currency(booking.hireFee)}. Please review the new price before continuing.`));
        result.append(notice);
      }
      if (found.quoteRevalidated) result.append(text('p', 'We’ve rechecked availability for your quote.', 'record-validity-note'));
      const amounts = window.LustreHirePayment.calculate(Number(booking.hireFee));
      const currency = window.LustreHirePayment.currency;
      const prices = text('div', '', 'quote-summary-prices');
      for (const [label, amount, note] of [
        ['Candle hire', currency(booking.hireFee), ''],
        ['Average per candle', new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(booking.hireFee / booking.quantity), 'Hire only'],
      ]) {
        const column = document.createElement('div');
        column.append(text('span', label), document.createTextNode(' '), text('strong', amount));
        if (note) column.append(text('small', note));
        prices.append(column);
      }
      result.append(prices);
      if (paid) {
        const payment = found.payment || booking.payment || {};
        const knownAmount = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;
        const card = text('div', '', 'quote-deposit-card');
        card.append(text('span', 'Outstanding balance'), text('strong', knownAmount(payment.balanceDue) ? currency(payment.balanceDue) : 'Not available', 'record-deposit-total'));
        card.append(text('p', knownAmount(payment.balanceDue) ? payment.balanceDue === 0 ? 'No outstanding balance.' : 'See your payment email for the remaining payment details.' : 'Contact us to confirm your current balance.'));
        const list = document.createElement('dl'); list.className = 'record-payment-facts';
        for (const [label, value] of [['Deposit received', payment.depositPaid], ['Total payments received', payment.totalPaid], ['Bond refunded', payment.bondRefunded]]) {
          if (knownAmount(value)) { const row = document.createElement('div'); row.append(text('dt', label), text('dd', currency(value))); list.append(row); }
        }
        card.append(list); result.append(card);
        result.append(text('p', 'Your date is secured. You do not need to pay another booking deposit.'));
        const contact = text('a', 'Contact us about this booking', 'calculator-nav-button'); contact.href = 'mailto:lustrehire@gmail.com'; result.append(contact);
        result.append(action('Use another reference', again)); showResult(heading); return;
      }
      const card = text('div', '', 'quote-deposit-card');
      card.append(text('span', paid ? 'Booking deposit paid' : 'Book with a deposit'),
        text('strong', currency(amounts.depositAmount), 'record-deposit-total'),
        text('p', paid ? 'Your date is secured. No new deposit is needed.' : 'That’s 50% of your hire cost.'));
      if (!paid) {
        const link = text('a', status === 'partial' ? `Continue with ${booking.quantity} candles →` : 'Book now →', 'booking-button record-book-quote');
        const url = new URL('/book.html', location.origin);
        url.searchParams.set('quoteToken', booking.quoteToken);
        if (status === 'partial') url.searchParams.set('adjustedQuantity', booking.quantity);
        link.href = url.href;
        if (status === 'price_updated') {
          const label = text('label', '', 'record-price-acceptance');
          const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.setAttribute('data-clarity-mask', 'true');
          label.append(checkbox, document.createTextNode('I’ve reviewed the updated price.'));
          link.setAttribute('aria-disabled', 'true'); link.removeAttribute('href');
          checkbox.addEventListener('change', () => {
            link.setAttribute('aria-disabled', String(!checkbox.checked));
            if (checkbox.checked) link.href = url.href; else link.removeAttribute('href');
          });
          card.append(label);
        }
        card.append(link);
      }
      result.append(card);
      const details = text('details', '', 'quote-later-details');
      const summary = document.createElement('summary');
      const labels = document.createElement('span');
      labels.append(text('strong', 'What do I pay later?'), text('small', 'Remaining hire balance + refundable bond'));
      const chevron = text('span', '', 'quote-chevron'); chevron.setAttribute('aria-hidden', 'true');
      summary.append(labels, chevron);
      const body = text('div', '', 'quote-later-body');
      body.append(text('p', `Due 7 days before pickup: ${currency(amounts.finalPaymentAmount)}`));
      const list = document.createElement('dl');
      for (const [label, value] of [['Remaining hire balance', amounts.remainingHireAmount], ['Refundable bond', amounts.bondAmount]]) {
        const row = document.createElement('div');
        row.append(text('dt', label), document.createTextNode(' '), text('dd', currency(value))); list.append(row);
      }
      body.append(list, text('p', 'The bond covers loss, damage or other costs under the hire terms. Eligible refunds are made within 24 hours of inspection.'));
      details.append(summary, body); result.append(details);
      result.append(text('p', paid ? 'Your date is secured. You do not need to pay another booking deposit.' : 'Only your deposit is charged when you book.', 'quote-deposit-reassurance'));
      if (paid) {
        const contact = text('a', 'Contact us about this booking', 'calculator-nav-button');
        contact.href = 'mailto:lustrehire@gmail.com'; result.append(contact);
      } else result.append(text('p', 'Subject to quote validity and current availability. A paid deposit secures your date.', 'record-validity-note'));
      // The existing token route rechecks validity and stock before checkout.
      const back = text('button', 'Use another reference', 'record-back');
      back.type = 'button'; back.addEventListener('click', () => { reset(); reference.focus(); });
      result.append(back);
      showResult(heading);
    } catch {
      if (version !== lookupVersion || !dialog.open) return;
      showEdge('We couldn’t load your record', 'Your reference and email are still here; please try again. No booking or payment has been made.', null, 'Try again', () => { reset(); form.requestSubmit(); });
    } finally { if (version === lookupVersion) clearLoading(); }
  });
});
