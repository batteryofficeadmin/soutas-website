const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isTouch = window.matchMedia('(hover: none)').matches;

document.getElementById('year').textContent = new Date().getFullYear();

// === SMOOTH SCROLL (Lenis) ===
let lenis = null;
if (!prefersReducedMotion && typeof Lenis !== 'undefined') {
  lenis = new Lenis({ lerp: 0.09, wheelMultiplier: 0.9 });
  function raf(time) {
    lenis.raf(time);
    requestAnimationFrame(raf);
  }
  requestAnimationFrame(raf);
}

function scrollToTarget(target) {
  if (lenis) {
    lenis.scrollTo(target, { offset: -70, duration: 1.3 });
  } else if (target === 0) {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } else {
    target.scrollIntoView({ behavior: 'smooth' });
  }
}

// === PRELOADER ===
const preloader = document.getElementById('preloader');
function finishPreload() {
  if (!preloader || preloader.classList.contains('done')) return;
  preloader.classList.add('done');
  document.body.classList.add('loaded');
  AOS.init({
    duration: 800,
    offset: 90,
    once: true,
    easing: 'ease-out-cubic'
  });
}
window.addEventListener('load', () => setTimeout(finishPreload, prefersReducedMotion ? 0 : 1150));
setTimeout(finishPreload, 3500);

// === SCROLL-DRIVEN UI (progress bar, navbar, back-to-top) ===
const progressBar = document.getElementById('scroll-progress');
const navbar = document.querySelector('.custom-navbar');
const backToTopBtn = document.getElementById('backToTop');
let lastScrollY = window.scrollY;
let ticking = false;

function onScroll() {
  const y = window.scrollY;
  const docHeight = document.documentElement.scrollHeight - window.innerHeight;

  if (progressBar) {
    progressBar.style.transform = `scaleX(${docHeight > 0 ? y / docHeight : 0})`;
  }

  if (navbar) {
    navbar.classList.toggle('scrolled', y > 60);
    const navOpen = document.getElementById('navbarNav')?.classList.contains('show');
    const scrollingDown = y > lastScrollY && y > 320;
    navbar.classList.toggle('hidden', scrollingDown && !navOpen);
  }

  if (backToTopBtn) {
    backToTopBtn.classList.toggle('visible', y > 400);
  }

  lastScrollY = y;
  ticking = false;
}

window.addEventListener('scroll', () => {
  if (!ticking) {
    requestAnimationFrame(onScroll);
    ticking = true;
  }
}, { passive: true });
onScroll();

backToTopBtn?.addEventListener('click', () => scrollToTarget(0));

// === ANCHOR LINKS ===
document.querySelectorAll('a[href^="#"]').forEach(link => {
  link.addEventListener('click', e => {
    const href = link.getAttribute('href');
    if (href.length < 2) return;
    const target = document.querySelector(href);
    if (!target) return;
    e.preventDefault();
    scrollToTarget(target);
    history.replaceState(null, '', href);
  });
});

// === ACTIVE NAV LINK ===
const sections = document.querySelectorAll('section[id]');
const navLinks = document.querySelectorAll('.navbar-nav .nav-link');

const sectionObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    navLinks.forEach(link => {
      link.classList.toggle('active', link.getAttribute('href') === `#${entry.target.id}`);
    });
  });
}, { threshold: 0.3, rootMargin: '-70px 0px -40% 0px' });

sections.forEach(section => sectionObserver.observe(section));

// === MOBILE NAV AUTO-CLOSE ===
const navbarCollapse = document.getElementById('navbarNav');
if (navbarCollapse) {
  navbarCollapse.querySelectorAll('.nav-link, .btn-nav-cta').forEach(link => {
    link.addEventListener('click', () => {
      if (navbarCollapse.classList.contains('show')) {
        bootstrap.Collapse.getOrCreateInstance(navbarCollapse).hide();
      }
    });
  });
}

// === SECTION HEADING "CHARGE" LINE ===
const headingObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('charged');
      headingObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.6 });

document.querySelectorAll('.section-heading').forEach(h => headingObserver.observe(h));

// === ANIMATED STAT COUNTERS ===
function animateCounter(el) {
  const target = parseInt(el.dataset.target, 10);
  const suffix = el.dataset.suffix || '';
  if (prefersReducedMotion) {
    el.textContent = target + suffix;
    return;
  }
  const duration = 1800;
  const startValue = target > 100 ? Math.floor(target * 0.97) : 0;
  const startTime = performance.now();

  function step(now) {
    const progress = Math.min((now - startTime) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.floor(startValue + (target - startValue) * eased) + suffix;
    if (progress < 1) requestAnimationFrame(step);
    else el.textContent = target + suffix;
  }
  requestAnimationFrame(step);
}

const statsBar = document.querySelector('.stats-bar');
const statNumbers = document.querySelectorAll('.stat-number');
if (statsBar && statNumbers.length) {
  const counterObserver = new IntersectionObserver(entries => {
    if (!entries[0].isIntersecting) return;
    statNumbers.forEach((el, i) => setTimeout(() => animateCounter(el), i * 150));
    counterObserver.disconnect();
  }, { threshold: 0.5 });
  counterObserver.observe(statsBar);
}

// === 3D TILT ON CARDS ===
if (!isTouch && !prefersReducedMotion) {
  document.querySelectorAll('[data-tilt]').forEach(card => {
    const maxTilt = 6;
    let frame = null;

    card.addEventListener('mousemove', e => {
      const rect = card.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width - 0.5;
      const py = (e.clientY - rect.top) / rect.height - 0.5;
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        card.style.transform =
          `perspective(900px) rotateX(${(-py * maxTilt).toFixed(2)}deg) rotateY(${(px * maxTilt).toFixed(2)}deg) translateY(-8px)`;
      });
    });

    card.addEventListener('mouseleave', () => {
      if (frame) cancelAnimationFrame(frame);
      card.style.transform = '';
    });
  });
}

// === PARALLAX ELEMENTS ===
const parallaxEls = document.querySelectorAll('[data-parallax]');
if (parallaxEls.length && !prefersReducedMotion) {
  function updateParallax() {
    const vh = window.innerHeight;
    parallaxEls.forEach(el => {
      const rect = el.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > vh) return;
      const speed = parseFloat(el.dataset.parallax) || 0.05;
      const offset = (rect.top + rect.height / 2 - vh / 2) * speed;
      el.style.transform = `translateY(${(-offset).toFixed(1)}px)`;
    });
  }
  window.addEventListener('scroll', () => requestAnimationFrame(updateParallax), { passive: true });
  updateParallax();
}

// === SUPPLIER CARD EXPAND: refresh scroll metrics after collapse animates ===
document.querySelectorAll('.supplier-details').forEach(el => {
  el.addEventListener('shown.bs.collapse', () => lenis?.resize());
  el.addEventListener('hidden.bs.collapse', () => lenis?.resize());
});
