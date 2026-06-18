/* =========================================================
   觉 (JUE) — THE AWAKENING
   JavaScript Engine: Cursor, Kinetic Text, Scroll, Magnetic
========================================================= */

(function () {
  'use strict';

  var $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) { return Array.from((ctx || document).querySelectorAll(sel)); };

  /* -------------------------------------------------------
     1. CUSTOM CURSOR
  ------------------------------------------------------- */
  var cursorDot = null;
  var cursorRing = null;
  var mouseX = 0, mouseY = 0;
  var ringX = 0, ringY = 0;

  function initCursor() {
    if (window.innerWidth < 769) return;

    cursorDot = document.createElement('div');
    cursorDot.className = 'cursor-dot';
    document.body.appendChild(cursorDot);

    cursorRing = document.createElement('div');
    cursorRing.className = 'cursor-ring';
    document.body.appendChild(cursorRing);

    document.addEventListener('mousemove', function (e) {
      mouseX = e.clientX;
      mouseY = e.clientY;
      cursorDot.style.left = mouseX + 'px';
      cursorDot.style.top = mouseY + 'px';
    });

    // Smooth ring follow
    function animateRing() {
      ringX += (mouseX - ringX) * 0.12;
      ringY += (mouseY - ringY) * 0.12;
      cursorRing.style.left = ringX + 'px';
      cursorRing.style.top = ringY + 'px';
      requestAnimationFrame(animateRing);
    }
    animateRing();

    // Hover effect on interactive elements
    var hoverTargets = 'a, button, .offer-card, .info-card, .timeline-item, .moment-row, .statement-section, .magnetic';
    document.addEventListener('mouseover', function (e) {
      if (e.target.closest(hoverTargets)) {
        cursorDot.classList.add('hovering');
        cursorRing.classList.add('hovering');
      }
    });
    document.addEventListener('mouseout', function (e) {
      if (e.target.closest(hoverTargets)) {
        cursorDot.classList.remove('hovering');
        cursorRing.classList.remove('hovering');
      }
    });
  }

  /* -------------------------------------------------------
     2. SCROLL REVEAL ENGINE
  ------------------------------------------------------- */
  function initReveal() {
    var staggerSelectors = '.offer-grid, .me-grid, .card-grid';

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;

        var parent = el.closest(staggerSelectors);
        if (parent && !parent.dataset.staggerStarted) {
          parent.dataset.staggerStarted = 'true';
          var children = Array.from(parent.querySelectorAll('.reveal, .reveal-left, .reveal-scale'));
          children.forEach(function (child, i) {
            child.style.transitionDelay = (i * 0.08) + 's';
            requestAnimationFrame(function () {
              child.classList.add('revealed');
            });
          });
        } else if (!parent) {
          el.classList.add('revealed');
        }
      });
    }, {
      threshold: 0.1,
      rootMargin: '0px 0px -60px 0px'
    });

    $$('.reveal, .reveal-left, .reveal-scale, .reveal-clip, .kinetic-text, .statement-section').forEach(function (el) {
      observer.observe(el);
    });
  }

  /* -------------------------------------------------------
     3. KINETIC TEXT — Split into characters
  ------------------------------------------------------- */
  function initKineticText() {
    $$('.kinetic-text').forEach(function (el) {
      var text = el.textContent;
      el.innerHTML = '';
      text.split('').forEach(function (char, i) {
        var span = document.createElement('span');
        span.className = 'char';
        span.textContent = char === ' ' ? ' ' : char;
        span.style.transitionDelay = (i * 0.04) + 's';
        el.appendChild(span);
      });
    });
  }

  /* -------------------------------------------------------
     4. MAGNETIC HOVER
  ------------------------------------------------------- */
  function initMagnetic() {
    if (window.innerWidth < 769) return;

    $$('.magnetic').forEach(function (el) {
      el.addEventListener('mousemove', function (e) {
        var rect = el.getBoundingClientRect();
        var x = e.clientX - rect.left - rect.width / 2;
        var y = e.clientY - rect.top - rect.height / 2;
        el.style.transform = 'translate(' + (x * 0.2) + 'px, ' + (y * 0.2) + 'px)';
      });

      el.addEventListener('mouseenter', function () {
        el.style.transition = 'none';
      });

      el.addEventListener('mouseleave', function () {
        el.style.transition = 'transform 0.6s cubic-bezier(0.16, 1, 0.3, 1)';
        el.style.transform = 'translate(0, 0)';
      });
    });
  }

  /* -------------------------------------------------------
     5. INTRO ANIMATION
  ------------------------------------------------------- */
  function initIntro() {
    var intro = $('#intro');
    var main = $('#main');

    if (intro && main) {
      setTimeout(function () {
        intro.classList.add('fade-out');
      }, 2800);

      setTimeout(function () {
        intro.style.display = 'none';
        main.classList.remove('hidden');
        void main.offsetWidth;
        main.classList.add('visible');
      }, 3400);
    } else if (main) {
      main.classList.remove('hidden');
      void main.offsetWidth;
      main.classList.add('visible');
    }
  }

  /* -------------------------------------------------------
     6. SCROLL PROGRESS BAR
  ------------------------------------------------------- */
  function initProgress() {
    var bar = $('.progress-bar');
    if (!bar) return;

    function update() {
      var scrollTop = window.pageYOffset;
      var docHeight = document.documentElement.scrollHeight - window.innerHeight;
      var pct = docHeight <= 0 ? 0 : (scrollTop / docHeight) * 100;
      bar.style.width = pct.toFixed(1) + '%';
    }

    window.addEventListener('scroll', update, { passive: true });
    update();
  }

  /* -------------------------------------------------------
     7. HAMBURGER MENU
  ------------------------------------------------------- */
  function initHamburger() {
    var btn = $('.hamburger');
    var menu = $('.mobile-menu');
    if (!btn || !menu) return;

    btn.addEventListener('click', function () {
      btn.classList.toggle('active');
      menu.classList.toggle('open');
      document.body.style.overflow = menu.classList.contains('open') ? 'hidden' : '';
    });

    $$('.mobile-link', menu).forEach(function (link) {
      link.addEventListener('click', function () {
        btn.classList.remove('active');
        menu.classList.remove('open');
        document.body.style.overflow = '';
      });
    });
  }

  /* -------------------------------------------------------
     8. ACTIVE NAV LINK
  ------------------------------------------------------- */
  function initActiveNav() {
    var page = window.location.pathname.split('/').pop() || 'index.html';
    $$('.nav-link, .mobile-link').forEach(function (link) {
      if (link.getAttribute('href') === page) {
        link.classList.add('active');
      }
    });
  }

  /* -------------------------------------------------------
     9. TABS (Hobby page)
  ------------------------------------------------------- */
  function initTabs() {
    var btns = $$('.tab-btn');
    var contents = $$('.tab-content');
    if (!btns.length) return;

    btns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        btns.forEach(function (b) { b.classList.remove('active'); });
        contents.forEach(function (c) { c.classList.remove('active'); });
        btn.classList.add('active');
        var target = $('#' + btn.getAttribute('data-tab'));
        if (target) target.classList.add('active');
      });
    });
  }

  /* -------------------------------------------------------
     10. PAGE TRANSITION
  ------------------------------------------------------- */
  function initPageTransition() {
    $$('a[href]').forEach(function (link) {
      link.addEventListener('click', function (e) {
        var href = this.getAttribute('href');
        if (!href || href === '#' || href.startsWith('http') || href.startsWith('mailto:')) return;
        if (this.hasAttribute('data-fullscreen-link')) return;

        e.preventDefault();
        var main = $('#main');
        if (main) {
          main.style.opacity = '0';
          main.style.transform = 'translateY(-15px)';
          main.style.transition = 'opacity 0.35s cubic-bezier(0.16, 1, 0.3, 1), transform 0.35s cubic-bezier(0.16, 1, 0.3, 1)';
        }
        setTimeout(function () { window.location.href = href; }, 350);
      });
    });
  }

  /* -------------------------------------------------------
     11. FULLSCREEN UNIVERSE ENTRY
  ------------------------------------------------------- */
  function initFullscreenUniverseLink() {
    var link = $('[data-fullscreen-link]');
    if (!link) return;

    link.addEventListener('click', function (e) {
      var href = link.getAttribute('href');
      if (!href) return;

      e.preventDefault();

      var main = $('#main');
      if (main) {
        main.style.opacity = '0';
        main.style.transform = 'translateY(-15px)';
        main.style.transition = 'opacity 0.25s cubic-bezier(0.16, 1, 0.3, 1), transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)';
      }

      function go() {
        window.location.href = href;
      }

      var root = document.documentElement;
      var requestFullscreen = root.requestFullscreen ||
        root.webkitRequestFullscreen ||
        root.msRequestFullscreen;

      if (!requestFullscreen) {
        setTimeout(go, 180);
        return;
      }

      try {
        var result = requestFullscreen.call(root);
        if (result && typeof result.then === 'function') {
          result.then(function () { setTimeout(go, 120); }).catch(function () { setTimeout(go, 180); });
        } else {
          setTimeout(go, 120);
        }
      } catch (err) {
        setTimeout(go, 180);
      }
    });
  }

  /* -------------------------------------------------------
     12. WECHAT LIGHTBOX
  ------------------------------------------------------- */
  function initLightbox() {
    var overlay = document.createElement('div');
    overlay.className = 'lightbox-overlay';
    overlay.innerHTML =
      '<div class="lightbox-card">' +
        '<button class="lightbox-close" aria-label="Close">×</button>' +
        '<div class="lightbox-label">WeChat / 微信</div>' +
        '<img src="Wechat Photo.jpg" alt="WeChat QR Code">' +
        '<div class="lightbox-hint">Click anywhere to close</div>' +
      '</div>';
    document.body.appendChild(overlay);

    var card = overlay.querySelector('.lightbox-card');
    var closeBtn = overlay.querySelector('.lightbox-close');

    function openLightbox(e) {
      e.preventDefault();
      overlay.classList.add('open');
      document.body.style.overflow = 'hidden';
    }

    function closeLightbox() {
      overlay.classList.remove('open');
      document.body.style.overflow = '';
    }

    // Click on WeChat trigger
    $$('.wechat-trigger').forEach(function (el) {
      el.addEventListener('click', openLightbox);
    });

    // Close: click overlay (not card), or close button
    overlay.addEventListener('click', function (e) {
      if (!card.contains(e.target)) closeLightbox();
    });
    closeBtn.addEventListener('click', closeLightbox);

    // Close: ESC key
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeLightbox();
    });
  }

  /* -------------------------------------------------------
     13. PROJECT IMAGE LIGHTBOX
  ------------------------------------------------------- */
  function initProjectLightbox() {
    var screenshots = $$('.timeline-screenshot');
    if (!screenshots.length) return;

    var overlay = document.createElement('div');
    overlay.className = 'project-lightbox-overlay';
    overlay.innerHTML =
      '<div class="project-lightbox-inner">' +
        '<button class="lightbox-close" aria-label="Close">×</button>' +
        '<img src="" alt="Project Screenshot">' +
      '</div>';
    document.body.appendChild(overlay);
    var overlayImg = overlay.querySelector('img');
    var closeBtn = overlay.querySelector('.lightbox-close');
    var inner = overlay.querySelector('.project-lightbox-inner');

    function openLightbox(src, alt) {
      overlayImg.src = src;
      overlayImg.alt = alt;
      overlay.classList.add('open');
      document.body.style.overflow = 'hidden';
    }

    function closeOverlay() {
      overlay.classList.remove('open');
      document.body.style.overflow = '';
    }

    screenshots.forEach(function (el) {
      el.addEventListener('click', function () {
        var img = el.querySelector('img');
        if (!img) return;
        openLightbox(img.src, img.alt);
      });
    });

    // Close: click overlay background (not the inner content)
    overlay.addEventListener('click', function (e) {
      if (!inner.contains(e.target)) closeOverlay();
    });
    closeBtn.addEventListener('click', closeOverlay);

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeOverlay();
    });
  }

  /* -------------------------------------------------------
     14. PARALLAX on scroll (subtle)
  ------------------------------------------------------- */
  function initParallax() {
    var bgChar = $('.hero-section');
    if (!bgChar) return;

    window.addEventListener('scroll', function () {
      var scrollY = window.pageYOffset;
      var afterStyle = bgChar.style;
      // Subtle parallax on the giant background character
      afterStyle.setProperty('--parallax-y', (scrollY * 0.15) + 'px');
    }, { passive: true });
  }

  /* -------------------------------------------------------
     15. MARQUEE — JS-driven infinite scroll
  ------------------------------------------------------- */
  function initMarquee() {
    var strip = $('.marquee-strip');
    if (!strip) return;

    var track = strip.querySelector('.marquee-track');
    if (!track) return;

    // Clone children for seamless loop
    var children = Array.from(track.children);
    children.forEach(function (child) {
      track.appendChild(child.cloneNode(true));
    });

    var pos = 0;
    var speed = window.innerWidth < 769 ? 0.5 : 0.8;

    function tick() {
      pos -= speed;
      var halfWidth = track.scrollWidth / 2;
      if (Math.abs(pos) >= halfWidth) {
        pos += halfWidth;
      }
      track.style.transform = 'translateX(' + pos + 'px)';
      requestAnimationFrame(tick);
    }

    requestAnimationFrame(tick);
  }

  /* -------------------------------------------------------
     16. TYPEWRITER EFFECT (Hero subtitle)
  ------------------------------------------------------- */
  function initTypewriter() {
    var el = $('.typewriter');
    if (!el) return;

    var text = el.getAttribute('data-text');
    if (!text) return;

    var started = false;

    function startTyping() {
      if (started) return;
      started = true;
      el.textContent = '';
      var i = 0;
      var interval = setInterval(function () {
        if (i < text.length) {
          el.textContent += text[i];
          i++;
        } else {
          clearInterval(interval);
          el.classList.add('done');
        }
      }, 45);
    }

    // Start after intro animation + reveal transition
    var intro = $('#intro');
    var delay = intro ? 4200 : 800;
    setTimeout(startTyping, delay);
  }

  /* -------------------------------------------------------
     17. PORTRAIT PARALLAX
  ------------------------------------------------------- */
  function initPortraitParallax() {
    var wrapper = document.querySelector('.home-portrait-wrapper');
    if (!wrapper) return;
    var img = wrapper.querySelector('.home-portrait-img');
    if (!img) return;

    var isDesktop = window.innerWidth >= 769;
    img.style.height = isDesktop ? '110%' : '120%';
    img.style.willChange = 'transform';

    function onScroll() {
      var rect = wrapper.getBoundingClientRect();
      var viewH = window.innerHeight;
      if (rect.bottom < 0 || rect.top > viewH) return;
      var progress = 1 - (rect.bottom / (viewH + rect.height));
      var shift = (progress - 0.5) * (isDesktop ? -6 : -12);
      img.style.transform = 'translateY(' + shift + '%)';
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* -------------------------------------------------------
     BOOT
  ------------------------------------------------------- */
  document.addEventListener('DOMContentLoaded', function () {
    initCursor();
    initKineticText();
    initReveal();
    initMagnetic();
    initIntro();
    initProgress();
    initHamburger();
    initActiveNav();
    initTabs();
    initPageTransition();
    initFullscreenUniverseLink();
    initLightbox();
    initProjectLightbox();
    initMarquee();
    initTypewriter();
    initParallax();
    initPortraitParallax();
  });

})();
