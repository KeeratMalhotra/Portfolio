/* ==========================================================================
   field.js — WebGL dot terrain for the hero.
   ~20k points on a perspective grid, displaced by simplex noise, lifted and
   lit by the cursor, with a slow scan band. Raw WebGL, no dependencies.
   Pauses when off-screen or when the tab is hidden; static under reduced motion.
   ========================================================================== */
(() => {
  const canvas = document.getElementById('field');
  if (!canvas) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const small = Math.min(window.innerWidth, window.innerHeight) < 700;

  const gl = canvas.getContext('webgl', {
    alpha: true,
    antialias: false,
    depth: false,
    premultipliedAlpha: false,
    powerPreference: 'high-performance',
  });
  if (!gl) { canvas.classList.add('is-fallback'); return; }

  // ---------------------------------------------------------------- shaders
  const VERT = `
    precision highp float;
    attribute vec2 a_grid;           // x: -1..1 across, y: 0..1 near->far
    uniform float u_time;
    uniform float u_aspect;
    uniform float u_dpr;
    uniform float u_intro;           // 0 -> 1 on load
    uniform vec2  u_mouse;           // NDC
    uniform float u_mouseAmt;        // 0..1, eased presence of the cursor
    varying float v_alpha;
    varying float v_glow;

    vec3 permute(vec3 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }
    float snoise(vec2 v) {
      const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
      vec2 i  = floor(v + dot(v, C.yy));
      vec2 x0 = v - i + dot(i, C.xx);
      vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
      vec4 x12 = x0.xyxy + C.xxzz;
      x12.xy -= i1;
      i = mod(i, 289.0);
      vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
      vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
      m = m * m; m = m * m;
      vec3 x = 2.0 * fract(p * C.www) - 1.0;
      vec3 h = abs(x) - 0.5;
      vec3 ox = floor(x + 0.5);
      vec3 a0 = x - ox;
      m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
      vec3 g;
      g.x  = a0.x  * x0.x   + h.x  * x0.y;
      g.yz = a0.yz * x12.xz + h.yz * x12.yw;
      return 130.0 * dot(m, g);
    }

    const float NEAR_Z = 1.4;
    const float FAR_Z  = 15.0;
    const float CAM_Y  = 1.55;
    const float PITCH  = 0.105;
    const float FOCAL  = 2.0;

    vec4 project(vec3 w) {
      vec3 p = vec3(w.x, w.y - CAM_Y, w.z);
      float c = cos(PITCH), s = sin(PITCH);
      vec3 v = vec3(p.x, p.y * c + p.z * s, -p.y * s + p.z * c);
      return vec4(v.x * FOCAL / u_aspect, v.y * FOCAL, 0.0, v.z);
    }

    void main() {
      float z = mix(NEAR_Z, FAR_Z, a_grid.y);
      float halfW = 1.1 * FAR_Z * max(u_aspect, 0.8) / FOCAL;
      float x = a_grid.x * halfW;

      float t = u_time;
      vec2 q = vec2(x * 0.16, z * 0.16 - t * 0.045);
      float h = snoise(q) * 0.78
              + snoise(q * 2.3 + vec2(t * 0.03, 0.0)) * 0.26
              + snoise(q * 5.1 - vec2(0.0, t * 0.05)) * 0.07;
      h *= u_intro;

      // cursor influence measured in screen space
      vec4 c0 = project(vec3(x, h, z));
      vec2 ndc = c0.xy / c0.w;
      vec2 d = (ndc - u_mouse) * vec2(u_aspect, 1.0);
      float infl = exp(-dot(d, d) * 7.0) * u_mouseAmt;
      float ripple = sin(length(d) * 22.0 - t * 3.2) * 0.5 + 0.5;
      h += infl * (0.55 + ripple * 0.12);

      vec4 clip = project(vec3(x, h, z));
      gl_Position = clip;

      // slow scan band travelling away from the viewer
      float scanZ = mix(NEAR_Z - 2.0, FAR_Z + 2.0, fract(t * 0.055));
      float scan = exp(-pow((z - scanZ) * 0.9, 2.0)) * 0.55;

      float depth = clamp(clip.w, 0.5, 40.0);
      gl_PointSize = clamp(u_dpr * (3.4 + infl * 2.6) * (4.6 / depth), 1.15 * u_dpr, 7.5 * u_dpr);

      float farFade  = 1.0 - smoothstep(FAR_Z * 0.62, FAR_Z, z);
      float nearFade = smoothstep(NEAR_Z, NEAR_Z + 0.9, z);
      float crest    = smoothstep(-0.6, 0.8, h);
      v_alpha = (0.32 + 0.68 * crest) * farFade * nearFade * (0.35 + 0.65 * u_intro);
      v_glow  = clamp(infl * 1.15 + scan * crest + smoothstep(0.62, 1.05, h) * 0.35, 0.0, 1.0);
    }
  `;

  const FRAG = `
    precision mediump float;
    varying float v_alpha;
    varying float v_glow;
    uniform vec3 u_base;
    uniform vec3 u_accent;
    void main() {
      vec2 c = gl_PointCoord - 0.5;
      float r = length(c);
      if (r > 0.5) discard;
      float a = smoothstep(0.5, 0.1, r);
      vec3 col = mix(u_base, u_accent, v_glow);
      gl_FragColor = vec4(col, a * v_alpha * (0.95 + v_glow * 0.6));
    }
  `;

  function compile(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.warn('[field] shader error:', gl.getShaderInfoLog(s));
      return null;
    }
    return s;
  }
  const vs = compile(gl.VERTEX_SHADER, VERT);
  const fs = compile(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) { canvas.classList.add('is-fallback'); return; }

  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.warn('[field] link error:', gl.getProgramInfoLog(prog));
    canvas.classList.add('is-fallback');
    return;
  }
  gl.useProgram(prog);

  // ---------------------------------------------------------------- geometry
  const COLS = small ? 140 : 260;
  const ROWS = small ? 70 : 110;
  const grid = new Float32Array(COLS * ROWS * 2);
  let k = 0;
  for (let r = 0; r < ROWS; r++) {
    const gy = r / (ROWS - 1);
    for (let c = 0; c < COLS; c++) {
      grid[k++] = (c / (COLS - 1)) * 2 - 1;
      grid[k++] = gy;
    }
  }
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, grid, gl.STATIC_DRAW);
  const aGrid = gl.getAttribLocation(prog, 'a_grid');
  gl.enableVertexAttribArray(aGrid);
  gl.vertexAttribPointer(aGrid, 2, gl.FLOAT, false, 0, 0);

  const U = {};
  ['u_time', 'u_aspect', 'u_dpr', 'u_intro', 'u_mouse', 'u_mouseAmt', 'u_base', 'u_accent']
    .forEach((n) => { U[n] = gl.getUniformLocation(prog, n); });

  gl.uniform3f(U.u_base, 0.62, 0.66, 0.72);
  gl.uniform3f(U.u_accent, 0.42, 0.96, 0.70);

  gl.disable(gl.DEPTH_TEST);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
  gl.clearColor(0, 0, 0, 0);

  // ---------------------------------------------------------------- sizing
  let dpr = 1, aspect = 1;
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, small ? 1.5 : 2);
    const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
    const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    aspect = w / h;
    gl.viewport(0, 0, w, h);
    gl.uniform1f(U.u_aspect, aspect);
    gl.uniform1f(U.u_dpr, dpr);
  }

  // ---------------------------------------------------------------- input
  const mouse = { x: 0, y: -3, tx: 0, ty: -3, amt: 0, tamt: 0 };
  if (!coarse) {
    window.addEventListener('pointermove', (e) => {
      const r = canvas.getBoundingClientRect();
      if (e.clientY > r.bottom) { mouse.tamt = 0; return; }
      mouse.tx = ((e.clientX - r.left) / r.width) * 2 - 1;
      mouse.ty = -(((e.clientY - r.top) / r.height) * 2 - 1);
      mouse.tamt = 1;
    }, { passive: true });
    document.addEventListener('pointerleave', () => { mouse.tamt = 0; });
    window.addEventListener('blur', () => { mouse.tamt = 0; });
  }

  // ---------------------------------------------------------------- loop
  const start = performance.now();
  const INTRO_MS = 1800;
  let raf = 0, visible = true, last = start;
  let clock = 8.0; // start mid-flow so the first frame already looks alive

  const easeOut = (t) => 1 - Math.pow(1 - t, 3);

  function frame(now) {
    raf = 0;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    clock += dt;

    mouse.x += (mouse.tx - mouse.x) * 0.08;
    mouse.y += (mouse.ty - mouse.y) * 0.08;
    mouse.amt += (mouse.tamt - mouse.amt) * 0.05;

    const intro = easeOut(Math.min(1, (now - start) / INTRO_MS));
    gl.uniform1f(U.u_time, clock);
    gl.uniform1f(U.u_intro, intro);
    gl.uniform2f(U.u_mouse, mouse.x, mouse.y);
    gl.uniform1f(U.u_mouseAmt, mouse.amt);

    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.POINTS, 0, COLS * ROWS);

    if (visible && !document.hidden) raf = requestAnimationFrame(frame);
  }

  function play() {
    if (reduceMotion || raf) return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }

  function renderStatic() {
    gl.uniform1f(U.u_time, 12.0);
    gl.uniform1f(U.u_intro, 1);
    gl.uniform2f(U.u_mouse, 0, -3);
    gl.uniform1f(U.u_mouseAmt, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.POINTS, 0, COLS * ROWS);
  }

  resize();
  let resizeT;
  window.addEventListener('resize', () => {
    clearTimeout(resizeT);
    resizeT = setTimeout(() => { resize(); if (reduceMotion) renderStatic(); }, 120);
  });

  if (reduceMotion) {
    renderStatic();
    return;
  }

  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) play();
  }, { threshold: 0 }).observe(canvas);

  document.addEventListener('visibilitychange', () => { if (!document.hidden) play(); });

  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    cancelAnimationFrame(raf);
    raf = 0;
    canvas.classList.add('is-fallback');
  });

  play();
})();
