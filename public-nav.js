document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.querySelector('.menu-toggle');
  const nav = document.querySelector('.mobile-nav');
  const setOpen = open => {
    nav?.classList.toggle('open', open);
    toggle?.classList.toggle('menu-open', open);
    toggle?.setAttribute('aria-expanded', String(open));
    nav?.setAttribute('aria-hidden', String(!open));
    if (nav) nav.inert = !open;
  };
  setOpen(false);
  document.addEventListener('click', event => {
    if (!nav?.contains(event.target) && !toggle?.contains(event.target)) setOpen(false);
  });
  matchMedia('(max-width: 1100px)').addEventListener('change', () => setOpen(false));
  toggle?.addEventListener('click', () => setOpen(toggle.getAttribute('aria-expanded') !== 'true'));
  nav?.querySelectorAll('a').forEach(link => link.addEventListener('click', () => setOpen(false)));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && toggle?.getAttribute('aria-expanded') === 'true') {
      setOpen(false);
      toggle.focus();
    }
  });
});
