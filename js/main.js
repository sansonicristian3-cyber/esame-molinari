/* ==========================================================================
   The Oblique Project — interactions
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hasFinePointer = window.matchMedia('(pointer: fine)').matches;
  if (hasFinePointer) document.body.classList.add('has-fine-pointer');

  /* ---------------- Footer year ---------------- */
  const yearEl = document.getElementById('footer-year');
  if (yearEl) yearEl.textContent = `© ${new Date().getFullYear()} The Oblique Project`;

  /* ---------------- Header: hide on scroll down, show on scroll up ---------------- */
  const header = document.getElementById('site-header');
  const progress = document.getElementById('scroll-progress');
  let lastY = window.scrollY;

  const onScroll = () => {
    const y = window.scrollY;

    header.classList.toggle('is-scrolled', y > 40);
    if (y > lastY && y > 160) {
      header.classList.add('is-hidden');
    } else {
      header.classList.remove('is-hidden');
    }
    lastY = y;

    const doc = document.documentElement;
    const max = doc.scrollHeight - doc.clientHeight;
    progress.style.width = max > 0 ? `${(y / max) * 100}%` : '0%';
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------------- Mobile nav ---------------- */
  const menuToggle = document.getElementById('menu-toggle');
  const mobileNav = document.getElementById('mobile-nav');

  const closeMenu = () => {
    mobileNav.classList.remove('is-open');
    menuToggle.setAttribute('aria-expanded', 'false');
  };

  menuToggle?.addEventListener('click', () => {
    const isOpen = mobileNav.classList.toggle('is-open');
    menuToggle.setAttribute('aria-expanded', String(isOpen));
  });

  mobileNav?.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', closeMenu);
  });

  /* ---------------- Custom cursor dot ---------------- */
  if (hasFinePointer && !reduceMotion) {
    const dot = document.getElementById('cursor-dot');
    let mx = 0, my = 0, cx = 0, cy = 0;

    window.addEventListener('mousemove', e => { mx = e.clientX; my = e.clientY; });

    const follow = () => {
      cx += (mx - cx) * 0.22;
      cy += (my - cy) * 0.22;
      dot.style.transform = `translate(${cx}px, ${cy}px) translate(-50%, -50%)`;
      requestAnimationFrame(follow);
    };
    requestAnimationFrame(follow);

    document.querySelectorAll('a, button, [data-drag-scroll]').forEach(el => {
      el.addEventListener('mouseenter', () => dot.classList.add('is-active'));
      el.addEventListener('mouseleave', () => dot.classList.remove('is-active'));
    });
  }

  /* ---------------- Drag-to-scroll work gallery ---------------- */
  document.querySelectorAll('[data-drag-scroll]').forEach(track => {
    let isDown = false;
    let startX = 0;
    let scrollStart = 0;
    let moved = false;

    const start = (x) => {
      isDown = true;
      moved = false;
      startX = x;
      scrollStart = track.scrollLeft;
      track.classList.add('is-dragging');
    };
    const move = (x) => {
      if (!isDown) return;
      const delta = x - startX;
      if (Math.abs(delta) > 4) moved = true;
      track.scrollLeft = scrollStart - delta;
    };
    const end = () => {
      isDown = false;
      track.classList.remove('is-dragging');
    };

    track.addEventListener('mousedown', e => { start(e.pageX); e.preventDefault(); });
    window.addEventListener('mousemove', e => move(e.pageX));
    window.addEventListener('mouseup', end);

    track.addEventListener('touchstart', e => start(e.touches[0].pageX), { passive: true });
    track.addEventListener('touchmove', e => move(e.touches[0].pageX), { passive: true });
    track.addEventListener('touchend', end);

    // Prevent an accidental click firing right after a drag.
    track.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', e => { if (moved) e.preventDefault(); });
    });
  });

  /* ---------------- Work image loader / graceful placeholder ---------------- */
  document.querySelectorAll('.work-img').forEach(el => {
    const src = el.getAttribute('data-img');
    if (!src) return;

    const img = new Image();
    img.onload = () => {
      el.style.backgroundImage = `url("${src}")`;
    };
    img.onerror = () => {
      el.classList.add('is-placeholder');
      const label = document.createElement('span');
      label.className = 'ph-label';
      const title = el.closest('.work-card')?.dataset.title || 'Project image';
      label.textContent = title;
      el.appendChild(label);
    };
    img.src = src;
  });

});
