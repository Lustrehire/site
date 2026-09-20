(function () {
  // Split integer cents so the two hire payments always add back to the hire fee.
  const calculate = (hireFee) => {
    const hireCents = Math.round((Number(hireFee) + Number.EPSILON) * 100);
    const depositCents = Math.round(hireCents / 2);
    const remainingCents = hireCents - depositCents;
    return {
      depositAmount: depositCents / 100,
      remainingHireAmount: remainingCents / 100,
      bondAmount: hireCents / 100,
      finalPaymentAmount: (remainingCents + hireCents) / 100,
    };
  };
  const currency = (amount) => new Intl.NumberFormat('en-AU', {
    style: 'currency', currency: 'AUD', minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
  }).format(amount);
  const summary = (hireFee, pickupDate, paid = false, compact = false) => {
    const amounts = calculate(hireFee);
    let due = 'Due 7 days before pickup';
    if (/^\d{4}-\d{2}-\d{2}$/.test(pickupDate || '')) {
      const date = new Date(`${pickupDate}T00:00:00Z`);
      if (!Number.isNaN(date.getTime())) {
        date.setUTCDate(date.getUTCDate() - 7);
        due += ` (${window.LustreHireDate.formatDisplayDate(date)})`;
      }
    }
    if (compact) {
      return `<div class="booking-payment-simple">
        <h4>Secure your date</h4>
        <p class="booking-payment-intro"><strong>Pay ${currency(amounts.depositAmount)} today to secure your date.</strong><span>${currency(amounts.finalPaymentAmount)} is due 7 days before pickup.</span></p>
        <div class="booking-payment-cards">
          <section class="booking-payment-card booking-payment-card-today" aria-label="Payment today">
            <h5>Today</h5>
            <strong class="booking-payment-amount">${currency(amounts.depositAmount)}</strong>
            <p>50% booking deposit<br>Secures your date</p>
          </section>
          <section class="booking-payment-card" aria-label="Payment later">
            <h5>Later</h5>
            <strong class="booking-payment-amount">${currency(amounts.finalPaymentAmount)}</strong>
            <p>${due}</p>
            <p>Remaining hire balance: ${currency(amounts.remainingHireAmount)}<br>Refundable bond: ${currency(amounts.bondAmount)}</p>
          </section>
        </div>
        <p class="booking-payment-footnote">Total candle hire: ${currency(Number(hireFee))}<br>The refundable bond is returned after return and inspection, subject to the hire terms.</p>
      </div>`;
    }
    const row = (label, amount, prominent = false) => `<div class="staged-payment-row${prominent ? ' staged-payment-total' : ''}"><span>${label}</span> <strong>${currency(amount)}</strong></div>`;
    return `<div class="staged-payment-summary">
      ${row(paid ? 'Total candle hire' : 'Candle hire', amounts.bondAmount)}
      ${paid ? '' : row('50% booking deposit', amounts.depositAmount)}
      ${row(paid ? 'Deposit paid today' : 'Due today', amounts.depositAmount, true)}
      <p class="staged-payment-note">Only the 50% booking deposit is charged ${paid ? 'in this checkout' : 'today'}.</p>
      <div class="staged-payment-later"><h4>Due later</h4>
        ${row('Remaining hire balance', amounts.remainingHireAmount)}
        ${row('Refundable bond', amounts.bondAmount)}
        ${row('Final payment', amounts.finalPaymentAmount)}
        <p class="staged-payment-note">${due}</p>
      </div>
    </div>`;
  };
  window.LustreHirePayment = { calculate, currency, summary };
})();
