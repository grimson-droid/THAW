/* =====================================================================
   THAW Strategy Consulting · main.js  (council round 2)
   One scalar drives the story: the page temperature. It sets the Thaw
   index readout, the nav bar, the docked thaw line, the body tint and
   the hero melt. Everything degrades to the static route (?static=1,
   prefers-reduced-motion, no JS, no CDN).
   ===================================================================== */
(function () {
  'use strict';
  var d = document, w = window, html = d.documentElement;
  var entering = html.classList.contains('is-entering');
  var reduce = w.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var params = new URLSearchParams(location.search);
  var isStatic = params.has('static') || reduce;
  if (isStatic) html.classList.add('static');
  function eagerImages() {
    d.querySelectorAll('img').forEach(function (i) { i.loading = 'eager'; i.decoding = 'sync'; if (i.decode) i.decode().catch(function () {}); });
  }
  if (isStatic) eagerImages();
  var hasGsap = typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined';
  if (hasGsap) gsap.registerPlugin(ScrollTrigger); else html.classList.add('no-gsap');
  var stripEl = d.querySelector('.hstrip');
  var pinStrip = !!(stripEl && hasGsap && !isStatic && w.innerWidth >= 900 && w.innerHeight >= 700);
  if (pinStrip) {
    html.classList.add('has-pin');
    var stripTrack = stripEl.querySelector('.hstrip__track');
    if (!stripTrack || stripTrack.scrollWidth - w.innerWidth < 360) { html.classList.remove('has-pin'); pinStrip = false; }
  }
  var finePointer = w.matchMedia('(pointer:fine) and (hover:hover)').matches;
  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };

  /* ---------- page-enter: the dark veil rises off the new page ---------- */
  if (entering) {
    var mainEntering = d.querySelector('main');
    if (mainEntering) mainEntering.style.animationDelay = '.15s';
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        var v = d.querySelector('.veil');
        html.classList.remove('is-entering');
        if (v) {
          v.style.visibility = 'visible';
          v.style.transformOrigin = 'top';
          v.style.transition = 'transform .6s cubic-bezier(.65,0,.35,1)';
          v.style.transform = 'scaleY(0)';
          setTimeout(function () { v.removeAttribute('style'); }, 700);
        }
      });
    });
  }

  /* ---------- containing-block hygiene ---------- */
  var mainEl = d.querySelector('main');
  if (mainEl) mainEl.addEventListener('animationend', function () { mainEl.style.animation = 'none'; }, { once: true });

  /* ---------- preloader (first visit of the session only) ---------- */
  var pre = d.querySelector('.preloader');
  var preShown = false;
  if (pre) {
    var seen = false;
    try { seen = !!sessionStorage.getItem('thaw-seen'); } catch (e) {}
    if (isStatic || seen) {
      pre.classList.add('is-gone');
    } else {
      preShown = true;
      html.classList.add('is-loading');
      var prePath = pre.querySelector('path');
      var preTexts = pre.querySelectorAll('text');
      var fontsReady = (d.fonts && d.fonts.ready)
        ? Promise.race([d.fonts.ready, new Promise(function (r) { setTimeout(r, 600); })])
        : Promise.resolve();
      fontsReady.then(function () {
        requestAnimationFrame(function () {
          if (prePath) { prePath.style.transition = 'stroke-dashoffset 1.1s cubic-bezier(.65,0,.35,1) .1s'; prePath.style.strokeDashoffset = '0'; }
          preTexts.forEach(function (t, i) { t.style.transition = 'opacity .8s ease ' + (0.3 + i * 0.3) + 's'; t.style.opacity = '1'; });
        });
      });
      setTimeout(function () {
        pre.classList.add('is-done');
        html.classList.remove('is-loading');
        if (lenis) lenis.start();
        setTimeout(initReveals, 560);
        setTimeout(function () { pre.classList.add('is-gone'); }, 1000);
      }, 1800);
      try { sessionStorage.setItem('thaw-seen', '1'); } catch (e) {}
    }
  }

  /* ---------- smooth scroll ---------- */
  var lenis = null;
  if (!isStatic && typeof Lenis !== 'undefined') {
    lenis = new Lenis({ lerp: 0.085, smoothWheel: true });
    if (preShown) lenis.stop();
    if (hasGsap) {
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
      gsap.ticker.lagSmoothing(0);
    } else {
      var rafLenis = function (t) { lenis.raf(t); requestAnimationFrame(rafLenis); };
      requestAnimationFrame(rafLenis);
    }
  }
  function scrollToEl(el) {
    if (!el) return;
    if (lenis) lenis.scrollTo(el, { offset: -96, duration: 1.4 });
    else el.scrollIntoView({ behavior: isStatic ? 'auto' : 'smooth', block: 'start' });
  }

  /* ---------- nav ---------- */
  var nav = d.querySelector('.nav');
  function navScrolled(y) { if (nav) nav.classList.toggle('is-scrolled', y > 40); }

  /* ---------- mobile menu with focus management ---------- */
  var burger = d.querySelector('.nav__burger');
  var menu = d.querySelector('.menu');
  function setMenu(open) {
    if (!menu || !burger) return;
    menu.classList.toggle('is-open', open);
    burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    menu.setAttribute('aria-hidden', open ? 'false' : 'true');
    d.body.style.overflow = open ? 'hidden' : '';
    ['main', 'footer'].forEach(function (s) {
      var el = d.querySelector(s);
      if (!el) return;
      if (open) el.setAttribute('inert', ''); else el.removeAttribute('inert');
    });
    if (lenis) { open ? lenis.stop() : lenis.start(); }
    if (open) {
      setTimeout(function () { var first = menu.querySelector('a'); if (first) first.focus(); }, 80);
    } else {
      burger.focus();
    }
  }
  if (burger && menu) {
    burger.addEventListener('click', function () { setMenu(!menu.classList.contains('is-open')); });
    d.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && menu.classList.contains('is-open')) setMenu(false);
    });
  }

  /* ---------- the temperature scalar: ramps inside each run of same-tint sections ---------- */
  var tempVals = d.querySelectorAll('[data-temp-val]');
  var tempBars = d.querySelectorAll('[data-temp-bar]');
  var temps = d.querySelectorAll('.temp');
  var thawPath = d.querySelector('.thawline path');
  var BAND = { winter: [-18, -11], thaw: [-4, 1], spring: [3, 7] };
  var pts = [{ y: 0, t: -18 }, { y: 1, t: 7 }];
  var lastTi = null, tintSecs = [];
  function fmtTemp(t) { return t === 0 ? '0°' : (t < 0 ? '−' : '+') + Math.abs(t) + '°'; }
  function buildPts() {
    var maxScroll = Math.max(1, html.scrollHeight - w.innerHeight);
    var secs = Array.prototype.slice.call(d.querySelectorAll('main [data-temp], main .hero, main .phero--dark')).map(function (s) {
      var r = (s.closest('.pin-spacer') || s).getBoundingClientRect(), top = r.top + w.scrollY;
      return { top: top, mid: top + r.height / 2, bot: top + r.height, t: s.dataset.temp || 'winter' };
    }).filter(function (s) { return BAND[s.t]; }).sort(function (a, b) { return a.top - b.top; });
    tintSecs = secs;
    pts = [];
    secs.forEach(function (s, i) {
      var b = BAND[s.t], first = i === 0 || secs[i - 1].t !== s.t, last = i === secs.length - 1 || secs[i + 1].t !== s.t;
      if (first && last) { pts.push({ y: s.top, t: b[0] }); pts.push({ y: s.bot, t: b[1] }); }
      else if (first) pts.push({ y: s.mid, t: b[0] });
      else if (last) pts.push({ y: s.mid, t: b[1] });
    });
    if (!pts.length) pts = [{ y: 0, t: -18 }];
    pts.unshift({ y: 0, t: pts[0].t });
    pts.push({ y: maxScroll + w.innerHeight * 0.5, t: 7 });
    pts.sort(function (a, b) { return a.y - b.y; });
  }
  function tempAt(y) {
    y += w.innerHeight * 0.5;
    if (y <= pts[0].y) return pts[0].t;
    for (var i = 1; i < pts.length; i++) {
      if (y <= pts[i].y) {
        var a = pts[i - 1], b = pts[i];
        var k = (y - a.y) / Math.max(1, b.y - a.y);
        return a.t + (b.t - a.t) * k;
      }
    }
    return pts[pts.length - 1].t;
  }
  function updateThaw(y) {
    var t = tempAt(y);
    var p = (t + 18) / 25;
    var ti = Math.round(t);
    if (ti !== lastTi) {
      lastTi = ti;
      tempVals.forEach(function (el) { el.textContent = fmtTemp(ti); });
    }
    tempBars.forEach(function (el) { el.style.transform = 'scaleX(' + p.toFixed(4) + ')'; });
    if (thawPath) thawPath.style.strokeDashoffset = String(1 - p);
    temps.forEach(function (el) { el.classList.toggle('is-above', t >= 0); });
    var tint = 'winter', probe = y + w.innerHeight * 0.5;
    for (var q = 0; q < tintSecs.length; q++) if (probe >= tintSecs[q].top) tint = tintSecs[q].t;
    if (d.body.dataset.temp !== tint) d.body.dataset.temp = tint;
  }
  if (isStatic) {
    tempVals.forEach(function (el) { el.textContent = '−18° to +7°'; });
    tempBars.forEach(function (el) { el.style.transform = 'scaleX(1)'; });
    if (thawPath) thawPath.style.strokeDashoffset = '0';
    var tempSections = d.querySelectorAll('main [data-temp]');
    if (tempSections.length && 'IntersectionObserver' in w) {
      var tio = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) { if (e.isIntersecting) d.body.dataset.temp = e.target.dataset.temp; });
      }, { rootMargin: '-40% 0px -40% 0px', threshold: 0 });
      tempSections.forEach(function (s) { tio.observe(s); });
    }
  } else {
    buildPts();
    if (d.fonts && d.fonts.ready) d.fonts.ready.then(function () { buildPts(); updateThaw(w.scrollY); });
    if (hasGsap) ScrollTrigger.addEventListener('refresh', function () { buildPts(); updateThaw(w.scrollY); });
  }

  /* ---------- hero: snowfall and the frosted window ---------- */
  var canvas = d.getElementById('snow');
  var hero = canvas ? canvas.closest('.hero') : null;
  var heroScroll = null;
  var sizeCanvas = null, paintFrost = null, wipe = null;
  if (canvas && hero && !isStatic) {
    var ctx = canvas.getContext('2d');
    var W = 0, H = 0, heroH = 0, flakes = [], melt = 0, raf = null, tick = 0, snowIn = 0;
    var dpr = Math.min(1.5, w.devicePixelRatio || 1);
    function mkFlake() {
      var z = Math.random();
      return { x: Math.random() * W, y: Math.random() * H, r: 0.5 + z * 2.3, s: 0.22 + z * 0.95, a: 0.22 + z * 0.55, ph: Math.random() * Math.PI * 2, z: z };
    }
    sizeCanvas = function () {
      W = hero.offsetWidth; H = hero.offsetHeight; heroH = H;
      canvas.width = W * dpr; canvas.height = H * dpr;
      canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var n = Math.min(340, Math.round(W * H / 6500));
      flakes = []; for (var i = 0; i < n; i++) flakes.push(mkFlake());
    };
    function drawSnow() {
      tick += 0.008;
      if (!html.classList.contains('is-loading')) snowIn = Math.min(1, snowIn + 0.011);
      ctx.clearRect(0, 0, W, H);
      var k = 1 - melt;
      if (k <= 0.002) { raf = null; return; }
      var ka = Math.pow(k, 1.5) * snowIn;
      for (var i = 0; i < flakes.length; i++) {
        var f = flakes[i];
        f.y += f.s * (0.35 + 0.85 * k);
        f.x += Math.sin(tick + f.ph) * 0.4 * f.z * k + 0.12;
        if (f.y > H + 4) { f.y = -4; f.x = Math.random() * W; }
        if (f.x > W + 4) f.x = -4; else if (f.x < -4) f.x = W + 4;
        ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (1 - 0.6 * melt), 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(238,243,246,' + (f.a * ka).toFixed(3) + ')'; ctx.fill();
      }
      raf = requestAnimationFrame(drawSnow);
    }
    sizeCanvas();
    d.addEventListener('visibilitychange', function () {
      if (d.hidden && raf) { cancelAnimationFrame(raf); raf = null; }
      else if (!d.hidden && !raf && melt < 1) raf = requestAnimationFrame(drawSnow);
    });
    raf = requestAnimationFrame(drawSnow);

    /* the frosted window: a wipeable canvas when a pointer exists, the frost div otherwise */
    var heroFrame = hero.querySelector('.hero__frame .frame');
    var heroFrostDiv = heroFrame ? heroFrame.querySelector('.frame__frost') : null;
    wipe = heroFrame ? heroFrame.querySelector('.frame__wipe') : null;
    var frostEl = heroFrostDiv;
    var frostBase = 0.96;
    if (wipe && heroFrame) {
      var wctx = wipe.getContext('2d');
      var wW = 0, wH = 0, lastX = null, lastY = null, frostImg = new Image();
      var wdpr = Math.min(1.5, w.devicePixelRatio || 1);
      paintFrost = function () {
        wW = heroFrame.clientWidth; wH = heroFrame.clientHeight;
        wipe.width = Math.round(wW * wdpr); wipe.height = Math.round(wH * wdpr);
        wctx.setTransform(wdpr, 0, 0, wdpr, 0, 0);
        wctx.globalCompositeOperation = 'source-over'; wctx.globalAlpha = 1;
        wctx.clearRect(0, 0, wW, wH);
        var photo = heroFrame.querySelector('img');
        if (photo && photo.complete && photo.naturalWidth) {
          var sw = Math.max(2, Math.round(wW / 16)), sh = Math.max(2, Math.round(wH / 16));
          var tmp = d.createElement('canvas'); tmp.width = sw; tmp.height = sh;
          var ps = Math.max(sw / photo.naturalWidth, sh / photo.naturalHeight);
          tmp.getContext('2d').drawImage(photo, (sw - photo.naturalWidth * ps) / 2, (sh - photo.naturalHeight * ps) / 2, photo.naturalWidth * ps, photo.naturalHeight * ps);
          wctx.imageSmoothingEnabled = true; wctx.imageSmoothingQuality = 'high';
          wctx.drawImage(tmp, 0, 0, wW, wH);
        }
        wctx.fillStyle = 'rgba(238,243,246,.34)'; wctx.fillRect(0, 0, wW, wH);
        if (frostImg.complete && frostImg.naturalWidth) {
          var s = Math.max(wW / frostImg.naturalWidth, wH / frostImg.naturalHeight);
          var iw = frostImg.naturalWidth * s, ih = frostImg.naturalHeight * s;
          wctx.globalAlpha = 0.5; wctx.drawImage(frostImg, (wW - iw) / 2, (wH - ih) / 2, iw, ih); wctx.globalAlpha = 1;
        }
      };
      frostImg.onload = function () {
        var ph = heroFrame.querySelector('img');
        if (ph && !ph.complete) ph.addEventListener('load', paintFrost, { once: true });
        paintFrost();
        wipe.classList.add('is-ready');
        if (heroFrostDiv) heroFrostDiv.style.opacity = '0';
        frostEl = wipe;
        frostEl.style.opacity = String(frostBase);
      };
      frostImg.src = 'assets/stock/frost-surface.jpg';
      function brush(x, y) {
        var g = wctx.createRadialGradient(x, y, 0, x, y, 70);
        g.addColorStop(0, 'rgba(0,0,0,.35)'); g.addColorStop(1, 'rgba(0,0,0,0)');
        wctx.globalCompositeOperation = 'destination-out';
        wctx.fillStyle = g;
        wctx.beginPath(); wctx.arc(x, y, 70, 0, Math.PI * 2); wctx.fill();
      }
      var touched = false;
      wipe.addEventListener('pointermove', function (e) {
        if (!wipe.classList.contains('is-ready')) return;
        if (e.pointerType === 'touch' && e.buttons === 0) return;
        touched = true;
        var r = wipe.getBoundingClientRect();
        var x = e.clientX - r.left, y = e.clientY - r.top;
        if (lastX === null) { lastX = x; lastY = y; }
        var dx = x - lastX, dy = y - lastY, dist = Math.hypot(dx, dy), steps = Math.max(1, Math.round(dist / 8));
        for (var i = 1; i <= steps; i++) brush(lastX + dx * i / steps, lastY + dy * i / steps);
        lastX = x; lastY = y;
      });
      wipe.addEventListener('pointerleave', function () { lastX = null; lastY = null; });
      /* hint stroke: shows touch and trackpad users that the window wipes */
      setTimeout(function () {
        if (touched || w.scrollY > 40 || !wipe.classList.contains('is-ready')) return;
        var t0 = performance.now(), px = null, py = null;
        (function step(now) {
          var k = Math.min(1, (now - t0) / 1400), e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
          var x = wW * (0.18 + 0.64 * e), y = wH * (0.62 - 0.22 * Math.sin(e * Math.PI));
          if (px !== null) { var dx = x - px, dy = y - py, n = Math.max(1, Math.round(Math.hypot(dx, dy) / 8)); for (var i = 1; i <= n; i++) brush(px + dx * i / n, py + dy * i / n); }
          px = x; py = y; if (k < 1) requestAnimationFrame(step);
        })(t0);
      }, preShown ? 4200 : 1800);
    }
    if (frostEl) frostEl.style.opacity = String(frostBase);
    var settleFrost = function () {
      frostBase = 0.82;
      if (frostEl) { frostEl.style.transition = 'opacity 2.6s cubic-bezier(.45,.05,.25,1)'; frostEl.style.opacity = String(frostBase); }
    };
    setTimeout(settleFrost, preShown ? 2300 : (entering ? 1000 : 600));
    heroScroll = function (y) {
      var p = clamp(y / (heroH * 0.6), 0, 1);
      melt = 1 - (1 - p) * (1 - p);
      if (frostEl) {
        if (p > 0) frostEl.style.transition = 'none';
        frostEl.style.opacity = (frostBase * (1 - melt)).toFixed(3);
      }
      if (!raf && melt < 1 && !d.hidden) raf = requestAnimationFrame(drawSnow);
    };
  }

  /* ---------- one resize handler, width changes only ---------- */
  var lastW = w.innerWidth, rzT = 0;
  w.addEventListener('resize', function () {
    if (rzT) return;
    rzT = requestAnimationFrame(function () {
      rzT = 0;
      if (w.innerWidth === lastW) return;
      lastW = w.innerWidth;
      if (sizeCanvas) sizeCanvas();
      if (paintFrost && wipe && wipe.classList.contains('is-ready')) paintFrost();
      if (!isStatic) { buildPts(); updateThaw(w.scrollY); }
    });
  });

  /* ---------- the single scroll handler ---------- */
  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      ticking = false;
      var y = w.scrollY;
      navScrolled(y);
      if (!isStatic) updateThaw(y);
      if (heroScroll) heroScroll(y);
    });
  }
  w.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------- word splitting for display headlines ---------- */
  function splitWords(el) {
    var count = 0;
    var walk = function (node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (child) {
        if (child.nodeType === 3) {
          var parts = child.textContent.split(/(\s+)/);
          var frag = d.createDocumentFragment();
          parts.forEach(function (part) {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(d.createTextNode(' ')); return; }
            var wrap = d.createElement('span'); wrap.className = 'w';
            var inner = d.createElement('span'); inner.textContent = part;
            inner.style.transition = 'transform 1.15s cubic-bezier(.22,1,.36,1) ' + (count * 0.05) + 's';
            count++;
            wrap.appendChild(inner); frag.appendChild(wrap);
          });
          node.replaceChild(frag, child);
        } else if (child.nodeType === 1 && child.tagName !== 'BR') {
          walk(child);
        }
      });
    };
    walk(el);
  }
  if (!isStatic) d.querySelectorAll('.split').forEach(splitWords);

  /* ---------- reveals, staggered lists, frost that thaws ---------- */
  function initReveals() {
    if (!pinStrip) d.querySelectorAll('.season .frame').forEach(function (f) { f.setAttribute('data-thaw', ''); });
    d.querySelectorAll('[data-stagger]').forEach(function (c) {
      c.classList.remove('reveal');
      Array.prototype.forEach.call(c.children, function (ch, i) {
        ch.classList.add('reveal');
        ch.removeAttribute('data-delay');
        ch.style.transitionDelay = Math.min(560, i * 70) + 'ms';
      });
    });
    if (!isStatic && 'IntersectionObserver' in w) {
      var rio = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) { e.target.classList.add('is-in'); rio.unobserve(e.target); }
        });
      }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
      d.querySelectorAll('.reveal, .split').forEach(function (el) { rio.observe(el); });
      var fio = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) { e.target.classList.add('is-thawed'); fio.unobserve(e.target); }
        });
      }, { threshold: 0.4 });
      d.querySelectorAll('.frame[data-thaw]').forEach(function (el) { fio.observe(el); });
    } else {
      d.querySelectorAll('.reveal, .split').forEach(function (el) { el.classList.add('is-in'); });
      d.querySelectorAll('.frame[data-thaw]').forEach(function (el) { el.classList.add('is-thawed'); });
    }
  }
  if (!preShown) { if (entering) setTimeout(initReveals, 380); else initReveals(); }

  /* ---------- parallax images ---------- */
  if (hasGsap && !isStatic) {
    d.querySelectorAll('[data-parallax]').forEach(function (img) {
      var s = parseFloat(img.dataset.parallax) || 8;
      gsap.fromTo(img, { yPercent: -s, scale: 1.14 }, {
        yPercent: s, scale: 1.14, ease: 'none',
        scrollTrigger: { trigger: img.closest('.frame') || img, start: 'top bottom', end: 'bottom top', scrub: true }
      });
    });
  }

  /* ---------- horizontal season strip (pinned only when JS can pin it) ---------- */
  if (pinStrip) {
    var strip = stripEl;
    var track = strip.querySelector('.hstrip__track');
    var prog = strip.querySelector('.hstrip__progress i');
    var frosts = Array.prototype.slice.call(strip.querySelectorAll('.frame__frost'));
    var labels = Array.prototype.slice.call(strip.querySelectorAll('.hstrip__progress span'));
    var seasons = Array.prototype.slice.call(strip.querySelectorAll('.season'));
    var seasonImgs = seasons.map(function (s) { return s.querySelector('.frame img'); });
    var centers = [];
    var dist = function () { return Math.max(0, track.scrollWidth - w.innerWidth); };
    gsap.to(track, {
      x: function () { return -dist(); }, ease: 'none',
      scrollTrigger: {
        trigger: strip,
        start: function () { return 'top ' + Math.min(0, w.innerHeight - strip.offsetHeight) + 'px'; },
        end: function () { return '+=' + dist(); },
        pin: true, scrub: 0.3, invalidateOnRefresh: true,
        onRefresh: function () { centers = seasons.map(function (s) { return s.offsetLeft + s.offsetWidth / 2; }); },
        onUpdate: function (self) {
          if (prog) prog.style.transform = 'scaleX(' + self.progress + ')';
          var k = Math.min(3, Math.floor(self.progress * 4 + .02));
          labels.forEach(function (l, i) { l.classList.toggle('is-on', i === k); });
          frosts.forEach(function (f, i) {
            var v = clamp((self.progress * 4 - i) * 1.4, 0, 1);
            f.style.opacity = (1 - v).toFixed(3);
          });
          var tx = gsap.getProperty(track, 'x') || 0;
          seasonImgs.forEach(function (im, i) {
            if (!im || centers[i] == null) return;
            im.style.transform = 'translateX(' + (-(centers[i] + tx - w.innerWidth / 2) * 0.06).toFixed(1) + 'px) scale(1.14)';
          });
        }
      }
    });
  }

  /* ---------- method line (approach) ---------- */
  var method = d.querySelector('.method');
  if (method && hasGsap && !isStatic) {
    var fill = method.querySelector('.method__line i');
    if (fill) gsap.to(fill, { scaleY: 1, ease: 'none', scrollTrigger: { trigger: method, start: 'top 70%', end: 'bottom 55%', scrub: true } });
  }

  /* ---------- team page: active member in sticky nav ---------- */
  var teamLinks = d.querySelectorAll('.team-nav a[href^="#"]');
  if (teamLinks.length && 'IntersectionObserver' in w) {
    var bios = d.querySelectorAll('.bio[id], .company[id]');
    var bio = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          teamLinks.forEach(function (a) { a.classList.toggle('is-active', a.getAttribute('href') === '#' + e.target.id); });
        }
      });
    }, { rootMargin: '-35% 0px -55% 0px', threshold: 0 });
    bios.forEach(function (b) { bio.observe(b); });
  }

  /* ---------- anchors and the skip link ---------- */
  d.querySelectorAll('a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      if (a.classList.contains('skip')) {
        e.preventDefault();
        var m = d.getElementById('main');
        if (m) { m.focus(); m.scrollIntoView(); }
        return;
      }
      var id = a.getAttribute('href');
      if (id.length < 2) return;
      var el = d.querySelector(id);
      if (!el) return;
      e.preventDefault();
      if (menu && menu.classList.contains('is-open')) setMenu(false);
      scrollToEl(el);
    });
  });

  /* ---------- cursor ring (interactive elements only) ---------- */
  var cur = d.querySelector('.cursor');
  if (cur && finePointer && !isStatic) {
    var mx = 0, my = 0, cx = 0, cy = 0, on = false;
    d.addEventListener('mousemove', function (e) { mx = e.clientX; my = e.clientY; if (!on) { on = true; cur.classList.add('is-on'); } });
    d.addEventListener('mouseleave', function () { cur.classList.remove('is-on'); on = false; });
    (function loop() {
      var kk = cur.classList.contains('is-wipe') ? 0.5 : 0.16; cx += (mx - cx) * kk; cy += (my - cy) * kk;
      cur.style.transform = 'translate(' + cx.toFixed(1) + 'px,' + cy.toFixed(1) + 'px) translate(-50%,-50%)';
      requestAnimationFrame(loop);
    })();
    d.querySelectorAll('a, button').forEach(function (el) {
      el.addEventListener('mouseenter', function () { cur.classList.add('is-hover'); });
      el.addEventListener('mouseleave', function () { cur.classList.remove('is-hover'); });
    });
    d.querySelectorAll('[data-cursor]').forEach(function (el) {
      el.addEventListener('mouseenter', function () {
        if (el.dataset.cursor === 'Wipe') { cur.classList.add('is-wipe'); return; }
        cur.classList.add('is-view'); cur.querySelector('span').textContent = el.dataset.cursor;
      });
      el.addEventListener('mouseleave', function () { cur.classList.remove('is-view', 'is-wipe'); });
    });
  }

  /* ---------- page transitions ---------- */
  if (!isStatic) {
    d.querySelectorAll('a[href]').forEach(function (a) {
      var href = a.getAttribute('href');
      if (!href || href.charAt(0) === '#' || /^(https?:|mailto:|tel:)/.test(href) || a.target === '_blank') return;
      a.addEventListener('click', function (e) {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        d.body.classList.add('is-leaving');
        try { sessionStorage.setItem('thaw-veil', '1'); } catch (err) {}
        setTimeout(function () { location.href = href; }, 520);
      });
    });
    w.addEventListener('pageshow', function (e) { if (e.persisted) d.body.classList.remove('is-leaving'); });
  }

  /* ---------- contact form (mock-up) ---------- */
  var form = d.querySelector('.form');
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!form.checkValidity()) { form.reportValidity(); return; }
      var name = form.querySelector('[name="name"]');
      var ok = form.nextElementSibling;
      if (ok) {
        var who = ok.querySelector('[data-name]');
        if (who) who.textContent = name && name.value.trim() ? ', ' + name.value.trim().split(' ')[0] : '';
      }
      form.classList.add('is-sending');
      setTimeout(function () {
        form.classList.add('is-sent');
        if (ok) {
          ok.setAttribute('tabindex', '-1');
          ok.classList.add('reveal');
          requestAnimationFrame(function () { ok.classList.add('is-in'); });
          ok.focus();
        }
      }, 450);
    });
  }

  /* ---------- the footer swoosh draws in when the footer arrives ---------- */
  var foot = d.querySelector('.footer');
  if (foot && 'IntersectionObserver' in w) {
    new IntersectionObserver(function (en) { html.classList.toggle('at-foot', en[0].isIntersecting); }, { threshold: 0.15 }).observe(foot);
  }

  /* ---------- print ---------- */
  w.addEventListener('beforeprint', function () {
    html.classList.remove('has-pin');
    html.classList.add('static');
    eagerImages();
    if (hasGsap) ScrollTrigger.getAll().forEach(function (t) { t.kill(); });
  });

  /* ---------- housekeeping ---------- */
  d.querySelectorAll('[data-year]').forEach(function (el) { el.textContent = new Date().getFullYear(); });
  if (hasGsap && d.fonts && d.fonts.ready) d.fonts.ready.then(function () { ScrollTrigger.refresh(); });
  w.addEventListener('load', function () { if (hasGsap) ScrollTrigger.refresh(); if (!isStatic) { buildPts(); updateThaw(w.scrollY); } });
})();
