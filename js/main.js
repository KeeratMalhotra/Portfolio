/* ==========================================================================
   main.js — interactions for the portfolio.
   Reveal on scroll, decode text, active nav, local clock, copy email,
   card spotlight, live schematics and a ⌘K command menu.
   ========================================================================== */
(() => {
  'use strict';

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const root = document.documentElement;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent);
  const EMAIL = 'itskeerat43@gmail.com';

  // ------------------------------------------------------------ hero intro
  requestAnimationFrame(() => requestAnimationFrame(() => root.classList.add('is-ready')));

  // ------------------------------------------------------------ modifier key hints
  $$('[data-mod]').forEach((el) => { el.textContent = isMac ? '⌘' : 'Ctrl'; });

  // ------------------------------------------------------------ decode text
  const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&/<>*+=';
  function decode(el) {
    if (el.dataset.decoded) return;
    el.dataset.decoded = '1';
    const final = el.textContent;
    if (reduceMotion) return;
    const len = final.length;
    const total = 520 + len * 18;
    const t0 = performance.now();
    function step(now) {
      const p = Math.min(1, (now - t0) / total);
      let out = '';
      for (let i = 0; i < len; i++) {
        const ch = final[i];
        const reveal = i / len * 0.65 + 0.35;
        if (ch === ' ' || p >= reveal) out += ch;
        else out += GLYPHS[(Math.random() * GLYPHS.length) | 0];
      }
      el.textContent = out;
      if (p < 1) requestAnimationFrame(step);
      else el.textContent = final;
    }
    requestAnimationFrame(step);
  }

  // ------------------------------------------------------------ reveal on scroll
  const revealEls = $$('.reveal');
  // stagger siblings that enter together
  const groups = new Map();
  revealEls.forEach((el) => {
    const p = el.parentElement;
    if (!groups.has(p)) groups.set(p, []);
    groups.get(p).push(el);
  });
  groups.forEach((els) => els.forEach((el, i) => el.style.setProperty('--d', `${Math.min(i, 6) * 70}ms`)));

  if ('IntersectionObserver' in window && !reduceMotion) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        $$('[data-scramble]', entry.target).forEach(decode);
        io.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    revealEls.forEach((el) => io.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add('is-in'));
  }

  // ------------------------------------------------------------ nav state
  const nav = $('#nav');
  const onScroll = () => nav && nav.classList.toggle('is-scrolled', window.scrollY > 12);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  const navLinks = $$('[data-nav]');
  const sections = navLinks.map((a) => document.getElementById(a.dataset.nav)).filter(Boolean);
  if (sections.length && 'IntersectionObserver' in window) {
    const visible = new Map();
    const so = new IntersectionObserver((entries) => {
      entries.forEach((e) => visible.set(e.target.id, e.isIntersecting ? e.intersectionRatio : 0));
      let best = null, ratio = 0;
      visible.forEach((r, id) => { if (r > ratio) { ratio = r; best = id; } });
      navLinks.forEach((a) => {
        const on = a.dataset.nav === best;
        a.classList.toggle('is-active', on);
        if (on) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
      });
    }, { threshold: [0, 0.15, 0.3, 0.5, 0.75], rootMargin: '-30% 0px -40% 0px' });
    sections.forEach((s) => so.observe(s));
  }

  // ------------------------------------------------------------ local clock (IST)
  const clocks = $$('[data-clock]');
  if (clocks.length) {
    const fmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' });
    const tick = () => { const t = fmt.format(new Date()); clocks.forEach((c) => { c.textContent = t; }); };
    tick();
    setInterval(tick, 15000);
  }

  // ------------------------------------------------------------ toast + copy
  const toastEl = $('#toast');
  let toastT;
  function toast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add('is-on');
    clearTimeout(toastT);
    toastT = setTimeout(() => toastEl.classList.remove('is-on'), 2200);
  }

  async function copy(text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch { /* noop */ }
      ta.remove();
    }
    toast('Email copied to clipboard');
  }
  $$('[data-copy]').forEach((btn) => btn.addEventListener('click', () => copy(btn.dataset.copy)));

  // ------------------------------------------------------------ project spotlight
  if (window.matchMedia('(hover: hover)').matches) {
    $$('.project').forEach((card) => {
      card.addEventListener('pointermove', (e) => {
        const r = card.getBoundingClientRect();
        card.style.setProperty('--mx', `${e.clientX - r.left}px`);
        card.style.setProperty('--my', `${e.clientY - r.top}px`);
      });
    });
  }

  // ------------------------------------------------------------ live schematics
  // Overlay an animated "packet" stroke on every edge; run only while on screen.
  $$('.sch').forEach((svg) => {
    $$('path.e', svg).forEach((p, i) => {
      const f = p.cloneNode();
      f.setAttribute('class', 'f');
      f.style.animationDelay = `${-(i * 0.37) % 1.8}s`;
      p.after(f);
    });
  });
  // on narrow screens diagrams scroll sideways; drop the edge fade once scrolled to the end
  $$('.fig__scroll').forEach((sc) => {
    const update = () => sc.classList.toggle('is-end', sc.scrollLeft + sc.clientWidth >= sc.scrollWidth - 4);
    sc.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update, { passive: true });
    update();
  });

  if ('IntersectionObserver' in window && !reduceMotion) {
    const fo = new IntersectionObserver((entries) => {
      entries.forEach((e) => e.target.classList.toggle('is-live', e.isIntersecting));
    }, { threshold: 0.25 });
    $$('.fig').forEach((f) => fo.observe(f));
  }

  // ------------------------------------------------------------ command menu
  const ICON = {
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    hash: '<path d="M4 9h16M4 15h16M10 3 8 21M16 3l-2 18"/>',
    ext: '<path d="M7 17 17 7M8 7h9v9"/>',
    copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/>',
    file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
    box: '<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="m3 8 9 5 9-5M12 13v8"/>',
  };
  const go = (id) => () => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  };
  const open = (url) => () => window.open(url, '_blank', 'noopener');

  const COMMANDS = [
    { group: 'Navigate', label: 'Home', icon: 'arrow', run: go('top'), keys: 'top hero start' },
    { group: 'Navigate', label: 'Selected work', icon: 'arrow', run: go('work'), keys: 'projects portfolio' },
    { group: 'Navigate', label: 'Recognition', icon: 'arrow', run: go('recognition'), keys: 'awards achievements hackathon sih ctf' },
    { group: 'Navigate', label: 'About', icon: 'arrow', run: go('about'), keys: 'bio skills education stack' },
    { group: 'Navigate', label: 'Contact', icon: 'arrow', run: go('contact'), keys: 'email hire reach' },

    { group: 'Projects', label: 'SAJAG: Disaster Readiness Platform', icon: 'box', hint: 'SIH 2025', run: go('sajag'), keys: 'ndma node postgres' },
    { group: 'Projects', label: 'Haven: Multi-agent AI companion', icon: 'box', hint: 'AI', run: go('haven'), keys: 'mcp gemini agents' },
    { group: 'Projects', label: 'CloudGuard: GCP security scanner', icon: 'box', hint: 'Security', run: go('cloudguard'), keys: 'iam cloud gcp' },
    { group: 'Projects', label: 'Campus Bazaar: Student marketplace', icon: 'box', hint: 'Live', run: go('campus-bazaar'), keys: 'supabase rls next moderation' },
    { group: 'Projects', label: 'QUORUM: Multi-agent trading desk', icon: 'box', hint: 'ML', run: go('quorum'), keys: 'trading crypto ml bot' },

    { group: 'Actions', label: 'Copy email address', icon: 'copy', hint: EMAIL, run: () => copy(EMAIL), keys: 'mail contact' },
    { group: 'Actions', label: 'Send an email', icon: 'mail', run: () => { window.location.href = `mailto:${EMAIL}`; }, keys: 'mail contact hire' },
    { group: 'Actions', label: 'Open résumé (PDF)', icon: 'file', run: open('assets/resume.pdf'), keys: 'resume cv pdf' },

    { group: 'Links', label: 'GitHub', icon: 'ext', hint: 'KeeratMalhotra', run: open('https://github.com/KeeratMalhotra'), keys: 'code repos source' },
    { group: 'Links', label: 'LinkedIn', icon: 'ext', hint: 'malhotrakeerat', run: open('https://www.linkedin.com/in/malhotrakeerat/'), keys: 'profile' },
    { group: 'Links', label: 'Codolio', icon: 'ext', hint: 'DSA profile', run: open('https://codolio.com/profile/keeratmalhotra'), keys: 'leetcode dsa coding' },
    { group: 'Links', label: 'Campus Bazaar live site', icon: 'ext', run: open('https://campusbazaar-nsut.vercel.app'), keys: 'demo' },
    { group: 'Links', label: 'CloudGuard website', icon: 'ext', run: open('https://cloudguard-landing.vercel.app'), keys: 'demo' },
  ];

  const cmdk = $('#cmdk');
  const input = $('#cmdk-input');
  const list = $('#cmdk-list');
  let results = [];
  let active = 0;
  let lastFocus = null;

  function score(cmd, q) {
    if (!q) return 1;
    const hay = `${cmd.label} ${cmd.keys || ''} ${cmd.group} ${cmd.hint || ''}`.toLowerCase();
    const label = cmd.label.toLowerCase();
    if (label.startsWith(q)) return 4;
    if (label.includes(q)) return 3;
    if (hay.includes(q)) return 2;
    // subsequence match
    let i = 0;
    for (const ch of label) if (ch === q[i]) i++;
    return i === q.length ? 1 : 0;
  }

  function render() {
    const q = input.value.trim().toLowerCase();
    results = COMMANDS.map((c) => ({ c, s: score(c, q) })).filter((r) => r.s > 0);
    if (q) results.sort((a, b) => b.s - a.s);
    active = Math.min(active, Math.max(0, results.length - 1));

    list.innerHTML = '';
    if (!results.length) {
      const li = document.createElement('li');
      li.className = 'cmdk__empty';
      li.textContent = 'No results. Try “email”, “resume” or a project name.';
      list.appendChild(li);
      input.removeAttribute('aria-activedescendant');
      return;
    }
    let group = null;
    results.forEach(({ c }, i) => {
      if (!q && c.group !== group) {
        group = c.group;
        const g = document.createElement('li');
        g.className = 'cmdk__group';
        g.setAttribute('role', 'presentation');
        g.textContent = group;
        list.appendChild(g);
      }
      const li = document.createElement('li');
      li.className = 'cmdk__item';
      li.id = `cmd-${i}`;
      li.setAttribute('role', 'option');
      li.setAttribute('aria-selected', i === active ? 'true' : 'false');
      li.innerHTML = `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${ICON[c.icon] || ICON.arrow}</svg><span></span>${c.hint ? '<span class="cmdk__hint"></span>' : ''}`;
      li.children[1].textContent = c.label;
      if (c.hint) li.children[2].textContent = c.hint;
      li.addEventListener('pointermove', () => { if (active !== i) { active = i; paint(); } });
      li.addEventListener('click', () => execute(i));
      list.appendChild(li);
    });
    paint();
  }

  function paint() {
    $$('.cmdk__item', list).forEach((el) => {
      const on = el.id === `cmd-${active}`;
      el.setAttribute('aria-selected', on ? 'true' : 'false');
      if (on) {
        input.setAttribute('aria-activedescendant', el.id);
        el.scrollIntoView({ block: 'nearest' });
      }
    });
  }

  function execute(i) {
    const r = results[i];
    if (!r) return;
    close();
    // let the dialog close before scrolling / opening
    setTimeout(r.c.run, 10);
  }

  function openMenu() {
    if (!cmdk || !cmdk.hidden) return;
    lastFocus = document.activeElement;
    cmdk.hidden = false;
    document.body.style.overflow = 'hidden';
    input.value = '';
    active = 0;
    render();
    requestAnimationFrame(() => input.focus());
  }

  function close() {
    if (!cmdk || cmdk.hidden) return;
    cmdk.hidden = true;
    document.body.style.overflow = '';
    if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus({ preventScroll: true });
  }

  if (cmdk) {
    $$('[data-cmdk-open]').forEach((b) => b.addEventListener('click', openMenu));
    $$('[data-cmdk-close]', cmdk).forEach((b) => b.addEventListener('click', close));
    input.addEventListener('input', () => { active = 0; render(); });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); active = (active + 1) % Math.max(1, results.length); paint(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); active = (active - 1 + results.length) % Math.max(1, results.length); paint(); }
      else if (e.key === 'Enter') { e.preventDefault(); execute(active); }
      else if (e.key === 'Tab') { e.preventDefault(); } // keep focus trapped in the dialog
    });

    document.addEventListener('keydown', (e) => {
      const mod = isMac ? e.metaKey : e.ctrlKey;
      if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (cmdk.hidden) openMenu(); else close();
        return;
      }
      if (e.key === 'Escape' && !cmdk.hidden) { e.preventDefault(); close(); return; }
      // "/" opens the menu too, unless typing in a field
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName) || document.activeElement?.isContentEditable;
      if (e.key === '/' && !typing && cmdk.hidden) { e.preventDefault(); openMenu(); }
    });
  }

  // ------------------------------------------------------------ hello, fellow engineer
  if (window.console && console.log) {
    console.log(
      '%c KM %c Reading the source? Good sign.\n\n' +
      '  Hand-built: HTML, CSS, raw WebGL. No frameworks.\n' +
      '  If you are hiring for SWE, AI or security roles: ' + EMAIL + '\n',
      'background:#6cf5b2;color:#04120b;font-weight:700;padding:2px 6px;border-radius:4px',
      'color:#a3a7af'
    );
  }
})();
