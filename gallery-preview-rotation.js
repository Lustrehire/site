// Rotate homepage inspiration only; keep existing lightbox links and layout.
document.addEventListener('DOMContentLoaded', async () => {
  const section = document.getElementById('gallery-preview');
  if (!section) return;
  const links = [...section.querySelectorAll('[data-gallery-image]')];
  if (!links.length) return;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const control = document.createElement('button');
  control.type = 'button';
  control.className = 'gallery-rotation-control';
  control.hidden = true;
  let paused = motion.matches, visible = false, busy = false, slot = 0, bag = [];
  const label = () => {
    control.textContent = paused ? 'Play photo rotation' : 'Pause photo rotation';
    control.setAttribute('aria-pressed', String(paused));
  };
  label();
  section.querySelector('.cro-section-heading').append(control);
  control.addEventListener('click', () => { paused = !paused; label(); });
  motion.addEventListener('change', () => { paused = motion.matches; label(); });
  new IntersectionObserver(entries => { visible = entries[0].isIntersecting; }).observe(section);
  let hovering = false;
  section.addEventListener('pointerenter', event => { if (event.pointerType === 'mouse') hovering = true; });
  section.addEventListener('pointerleave', () => { hovering = false; });
  const blocked = () => paused || !visible || document.hidden || hovering ||
    section.querySelector('[data-gallery-image]:focus') || document.querySelector('dialog[open]');
  try {
    let items = window.lustrePreviewGallery;
    if (!Array.isArray(items)) {
      const response = await fetch('/content/gallery.json', { credentials: 'omit', referrerPolicy: 'no-referrer' });
      if (!response.ok) return;
      items = await response.json();
    }
    const pool = items.filter(item => item.src?.startsWith('/img/gallery-managed/full/') && item.preview?.startsWith('/img/gallery-managed/previews/'));
    if (pool.length <= links.length) return;
    control.hidden = false;
    const shuffle = items => {
      for (let i = items.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [items[i], items[j]] = [items[j], items[i]];
      }
      return items;
    };
    const path = value => decodeURI(new URL(value, location.origin).pathname);
    setInterval(async () => {
      if (busy || blocked()) return;
      const displayed = new Set(links.map(link => path(link.href)));
      if (!bag.length) bag = shuffle([...pool]);
      let next;
      while (bag.length && !next) {
        const candidate = bag.pop();
        if (!displayed.has(path(candidate.src))) next = candidate;
      }
      if (!next) return;
      const available = links.filter(link => link.getClientRects().length);
      if (!available.length) return;
      const link = available[slot % available.length];
      const img = link.querySelector('img');
      busy = true;
      try {
        const preload = new Image();
        preload.src = next.preview;
        await preload.decode();
        if (blocked() || !link.getClientRects().length) return;
        link.href = next.src;
        link.setAttribute('aria-label', 'Open image: ' + next.alt);
        img.srcset = `${next.preview} ${next.previewWidth || 480}w, ${next.src} ${next.width}w`;
        img.src = next.preview;
        img.alt = next.alt;
        // Retain the slot dimensions so the gallery does not shift while rotating.
        if (!motion.matches) img.animate([{ opacity: .4 }, { opacity: 1 }], { duration: 450, easing: 'ease-out' });
        slot++;
      } catch { /* Keep the current photo if the replacement cannot load. */ }
      finally { busy = false; }
    }, 5000);
  } catch { /* Static gallery and lightbox remain available offline. */ }
});
