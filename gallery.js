document.addEventListener('DOMContentLoaded', () => {
  const links = Array.from(document.querySelectorAll('[data-gallery-image]'));
  const dialog = document.getElementById('gallery-lightbox');
  if (!dialog || typeof dialog.showModal !== 'function') return; // Original image links remain usable.
  const image = document.getElementById('gallery-full-image');
  const caption = document.getElementById('gallery-caption');
  let current = 0;
  let returnFocus;
  const show = index => {
    current = (index + links.length) % links.length;
    const source = links[current].querySelector('img');
    image.src = links[current].href;
    image.alt = source.alt;
    caption.textContent = `${current + 1} of ${links.length}`;
  };
  links.forEach((link, index) => link.addEventListener('click', event => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    returnFocus = link;
    show(index);
    dialog.showModal();
    document.body.classList.add('gallery-lightbox-open');
    dialog.querySelector('[data-gallery-close]').focus();
  }));
  dialog.querySelector('[data-gallery-close]').addEventListener('click', () => dialog.close());
  dialog.querySelector('[data-gallery-prev]').addEventListener('click', () => show(current - 1));
  dialog.querySelector('[data-gallery-next]').addEventListener('click', () => show(current + 1));
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  dialog.addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      show(current + (event.key === 'ArrowLeft' ? -1 : 1));
    }
    if (event.key === 'Tab') {
      const controls = Array.from(dialog.querySelectorAll('button, a[href]'));
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  });
  dialog.addEventListener('close', () => {
    document.body.classList.remove('gallery-lightbox-open');
    returnFocus?.focus({ preventScroll: true });
  });
});
