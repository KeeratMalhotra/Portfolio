/* ============================================================
   Keerat Malhotra — Portfolio | main.js
   Premium dark portfolio with 3D monogram mouse tracking
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
  // ──────────────────────────────────────────────────────────
  // LOADER — runs for exactly 5 seconds with progress bar
  // ──────────────────────────────────────────────────────────
  const loader = document.getElementById('loader');
  const loaderBar = document.getElementById('loader-bar');
  const loaderPercent = document.getElementById('loader-percent');
  const LOAD_DURATION = 5000; // 5 seconds
  const loadStart = performance.now();

  function tickLoader(now) {
    const elapsed = now - loadStart;
    const progress = Math.min(elapsed / LOAD_DURATION, 1);
    const percent = Math.round(progress * 100);

    if (loaderBar) loaderBar.style.width = percent + '%';
    if (loaderPercent) loaderPercent.textContent = percent;

    if (progress < 1) {
      requestAnimationFrame(tickLoader);
    } else {
      // Done — fade out loader
      if (loader) {
        loader.style.opacity = '0';
        loader.style.visibility = 'hidden';
        setTimeout(() => loader.style.display = 'none', 800);
      }
    }
  }

  requestAnimationFrame(tickLoader);

  // ──────────────────────────────────────────────────────────
  // Utility helpers
  // ──────────────────────────────────────────────────────────

  /** Linear interpolation */
  const lerp = (a, b, t) => a + (b - a) * t;

  /** Clamp value between min and max */
  const clamp = (val, min, max) => Math.min(Math.max(val, min), max);

  /** EaseOutExpo for counter animation */
  const easeOutExpo = (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));

  /** Simple debounce */
  const debounce = (fn, ms = 100) => {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), ms);
    };
  };

  /** Detect mobile / touch device */
  const isMobile = () =>
    window.innerWidth < 768 ||
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0;

  // Shared mouse state (updated once, consumed by multiple systems)
  const mouse = { x: window.innerWidth / 2, y: window.innerHeight / 2 };

  // ──────────────────────────────────────────────────────────
  // 1. CUSTOM CURSOR
  // ──────────────────────────────────────────────────────────

  const cursor = document.getElementById('cursor');
  const cursorFollower = document.getElementById('cursor-follower');

  // Follower uses lerp so it trails the main cursor
  const follower = { x: mouse.x, y: mouse.y };

  function initCursor() {
    if (isMobile() || !cursor || !cursorFollower) {
      // Hide custom cursors on mobile
      if (cursor) cursor.style.display = 'none';
      if (cursorFollower) cursorFollower.style.display = 'none';
      return;
    }

    // Hide default cursor on desktop
    document.body.style.cursor = 'none';

    // Hover targets — scale up cursor on interactive elements
    const hoverTargets = document.querySelectorAll(
      'a, button, .glass-card, .nav-link, .hamburger, .social-link, .project-link, .skill-tag'
    );

    hoverTargets.forEach((el) => {
      el.style.cursor = 'none';
      el.addEventListener('mouseenter', () => {
        cursor.classList.add('cursor-hover');
        cursorFollower.classList.add('cursor-hover');
      });
      el.addEventListener('mouseleave', () => {
        cursor.classList.remove('cursor-hover');
        cursorFollower.classList.remove('cursor-hover');
      });
    });

    // Animate follower with lerp every frame
    function tickCursor() {
      follower.x = lerp(follower.x, mouse.x, 0.15);
      follower.y = lerp(follower.y, mouse.y, 0.15);

      cursor.style.transform = `translate(${mouse.x}px, ${mouse.y}px) translate(-50%, -50%)`;
      cursorFollower.style.transform = `translate(${follower.x}px, ${follower.y}px) translate(-50%, -50%)`;

      requestAnimationFrame(tickCursor);
    }

    requestAnimationFrame(tickCursor);
  }

  // ──────────────────────────────────────────────────────────
  // 2. MONOGRAM 3D MOUSE TRACKING (main feature)
  // ──────────────────────────────────────────────────────────

  const monogramInner = document.getElementById('monogram-inner');

  // Current (smoothed) rotation values
  const mono = { rotX: 0, rotY: 0, targetRotX: 0, targetRotY: 0 };

  const MAX_ROTATION = 15; // degrees

  function updateMonogramTarget() {
    if (!monogramInner) return;

    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;

    // Normalise mouse position to -1 … 1
    const nx = (mouse.x - cx) / cx;
    const ny = (mouse.y - cy) / cy;

    // rotateY follows horizontal movement, rotateX is inverted vertical
    mono.targetRotY = clamp(nx * MAX_ROTATION, -MAX_ROTATION, MAX_ROTATION);
    mono.targetRotX = clamp(-ny * MAX_ROTATION, -MAX_ROTATION, MAX_ROTATION);
  }

  function tickMonogram() {
    if (!monogramInner) return;

    mono.rotX = lerp(mono.rotX, mono.targetRotX, 0.08);
    mono.rotY = lerp(mono.rotY, mono.targetRotY, 0.08);

    monogramInner.style.transform =
      `perspective(1000px) rotateX(${mono.rotX.toFixed(2)}deg) rotateY(${mono.rotY.toFixed(2)}deg)`;

    requestAnimationFrame(tickMonogram);
  }

  // Reset rotation when cursor leaves the viewport
  document.addEventListener('mouseleave', () => {
    mono.targetRotX = 0;
    mono.targetRotY = 0;
  });

  document.addEventListener('mouseenter', () => {
    updateMonogramTarget();
  });

  // ──────────────────────────────────────────────────────────
  // 3. FLOATING ORB PARALLAX
  // ──────────────────────────────────────────────────────────

  const orbMultipliers = {
    1: 0.03,
    2: 0.02,
    3: 0.04,
    4: 0.025,
    5: 0.015,
  };

  const orbs = document.querySelectorAll('.floating-orb');

  function tickOrbs() {
    if (!orbs.length) return;

    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    const dx = mouse.x - cx;
    const dy = mouse.y - cy;

    orbs.forEach((orb, i) => {
      const idx = i + 1;
      const m = orbMultipliers[idx] || 0.02;

      // Move opposite to mouse direction for depth parallax
      const tx = -dx * m;
      const ty = -dy * m;

      orb.style.transform = `translate(${tx.toFixed(1)}px, ${ty.toFixed(1)}px)`;
    });

    requestAnimationFrame(tickOrbs);
  }

  // ──────────────────────────────────────────────────────────
  // Global mousemove — single listener drives cursor + monogram + orbs
  // ──────────────────────────────────────────────────────────

  document.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    updateMonogramTarget();
  }, { passive: true });

  // ──────────────────────────────────────────────────────────
  // 4. NAVBAR BEHAVIOUR
  // ──────────────────────────────────────────────────────────

  const navbar = document.getElementById('navbar');
  const navLinks = document.querySelectorAll('.nav-link');
  const sections = document.querySelectorAll('section[id]');

  // --- Scroll class toggle ---
  function handleNavScroll() {
    if (!navbar) return;
    if (window.scrollY > 80) {
      navbar.classList.add('nav-scrolled');
    } else {
      navbar.classList.remove('nav-scrolled');
    }
  }

  // --- Active section highlighting via IntersectionObserver ---
  function initNavHighlight() {
    if (!sections.length || !navLinks.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const id = entry.target.getAttribute('id');
            navLinks.forEach((link) => {
              if (link.getAttribute('href') === `#${id}`) {
                link.classList.add('nav-active');
              } else {
                link.classList.remove('nav-active');
              }
            });
          }
        });
      },
      { threshold: 0.4 }
    );

    sections.forEach((sec) => observer.observe(sec));
  }

  // --- Smooth scrolling for nav links ---
  navLinks.forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const target = document.querySelector(link.getAttribute('href'));
      if (target) {
        target.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });

  // ──────────────────────────────────────────────────────────
  // 5. HAMBURGER MENU
  // ──────────────────────────────────────────────────────────

  const hamburger = document.getElementById('hamburger');
  const navMenu = document.getElementById('nav-menu');

  function closeMenu() {
    if (hamburger) hamburger.classList.remove('active');
    if (navMenu) navMenu.classList.remove('active');
  }

  if (hamburger && navMenu) {
    hamburger.addEventListener('click', () => {
      hamburger.classList.toggle('active');
      navMenu.classList.toggle('active');
    });

    // Close menu when a nav link inside is clicked
    navMenu.querySelectorAll('.nav-link').forEach((link) => {
      link.addEventListener('click', closeMenu);
    });

    // Close when clicking outside menu
    document.addEventListener('click', (e) => {
      if (
        navMenu.classList.contains('active') &&
        !navMenu.contains(e.target) &&
        !hamburger.contains(e.target)
      ) {
        closeMenu();
      }
    });
  }

  // ──────────────────────────────────────────────────────────
  // 6. SCROLL REVEAL (Intersection Observer)
  // ──────────────────────────────────────────────────────────

  function initReveal() {
    const reveals = document.querySelectorAll('.reveal');
    if (!reveals.length) return;

    // Group children by parent for stagger delays
    const parentMap = new Map();
    reveals.forEach((el) => {
      const parent = el.parentElement;
      if (!parentMap.has(parent)) parentMap.set(parent, []);
      parentMap.get(parent).push(el);
    });

    // Apply stagger delay
    parentMap.forEach((children) => {
      if (children.length > 1) {
        children.forEach((child, i) => {
          child.style.transitionDelay = `${i * 0.1}s`;
        });
      }
    });

    const observer = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('reveal-visible');
            obs.unobserve(entry.target); // one-time
          }
        });
      },
      { threshold: 0.15 }
    );

    reveals.forEach((el) => observer.observe(el));
  }

  // ──────────────────────────────────────────────────────────
  // 7. STATS COUNTER ANIMATION
  // ──────────────────────────────────────────────────────────

  function initCounters() {
    const statNumbers = document.querySelectorAll('.stat-number[data-target]');
    if (!statNumbers.length) return;

    const DURATION = 2000; // ms

    function animateCounter(el) {
      const target = parseInt(el.getAttribute('data-target'), 10);
      if (isNaN(target)) return;

      const start = performance.now();

      function tick(now) {
        const elapsed = now - start;
        const progress = Math.min(elapsed / DURATION, 1);
        const eased = easeOutExpo(progress);
        el.textContent = Math.round(eased * target);

        if (progress < 1) {
          requestAnimationFrame(tick);
        } else {
          el.textContent = target;
        }
      }

      requestAnimationFrame(tick);
    }

    const observer = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            animateCounter(entry.target);
            obs.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.5 }
    );

    statNumbers.forEach((el) => observer.observe(el));
  }

  // ──────────────────────────────────────────────────────────
  // 8. TYPING EFFECT
  // ──────────────────────────────────────────────────────────

  function initTypingEffect() {
    const typedEl = document.getElementById('typed-text');
    if (!typedEl) return;

    const strings = [
      'Full-Stack Developer 🚀',
      'Security Enthusiast 🛡️',
      'SIH 2025 National Finalist 🏆',
      'Problem Solver • 450+ DSA 💻',
    ];

    const TYPE_SPEED = 80;
    const DELETE_SPEED = 40;
    const PAUSE_AFTER_TYPE = 2000;
    const PAUSE_AFTER_DELETE = 500;

    let stringIdx = 0;
    let charIdx = 0;
    let isDeleting = false;

    function tick() {
      const current = strings[stringIdx];

      if (!isDeleting) {
        // Typing forward
        charIdx++;
        typedEl.textContent = current.substring(0, charIdx);

        if (charIdx === current.length) {
          // Finished typing — pause then start deleting
          isDeleting = true;
          setTimeout(tick, PAUSE_AFTER_TYPE);
          return;
        }
        setTimeout(tick, TYPE_SPEED);
      } else {
        // Deleting
        charIdx--;
        typedEl.textContent = current.substring(0, charIdx);

        if (charIdx === 0) {
          isDeleting = false;
          stringIdx = (stringIdx + 1) % strings.length;
          setTimeout(tick, PAUSE_AFTER_DELETE);
          return;
        }
        setTimeout(tick, DELETE_SPEED);
      }
    }

    // Exposed so hero animation can start it after intro
    window.__startTyping = tick;
  }

  // ──────────────────────────────────────────────────────────
  // 9. MONOGRAM PARTICLES
  // ──────────────────────────────────────────────────────────

  function initMonogramParticles() {
    const container = document.getElementById('monogram-particles');
    if (!container) return;

    const PARTICLE_COUNT = 20;
    const COLORS = ['var(--primary)', 'var(--secondary)'];

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const dot = document.createElement('span');
      dot.classList.add('monogram-particle');

      const size = 2 + Math.random() * 2; // 2-4px
      const x = Math.random() * 100;       // % position
      const y = Math.random() * 100;
      const opacity = 0.3 + Math.random() * 0.5;
      const duration = 4 + Math.random() * 6; // 4-10s
      const delay = Math.random() * -10;       // negative for offset

      Object.assign(dot.style, {
        position: 'absolute',
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: '50%',
        background: COLORS[i % COLORS.length],
        opacity: opacity,
        left: `${x}%`,
        top: `${y}%`,
        animation: `particleFloat ${duration}s ${delay}s ease-in-out infinite`,
        pointerEvents: 'none',
      });

      container.appendChild(dot);
    }

    // Inject keyframes if not already present
    if (!document.getElementById('particle-keyframes')) {
      const style = document.createElement('style');
      style.id = 'particle-keyframes';
      style.textContent = `
        @keyframes particleFloat {
          0%, 100% {
            transform: translate(0, 0) scale(1);
            opacity: var(--p-opacity, 0.4);
          }
          25% {
            transform: translate(${10 + Math.random() * 15}px, ${-10 - Math.random() * 15}px) scale(1.2);
            opacity: 0.7;
          }
          50% {
            transform: translate(${-5 - Math.random() * 10}px, ${5 + Math.random() * 10}px) scale(0.8);
            opacity: 0.3;
          }
          75% {
            transform: translate(${8 + Math.random() * 12}px, ${8 + Math.random() * 12}px) scale(1.1);
            opacity: 0.6;
          }
        }
      `;
      document.head.appendChild(style);
    }
  }

  // ──────────────────────────────────────────────────────────
  // 10. SCROLL INDICATOR HIDE
  // ──────────────────────────────────────────────────────────

  const scrollIndicator = document.getElementById('scroll-indicator');

  function handleScrollIndicator() {
    if (!scrollIndicator) return;

    if (window.scrollY > 200) {
      scrollIndicator.style.opacity = '0';
      scrollIndicator.style.pointerEvents = 'none';
      // Allow CSS transition to complete before hiding
      setTimeout(() => {
        if (window.scrollY > 200) {
          scrollIndicator.style.display = 'none';
        }
      }, 500);
    } else {
      scrollIndicator.style.display = '';
      // Force reflow so the transition plays
      void scrollIndicator.offsetHeight;
      scrollIndicator.style.opacity = '1';
      scrollIndicator.style.pointerEvents = '';
    }
  }

  // ──────────────────────────────────────────────────────────
  // 11. BACK TO TOP BUTTON
  // ──────────────────────────────────────────────────────────

  const backToTop = document.getElementById('back-to-top');

  function handleBackToTop() {
    if (!backToTop) return;

    if (window.scrollY > 500) {
      backToTop.classList.add('visible');
    } else {
      backToTop.classList.remove('visible');
    }
  }

  if (backToTop) {
    backToTop.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // ──────────────────────────────────────────────────────────
  // 12. CONTACT FORM
  // ──────────────────────────────────────────────────────────

  const contactForm = document.getElementById('contact-form');

  if (contactForm) {
    contactForm.addEventListener('submit', (e) => {
      e.preventDefault();

      const name =
        (contactForm.querySelector('[name="name"]') ||
          contactForm.querySelector('#name'))?.value || '';
      const email =
        (contactForm.querySelector('[name="email"]') ||
          contactForm.querySelector('#email'))?.value || '';
      const message =
        (contactForm.querySelector('[name="message"]') ||
          contactForm.querySelector('#message'))?.value || '';

      const subject = encodeURIComponent(`Portfolio Contact from ${name}`);
      const body = encodeURIComponent(
        `Name: ${name}\nEmail: ${email}\n\n${message}`
      );

      const mailto = `mailto:itskeerat43@gmail.com?subject=${subject}&body=${body}`;

      // Open mailto
      window.location.href = mailto;

      // Visual feedback
      const btn = contactForm.querySelector('button[type="submit"]');
      if (btn) {
        const original = btn.textContent;
        btn.textContent = 'Sent!';
        btn.disabled = true;
        setTimeout(() => {
          btn.textContent = original;
          btn.disabled = false;
        }, 2000);
      }
    });
  }

  // ──────────────────────────────────────────────────────────
  // 13. HERO TEXT REVEAL ON LOAD
  // ──────────────────────────────────────────────────────────

  function heroReveal() {
    const targets = [
      { selector: '.hero-greeting', delay: 300 },
      { selector: '.hero-name', delay: 500 },
      { selector: '.hero-role-prefix', delay: 700 },
      { selector: '.hero-role', delay: 900 },
      { selector: '.monogram-container', delay: 600 },
    ];

    // Inject reveal styles if not present
    if (!document.getElementById('hero-reveal-styles')) {
      const style = document.createElement('style');
      style.id = 'hero-reveal-styles';
      style.textContent = `
        .hero-hidden {
          opacity: 0;
          transform: translateY(30px);
          transition: opacity 0.7s cubic-bezier(0.16, 1, 0.3, 1),
                      transform 0.7s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .hero-hidden.hero-visible {
          opacity: 1;
          transform: translateY(0);
        }
        .monogram-container.hero-hidden {
          opacity: 0;
          transform: scale(0.8);
        }
        .monogram-container.hero-hidden.hero-visible {
          opacity: 1;
          transform: scale(1);
        }
      `;
      document.head.appendChild(style);
    }

    // Set initial hidden state
    targets.forEach(({ selector }) => {
      const el = document.querySelector(selector);
      if (el) el.classList.add('hero-hidden');
    });

    // Animate in with staggered delays
    targets.forEach(({ selector, delay }) => {
      const el = document.querySelector(selector);
      if (!el) return;
      setTimeout(() => {
        el.classList.add('hero-visible');
      }, delay);
    });

    // Start typing effect after hero animation completes
    setTimeout(() => {
      if (typeof window.__startTyping === 'function') {
        window.__startTyping();
      }
    }, 1500);
  }

  // ──────────────────────────────────────────────────────────
  // SCROLL HANDLER (debounced)
  // ──────────────────────────────────────────────────────────

  const onScroll = debounce(() => {
    handleNavScroll();
    handleScrollIndicator();
    handleBackToTop();
  }, 10);

  window.addEventListener('scroll', onScroll, { passive: true });

  // Also fire immediately to set initial state
  handleNavScroll();
  handleScrollIndicator();
  handleBackToTop();

  // ──────────────────────────────────────────────────────────
  // 14. FLICKERING HERO ROLE TEXT
  // ──────────────────────────────────────────────────────────

  function initFlickerText() {
    const el = document.getElementById('hero-role-flicker');
    if (!el) return;

    const roles = [
      'FULL-STACK\nDEVELOPER',
      'ALGORITHMIC\nPROBLEM SOLVER',
      'SECURITY\nENTHUSIAST',
      'SIH 2025\nNATIONAL FINALIST',
    ];

    let idx = 0;

    function showRole() {
      el.innerHTML = roles[idx].replace('\n', '<br>');
      el.classList.remove('flicker-out');
      el.classList.add('flicker-in');

      // After 3 seconds, flicker out and switch
      setTimeout(() => {
        el.classList.remove('flicker-in');
        el.classList.add('flicker-out');

        setTimeout(() => {
          idx = (idx + 1) % roles.length;
          showRole();
        }, 500); // wait for flicker-out animation
      }, 3000);
    }

    showRole();
  }

  // ──────────────────────────────────────────────────────────
  // 15. SIH IMAGE SLIDESHOW
  // ──────────────────────────────────────────────────────────

  function initGallerySlideshow() {
    const slides = document.querySelectorAll('#gallery-slides .gallery-img');
    const dots = document.querySelectorAll('#gallery-dots .gallery-dot');
    if (!slides.length) return;

    let current = 0;

    function goTo(i) {
      slides.forEach(s => s.classList.remove('active'));
      dots.forEach(d => d.classList.remove('active'));
      slides[i].classList.add('active');
      if (dots[i]) dots[i].classList.add('active');
      current = i;
    }

    // Auto-advance every 4 seconds
    setInterval(() => {
      goTo((current + 1) % slides.length);
    }, 4000);

    // Clickable dots
    dots.forEach(dot => {
      dot.addEventListener('click', () => {
        goTo(parseInt(dot.dataset.index, 10));
      });
    });
  }

  // ──────────────────────────────────────────────────────────
  // INITIALISE EVERYTHING
  // ──────────────────────────────────────────────────────────

  initCursor();
  requestAnimationFrame(tickMonogram);
  requestAnimationFrame(tickOrbs);
  initNavHighlight();
  initReveal();
  initCounters();
  initFlickerText();
  initGallerySlideshow();

  // Hero reveal kicks off last — starts the entrance sequence
  heroReveal();

  // ──────────────────────────────────────────────────────────
  // RESIZE HANDLER — re-evaluate mobile state for cursor
  // ──────────────────────────────────────────────────────────

  window.addEventListener(
    'resize',
    debounce(() => {
      if (isMobile()) {
        if (cursor) cursor.style.display = 'none';
        if (cursorFollower) cursorFollower.style.display = 'none';
        document.body.style.cursor = '';
      } else {
        if (cursor) cursor.style.display = '';
        if (cursorFollower) cursorFollower.style.display = '';
        document.body.style.cursor = 'none';
      }
    }, 200),
    { passive: true }
  );
});
