/* =====================================================================
   THAW Strategy Consulting · journey.js  (home page v2)
   Scroll-scrubbed footage on a sticky canvas, five chapters, snow and
   frost that answer the page temperature, a route rail and a HUD.
   Depends on main.js (window.THAW) for the preloader hold, the thaw
   scalar and Lenis. Exits on the static route.
   ===================================================================== */
(function () {
  'use strict';
  var d = document, w = window, html = d.documentElement;
  var J = d.querySelector('.journey');
  if (!J) return;
  var T = w.THAW || {};
  var stage = J.querySelector('.journey__stage');
  var cv = J.querySelector('.journey__canvas');
  if (html.classList.contains('static') || !stage || !cv || !cv.getContext) return;
  var ctx = cv.getContext('2d', { alpha: false });
  if (!ctx) { html.classList.add('static'); return; }
  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };
  var smooth = function (k) { k = clamp(k, 0, 1); return k * k * (3 - 2 * k); };
  var pad = function (n) { return (n < 10 ? '0' : '') + n; };

  /* ---------- chapters from the markup ---------- */
  var CH = Array.prototype.slice.call(J.querySelectorAll('.chapter')).map(function (el) {
    return {
      el: el, inner: el.querySelector('.chapter__inner'), key: el.dataset.key,
      n: parseInt(el.dataset.frames, 10) || 48, ext: el.dataset.ext || 'webp',
      len: parseFloat(el.dataset.len) || 1.8, zoom: parseFloat(el.dataset.zoom) || 0,
      temp: parseFloat(el.dataset.temp), name: el.dataset.name || '',
      imgs: [], ok: [], loaded: 0, words: [], vis: true, lastQ: -9
    };
  });
  var N = CH.length;
  var total = CH.reduce(function (s, c) { return s + c.len; }, 0);
  var bounds = [], acc = 0;
  CH.forEach(function (c) { bounds.push(acc / total); acc += c.len; });
  bounds.push(1);
  J.style.setProperty('--jl', String(Math.round((total + 1) * 100)));
  var portrait = w.innerHeight > w.innerWidth && w.innerWidth < 900;
  var dirTag = portrait ? 'p' : 'w';

  /* words of chapters 2 to 5 rise with the scroll */
  CH.forEach(function (c, i) {
    if (i === 0) return;
    var h = c.el.querySelector('.chapter__h');
    if (!h) return;
    var walk = function (node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (child) {
        if (child.nodeType === 3) {
          var frag = d.createDocumentFragment();
          child.textContent.split(/(\s+)/).forEach(function (part) {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(d.createTextNode(' ')); return; }
            var wrap = d.createElement('span'); wrap.className = 'jw';
            var inner = d.createElement('span'); inner.textContent = part;
            wrap.appendChild(inner); frag.appendChild(wrap); c.words.push(inner);
          });
          node.replaceChild(frag, child);
        } else if (child.nodeType === 1 && child.tagName !== 'BR') walk(child);
      });
    };
    walk(h);
  });

  /* ---------- the frame loader: chapter 1 first, then the rest, current chapter jumps the queue ---------- */
  var cur = 0, firstDrawn = false, holdDone = null;
  var loadBar = d.querySelector('[data-load-bar]'), loadLabel = d.querySelector('[data-load-label]');
  if (T.hold) T.hold(new Promise(function (r) { holdDone = r; }));
  var GATE = Math.min(CH[0].n, 16);
  function src(ci, fi) { return 'assets/journey/' + CH[ci].key + '/' + dirTag + '/' + pad(fi + 1) + '.' + CH[ci].ext; }
  var inflight = 0, MAXF = 4, pending = [];
  function nextJob() {
    var order = [cur];
    for (var k = 0; k < N; k++) if (order.indexOf(k) < 0) order.push(k);
    for (var o = 0; o < order.length; o++) {
      var c = CH[order[o]];
      for (var f = 0; f < c.n; f++) if (!c.ok[f] && pending.indexOf(order[o] * 1000 + f) < 0) return [order[o], f];
    }
    return null;
  }
  function pump() {
    while (inflight < MAXF) {
      var job = nextJob();
      if (!job) return;
      (function (ci, fi) {
        var tag = ci * 1000 + fi; pending.push(tag); inflight++;
        var im = new Image(); im.decoding = 'async';
        var done = function (ok) {
          inflight--; pending.splice(pending.indexOf(tag), 1);
          if (ok) {
            CH[ci].ok[fi] = true; CH[ci].imgs[fi] = im; CH[ci].loaded++;
            if (ci === 0 && loadBar) {
              var k = clamp(CH[0].loaded / GATE, 0, 1);
              loadBar.style.setProperty('--load', k.toFixed(3));
              if (loadLabel && k >= 1) loadLabel.textContent = 'Ready';
            }
            if (ci === 0 && CH[0].loaded >= GATE && holdDone) { holdDone(); holdDone = null; }
            if (!firstDrawn || (ci === cur && fi === want.fi)) render(true);
          }
          pump();
        };
        im.onload = function () { (im.decode ? im.decode().catch(function () {}) : Promise.resolve()).then(function () { done(true); }); };
        im.onerror = function () { done(false); };
        im.src = src(ci, fi);
      })(job[0], job[1]);
    }
  }
  setTimeout(function () { if (holdDone) { holdDone(); holdDone = null; } }, 7000);

  /* ---------- canvas ---------- */
  var cw = 0, chh = 0, want = { ci: 0, fi: 0, a: 0, z: 1 }, drawn = { ci: -1, fi: -1, a: -1, z: -1 };
  /* a sliding window of decoded copies (offscreen canvases) around the current frame,
     prefilled a couple of frames per tick, so a draw during the scroll is a copy, not a decode */
  var cache = {}, keepSet = {}, prefillRaf = null, winCi = 0, winFi = 0;
  function makeCached(ci, fi) {
    var im = CH[ci].imgs[fi], oc = d.createElement('canvas');
    oc.width = im.naturalWidth; oc.height = im.naturalHeight;
    oc.getContext('2d').drawImage(im, 0, 0);
    return oc;
  }
  function windowOrder(ci, fi) {
    var order = [], k;
    for (k = 0; k <= 14; k++) if (fi + k < CH[ci].n) order.push([ci, fi + k]);
    for (k = 1; k <= 4; k++) if (fi - k >= 0) order.push([ci, fi - k]);
    if (ci + 1 < N) for (k = 0; k < 3; k++) if (k < CH[ci + 1].n) order.push([ci + 1, k]);
    if (ci > 0) order.push([ci - 1, CH[ci - 1].n - 1]);
    return order;
  }
  function setWindow(ci, fi) {
    winCi = ci; winFi = fi;
    var keep = {}, key;
    windowOrder(ci, fi).forEach(function (o) { keep[o[0] * 1000 + o[1]] = 1; });
    keepSet = keep;
    for (key in cache) if (!keep[key]) { cache[key].width = 0; cache[key].height = 0; delete cache[key]; }
    schedulePrefill();
  }
  /* decode ahead only in idle time (one frame per tick where idle callbacks are missing) */
  function schedulePrefill() {
    if (prefillRaf) return;
    prefillRaf = w.requestIdleCallback ? w.requestIdleCallback(prefill, { timeout: 160 }) : requestAnimationFrame(function () { prefill(null); });
  }
  function prefill(deadline) {
    prefillRaf = null;
    var order = windowOrder(winCi, winFi), left = 0, did = 0;
    for (var i = 0; i < order.length; i++) {
      var c = order[i][0], f = order[i][1], key = c * 1000 + f;
      if (cache[key] || !CH[c].ok[f]) continue;
      var room = deadline ? (deadline.timeRemaining() > 9 || (deadline.didTimeout && did < 1)) : did < 1;
      if (room) { cache[key] = makeCached(c, f); did++; } else left++;
    }
    if (left) schedulePrefill();
  }
  function frameSource(ci, fi) {
    var key = ci * 1000 + fi;
    if (cache[key]) return cache[key];
    if (CH[ci].ok[fi]) { if (keepSet[key]) cache[key] = makeCached(ci, fi); return CH[ci].imgs[fi]; }
    return nearest(ci, fi);
  }
  T.journeyDebug = function () { var n = 0; for (var k in cache) n++; return { cached: n, want: want, drawn: drawn, loaded: CH.map(function (c) { return c.loaded; }) }; };
  function sizeCanvas() {
    var W = stage.clientWidth, H = stage.clientHeight;
    var s = Math.min(Math.min(1.5, w.devicePixelRatio || 1), 1920 / Math.max(1, W));
    cw = Math.round(W * s); chh = Math.round(H * s);
    cv.width = cw; cv.height = chh;
    drawn.ci = -1;
  }
  function nearest(ci, fi) {
    var c = CH[ci];
    if (c.ok[fi]) return c.imgs[fi];
    for (var k = 1; k < c.n; k++) {
      if (fi - k >= 0 && c.ok[fi - k]) return c.imgs[fi - k];
      if (fi + k < c.n && c.ok[fi + k]) return c.imgs[fi + k];
    }
    if (ci > 0) return nearest(ci - 1, CH[ci - 1].n - 1);
    return null;
  }
  function cover(im, zoom) {
    var iw = im.naturalWidth || im.width, ih = im.naturalHeight || im.height;
    var s = Math.max(cw / iw, chh / ih) * zoom, dw = iw * s, dh = ih * s;
    ctx.drawImage(im, (cw - dw) / 2, (chh - dh) / 2, dw, dh);
  }
  var FADE = 0.86;
  function render(force) {
    if (!force && want.ci === drawn.ci && want.fi === drawn.fi && Math.abs(want.a - drawn.a) < 0.012 && Math.abs(want.z - drawn.z) < 0.0015) return;
    var im = frameSource(want.ci, want.fi);
    if (!im) return;
    ctx.globalAlpha = 1;
    cover(im, want.z);
    if (want.a > 0 && want.ci + 1 < N) {
      var nx = frameSource(want.ci + 1, 0);
      if (nx) { ctx.globalAlpha = want.a; cover(nx, CH[want.ci + 1].zoom < 0 ? 1 - CH[want.ci + 1].zoom : 1); ctx.globalAlpha = 1; }
      /* dip through the dark between two different places, so the mix never reads as a double exposure */
      var dip = Math.sin(Math.PI * want.a) * 0.88;
      ctx.fillStyle = 'rgba(11,34,23,' + dip.toFixed(3) + ')'; ctx.fillRect(0, 0, cw, chh);
    }
    drawn.ci = want.ci; drawn.fi = want.fi; drawn.a = want.a; drawn.z = want.z;
    firstDrawn = true;
  }

  /* ---------- temperature along the journey ---------- */
  function tempAtP(p) {
    for (var i = 0; i < N; i++) {
      if (p <= bounds[i + 1]) {
        var a = CH[i].temp, b = i + 1 < N ? CH[i + 1].temp : CH[i].temp + 1;
        return a + (b - a) * clamp((p - bounds[i]) / (bounds[i + 1] - bounds[i]), 0, 1);
      }
    }
    return CH[N - 1].temp + 1;
  }
  var jTop = 0, jTravel = 1;
  function measure() {
    jTop = J.getBoundingClientRect().top + w.scrollY;
    jTravel = Math.max(1, J.offsetHeight - w.innerHeight);
  }
  T.tempSource = function () {
    measure();
    var pts = CH.map(function (c, i) { return { y: jTop + bounds[i] * jTravel + w.innerHeight * 0.5, t: c.temp }; });
    pts.push({ y: jTop + jTravel + w.innerHeight * 0.5, t: CH[N - 1].temp + 1 });
    return pts;
  };
  if (T.BAND) { T.BAND.thaw = [CH[N - 1].temp + 1, CH[N - 1].temp + 2]; T.BAND.spring = [CH[N - 1].temp + 2, 7]; }

  /* ---------- snow ---------- */
  var snow = J.querySelector('#snow'), sctx = snow ? snow.getContext('2d') : null;
  var SW = 0, SH = 0, flakes = [], sraf = null, tick = 0, snowK = 1, snowIn = 0, stageOn = true;
  var sdpr = Math.min(1.5, w.devicePixelRatio || 1);
  function mkFlake() { var z = Math.random(); return { x: Math.random() * SW, y: Math.random() * SH, r: 0.5 + z * 2.3, s: 0.22 + z * 0.95, a: 0.22 + z * 0.55, ph: Math.random() * Math.PI * 2, z: z }; }
  function sizeSnow() {
    if (!sctx) return;
    SW = stage.clientWidth; SH = stage.clientHeight;
    snow.width = Math.round(SW * sdpr); snow.height = Math.round(SH * sdpr);
    sctx.setTransform(sdpr, 0, 0, sdpr, 0, 0);
    var n = Math.min(260, Math.round(SW * SH / 7200));
    flakes = []; for (var i = 0; i < n; i++) flakes.push(mkFlake());
  }
  function drawSnow() {
    tick += 0.008;
    if (!html.classList.contains('is-loading')) snowIn = Math.min(1, snowIn + 0.011);
    sctx.clearRect(0, 0, SW, SH);
    if (snowK <= 0.002 || !stageOn) { sraf = null; return; }
    var ka = Math.pow(snowK, 1.4) * snowIn;
    for (var i = 0; i < flakes.length; i++) {
      var f = flakes[i];
      f.y += f.s * (0.35 + 0.85 * snowK);
      f.x += Math.sin(tick + f.ph) * 0.4 * f.z * snowK + 0.12;
      if (f.y > SH + 4) { f.y = -4; f.x = Math.random() * SW; }
      if (f.x > SW + 4) f.x = -4; else if (f.x < -4) f.x = SW + 4;
      sctx.beginPath(); sctx.arc(f.x, f.y, f.r * (1 - 0.5 * (1 - snowK)), 0, Math.PI * 2);
      sctx.fillStyle = 'rgba(238,243,246,' + (f.a * ka).toFixed(3) + ')'; sctx.fill();
    }
    sraf = requestAnimationFrame(drawSnow);
  }
  function wakeSnow() { if (sctx && !sraf && snowK > 0.002 && stageOn && !d.hidden) sraf = requestAnimationFrame(drawSnow); }
  d.addEventListener('visibilitychange', function () { if (d.hidden && sraf) { cancelAnimationFrame(sraf); sraf = null; } else wakeSnow(); });

  /* ---------- frost on the window: fades with the thaw, wipes under the pointer ---------- */
  var frost = J.querySelector('.journey__frost'), fctx = frost ? frost.getContext('2d') : null;
  var FW = 0, FH = 0, frostImg = new Image(), frostReady = false, frostK = 1, lastFX = null, lastFY = null;
  function paintFrost() {
    if (!fctx || !frostReady) return;
    FW = stage.clientWidth; FH = stage.clientHeight;
    frost.width = FW; frost.height = FH;
    fctx.setTransform(1, 0, 0, 1, 0, 0);
    fctx.globalCompositeOperation = 'source-over'; fctx.globalAlpha = 1;
    fctx.clearRect(0, 0, FW, FH);
    var s = Math.max(FW / frostImg.naturalWidth, FH / frostImg.naturalHeight);
    var iw = frostImg.naturalWidth * s, ih = frostImg.naturalHeight * s;
    fctx.drawImage(frostImg, (FW - iw) / 2, (FH - ih) / 2, iw, ih);
    fctx.fillStyle = 'rgba(232,238,244,.42)'; fctx.fillRect(0, 0, FW, FH);
    var g = fctx.createRadialGradient(FW * 0.5, FH * 0.5, Math.min(FW, FH) * 0.26, FW * 0.5, FH * 0.5, Math.max(FW, FH) * 0.74);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.5, 'rgba(0,0,0,.4)'); g.addColorStop(1, 'rgba(0,0,0,1)');
    fctx.globalCompositeOperation = 'destination-in';
    fctx.fillStyle = g; fctx.fillRect(0, 0, FW, FH);
    fctx.globalCompositeOperation = 'source-over';
  }
  function brush(x, y) {
    var g = fctx.createRadialGradient(x, y, 0, x, y, 90);
    g.addColorStop(0, 'rgba(0,0,0,.3)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    fctx.globalCompositeOperation = 'destination-out';
    fctx.fillStyle = g; fctx.beginPath(); fctx.arc(x, y, 90, 0, Math.PI * 2); fctx.fill();
    fctx.globalCompositeOperation = 'source-over';
  }
  if (fctx) {
    frostImg.onload = function () { frostReady = true; paintFrost(); applyFrost(); };
    frostImg.src = 'assets/stock/frost-surface.jpg';
    stage.addEventListener('pointermove', function (e) {
      if (!frostReady || frostK < 0.05) return;
      if (e.pointerType === 'touch' && e.buttons === 0) return;
      var r = stage.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
      if (lastFX === null) { lastFX = x; lastFY = y; }
      var dx = x - lastFX, dy = y - lastFY, steps = Math.max(1, Math.round(Math.hypot(dx, dy) / 10));
      for (var i = 1; i <= steps; i++) brush(lastFX + dx * i / steps, lastFY + dy * i / steps);
      lastFX = x; lastFY = y;
    }, { passive: true });
    stage.addEventListener('pointerleave', function () { lastFX = null; lastFY = null; });
  }
  function applyFrost() { if (frost) frost.style.opacity = (frostK * 0.78).toFixed(3); }

  /* ---------- grade, rail, HUD ---------- */
  var gCool = J.querySelector('.journey__grade--cool'), gWarm = J.querySelector('.journey__grade--warm');
  var rail = J.querySelector('.rail'), railLine = rail ? rail.querySelector('.rail__line i') : null;
  var stops = rail ? Array.prototype.slice.call(rail.querySelectorAll('.rail__stop')) : [];
  var hud = J.querySelector('.hud'), hudN = J.querySelector('[data-hud-n]'), hudName = J.querySelector('[data-hud-name]');
  var nav = d.querySelector('.nav');
  var lastCur = -1, lastTemp = null;
  function goChapter(i) {
    measure();
    var y = jTop + bounds[i] * jTravel + (i === 0 ? 0 : 6);
    if (T.lenis) T.lenis.scrollTo(y, { duration: 1.6 }); else w.scrollTo(0, y);
  }
  stops.forEach(function (b, i) { b.addEventListener('click', function () { goChapter(parseInt(b.dataset.go, 10) || i); }); });
  var skip = J.querySelector('.hud__skip');
  if (skip) skip.addEventListener('click', function (e) {
    e.preventDefault();
    var target = d.querySelector(skip.getAttribute('href'));
    if (!target) return;
    if (T.lenis) T.lenis.scrollTo(target, { offset: -96, duration: 1.8 }); else target.scrollIntoView();
  });

  /* ---------- chapter type ---------- */
  function layoutChapter(c, i, q) {
    var o, ty, k;
    if (i === 0) { k = smooth((q - 0.42) / 0.3); o = 1 - k; ty = -70 * k; }
    else if (i === N - 1) { k = smooth((q - 0.07) / 0.24); o = k; ty = 56 * (1 - k); }
    else { var kin = smooth((q - 0.05) / 0.22), kout = smooth((q - 0.7) / 0.17); o = kin * (1 - kout); ty = 56 * (1 - kin) - 56 * kout; }
    var show = o > 0.001;
    if (show !== c.vis) { c.vis = show; c.el.style.visibility = show ? 'visible' : 'hidden'; }
    if (!show && c.lastQ === -9) return;
    c.el.style.opacity = o.toFixed(3);
    c.el.style.transform = 'translate3d(0,' + ty.toFixed(1) + 'px,0)';
    for (var j = 0; j < c.words.length; j++) {
      var kw = smooth((q - 0.05 - j * 0.016) / 0.16);
      c.words[j].style.transform = 'translateY(' + (110 * (1 - kw)).toFixed(1) + '%)';
    }
    c.lastQ = q;
  }

  /* ---------- the scroll ---------- */
  var ticking = false, lastP = -1;
  function update() {
    var y = w.scrollY;
    var p = clamp((y - jTop) / jTravel, 0, 1);
    stageOn = y < jTop + J.offsetHeight;
    var ci = 0;
    for (var i = 0; i < N; i++) if (p >= bounds[i]) ci = i;
    var q = (p - bounds[ci]) / (bounds[ci + 1] - bounds[ci]);
    if (p >= 1) { ci = N - 1; q = 1; }
    cur = ci;
    var hasNext = ci + 1 < N;
    var fq = hasNext ? clamp(q / FADE, 0, 1) : q;
    want.ci = ci;
    want.fi = Math.round(fq * (CH[ci].n - 1));
    want.a = hasNext && q > FADE ? smooth((q - FADE) / (1 - FADE)) : 0;
    want.z = CH[ci].zoom >= 0 ? 1 + CH[ci].zoom * q : 1 - CH[ci].zoom * (1 - q);
    if (ci !== winCi || want.fi !== winFi) setWindow(ci, want.fi);
    render(false);
    /* type */
    for (var k = 0; k < N; k++) {
      var qq = (p - bounds[k]) / (bounds[k + 1] - bounds[k]);
      if (qq < -0.02 || qq > 1.05) { if (CH[k].vis) { CH[k].vis = false; CH[k].el.style.visibility = 'hidden'; CH[k].el.style.opacity = '0'; } continue; }
      layoutChapter(CH[k], k, qq);
    }
    /* temperature-driven layers */
    var t = tempAtP(p);
    if (t !== lastTemp) {
      lastTemp = t;
      snowK = clamp((-t - 2) / 14, 0, 1);
      frostK = clamp((-t - 3) / 15, 0, 1); applyFrost();
      if (gCool) gCool.style.opacity = clamp(-t / 18, 0, 1).toFixed(3);
      if (gWarm) gWarm.style.opacity = clamp(t / 7, 0, 1).toFixed(3);
      wakeSnow();
    }
    /* rail + hud */
    if (railLine) railLine.style.transform = 'scaleY(' + p.toFixed(4) + ')';
    if (ci !== lastCur) {
      lastCur = ci;
      stops.forEach(function (s, i) { s.classList.toggle('is-on', i === ci); s.classList.toggle('is-past', i < ci); });
      if (hudN) hudN.textContent = pad(ci + 1);
      if (hudName) hudName.textContent = CH[ci].name;
      pump();
    }
    if (hud) hud.classList.toggle('is-on', p > 0.015);
    J.classList.toggle('is-going', p > 0.03 && p < 0.985);
    J.classList.toggle('is-done', p >= 0.985);
    if (nav) nav.classList.toggle('over-dark', y < jTop + J.offsetHeight - nav.offsetHeight * 0.5);
    lastP = p;
  }
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () { ticking = false; update(); });
  }
  w.addEventListener('scroll', onScroll, { passive: true });

  /* ---------- resize: width changes, or tall height changes (not the mobile toolbar) ---------- */
  var lastW = w.innerWidth, lastH = w.innerHeight, rzT = 0;
  w.addEventListener('resize', function () {
    if (rzT) return;
    rzT = requestAnimationFrame(function () {
      rzT = 0;
      if (w.innerWidth === lastW && Math.abs(w.innerHeight - lastH) < 160) return;
      lastW = w.innerWidth; lastH = w.innerHeight;
      sizeCanvas(); sizeSnow(); paintFrost(); measure(); update(); render(true);
    });
  });

  /* ---------- go ---------- */
  html.classList.remove('no-js');
  sizeCanvas(); sizeSnow(); measure();
  if (T.refresh) T.refresh();
  update();
  wakeSnow();
  pump();
  w.addEventListener('load', function () { measure(); update(); if (T.refresh) T.refresh(); });
  if (T.onReady) T.onReady.push(function () { measure(); update(); });
})();
