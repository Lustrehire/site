// Move the existing sections, preserving their listeners, state and reading order.
// Both layouts share the content sequence; desktop shows every section in full.
(() => {
  const main = document.getElementById('main-content');
  if (!main) return;
  const original = Array.from(main.children);
  const gallery = document.querySelector('.cro-gallery-preview');
  const photos = gallery ? Array.from(gallery.children) : [];
  const mobile = matchMedia('(max-width: 767px)');
  const availability = document.getElementById('availability-checker');
  const heroSlot = document.getElementById('desktop-hero-form-slot');
  const estimator = document.getElementById('candle-calculator');
  const estimatorPanel = document.getElementById('wedding-estimator-panel');
  const estimatorHome = document.createComment('Original mobile estimator position');
  estimator.before(estimatorHome);
  const desktopHero = matchMedia('(min-width: 1024px)');
  const estimatorStart = document.getElementById('calculator-start');
  const mobileEstimatorLabel = estimatorStart.textContent;
  const mobileEstimatorMarkup = estimatorStart.innerHTML;
  const trustStrip = document.createElement('div');
  trustStrip.className = 'mobile-hero-trust';
  const heroPrice = document.querySelector('.hero-price');
  const heroReviews = document.querySelector('.hero-text > .cro-trust-link');
  const priceHome = document.createComment('Hero price position');
  const reviewsHome = document.createComment('Hero reviews position');
  heroPrice.before(priceHome);
  heroReviews.before(reviewsHome);
  const entryTitle = availability.querySelector('h2 .mobile-v3-only');
  const originalEntryTitle = entryTitle.textContent;
  const quantityLabel = availability.querySelector('label[for="availability-quantity"]');
  const originalQuantityLabel = quantityLabel.textContent;
  const placeAvailability = () => {
    heroSlot.hidden = !desktopHero.matches;
    estimatorPanel.hidden = !desktopHero.matches;
    const startLabel = desktopHero.matches ? 'Estimate my candle quantity →' : mobile.matches ? 'Not sure how many you need? Try our wedding candle estimator →' : mobileEstimatorLabel;
    estimatorStart.dataset.defaultLabel = startLabel;
    if (!estimatorStart.disabled) {
      if (desktopHero.matches) estimatorStart.textContent = startLabel;
      else if (mobile.matches) estimatorStart.textContent = startLabel;
      else estimatorStart.innerHTML = mobileEstimatorMarkup;
    }
    if (!document.getElementById('availability-dialog')?.open) {
      if (desktopHero.matches) heroSlot.appendChild(availability);
      else if (mobile.matches) main.prepend(availability);
      else main.insertBefore(availability, estimatorPanel);
    }
    entryTitle.textContent = mobile.matches ? 'Check your date' : originalEntryTitle;
    quantityLabel.textContent = mobile.matches ? 'Candle quantity' : originalQuantityLabel;
    if (mobile.matches) {
      trustStrip.append(heroReviews, heroPrice);
      if (!document.getElementById('availability-dialog')?.open) availability.after(trustStrip);
    } else {
      reviewsHome.after(heroReviews);
      priceHome.after(heroPrice);
      trustStrip.remove();
    }
    if (desktopHero.matches) document.getElementById('desktop-estimator-content').appendChild(estimator);
    else estimatorHome.after(estimator);
  };
  const ids = ['candle-packages', 'availability-checker', 'wedding-estimator-panel', 'benefits', 'gallery-preview', 'candle-sizes', 'testimonials', 'how-it-works', 'faq'];
  const disclosures = [];
  const disclose = (nodes, label, before) => {
    if (!nodes.length || !before?.parentNode) return;
    const details = document.createElement('details');
    details.className = 'mobile-more';
    const summary = document.createElement('summary');
    summary.textContent = label;
    details.appendChild(summary);
    before.parentNode.insertBefore(details, before);
    nodes.forEach(node => details.appendChild(node));
    disclosures.push({ details, nodes });
  };
  const apply = () => {
    disclosures.splice(0).reverse().forEach(({ details, nodes }) => {
      nodes.forEach(node => details.parentNode?.insertBefore(node, details));
      details.remove();
    });
    const ordered = [...ids.map(id => original.find(node => node.id === id)), ...original.filter(node => !ids.includes(node.id))];
    ordered.filter(Boolean).forEach(node => {
      if (node !== availability || !document.getElementById('availability-dialog')?.open) main.appendChild(node);
    });
    const photoOrder = photos;
    photoOrder.filter(Boolean).forEach(node => gallery.appendChild(node));
    if (mobile.matches) {
      const extraPhotos = photoOrder.slice(3);
      if (extraPhotos.length) {
        const extraGrid = document.createElement('div');
        extraGrid.className = 'cro-gallery-preview';
        gallery.after(extraGrid);
        extraPhotos.forEach(photo => extraGrid.appendChild(photo));
        disclose([extraGrid], 'More candle styling', extraGrid);
      }
      const contact = document.getElementById('contact-modal');
      disclose([contact], 'Send us a message', contact);
    } else {
      document.querySelectorAll('.cro-gallery-preview:empty').forEach(grid => {
        if (grid !== gallery) grid.remove();
      });
    }
    placeAvailability();
  };
  apply();
  mobile.addEventListener('change', apply);
  desktopHero.addEventListener('change', placeAvailability);
  availability.addEventListener('lustre:availability-restored', placeAvailability);
})();
