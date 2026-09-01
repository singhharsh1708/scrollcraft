(function () {
  var canvas = document.getElementById('scroll-canvas');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');

  var desktopCount = __DESKTOP_COUNT__;
  var mobileCount = __MOBILE_COUNT__;
  var hasMobile = __HAS_MOBILE__;
  var totalScrollHeight = __TOTAL_SCROLL__;
  var framesDir = '__FRAMES_DIR__';
  var framesMobileDir = '__FRAMES_MOBILE_DIR__';

  var mq = window.matchMedia('(max-width: 767px)');
  var isMobile = hasMobile && mq.matches;
  var frameCount = isMobile ? mobileCount : desktopCount;
  var desktopImages = new Array(desktopCount);
  var mobileImages = hasMobile ? new Array(mobileCount) : null;
  var currentFrame = 0;
  var dpr = 1;

  function getImages() {
    return (isMobile && mobileImages) ? mobileImages : desktopImages;
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    var cssW = window.innerWidth;
    var cssH = window.innerHeight;
    canvas.width = Math.max(1, Math.round(cssW * dpr));
    canvas.height = Math.max(1, Math.round(cssH * dpr));
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawFrame(currentFrame);
  }

  function drawFrame(index) {
    var images = getImages();
    var img = images[index];
    if (!img || !img.complete) return;
    if (!img.naturalWidth || !img.naturalHeight) return;
    var cssW = window.innerWidth;
    var cssH = window.innerHeight;
    var scale = Math.max(cssW / img.naturalWidth, cssH / img.naturalHeight);
    var w = img.naturalWidth * scale;
    var h = img.naturalHeight * scale;
    ctx.clearRect(0, 0, cssW, cssH);
    ctx.drawImage(img, (cssW - w) / 2, (cssH - h) / 2, w, h);
  }

  function framePath(dir, idx) {
    var s = String(idx);
    while (s.length < 4) s = '0' + s;
    return dir + '/frame_' + s + '.jpg';
  }

  function preloadSet(count, dir, target) {
    if (!count) return;
    var STEP = 5;
    var keyframes = [];
    for (var i = 0; i < count; i += STEP) keyframes.push(i);
    var settled = 0;

    function loadOne(idx) {
      var img = new Image();
      img.src = framePath(dir, idx);
      img.onload = function () {
        target[idx] = img;
        if (idx === currentFrame) drawFrame(idx);
      };
    }

    keyframes.forEach(function (i) {
      var img = new Image();
      img.src = framePath(dir, i);
      function advance() {
        settled++;
        if (settled === keyframes.length) {
          for (var j = 0; j < count; j++) {
            if (j % STEP !== 0) loadOne(j);
          }
        }
      }
      img.onload = function () {
        target[i] = img;
        if (i === currentFrame) drawFrame(i);
        advance();
      };
      img.onerror = advance;
    });
  }

  var mobileLoaded = false;
  var desktopLoaded = false;

  function preload() {
    if (hasMobile && isMobile) {
      preloadSet(mobileCount, framesMobileDir, mobileImages);
      mobileLoaded = true;
    } else {
      preloadSet(desktopCount, framesDir, desktopImages);
      desktopLoaded = true;
    }
  }

  var rafId = 0;

  function onScroll() {
    if (rafId) return;
    rafId = window.requestAnimationFrame(function () {
      rafId = 0;
      var track = totalScrollHeight - window.innerHeight;
      var progress = track > 0 ? window.scrollY / track : 0;
      if (progress < 0) progress = 0;
      if (progress > 1) progress = 1;
      var last = frameCount - 1;
      var index = last > 0 ? Math.round(progress * last) : 0;
      if (index !== currentFrame) {
        currentFrame = index;
        drawFrame(index);
      }
      var hint = document.getElementById('scroll-hint');
      if (hint) hint.style.opacity = window.scrollY > 80 ? '0' : '1';
    });
  }

  if (hasMobile) {
    mq.addEventListener('change', function (e) {
      isMobile = e.matches;
      frameCount = isMobile ? mobileCount : desktopCount;
      if (isMobile && !mobileLoaded) {
        preloadSet(mobileCount, framesMobileDir, mobileImages);
        mobileLoaded = true;
      }
      if (!isMobile && !desktopLoaded) {
        preloadSet(desktopCount, framesDir, desktopImages);
        desktopLoaded = true;
      }
      currentFrame = -1;
      onScroll();
    });
  }

  var reveal = document.querySelectorAll('.section-content');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) entry.target.classList.add('visible');
      });
    }, { threshold: 0.25 });
    Array.prototype.forEach.call(reveal, function (el) { io.observe(el); });
  } else {
    Array.prototype.forEach.call(reveal, function (el) { el.classList.add('visible'); });
  }

  if (__HAS_AUDIO__) {
    var audio = new Audio('__AUDIO_SRC__');
    audio.loop = true;
    audio.volume = 0.5;
    var muted = true;
    audio.muted = true;
    var btn = document.getElementById('audio-mute');
    function start() {
      var p = audio.play();
      if (p && typeof p.catch === 'function') p.catch(function () {});
      window.removeEventListener('scroll', start);
      window.removeEventListener('pointerdown', start);
    }
    window.addEventListener('scroll', start, { once: true, passive: true });
    window.addEventListener('pointerdown', start, { once: true });
    if (btn) {
      btn.addEventListener('click', function () {
        muted = !muted;
        audio.muted = muted;
        btn.textContent = muted ? '🔇' : '🔊';
        btn.setAttribute('aria-label', muted ? 'Unmute background audio' : 'Mute background audio');
        if (!muted) start();
      });
    }
  }

  window.addEventListener('resize', resize, { passive: true });
  window.addEventListener('scroll', onScroll, { passive: true });
  resize();
  preload();
  onScroll();
})();
