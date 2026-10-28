/* ==========================================================================
   projects.js — case-study interactivity.
   Tabs, screenshot carousels, lightbox, code viewer with a tiny highlighter,
   and three demos built from each project's real logic:
     · CloudGuard     — score simulator using scorecard.py's weights and grades
     · Campus Bazaar  — access explorer built from supabase/schema.sql policies
     · Haven          — orchestrator routing replay from its system prompt
   ========================================================================== */
(() => {
  'use strict';

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const KM = window.KM || {};
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const toast = (m) => KM.toast && KM.toast(m);

  /* ------------------------------------------------------------------ highlighter */
  const LANGS = {
    py: [
      ['t-c', /#.*/],
      ['t-s', /"""[\s\S]*?"""|f?"(?:\\.|[^"\\\n])*"|f?'(?:\\.|[^'\\\n])*'/],
      ['t-k', /\b(?:def|return|if|elif|else|for|in|not|and|or|continue|break|import|from|as|class|async|await|try|except|finally|raise|with|while|lambda|is|None|True|False|pass|yield)\b/],
      ['t-n', /\b\d+(?:\.\d+)?\b/],
      ['t-f', /\b[A-Za-z_]\w*(?=\s*\()/],
    ],
    sql: [
      ['t-c', /--.*/],
      ['t-s', /'(?:''|[^'\n])*'|"(?:[^"\n])*"/],
      ['t-p', /\$\$/],
      ['t-k', /\b(?:create|function|returns|trigger|language|security|definer|set|as|begin|if|is|null|or|and|not|like|then|raise|exception|end|insert|into|values|return|new|policy|on|for|select|to|using|in|from|where|exists|table|alter|enable|row|level|update|delete|with|check|after|each|execute|stable|sql|plpgsql|authenticated)\b/i],
      ['t-n', /\b\d+\b/],
      ['t-f', /\b[a-z_][\w.]*(?=\()/i],
    ],
    js: [
      ['t-c', /\/\/.*|\/\*[\s\S]*?\*\//],
      ['t-s', /`(?:\\.|[^`\\])*`|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'/],
      ['t-k', /\b(?:const|let|var|function|return|if|else|await|async|export|import|from|new|null|true|false|for|of|in|try|catch|throw|typeof)\b/],
      ['t-n', /\b\d+(?:\.\d+)?\b/],
      ['t-f', /\b[A-Za-z_$][\w$]*(?=\s*\()/],
    ],
    json: [
      ['t-f', /"(?:\\.|[^"\\\n])*"(?=\s*:)/],
      ['t-s', /"(?:\\.|[^"\\\n])*"/],
      ['t-k', /\b(?:true|false|null)\b/],
      ['t-n', /-?\b\d+(?:\.\d+)?\b/],
    ],
  };

  function highlight(src, lang) {
    const rules = LANGS[lang];
    const tokens = [];
    if (rules) {
      const re = new RegExp(rules.map(([, r]) => `(${r.source})`).join('|'), lang === 'sql' ? 'gi' : 'g');
      let last = 0, m;
      while ((m = re.exec(src))) {
        if (m[0] === '') { re.lastIndex++; continue; }
        if (m.index > last) tokens.push(['', src.slice(last, m.index)]);
        const gi = m.slice(1).findIndex((x) => x !== undefined);
        tokens.push([rules[gi][0], m[0]]);
        last = re.lastIndex;
      }
      if (last < src.length) tokens.push(['', src.slice(last)]);
    } else {
      tokens.push(['', src]);
    }
    const lines = [[]];
    tokens.forEach(([cls, text]) => {
      text.split('\n').forEach((part, i) => {
        if (i > 0) lines.push([]);
        if (part) lines[lines.length - 1].push([cls, part]);
      });
    });
    return lines
      .map((l) => `<span class="ln">${l.map(([c, t]) => (c ? `<span class="${c}">${esc(t)}</span>` : esc(t))).join('') || ' '}</span>`)
      .join('');
  }

  function renderCode(pre, src) {
    const code = pre.querySelector('code') || pre;
    const raw = src != null ? src : code.textContent;
    pre.dataset.raw = raw;
    code.innerHTML = highlight(raw, pre.dataset.lang);
  }

  /* ------------------------------------------------------------------ lightbox */
  const lb = (() => {
    const dlg = $('#lightbox');
    if (!dlg || typeof dlg.showModal !== 'function') return { open: (items, i) => window.open(items[i].src, '_blank', 'noopener') };
    const img = $('#lightbox-img', dlg);
    const cap = $('#lightbox-cap', dlg);
    const count = $('#lightbox-count', dlg);
    const prev = $('[data-lb="prev"]', dlg);
    const next = $('[data-lb="next"]', dlg);
    let items = [], idx = 0, onClose = null;

    function show(i) {
      idx = (i + items.length) % items.length;
      const it = items[idx];
      img.src = it.src;
      img.alt = it.alt || '';
      cap.textContent = it.caption || '';
      count.textContent = items.length > 1 ? `${idx + 1} / ${items.length}` : '';
      prev.hidden = next.hidden = items.length < 2;
      // warm the next image
      if (items.length > 1) { const n = new Image(); n.src = items[(idx + 1) % items.length].src; }
    }
    function open(list, i = 0, cb) {
      items = list; onClose = cb || null;
      show(i);
      dlg.showModal();
      document.body.style.overflow = 'hidden';
    }
    function close() { if (dlg.open) dlg.close(); }
    dlg.addEventListener('close', () => {
      document.body.style.overflow = '';
      if (onClose) onClose(idx);
    });
    dlg.addEventListener('click', (e) => {
      const b = e.target.closest('[data-lb]');
      if (b) {
        const a = b.dataset.lb;
        if (a === 'prev') show(idx - 1);
        else if (a === 'next') show(idx + 1);
        else close();
        return;
      }
      if (e.target === dlg || e.target.classList.contains('lightbox__frame')) close();
    });
    dlg.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') { e.preventDefault(); show(idx - 1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); show(idx + 1); }
    });
    // swipe
    let sx = null;
    img.addEventListener('pointerdown', (e) => { sx = e.clientX; });
    img.addEventListener('pointerup', (e) => {
      if (sx == null) return;
      const dx = e.clientX - sx; sx = null;
      if (Math.abs(dx) > 40 && items.length > 1) show(idx + (dx < 0 ? 1 : -1));
    });
    return { open };
  })();

  // standalone lightbox groups (secondary projects, certificate, photos)
  const lbGroups = new Map();
  $$('[data-lightbox], [data-lightbox-extra]').forEach((el) => {
    const g = el.dataset.lightbox || el.dataset.lightboxExtra;
    if (!lbGroups.has(g)) lbGroups.set(g, []);
    const imgEl = el.querySelector('img');
    lbGroups.get(g).push({ el, src: el.dataset.src || (imgEl && imgEl.currentSrc) || '', caption: el.dataset.caption || '', alt: imgEl ? imgEl.alt : '' });
  });
  lbGroups.forEach((items) => {
    items.forEach((it, i) => {
      if (it.el.hasAttribute('data-lightbox')) it.el.addEventListener('click', () => lb.open(items, i));
    });
  });

  /* ------------------------------------------------------------------ tabs */
  const tabControllers = new Map();
  $$('[data-tabs]').forEach((wrap) => {
    const tabs = $$('[role="tab"]', wrap);
    const panels = tabs.map((t) => document.getElementById(t.getAttribute('aria-controls')));
    const caseEl = wrap.closest('.case');

    function select(i, focus) {
      tabs.forEach((t, j) => {
        const on = i === j;
        t.setAttribute('aria-selected', on ? 'true' : 'false');
        t.tabIndex = on ? 0 : -1;
        panels[j].classList.toggle('is-active', on);
      });
      if (focus) tabs[i].focus();
      const dot = tabs[i].querySelector('.tab__dot');
      if (dot) dot.remove();
      panels[i].dispatchEvent(new CustomEvent('panel:show', { bubbles: false }));
    }

    tabs.forEach((t, i) => {
      t.addEventListener('click', () => select(i));
      t.addEventListener('keydown', (e) => {
        let n = null;
        if (e.key === 'ArrowRight') n = (i + 1) % tabs.length;
        if (e.key === 'ArrowLeft') n = (i - 1 + tabs.length) % tabs.length;
        if (e.key === 'Home') n = 0;
        if (e.key === 'End') n = tabs.length - 1;
        if (n != null) { e.preventDefault(); select(n, true); }
      });
    });
    if (caseEl) tabControllers.set(caseEl.id, select);
  });
  KM.openTab = (caseId, n) => { const s = tabControllers.get(caseId); if (s) s(n - 1); };

  /* ------------------------------------------------------------------ carousels */
  $$('[data-carousel]').forEach((root) => {
    const view = $('.browser__view', root);
    const slides = $$('.slide', root);
    const panel = root.closest('.panel');
    const thumbs = panel ? $$('.thumb', panel) : [];
    const capOut = panel ? $('[data-caption-out]', panel) : null;
    const countEl = $('[data-count]', root);
    const DUR = 5200;
    let i = 0, timer = 0, visible = false, hovering = false, stopped = reduceMotion;

    const bar = document.createElement('span');
    bar.className = 'browser__timer';
    bar.style.setProperty('--dur', `${DUR}ms`);
    view.appendChild(bar);

    const items = slides.map((s) => {
      const im = $('img', s);
      return { src: im.getAttribute('src'), alt: im.alt, caption: s.dataset.caption || '' };
    });

    function go(n, user) {
      i = (n + slides.length) % slides.length;
      slides.forEach((s, j) => s.classList.toggle('is-active', j === i));
      thumbs.forEach((t, j) => { t.classList.toggle('is-active', j === i); t.setAttribute('aria-current', j === i ? 'true' : 'false'); });
      if (countEl) countEl.textContent = String(i + 1);
      if (capOut) capOut.textContent = items[i].caption;
      // make sure the next one is ready
      const nx = $('img', slides[(i + 1) % slides.length]);
      if (nx && nx.loading === 'lazy') nx.loading = 'eager';
      if (user) stopped = true;
      schedule();
    }

    function schedule() {
      clearTimeout(timer);
      bar.classList.remove('is-running');
      if (stopped || !visible || hovering) return;
      void bar.offsetWidth; // restart the progress animation
      bar.classList.add('is-running');
      timer = setTimeout(() => go(i + 1), DUR);
    }

    $('.browser__nav--prev', root).addEventListener('click', (e) => { e.stopPropagation(); go(i - 1, true); });
    $('.browser__nav--next', root).addEventListener('click', (e) => { e.stopPropagation(); go(i + 1, true); });
    thumbs.forEach((t, j) => t.addEventListener('click', () => go(j, true)));
    slides.forEach((s, j) => s.addEventListener('click', () => {
      stopped = true; schedule();
      lb.open(items, j, (last) => go(last, true));
    }));
    view.addEventListener('pointerenter', () => { hovering = true; schedule(); });
    view.addEventListener('pointerleave', () => { hovering = false; schedule(); });
    view.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); go(i + 1, true); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(i - 1, true); }
    });
    let sx = null;
    view.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') sx = e.clientX; });
    view.addEventListener('pointerup', (e) => {
      if (sx == null) return;
      const dx = e.clientX - sx; sx = null;
      if (Math.abs(dx) > 40) { e.preventDefault(); go(i + (dx < 0 ? 1 : -1), true); }
    });

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([en]) => { visible = en.isIntersecting; schedule(); }, { threshold: 0.45 }).observe(view);
    }
    go(0);
  });

  /* ------------------------------------------------------------------ code viewers */
  $$('[data-code]').forEach((box) => {
    const files = $$('.code__file', box);
    const srcs = $$('.code__src', box);
    const link = $('[data-code-link]', box);
    srcs.forEach((pre) => renderCode(pre));
    function show(n) {
      files.forEach((f, j) => { f.classList.toggle('is-active', j === n); f.setAttribute('aria-selected', j === n ? 'true' : 'false'); });
      srcs.forEach((p, j) => p.classList.toggle('is-active', j === n));
      if (link && srcs[n].dataset.href) link.href = srcs[n].dataset.href;
    }
    files.forEach((f, j) => { f.setAttribute('role', 'tab'); f.addEventListener('click', () => show(j)); });
    const copyBtn = $('[data-code-copy]', box);
    if (copyBtn) copyBtn.addEventListener('click', () => {
      const active = srcs.find((p) => p.classList.contains('is-active'));
      if (active && KM.copyText) KM.copyText(active.dataset.raw, 'Code copied to clipboard');
    });
    show(0);
  });

  /* ================================================================== DEMO 1 · CloudGuard */
  const cgRoot = $('[data-demo="cloudguard"]');
  if (cgRoot) {
    // Weights and grade thresholds are the real ones from scorecard.py.
    const WEIGHTS = { CRITICAL: 20, HIGH: 10, MEDIUM: 5, LOW: 2 };
    const grade = (s) => (s >= 90 ? 'Excellent' : s >= 70 ? 'Good' : s >= 50 ? 'Needs Improvement' : 'Critical Risk');
    const gradeColor = (s) => (s >= 90 ? 'var(--accent)' : s >= 70 ? '#c6e86b' : s >= 50 ? 'var(--warn)' : 'var(--bad)');
    const FIX_FW = "Restrict the source range to specific trusted IPs instead of 0.0.0.0/0, or remove the rule if it's unused.";
    const FIX_SA = "Avoid using Google's auto-created default service account. Create a dedicated service account with only the permissions it needs.";
    const FIX_OWN = 'Review whether this member truly needs Owner/Editor. Prefer narrower, specific roles (use principle of least privilege).';
    // Sample findings, in the exact shape and wording the scanners emit.
    const F = [
      { sev: 'CRITICAL', res: 'my-public-bucket', desc: 'Bucket is publicly accessible to allUsers', fix: "Remove allUsers/allAuthenticatedUsers from the bucket's IAM policy, or enable Public Access Prevention." },
      { sev: 'CRITICAL', res: 'allow-all-ingress', desc: 'ALL protocols and ports open to the entire internet', fix: FIX_FW },
      { sev: 'HIGH', res: 'default-allow-ssh', desc: 'TCP port 22 (SSH) open to the entire internet', fix: FIX_FW },
      { sev: 'HIGH', res: 'default-allow-rdp', desc: 'TCP port 3389 (RDP) open to the entire internet', fix: FIX_FW },
      { sev: 'HIGH', res: '…-compute@developer.gserviceaccount.com', desc: "Default service account has role 'roles/editor'", fix: FIX_SA },
      { sev: 'HIGH', res: '…@appspot.gserviceaccount.com', desc: "Default service account has role 'roles/editor'", fix: FIX_SA },
      { sev: 'MEDIUM', res: 'user:alice@example.com', desc: "Member has broad role 'roles/owner'", fix: FIX_OWN },
      { sev: 'MEDIUM', res: 'user:bob@example.com', desc: "Member has broad role 'roles/owner'", fix: FIX_OWN },
      { sev: 'MEDIUM', res: 'my-gcp-project', desc: 'No custom log sinks configured - logs only live in the default bucket.', fix: 'Create a log sink to export logs to a separate bucket/BigQuery for longer-term retention and tamper resistance.' },
      { sev: 'LOW', res: 'my-gcp-project', desc: 'Default log bucket retention is only 30 days.', fix: 'Consider increasing retention (e.g. to 90+ days), or export logs via a sink.' },
    ];
    const PRESETS = {
      fresh: [0, 2, 3, 4, 5, 6, 7, 8, 9], // CloudGuard's worked example: 100 - (1x20 + 4x10 + 3x5 + 1x2) = 23
      hardened: [9],
      clear: [],
    };
    const on = new Set(PRESETS.fresh);

    cgRoot.innerHTML = `
      <div class="demo__bar">
        <span class="demo__title">score simulator · scorecard.py</span>
        <div class="seg" role="group" aria-label="Presets">
          <button type="button" data-preset="fresh" aria-pressed="true">Fresh project</button>
          <button type="button" data-preset="hardened" aria-pressed="false">Hardened</button>
          <button type="button" data-preset="clear" aria-pressed="false">Clear</button>
        </div>
      </div>
      <div class="sim__grid">
        <div class="sim__score">
          <svg class="gauge" viewBox="0 0 150 150" aria-hidden="true">
            <circle class="gauge__track" cx="75" cy="75" r="62"/>
            <circle class="gauge__bar" cx="75" cy="75" r="62" stroke-dasharray="389.56" stroke-dashoffset="389.56"/>
            <text class="gauge__num" x="75" y="84">0</text>
            <text class="gauge__of" x="75" y="104">/ 100</text>
          </svg>
          <div>
            <span class="sim__grade" data-grade>…</span>
            <p class="sim__formula" data-formula></p>
          </div>
        </div>
        <div class="sim__list" role="group" aria-label="Findings">
          ${F.map((f, i) => `
            <button class="sim__row" type="button" role="switch" data-i="${i}" aria-checked="false" title="${esc(`[${f.sev}] ${f.res}: ${f.desc}`)}">
              <span class="switch" aria-hidden="true"></span>
              <span class="sev sev--${f.sev.toLowerCase()}">${f.sev}</span>
              <span class="sim__txt"><b>${esc(f.res)}</b>${esc(f.desc)}</span>
              <span class="sim__pts">-${WEIGHTS[f.sev]}</span>
            </button>`).join('')}
          <div class="sim__row sim__row--static" aria-label="ICMP rule skipped">
            <span></span>
            <span class="sev sev--skip">skipped</span>
            <span class="sim__txt"><b>allow-icmp</b>ICMP from 0.0.0.0/0: no ports to expose, so it's not a finding</span>
            <span class="sim__pts">0</span>
          </div>
        </div>
      </div>
      <p class="sim__fix" data-fix aria-live="polite"><b>fix</b>Toggle a finding to see the fix CloudGuard suggests.</p>
      <p class="demo__note">Severity weights and grade thresholds are the real ones from <code>scorecard.py</code>; the findings are samples in the exact shape and wording the scanners emit. “Fresh project” reproduces the worked example on CloudGuard's site.</p>`;

    const rows = $$('.sim__row[data-i]', cgRoot);
    const bar = $('.gauge__bar', cgRoot);
    const num = $('.gauge__num', cgRoot);
    const gradeEl = $('[data-grade]', cgRoot);
    const formula = $('[data-formula]', cgRoot);
    const fixEl = $('[data-fix]', cgRoot);
    const C = 2 * Math.PI * 62;
    let shown = 0, raf = 0;

    function animateNum(to) {
      cancelAnimationFrame(raf);
      if (reduceMotion) { shown = to; num.textContent = to; return; }
      const from = shown, t0 = performance.now(), d = 650;
      const step = (t) => {
        const p = Math.min(1, (t - t0) / d);
        shown = Math.round(from + (to - from) * (1 - Math.pow(1 - p, 3)));
        num.textContent = shown;
        if (p < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    }

    function update() {
      const counts = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
      on.forEach((i) => { counts[F[i].sev]++; });
      const deduct = Object.keys(counts).reduce((a, k) => a + counts[k] * WEIGHTS[k], 0);
      const score = Math.max(100 - deduct, 0);
      rows.forEach((r) => r.setAttribute('aria-checked', on.has(+r.dataset.i) ? 'true' : 'false'));
      bar.style.strokeDashoffset = String(C * (1 - score / 100));
      bar.style.stroke = gradeColor(score);
      gradeEl.textContent = grade(score);
      gradeEl.style.color = gradeColor(score);
      const parts = Object.keys(counts).filter((k) => counts[k]).map((k) => `${counts[k]}×${WEIGHTS[k]}`);
      formula.innerHTML = parts.length ? `100 − (${parts.join(' + ')}) = <b>${score}</b>` : `100 − 0 = <b>100</b>`;
      animateNum(score);
    }

    rows.forEach((r) => {
      r.addEventListener('click', () => {
        const i = +r.dataset.i;
        if (on.has(i)) on.delete(i); else on.add(i);
        $$('[data-preset]', cgRoot).forEach((b) => b.setAttribute('aria-pressed', 'false'));
        fixEl.innerHTML = `<b>fix</b>${esc(F[i].fix)}`;
        update();
      });
      r.addEventListener('pointerenter', () => { fixEl.innerHTML = `<b>fix</b>${esc(F[+r.dataset.i].fix)}`; });
    });
    $$('[data-preset]', cgRoot).forEach((b) => b.addEventListener('click', () => {
      on.clear();
      PRESETS[b.dataset.preset].forEach((i) => on.add(i));
      $$('[data-preset]', cgRoot).forEach((x) => x.setAttribute('aria-pressed', x === b ? 'true' : 'false'));
      update();
    }));

    // animate the gauge in the first time the panel opens
    let started = false;
    const start = () => { if (started) return; started = true; update(); };
    const panel = cgRoot.closest('.panel');
    if (panel) panel.addEventListener('panel:show', start);
    if (panel && panel.classList.contains('is-active')) start();
  }

  /* ================================================================== DEMO 2 · Campus Bazaar */
  const cbRoot = $('[data-demo="campus-bazaar"]');
  if (cbRoot) {
    const SQL = {
      browse: `create policy "see live listings" on public.listings
  for select using (
    status in ('active', 'sold')
    or seller_id = (select auth.uid())
    or (select public.is_admin())
  );`,
      publish: `create policy "post as yourself" on public.listings
  for insert to authenticated
  with check (seller_id = (select auth.uid()) and status = 'pending');

-- moving a listing to 'active' happens server-side after the ai check,
-- or when an admin approves it (admins can update any listing):
create policy "update your own listing" on public.listings
  for update to authenticated
  using (seller_id = (select auth.uid()) or (select public.is_admin()));`,
      edit: `create policy "update your own listing" on public.listings
  for update to authenticated
  using (seller_id = (select auth.uid()) or (select public.is_admin()));
create policy "delete your own listing" on public.listings
  for delete to authenticated
  using (seller_id = (select auth.uid()) or (select public.is_admin()));`,
      chat: `create policy "start a chat on someone else's live listing" on public.conversations
  for insert to authenticated
  with check (
    buyer_id = (select auth.uid())
    and exists (
      select 1 from public.listings l
      where l.id = listing_id
        and l.seller_id = conversations.seller_id
        and l.seller_id <> (select auth.uid())
        and l.status = 'active'
    )
  );`,
      read: `create policy "see your chats" on public.conversations
  for select to authenticated
  using ((select auth.uid()) in (buyer_id, seller_id));

create policy "read messages in your chats" on public.messages
  for select to authenticated
  using ((select public.is_member(conversation_id)));
-- no policy for admins on purpose: even admins can't read private chats.`,
      reports: `-- reports: only admins can read or update them
create policy "admins read reports" on public.reports
  for select to authenticated using ((select public.is_admin()));`,
      signup: `create function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.email is null or lower(new.email) not like '%@nsut.ac.in' then
    raise exception 'only @nsut.ac.in emails can join campus bazaar';
  end if;
  insert into public.profiles (id, username)
  values (new.id, public.random_username());
  return new;
end;
$$;`,
    };
    const ACTIONS = [
      { key: 'browse', label: 'Browse live listings',
        v: { student: 'allow', owner: 'allow', admin: 'allow' },
        why: { student: 'Anyone can see listings that are <b>active</b> or <b>sold</b>.', owner: 'Sellers also see their own <b>pending</b> and <b>flagged</b> listings.', admin: 'Moderators see everything, including pending and flagged listings.' } },
      { key: 'publish', label: 'Publish a listing straight to live',
        v: { student: 'deny', owner: 'deny', admin: 'allow' },
        why: { student: 'Inserts are only allowed with <b>status = pending</b>. The server sets it live after the AI check.', owner: 'Same rule for your own listing: it starts as <b>pending</b>, and only the server can make it <b>active</b>.', admin: 'Moderators approve listings from the review queue, because admins can update any listing.' } },
      { key: 'edit', label: 'Edit or delete a listing',
        v: { student: 'deny', owner: 'own', admin: 'allow' },
        why: { student: "You can't touch another student's listing.", owner: 'Only your own listings: <b>seller_id = auth.uid()</b>.', admin: 'Moderators can update or remove any listing.' } },
      { key: 'chat', label: 'Start a chat about a listing',
        v: { student: 'allow', owner: 'deny', admin: 'allow' },
        why: { student: "Allowed on someone else's <b>active</b> listing, with you as the buyer.", owner: "You can't open a chat on your own listing.", admin: 'Same rule as any student: someone else\'s active listing only.' } },
      { key: 'read', label: 'Read a private chat',
        v: { student: 'deny', owner: 'own', admin: 'deny' },
        why: { student: 'Only the buyer and the seller of a conversation can read it.', owner: 'You can read chats you are part of, as buyer or seller.', admin: '<b>Denied on purpose.</b> There is no admin policy, so even moderators can\'t read private chats.' } },
      { key: 'reports', label: 'Read user reports',
        v: { student: 'deny', owner: 'deny', admin: 'allow' },
        why: { student: 'Reports are visible to moderators only.', owner: 'Reports are visible to moderators only.', admin: 'Moderators read and resolve reports from the admin dashboard.' } },
      { key: 'signup', label: 'Sign up with a non-NSUT email',
        v: { student: 'deny', owner: 'deny', admin: 'deny' },
        why: { student: 'A database trigger rejects any email outside <b>@nsut.ac.in</b>, so editing the frontend can\'t bypass it.', owner: 'A database trigger rejects any email outside <b>@nsut.ac.in</b>, so editing the frontend can\'t bypass it.', admin: 'Nobody can, admins included. The rule lives in the database.' } },
    ];
    const LABEL = { allow: 'allowed', deny: 'denied', own: 'own only' };
    let role = 'student', sel = 4;

    cbRoot.innerHTML = `
      <div class="demo__bar">
        <span class="demo__title">who can do what · row-level security</span>
        <div class="seg" role="radiogroup" aria-label="View as">
          <button type="button" role="radio" data-role="student" aria-checked="true">Student</button>
          <button type="button" role="radio" data-role="owner" aria-checked="false">Listing owner</button>
          <button type="button" role="radio" data-role="admin" aria-checked="false">Moderator</button>
        </div>
      </div>
      <div class="rls__list" role="listbox" aria-label="Actions">
        ${ACTIONS.map((a, i) => `
          <button class="rls__row" type="button" role="option" data-i="${i}" aria-selected="false">
            <span>${esc(a.label)}</span>
            <span class="verdict" data-v></span>
          </button>`).join('')}
      </div>
      <div class="rls__detail">
        <p class="rls__why" data-why aria-live="polite"></p>
        <pre class="code__src" data-lang="sql" data-sql><code></code></pre>
      </div>
      <p class="demo__note">Enforced by Postgres itself, not the frontend. Policies are excerpts from <code>supabase/schema.sql</code>.</p>`;

    const rows = $$('.rls__row', cbRoot);
    const why = $('[data-why]', cbRoot);
    const pre = $('[data-sql]', cbRoot);

    function paint() {
      rows.forEach((r, i) => {
        const v = ACTIONS[i].v[role];
        const badge = $('[data-v]', r);
        badge.className = `verdict verdict--${v}`;
        badge.textContent = LABEL[v];
        r.setAttribute('aria-selected', i === sel ? 'true' : 'false');
      });
      const a = ACTIONS[sel];
      why.innerHTML = a.why[role];
      renderCode(pre, SQL[a.key]);
    }
    rows.forEach((r, i) => {
      r.addEventListener('click', () => { sel = i; paint(); });
      r.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault();
          sel = (sel + (e.key === 'ArrowDown' ? 1 : -1) + rows.length) % rows.length;
          paint();
          rows[sel].focus();
        }
      });
    });
    $$('[data-role]', cbRoot).forEach((b) => b.addEventListener('click', () => {
      role = b.dataset.role;
      $$('[data-role]', cbRoot).forEach((x) => x.setAttribute('aria-checked', x === b ? 'true' : 'false'));
      paint();
    }));
    paint();
  }

  /* ================================================================== DEMO 3 · Haven */
  const hvRoot = $('[data-demo="haven"]');
  if (hvRoot) {
    const AGENTS = ['scheduler', 'planner', 'priority', 'habits', 'notification', 'voice', 'email', 'review', 'slides'];
    const TOOLS = ['mcp/calendar', 'mcp/tasks', 'mcp/gmail', 'mcp/slides'];
    const TOOL_FOR = { scheduler: 'mcp/calendar', planner: 'mcp/tasks', email: 'mcp/gmail', slides: 'mcp/slides' };
    // Agent + instruction pairs are the routing examples in Haven's orchestrator prompt.
    const EX = [
      { q: 'Move my 4pm meeting to 5pm', intent: 'reschedule an existing event', agent: 'scheduler', ins: 'Reschedule: move the 4pm event to 5pm today' },
      { q: 'What should I focus on?', intent: 'prioritise current work', agent: 'priority', ins: "Prioritize the user's tasks and events" },
      { q: 'Draft an email to john about the project', intent: 'compose an email draft', agent: 'email', ins: 'Draft an email to john about the project' },
      { q: 'Do I have any deadlines this week?', intent: 'list upcoming deadlines', agent: 'planner', ins: 'List tasks with deadlines this week' },
      { q: 'Make slides about the quarterly report', intent: 'create a presentation', agent: 'slides', ins: 'Make slides about the quarterly report' },
      { q: 'I went to the gym today', intent: 'habit check-in', agent: 'habits', ins: 'Check in for gym habit' },
      { q: 'How was my week?', intent: 'weekly review', agent: 'review', ins: 'Generate weekly productivity review' },
      { q: 'Remind me about the meeting at 3pm', intent: 'set a reminder', agent: 'notification', ins: "Set a reminder for the user's meeting at 3pm" },
      { q: 'Hello!', intent: 'greeting', agent: null, direct: "Hey! I'm Haven, your AI productivity assistant. I can help you manage your calendar, tasks, emails, and reminders. What would you like to do?" },
    ];

    hvRoot.innerHTML = `
      <div class="demo__bar">
        <span class="demo__title">orchestrator · intent routing</span>
        <span>pick a message</span>
      </div>
      <div class="route__prompts" role="group" aria-label="Example messages">
        ${EX.map((e, i) => `<button class="route__chip" type="button" data-i="${i}" aria-pressed="false">${esc(e.q)}</button>`).join('')}
      </div>
      <div class="route__input" aria-live="polite"><span class="mono">you ›</span><span class="route__typed" data-typed></span></div>
      <div class="route__grid">
        <pre class="code__src route__json" data-lang="json" data-json><code></code></pre>
        <div class="route__agents">
          <span class="route__label">router</span>
          <div class="route__pills"><span class="pill pill--core" data-core>orchestrator · gemini 2.5 flash</span></div>
          <span class="route__label">specialist agents</span>
          <div class="route__pills">${AGENTS.map((a) => `<span class="pill" data-agent="${a}">${a}</span>`).join('')}</div>
          <span class="route__label">mcp tools</span>
          <div class="route__pills">${TOOLS.map((t) => `<span class="pill" data-tool="${t}">${t}</span>`).join('')}</div>
        </div>
      </div>
      <p class="demo__note">The agent and instruction for each message come from the routing examples in Haven's orchestrator prompt. This replays them in your browser, with no API calls.</p>`;

    const chips = $$('.route__chip', hvRoot);
    const typed = $('[data-typed]', hvRoot);
    const pre = $('[data-json]', hvRoot);
    const core = $('[data-core]', hvRoot);
    const agentPills = $$('[data-agent]', hvRoot);
    const toolPills = $$('[data-tool]', hvRoot);
    let run = 0;
    const wait = (ms) => new Promise((r) => setTimeout(r, reduceMotion ? 0 : ms));

    function json(e) {
      const obj = e.agent
        ? { intent: e.intent, agents: [e.agent], tasks: [{ agent: e.agent, instruction: e.ins }], direct_response: null }
        : { intent: e.intent, agents: [], tasks: [], direct_response: e.direct };
      return JSON.stringify(obj, null, 2);
    }

    async function play(i) {
      const id = ++run;
      const e = EX[i];
      chips.forEach((c, j) => c.setAttribute('aria-pressed', j === i ? 'true' : 'false'));
      [core, ...agentPills, ...toolPills].forEach((p) => p.classList.remove('is-on'));
      pre.classList.add('is-thinking');
      typed.textContent = '';
      for (let k = 1; k <= e.q.length; k++) {
        if (id !== run) return;
        typed.textContent = e.q.slice(0, k);
        await wait(22);
      }
      await wait(180);
      if (id !== run) return;
      core.classList.add('is-on');
      renderCode(pre, '{\n  "intent": "…"\n}');
      await wait(520);
      if (id !== run) return;
      renderCode(pre, json(e));
      pre.classList.remove('is-thinking');
      if (e.agent) {
        await wait(260);
        if (id !== run) return;
        const ap = agentPills.find((p) => p.dataset.agent === e.agent);
        if (ap) ap.classList.add('is-on');
        const tool = TOOL_FOR[e.agent];
        if (tool) {
          await wait(320);
          if (id !== run) return;
          const tp = toolPills.find((p) => p.dataset.tool === tool);
          if (tp) tp.classList.add('is-on');
        }
      }
    }

    chips.forEach((c, i) => c.addEventListener('click', () => play(i)));
    renderCode(pre, '{\n  "intent": null,\n  "agents": [],\n  "tasks": []\n}');
    let started = false;
    const panel = hvRoot.closest('.panel');
    const start = () => { if (started) return; started = true; play(0); };
    if (panel) panel.addEventListener('panel:show', start);
  }
})();
