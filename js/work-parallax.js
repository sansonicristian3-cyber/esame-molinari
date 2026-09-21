/* ==========================================================================
   Work section — editorial scroll composition.

   Scoped entirely to #work-canvas / .parallax-item. Reads x/y/width/speed
   per item straight from data-attributes in index.html (desktop values,
   plus -m suffixed mobile overrides) so the composition can be re-directed
   later without touching this file.

   Native scroll (window.scrollY) is the only source of truth. A smoothed
   copy of it is used purely for the visual transform — the browser's real
   scroll position is never overridden, no wheel/touch events are
   intercepted, and nothing here touches .work-card, its data-* attributes,
   or the modal/click logic already wired up in main.js.
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {

  const canvas = document.getElementById('work-canvas');
  if (!canvas) return;

  const items = Array.from(canvas.querySelectorAll('.parallax-item'));
  if (!items.length) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isMobile = () => window.matchMedia('(max-width: 767px)').matches;

  function isVisible(item) {
    const card = item.querySelector('.work-card');
    return card && !card.classList.contains('is-hidden');
  }

  /* ---------------- base layout: the full art-directed composition ---------------- */
  function layoutComposition(mobile) {
    const heightVh = parseFloat(canvas.dataset[mobile ? 'heightM' : 'height']) || 220;
    canvas.style.height = `${heightVh}vh`;

    items.forEach((item) => {
      const x = parseFloat(item.dataset[mobile ? 'xM' : 'x']) || 0;
      const y = parseFloat(item.dataset[mobile ? 'yM' : 'y']) || 0;
      const w = parseFloat(item.dataset[mobile ? 'wM' : 'w']) || 20;

      item.style.left = `${x}%`;
      item.style.top = `${y}vh`;
      item.style.width = `${w}%`;
      item._speed = parseFloat(item.dataset[mobile ? 'speedM' : 'speed']) || 1;
    });
  }

  /* ---------------- filtered layout: compact masonry, starts right under the filters ---------------- */
  function layoutFiltered(mobile) {
    const cols = mobile ? 1 : 2;
    const colX = mobile ? [9] : [4, 54];
    const colW = mobile ? 82 : 42;
    const gapVh = mobile ? 3 : 4;
    const colHeights = new Array(cols).fill(0);

    const canvasWidthPx = canvas.getBoundingClientRect().width;
    const vh = window.innerHeight / 100;

    items.forEach((item) => {
      const speed = parseFloat(item.dataset[mobile ? 'speedM' : 'speed']) || 1;
      item._speed = speed;

      if (!isVisible(item)) return; // stays wherever it last was, but display:none hides it

      let col = 0;
      for (let c = 1; c < cols; c++) if (colHeights[c] < colHeights[col]) col = c;

      item.style.left = `${colX[col]}%`;
      item.style.top = `${colHeights[col]}vh`;
      item.style.width = `${colW}%`;

      const itemWidthPx = (colW / 100) * canvasWidthPx;
      const itemHeightPx = itemWidthPx * (4 / 3); // matches the work-img aspect-[3/4]
      colHeights[col] += (itemHeightPx / vh) + gapVh;
    });

    canvas.style.height = `${Math.max(...colHeights, 40)}vh`;
  }

  function layout() {
    const mobile = isMobile();
    const filtered = items.some((item) => !isVisible(item));
    if (filtered) layoutFiltered(mobile); else layoutComposition(mobile);
    canvasTop = window.scrollY + canvas.getBoundingClientRect().top;
  }
  window.__workRelayout = layout; // called by main.js right after a filter click

  let canvasTop = 0;
  layout();

  // Re-layout on resize (debounced via rAF) and when crossing the mobile/desktop breakpoint.
  let resizeQueued = false;
  function queueLayout() {
    if (resizeQueued) return;
    resizeQueued = true;
    requestAnimationFrame(() => { layout(); resizeQueued = false; });
  }
  if (window.ResizeObserver) {
    new ResizeObserver(queueLayout).observe(canvas);
  } else {
    window.addEventListener('resize', queueLayout);
  }
  window.matchMedia('(max-width: 767px)').addEventListener?.('change', queueLayout);

  /* ---------------- only animate while the composition is near the viewport ---------------- */
  let active = true;
  if (window.IntersectionObserver) {
    const io = new IntersectionObserver((entries) => {
      active = entries[0]?.isIntersecting ?? true;
    }, { rootMargin: '30% 0px 30% 0px' });
    io.observe(canvas);
  }

  /* ---------------- entrance reveal: each item fades/clips in once, not identically ---------------- */
  if (window.IntersectionObserver) {
    const revealIO = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-revealed');
          revealIO.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.15 });
    items.forEach((item) => revealIO.observe(item));
  } else {
    items.forEach((item) => item.classList.add('is-revealed'));
  }

  /* ---------------- scroll-linked parallax (native scroll is the source of truth) ---------------- */
  if (reduceMotion) return; // composition/layout stays, no scroll-linked motion

  let smoothedY = window.scrollY;

  function frame() {
    requestAnimationFrame(frame);
    if (!active) return;

    smoothedY += (window.scrollY - smoothedY) * 0.12;
    const relative = smoothedY - canvasTop;

    items.forEach((item) => {
      const offset = relative * (item._speed - 1);
      item.style.transform = `translate3d(0, ${offset.toFixed(1)}px, 0)`;
    });
  }
  requestAnimationFrame(frame);
});
