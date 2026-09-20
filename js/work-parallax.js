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

  /* ---------------- base layout: position each item from its data-attributes ---------------- */
  function layout() {
    const mobile = isMobile();
    const canvasWidth = canvas.getBoundingClientRect().width;
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

    canvasTop = window.scrollY + canvas.getBoundingClientRect().top;
  }

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
