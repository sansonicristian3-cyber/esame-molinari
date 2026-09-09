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
    if (y > lastY && y > 160) header.classList.add('is-hidden');
    else header.classList.remove('is-hidden');
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
  mobileNav?.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMenu));

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

  /* ---------------- Marquee: clone content for a seamless loop ---------------- */
  const marqueeTrack = document.getElementById('marquee-track');
  if (marqueeTrack) {
    const clone = marqueeTrack.cloneNode(true);
    clone.setAttribute('aria-hidden', 'true');
    marqueeTrack.parentNode.appendChild(clone);
    // wrap both tracks so they scroll together as one flex row
    const wrapper = document.createElement('div');
    wrapper.style.display = 'inline-flex';
    marqueeTrack.parentNode.insertBefore(wrapper, marqueeTrack);
    wrapper.appendChild(marqueeTrack);
    wrapper.appendChild(clone);
    wrapper.classList.add('marquee-wrapper');
    wrapper.style.animation = getComputedStyle(marqueeTrack).animation;
    marqueeTrack.style.animation = 'none';
    clone.style.animation = 'none';
    wrapper.style.setProperty('animation', 'marquee 26s linear infinite');
    if (reduceMotion) wrapper.style.animation = 'none';
  }

  /* ---------------- Work: image loader (first image = card thumbnail) ---------------- */
  document.querySelectorAll('.work-card').forEach(card => {
    const list = (card.dataset.images || '').split(',').map(s => s.trim()).filter(Boolean);
    const el = card.querySelector('.work-img');
    if (!el || !list.length) return;

    const img = new Image();
    img.onload = () => { el.style.backgroundImage = `url("${list[0]}")`; };
    img.onerror = () => { el.classList.add('is-placeholder'); };
    img.src = list[0];
  });

  /* ---------------- Work: category filters ---------------- */
  const filterBtns = document.querySelectorAll('.filter-btn');
  const workCards = document.querySelectorAll('.work-card');

  const applyFilter = (filter) => {
    workCards.forEach(card => {
      const match = filter === 'all' || card.dataset.category === filter;
      card.classList.toggle('is-hidden', !match);
    });
  };

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => { b.classList.remove('is-active'); b.setAttribute('aria-selected', 'false'); });
      btn.classList.add('is-active');
      btn.setAttribute('aria-selected', 'true');
      applyFilter(btn.dataset.filter);
    });
  });

  /* ---------------- Work: drag-to-scroll (distinguishes drag from click) ---------------- */
  document.querySelectorAll('[data-drag-scroll]').forEach(track => {
    let isDown = false, startX = 0, scrollStart = 0, moved = false;

    const start = (x) => { isDown = true; moved = false; startX = x; scrollStart = track.scrollLeft; track.classList.add('is-dragging'); };
    const move = (x) => {
      if (!isDown) return;
      const delta = x - startX;
      if (Math.abs(delta) > 4) moved = true;
      track.scrollLeft = scrollStart - delta;
    };
    const end = () => { isDown = false; track.classList.remove('is-dragging'); };

    track.addEventListener('mousedown', e => { start(e.pageX); e.preventDefault(); });
    window.addEventListener('mousemove', e => move(e.pageX));
    window.addEventListener('mouseup', end);
    track.addEventListener('touchstart', e => start(e.touches[0].pageX), { passive: true });
    track.addEventListener('touchmove', e => move(e.touches[0].pageX), { passive: true });
    track.addEventListener('touchend', end);

    track.querySelectorAll('.work-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (moved) { e.preventDefault(); e.stopPropagation(); return; }
        openModal(card);
      });
    });
  });

  /* ---------------- Work: modal carousel ---------------- */
  const modal = document.getElementById('work-modal');
  const modalImg = document.getElementById('modal-img');
  const modalTag = document.getElementById('modal-tag');
  const modalTitle = document.getElementById('modal-title');
  const modalDesc = document.getElementById('modal-desc');
  const modalDots = document.getElementById('modal-dots');
  const prevImgBtn = modal?.querySelector('.modal-prev-img');
  const nextImgBtn = modal?.querySelector('.modal-next-img');
  const prevProjectBtn = document.getElementById('modal-project-prev');
  const nextProjectBtn = document.getElementById('modal-project-next');

  let currentImages = [];
  let currentImgIndex = 0;
  let currentCard = null;

  function visibleCards() {
    return Array.from(document.querySelectorAll('.work-card')).filter(c => !c.classList.contains('is-hidden'));
  }

  function renderImage() {
    const src = currentImages[currentImgIndex];
    modalImg.src = src;
    modalImg.alt = currentCard?.dataset.title || '';
    modalDots.innerHTML = '';
    if (currentImages.length > 1) {
      currentImages.forEach((_, i) => {
        const dot = document.createElement('span');
        if (i === currentImgIndex) dot.classList.add('is-active');
        modalDots.appendChild(dot);
      });
    }
    const showImgNav = currentImages.length > 1;
    prevImgBtn.style.display = showImgNav ? 'flex' : 'none';
    nextImgBtn.style.display = showImgNav ? 'flex' : 'none';
  }

  function openModal(card) {
    currentCard = card;
    currentImages = (card.dataset.images || '').split(',').map(s => s.trim()).filter(Boolean);
    currentImgIndex = 0;
    modalTag.textContent = card.dataset.tag || '';
    modalTitle.textContent = card.dataset.title || '';
    modalDesc.textContent = card.dataset.desc || '';
    renderImage();
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  function stepImage(dir) {
    if (!currentImages.length) return;
    currentImgIndex = (currentImgIndex + dir + currentImages.length) % currentImages.length;
    renderImage();
  }

  function stepProject(dir) {
    const list = visibleCards();
    if (!list.length || !currentCard) return;
    let idx = list.indexOf(currentCard);
    idx = (idx + dir + list.length) % list.length;
    openModal(list[idx]);
  }

  modal?.querySelectorAll('[data-modal-close]').forEach(el => el.addEventListener('click', closeModal));
  prevImgBtn?.addEventListener('click', () => stepImage(-1));
  nextImgBtn?.addEventListener('click', () => stepImage(1));
  prevProjectBtn?.addEventListener('click', () => stepProject(-1));
  nextProjectBtn?.addEventListener('click', () => stepProject(1));

  document.addEventListener('keydown', (e) => {
    if (!modal.classList.contains('is-open')) return;
    if (e.key === 'Escape') closeModal();
    if (e.key === 'ArrowLeft') stepImage(-1);
    if (e.key === 'ArrowRight') stepImage(1);
  });

  /* ---------------- Contact form: AJAX submit + confirmation popup ---------------- */
  const contactForm = document.querySelector('.contact-form');
  const formStatus = document.getElementById('form-status');
  const popup = document.getElementById('form-popup');
  const popupCard = popup?.querySelector('.form-popup-card');
  const popupIcon = document.getElementById('form-popup-icon');
  const popupTitle = document.getElementById('form-popup-title');
  const popupText = document.getElementById('form-popup-text');
  let popupTimer = null;

  function showPopup({ ok, title, text }) {
    popupCard.classList.toggle('is-error', !ok);
    popupIcon.textContent = ok ? '✓' : '!';
    popupTitle.textContent = title;
    popupText.textContent = text;
    popup.classList.add('is-open');
    popup.setAttribute('aria-hidden', 'false');
    clearTimeout(popupTimer);
    popupTimer = setTimeout(closePopup, 5000);
  }
  function closePopup() {
    popup.classList.remove('is-open');
    popup.setAttribute('aria-hidden', 'true');
    clearTimeout(popupTimer);
  }
  popup?.querySelectorAll('[data-popup-close]').forEach(el => el.addEventListener('click', closePopup));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && popup?.classList.contains('is-open')) closePopup(); });

  contactForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = contactForm.querySelector('.form-submit');
    const originalLabel = submitBtn.textContent;
    submitBtn.textContent = 'Sending…';
    submitBtn.disabled = true;
    formStatus.textContent = '';
    formStatus.classList.remove('is-error');

    // FormSubmit's AJAX endpoint mirrors the normal action URL, prefixed with /ajax/
    const ajaxUrl = contactForm.action.replace('formsubmit.co/', 'formsubmit.co/ajax/');

    try {
      const res = await fetch(ajaxUrl, {
        method: 'POST',
        headers: { 'Accept': 'application/json' },
        body: new FormData(contactForm)
      });
      if (!res.ok) throw new Error('Request failed');

      showPopup({
        ok: true,
        title: 'Message sent',
        text: "Thanks for reaching out — we'll get back to you soon."
      });
      contactForm.reset();
    } catch (err) {
      showPopup({
        ok: false,
        title: 'Something went wrong',
        text: 'Your message could not be sent. Please try again or email us directly.'
      });
      formStatus.textContent = 'Delivery failed — please try again.';
      formStatus.classList.add('is-error');
    } finally {
      submitBtn.textContent = originalLabel;
      submitBtn.disabled = false;
    }
  });

  /* ==========================================================================
     Tetris — self-contained, keyed to the site's accent green
     ========================================================================== */
  const canvas = document.getElementById('tetris-canvas');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    const COLS = 10, ROWS = 18, CELL = canvas.width / COLS;
    const scoreEl = document.getElementById('tetris-score');

    const SHAPES = {
      I: [[1,1,1,1]],
      O: [[1,1],[1,1]],
      T: [[0,1,0],[1,1,1]],
      S: [[0,1,1],[1,1,0]],
      Z: [[1,1,0],[0,1,1]],
      J: [[1,0,0],[1,1,1]],
      L: [[0,0,1],[1,1,1]]
    };
    const SHADES = {
      I: 'rgba(198,255,0,1)',
      O: 'rgba(198,255,0,0.85)',
      T: 'rgba(198,255,0,0.7)',
      S: 'rgba(198,255,0,0.55)',
      Z: 'rgba(198,255,0,0.4)',
      J: 'rgba(198,255,0,0.9)',
      L: 'rgba(198,255,0,0.62)'
    };
    const KEYS = Object.keys(SHAPES);

    let board = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
    let piece, px, py, score = 0, dropTimer = null, gameOver = false, active = false;

    function newPiece() {
      const key = KEYS[Math.floor(Math.random() * KEYS.length)];
      return { key, shape: SHAPES[key].map(r => r.slice()) };
    }

    function spawn() {
      piece = newPiece();
      px = Math.floor((COLS - piece.shape[0].length) / 2);
      py = 0;
      if (collides(piece.shape, px, py)) {
        gameOver = true;
        clearInterval(dropTimer);
      }
    }

    function collides(shape, ox, oy) {
      for (let y = 0; y < shape.length; y++) {
        for (let x = 0; x < shape[y].length; x++) {
          if (!shape[y][x]) continue;
          const bx = ox + x, by = oy + y;
          if (bx < 0 || bx >= COLS || by >= ROWS) return true;
          if (by >= 0 && board[by][bx]) return true;
        }
      }
      return false;
    }

    function merge() {
      piece.shape.forEach((row, y) => row.forEach((v, x) => {
        if (v && py + y >= 0) board[py + y][px + x] = piece.key;
      }));
    }

    function clearLines() {
      let cleared = 0;
      board = board.filter(row => {
        const full = row.every(cell => cell);
        if (full) cleared++;
        return !full;
      });
      while (board.length < ROWS) board.unshift(Array(COLS).fill(null));
      if (cleared) {
        score += [0, 100, 300, 500, 800][cleared] || cleared * 200;
        scoreEl.textContent = score;
      }
    }

    function rotate(shape) {
      const rows = shape.length, cols = shape[0].length;
      const out = Array.from({ length: cols }, () => Array(rows).fill(0));
      for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) out[x][rows - 1 - y] = shape[y][x];
      return out;
    }

    function draw() {
      ctx.fillStyle = '#141414';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.strokeStyle = 'rgba(244,243,238,0.06)';
      for (let x = 0; x <= COLS; x++) { ctx.beginPath(); ctx.moveTo(x * CELL, 0); ctx.lineTo(x * CELL, canvas.height); ctx.stroke(); }
      for (let y = 0; y <= ROWS; y++) { ctx.beginPath(); ctx.moveTo(0, y * CELL); ctx.lineTo(canvas.width, y * CELL); ctx.stroke(); }

      board.forEach((row, y) => row.forEach((cell, x) => {
        if (cell) { ctx.fillStyle = SHADES[cell]; ctx.fillRect(x * CELL + 1, y * CELL + 1, CELL - 2, CELL - 2); }
      }));

      if (piece) {
        ctx.fillStyle = SHADES[piece.key];
        piece.shape.forEach((row, y) => row.forEach((v, x) => {
          if (v) ctx.fillRect((px + x) * CELL + 1, (py + y) * CELL + 1, CELL - 2, CELL - 2);
        }));
      }

      if (gameOver) {
        ctx.fillStyle = 'rgba(20,20,20,0.82)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#f4f3ee';
        ctx.font = '14px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Game over', canvas.width / 2, canvas.height / 2 - 10);
        ctx.fillStyle = '#c6ff00';
        ctx.fillText('Press Enter to restart', canvas.width / 2, canvas.height / 2 + 12);
      }
    }

    function tick() {
      if (gameOver) return;
      if (!collides(piece.shape, px, py + 1)) {
        py++;
      } else {
        merge();
        clearLines();
        spawn();
      }
      draw();
    }

    function hardDrop() {
      while (!collides(piece.shape, px, py + 1)) py++;
      tick();
    }

    function startGame() {
      board = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
      score = 0;
      scoreEl.textContent = 0;
      gameOver = false;
      spawn();
      draw();
      clearInterval(dropTimer);
      dropTimer = setInterval(tick, 650);
    }

    canvas.addEventListener('click', () => { canvas.focus(); if (!active) { active = true; startGame(); } });
    canvas.addEventListener('keydown', (e) => {
      if (!active) return;
      if (gameOver) { if (e.key === 'Enter') startGame(); return; }
      if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' '].includes(e.key)) e.preventDefault();

      if (e.key === 'ArrowLeft' && !collides(piece.shape, px - 1, py)) px--;
      else if (e.key === 'ArrowRight' && !collides(piece.shape, px + 1, py)) px++;
      else if (e.key === 'ArrowDown') tick();
      else if (e.key === 'ArrowUp') {
        const rotated = rotate(piece.shape);
        if (!collides(rotated, px, py)) piece.shape = rotated;
      } else if (e.key === ' ') hardDrop();
      draw();
    });

    // idle preview frame before the user starts
    draw();
  }

});
