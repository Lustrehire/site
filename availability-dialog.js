// Presentation adapter: move the original availability section into a native
// modal. No forms are cloned, and existing result/action handlers stay attached.
document.addEventListener('DOMContentLoaded', () => {
  const section = document.getElementById('availability-checker');
  const main = document.getElementById('main-content');
  if (!section || !main) return;
  const dialog = document.createElement('dialog');
  dialog.id = 'availability-dialog';
  dialog.setAttribute('aria-labelledby', 'availability-dialog-title');
  dialog.innerHTML = '<div class="availability-dialog-bar"><span id="availability-dialog-title">Your availability</span><button type="button" class="availability-dialog-close" aria-label="Close availability" autofocus><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button></div><div class="availability-dialog-content"></div>';
  main.appendChild(dialog);
  const content = dialog.querySelector('.availability-dialog-content');
  let placeholder = null;
  const open = () => {
    if (!placeholder) {
      const css = getComputedStyle(section);
      placeholder = document.createElement('div');
      placeholder.className = 'availability-dialog-placeholder';
      placeholder.setAttribute('aria-hidden', 'true');
      Object.assign(placeholder.style, {
        height: `${section.getBoundingClientRect().height}px`,
        margin: css.margin, gridColumn: css.gridColumn, gridRow: css.gridRow,
      });
      section.before(placeholder);
    }
    content.appendChild(section);
    if (!dialog.open) dialog.showModal();
    document.documentElement.classList.add('availability-dialog-open');
    if (!dialog.contains(document.activeElement)) dialog.querySelector('.availability-dialog-close').focus();
  };
  const restore = () => {
    // Input edits also clear the result state. Leave the entry form in place
    // unless it is actually returning from the modal, so typing keeps focus.
    if (!dialog.open && !placeholder) return;
    if (dialog.open) dialog.close();
    if (placeholder) {
      placeholder.replaceWith(section);
      placeholder = null;
    }
    document.documentElement.classList.remove('availability-dialog-open');
    section.dispatchEvent(new Event('lustre:availability-restored'));
  };
  // Reuse Edit Details to dismiss: it preserves entered values, clears the
  // displayed result and returns focus to the original date field.
  const dismiss = () => document.getElementById('availability-edit-button')?.click();
  section.addEventListener('lustre:availability-view', event => {
    if (event.detail.hasResult) open(); else restore();
  });
  section.addEventListener('lustre:availability-step', event => {
    if (!dialog.open || event.detail.step <= 1) return;
    const panel = document.getElementById(`availability-step-${event.detail.step}-panel`);
    const target = [...panel.querySelectorAll('input,select,textarea,button')].find(node => !node.disabled && node.getClientRects().length);
    if (target) target.focus();
  });
  dialog.querySelector('.availability-dialog-close').addEventListener('click', dismiss);
  dialog.addEventListener('cancel', event => { event.preventDefault(); dismiss(); });
  dialog.addEventListener('click', event => {
    const rect = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) dismiss();
  });
  // Contact is an existing in-page destination; remove modal inertness before
  // its existing scroll/focus handler runs.
  section.addEventListener('click', event => {
    if (event.target.closest('[data-availability-action="contact-us"]')) dismiss();
  }, true);
  // The responsive layout moves original sections at its breakpoint. Keep the
  // active section in the modal after that layout adjustment finishes.
  window.addEventListener('resize', () => requestAnimationFrame(() => {
    if (dialog.open && section.parentNode !== content) content.appendChild(section);
  }));
});
