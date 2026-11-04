// Reuse the single live estimator; no copied forms or independent calculations.
document.addEventListener('DOMContentLoaded', () => {
  const estimator = document.getElementById('candle-calculator');
  if (!estimator) return;
  const dialog = document.createElement('dialog');
  dialog.id = 'estimator-dialog';
  dialog.setAttribute('aria-labelledby', 'estimator-dialog-title');
  dialog.innerHTML = '<div class="estimator-dialog-bar"><span id="estimator-dialog-title">Wedding Candle Estimator</span><button type="button" aria-label="Close candle estimator">×</button></div><div class="estimator-dialog-body"></div>';
  document.getElementById('main-content').append(dialog);
  const body = dialog.querySelector('.estimator-dialog-body');
  let placeholder, trigger;
  const close = () => {
    if (!dialog.open) return;
    dialog.close();
    if (placeholder) { placeholder.replaceWith(estimator); placeholder = null; }
    estimator.dispatchEvent(new Event('lustre:estimator-restored'));
    const returnTarget = trigger?.closest(".mobile-nav") ? document.querySelector(".menu-toggle") : trigger;
    if (returnTarget?.isConnected) returnTarget.focus({ preventScroll: true });
  };
  const open = source => {
    if (dialog.open) return;
    trigger = source;
    placeholder = document.createComment('Estimator modal return position');
    estimator.before(placeholder);
    body.append(estimator);
    dialog.showModal();
    document.getElementById('calculator-start').click();

  };
  document.querySelectorAll('[data-open-estimator]').forEach(button => button.addEventListener('click', () => open(button)));
  dialog.querySelector('button').addEventListener('click', close);
  dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
  dialog.addEventListener('click', event => {
    const rect = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) close();
  });
  document.getElementById('calculator-cancel')?.addEventListener('click', close);
  document.getElementById('calculator-check-date')?.addEventListener('click', close, true);
  if (location.hash === '#candle-calculator') open(document.querySelector('#estimator-cta [data-open-estimator]'));
});
