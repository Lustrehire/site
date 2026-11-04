// One shared contact form and the existing Formspree submission handler.
document.addEventListener('DOMContentLoaded', () => {
  const content = document.getElementById('contact-modal');
  if (!content) return;
  const form = document.getElementById('contact-modal-form');
  const status = document.getElementById('contact-modal-status');
  const dialog = document.createElement('dialog');
  dialog.id = 'contact-dialog';
  dialog.setAttribute('aria-labelledby', 'contact-dialog-title');
  dialog.innerHTML = '<div class="contact-dialog-bar"><h2 id="contact-dialog-title">Send us a message</h2><button type="button" aria-label="Close contact form">×</button></div><div class="contact-dialog-body"></div>';
  dialog.querySelector('.contact-dialog-body').append(content);
  document.getElementById('main-content').append(dialog);
  let trigger;
  const close = () => {
    if (!dialog.open) return;
    dialog.close();
    const destination = trigger?.closest('.mobile-nav') ? document.querySelector('.menu-toggle') : trigger;
    if (destination?.isConnected) destination.focus({preventScroll:true});
  };
  const open = source => {
    if (dialog.open) return;
    trigger = source;
    if (form.hidden) {
      form.hidden = false;
      status.hidden = true;
      status.replaceChildren();
      status.classList.remove('is-success', 'is-error', 'status-loading');
    }
    dialog.showModal();
    document.getElementById('contact-modal-name').focus({preventScroll:true});
  };
  document.querySelectorAll('[data-open-contact]').forEach(link => link.addEventListener('click', event => {
    event.preventDefault();
    open(link);
  }));
  dialog.querySelector('button').addEventListener('click',close);
  dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
  dialog.addEventListener('click',event=>{
    const rect=dialog.getBoundingClientRect();
    if(event.target===dialog&&(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom))close();
  });
  // Contact links from other pages already point to /#contact.
  if (location.hash === '#contact') {
    history.replaceState(null, '', location.pathname + location.search);
    open(document.querySelector('#contact [data-open-contact]'));
    // Native fragment navigation can move focus again when the page finishes loading.
    window.addEventListener('load', () => {
      if (dialog.open && !dialog.contains(document.activeElement)) document.getElementById('contact-modal-name').focus({preventScroll:true});
    }, {once:true});
  }
});
