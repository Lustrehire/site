document.addEventListener('DOMContentLoaded', () => {
  const track = document.getElementById('customer-reviews');
  const buttons = Array.from(document.querySelectorAll('[data-review-index]'));
  if (!track || !buttons.length) return;
  const cards = Array.from(track.querySelectorAll('.testimonial-card'));
  const previous = document.querySelector('.review-previous');
  const next = document.querySelector('.review-next');
  let current = 0;
  const last = () => {
    const step = cards[1].offsetLeft - cards[0].offsetLeft;
    return Math.max(0, cards.length - Math.round((track.clientWidth + parseFloat(getComputedStyle(track).columnGap)) / step));
  };
  const select = index => {
    current = Math.min(index, last());
    buttons.forEach((button, i) => {
      button.hidden = i > last();
      button.setAttribute('aria-pressed', String(i === current));
    });
    previous.disabled = current === 0;
    next.disabled = current === last();
  };
  const move = index => {
    index = Math.max(0, Math.min(last(), index));
    track.scrollTo({ left: cards[index].offsetLeft - cards[0].offsetLeft, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
    select(index);
  };
  buttons.forEach((button, index) => button.addEventListener('click', () => move(index)));
  previous.addEventListener('click', () => move(current - 1));
  next.addEventListener('click', () => move(current + 1));
  track.addEventListener('scroll', () => {
    const step = cards[1].offsetLeft - cards[0].offsetLeft;
    select(Math.round(track.scrollLeft / step));
  }, { passive: true });
  track.addEventListener('keydown', event => {
    if (event.target !== track || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    move(current + (event.key === 'ArrowRight' ? 1 : -1));
  });
  new ResizeObserver(() => select(Math.round(track.scrollLeft / (cards[1].offsetLeft - cards[0].offsetLeft)))).observe(track);
  select(0);
});
