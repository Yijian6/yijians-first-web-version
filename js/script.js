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
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
        }
      });
    }, {
      threshold: 0.1,
      rootMargin: '0px 0px -60px 0px'
    });

    $$('.reveal, .reveal-left, .reveal-scale, .kinetic-text, .statement-section').forEach(function (el) {
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

      el.addEventListener('mouseleave', function () {
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

        e.preventDefault();
        var main = $('#main');
        if (main) {
          main.style.opacity = '0';
          main.style.transform = 'translateY(-15px)';
          main.style.transition = 'opacity 0.35s ease, transform 0.35s ease';
        }
        setTimeout(function () { window.location.href = href; }, 350);
      });
    });
  }

  /* -------------------------------------------------------
     11. WECHAT LIGHTBOX
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
     12. PROJECT IMAGE LIGHTBOX
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
     13. PARALLAX on scroll (subtle)
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
     14. TYPEWRITER EFFECT (Hero subtitle)
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
    initLightbox();
    initProjectLightbox();
    initTypewriter();
    initParallax();
  });

})();
