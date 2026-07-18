/* =========================================================
   觉 (JUE) — THE AWAKENING
   JavaScript Engine: Cursor, Kinetic Text, Scroll, Magnetic
========================================================= */

(function () {
  'use strict';

  var $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) { return Array.from((ctx || document).querySelectorAll(sel)); };
  var compat = window.JueCompat || null;

  function storageGet(key, fallback) {
    return compat ? compat.storage.get(key, fallback) : fallback;
  }

  function storageSet(key, value) {
    return compat ? compat.storage.set(key, value) : false;
  }

  function lockPage() {
    if (compat) compat.lockBodyScroll();
    else document.body.style.overflow = 'hidden';
  }

  function unlockPage() {
    if (compat) compat.unlockBodyScroll();
    else document.body.style.overflow = '';
  }

  function canFineHover() {
    if (compat) {
      var caps = compat.getInputCapabilities();
      return caps.hover && caps.finePointer;
    }
    return window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  }

  function focusableElements(container) {
    if (!container) return [];
    return $$('a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])', container)
      .filter(function (el) {
        return !el.hidden && el.getAttribute('aria-hidden') !== 'true' && el.getClientRects().length > 0;
      });
  }

  function trapDialogKey(e, container, close) {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
      return;
    }
    if (e.key !== 'Tab') return;
    var focusable = focusableElements(container);
    if (!focusable.length) {
      e.preventDefault();
      container.focus();
      return;
    }
    var first = focusable[0];
    var last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  // Shared origin for the "day N" counters (Work rings caption + footer)
  function daysSinceStart() {
    var start = new Date(2026, 4, 8); // 2026-05-08, day 1
    var d = Math.floor((Date.now() - start.getTime()) / 86400000) + 1;
    return d < 1 ? 1 : d;
  }

  /* -------------------------------------------------------
     1. CUSTOM CURSOR
  ------------------------------------------------------- */
  var cursorDot = null;
  var cursorRing = null;
  var mouseX = 0, mouseY = 0;
  var ringX = 0, ringY = 0;
  var bhPull = null;   // set by the black hole while hovering: {x, y, s}
  var cursorRaf = null;

  function initCursor() {
    function onMove(e) {
      if (!cursorDot) return;
      mouseX = e.clientX;
      mouseY = e.clientY;
      cursorDot.style.left = mouseX + 'px';
      cursorDot.style.top = mouseY + 'px';
    }

    var hoverTargets = 'a, button, .offer-card, .info-card, .timeline-item, .moment-row, .statement-section, .magnetic';
    function onOver(e) {
      if (cursorDot && e.target.closest(hoverTargets)) {
        cursorDot.classList.add('hovering');
        cursorRing.classList.add('hovering');
      }
    }
    function onOut(e) {
      if (cursorDot && e.target.closest(hoverTargets)) {
        cursorDot.classList.remove('hovering');
        cursorRing.classList.remove('hovering');
      }
    }

    function animateRing() {
      if (!cursorRing) {
        cursorRaf = null;
        return;
      }
      var tx = mouseX, ty = mouseY;
      if (bhPull) {
        tx += (bhPull.x - mouseX) * bhPull.s;
        ty += (bhPull.y - mouseY) * bhPull.s;
      }
      ringX += (tx - ringX) * 0.12;
      ringY += (ty - ringY) * 0.12;
      cursorRing.style.left = ringX + 'px';
      cursorRing.style.top = ringY + 'px';
      cursorRaf = requestAnimationFrame(animateRing);
    }

    function enable() {
      if (cursorDot || !canFineHover()) return;
      cursorDot = document.createElement('div');
      cursorDot.className = 'cursor-dot';
      document.body.appendChild(cursorDot);
      cursorRing = document.createElement('div');
      cursorRing.className = 'cursor-ring';
      document.body.appendChild(cursorRing);
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseover', onOver);
      document.addEventListener('mouseout', onOut);
      cursorRaf = requestAnimationFrame(animateRing);
    }

    function disable() {
      if (cursorRaf) cancelAnimationFrame(cursorRaf);
      cursorRaf = null;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseover', onOver);
      document.removeEventListener('mouseout', onOut);
      if (cursorDot) cursorDot.remove();
      if (cursorRing) cursorRing.remove();
      cursorDot = cursorRing = null;
      bhPull = null;
    }

    function sync() {
      if (canFineHover()) enable();
      else disable();
    }

    sync();
    if (compat) compat.onInputCapabilitiesChange(sync);
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

    $$('.reveal, .reveal-left, .reveal-scale, .reveal-clip, .kinetic-text').forEach(function (el) {
      observer.observe(el);
    });

    var statementMargin = window.innerWidth >= 769 ? '0px 0px -100px 0px' : '0px 0px -60px 0px';
    var statementObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('revealed');
        statementObserver.unobserve(entry.target);
        setTimeout(function () {
          entry.target.classList.add('anim-done');
        }, 1400);
      });
    }, {
      threshold: 0.15,
      rootMargin: statementMargin
    });

    $$('.statement-section').forEach(function (el) {
      statementObserver.observe(el);
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
    $$('.magnetic').forEach(function (el) {
      el.addEventListener('mousemove', function (e) {
        if (!canFineHover()) return;
        var rect = el.getBoundingClientRect();
        var x = e.clientX - rect.left - rect.width / 2;
        var y = e.clientY - rect.top - rect.height / 2;
        el.style.transform = 'translate(' + (x * 0.2) + 'px, ' + (y * 0.2) + 'px)';
      });

      el.addEventListener('mouseenter', function () {
        if (!canFineHover()) return;
        el.style.transition = 'none';
      });

      el.addEventListener('mouseleave', function () {
        if (!canFineHover()) {
          el.style.transform = '';
          return;
        }
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

    if (!menu.id) menu.id = 'mobileMenu';
    btn.setAttribute('aria-controls', menu.id);
    btn.setAttribute('aria-expanded', 'false');
    var previousFocus = null;

    function closeMenu(restoreFocus) {
      if (!menu.classList.contains('open')) return;
      btn.classList.remove('active');
      menu.classList.remove('open');
      btn.setAttribute('aria-expanded', 'false');
      unlockPage();
      if (restoreFocus !== false && previousFocus && previousFocus.focus) previousFocus.focus();
      previousFocus = null;
    }

    function openMenu() {
      previousFocus = document.activeElement;
      btn.classList.add('active');
      menu.classList.add('open');
      btn.setAttribute('aria-expanded', 'true');
      lockPage();
      var firstLink = $('.mobile-link', menu);
      if (firstLink) window.requestAnimationFrame(function () { firstLink.focus(); });
    }

    btn.addEventListener('click', function () {
      if (menu.classList.contains('open')) closeMenu();
      else openMenu();
    });

    $$('.mobile-link', menu).forEach(function (link) {
      link.addEventListener('click', function () {
        closeMenu(false);
      });
    });

    document.addEventListener('keydown', function (e) {
      if (!menu.classList.contains('open')) return;
      trapDialogKey(e, menu, function () { closeMenu(); });
    });
    window.addEventListener('pagehide', function () { closeMenu(false); });
    window.addEventListener('pageshow', function () {
      btn.classList.remove('active');
      menu.classList.remove('open');
      btn.setAttribute('aria-expanded', 'false');
      unlockPage();
    });
  }

  /* -------------------------------------------------------
     7b. MENU HINT — 首次访问在汉堡按钮上显示脉冲点，
         用户打开过一次菜单后永久消失
  ------------------------------------------------------- */
  function initMenuHint() {
    var btn = $('.hamburger');
    if (!btn) return;

    var KEY = 'jue-menu-opened';
    if (storageGet(KEY)) return;

    btn.classList.add('has-hint');
    btn.addEventListener('click', function () {
      btn.classList.remove('has-hint');
      storageSet(KEY, '1');
    }, { once: true });
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
    if (document.querySelector('.passion-disc')) return;
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
        if (this.hasAttribute('data-blackhole')) return;   // black hole runs its own swallow transition

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

      if (window.JueCompat && window.JueCompat.isWeChat()) {
        go();
        return;
      }

      var root = document.documentElement;
      var requestFullscreen = root.requestFullscreen ||
        root.webkitRequestFullscreen ||
        root.msRequestFullscreen;

      if (!requestFullscreen) {
        go();
        return;
      }

      try {
        var result = requestFullscreen.call(root);
        if (result && typeof result.then === 'function') {
          result.then(function () { setTimeout(go, 120); }).catch(go);
        } else {
          setTimeout(go, 120);
        }
      } catch (err) {
        go();
      }
    });
  }

  /* -------------------------------------------------------
     12. WECHAT LIGHTBOX
  ------------------------------------------------------- */
  function initLightbox() {
    var overlay = document.createElement('div');
    overlay.className = 'lightbox-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'wechatLightboxTitle');
    overlay.innerHTML =
      '<div class="lightbox-card">' +
        '<button class="lightbox-close" aria-label="Close">×</button>' +
        '<div class="lightbox-label" id="wechatLightboxTitle">WeChat / 微信</div>' +
        '<div class="chat-mode" role="switch" aria-checked="false" tabindex="0" aria-label="进入聊天模式">' +
          '<span class="chat-mode-text">进入聊天模式</span>' +
          '<span class="chat-mode-toggle" aria-hidden="true"><span class="chat-mode-knob"></span></span>' +
        '</div>' +
        '<div class="lightbox-qr">' +
          '<img src="Wechat Photo.jpg" alt="WeChat QR Code">' +
          '<div class="lightbox-hint">Click anywhere to close</div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);

    var card = overlay.querySelector('.lightbox-card');
    var closeBtn = overlay.querySelector('.lightbox-close');
    var chatMode = overlay.querySelector('.chat-mode');
    var previousFocus = null;

    function setChatOn(on) {
      card.classList.toggle('chat-on', on);
      chatMode.setAttribute('aria-checked', on ? 'true' : 'false');
    }

    chatMode.addEventListener('click', function () {
      setChatOn(!card.classList.contains('chat-on'));
    });
    chatMode.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setChatOn(!card.classList.contains('chat-on'));
      }
    });

    function openLightbox(e) {
      e.preventDefault();
      previousFocus = e.currentTarget || document.activeElement;
      setChatOn(false);
      overlay.classList.add('open');
      lockPage();
      window.requestAnimationFrame(function () { closeBtn.focus(); });
    }

    function closeLightbox() {
      if (!overlay.classList.contains('open')) return;
      overlay.classList.remove('open');
      unlockPage();
      if (previousFocus && previousFocus.focus) previousFocus.focus();
      previousFocus = null;
    }

    // Click on WeChat trigger
    $$('.wechat-trigger').forEach(function (el) {
      el.addEventListener('click', openLightbox);
      el.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') openLightbox(e);
      });
    });

    // Close: click overlay (not card), or close button
    overlay.addEventListener('click', function (e) {
      if (!card.contains(e.target)) closeLightbox();
    });
    closeBtn.addEventListener('click', closeLightbox);

    document.addEventListener('keydown', function (e) {
      if (overlay.classList.contains('open')) trapDialogKey(e, overlay, closeLightbox);
    });
  }

  /* -------------------------------------------------------
     13. PROJECT IMAGE LIGHTBOX
  ------------------------------------------------------- */
  function initProjectLightbox() {
    // Delegated: works for static screenshots AND the Growth Rings
    // stage thumb, which is re-rendered on every ring switch.
    var overlay = null, overlayImg, inner;

    function ensureOverlay() {
      if (overlay) return;
      overlay = document.createElement('div');
      overlay.className = 'project-lightbox-overlay';
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');
      overlay.setAttribute('aria-label', '项目图片预览');
      overlay.innerHTML =
        '<div class="project-lightbox-inner">' +
          '<button class="lightbox-close" aria-label="Close">×</button>' +
          '<img src="" alt="Project Screenshot">' +
        '</div>';
      document.body.appendChild(overlay);
      overlayImg = overlay.querySelector('img');
      inner = overlay.querySelector('.project-lightbox-inner');
      overlay.querySelector('.lightbox-close').addEventListener('click', closeOverlay);
      overlay.addEventListener('click', function (e) {
        if (!inner.contains(e.target)) closeOverlay();
      });
    }

    var previousFocus = null;
    function openLightbox(src, alt) {
      ensureOverlay();
      previousFocus = document.activeElement;
      overlayImg.src = src;
      overlayImg.alt = alt;
      overlay.classList.add('open');
      lockPage();
      window.requestAnimationFrame(function () {
        overlay.querySelector('.lightbox-close').focus();
      });
    }

    function closeOverlay() {
      if (!overlay) return;
      overlay.classList.remove('open');
      unlockPage();
      if (previousFocus && previousFocus.focus) previousFocus.focus();
      previousFocus = null;
    }

    document.addEventListener('click', function (e) {
      var el = e.target && e.target.closest
        ? e.target.closest('.timeline-screenshot, .stage-thumb')
        : null;
      if (!el) return;
      var img = el.querySelector('img');
      if (!img) return;
      openLightbox(img.src, img.alt);
    });

    document.addEventListener('keydown', function (e) {
      if (overlay && overlay.classList.contains('open')) trapDialogKey(e, overlay, closeOverlay);
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
     18a. OFFER WHEEL — 5-orb scenario navigation
  ------------------------------------------------------- */
  var offerWheelAPI = null; // set by initOfferWheel, consumed by initOfferDial

  function initOfferWheel() {
    var wheel = document.getElementById('offerWheel');
    if (!wheel) return;

    var orbs = $$('.ow-orb', wheel);
    var panels = $$('.ow-panel');
    var centerName = document.getElementById('owCenterName');
    var centerSub = document.getElementById('owCenterSub');
    var wrapper = document.querySelector('.ow-panel-wrapper');
    var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var N = 5;

    var CATS = [
      { id: 'ai',     label: '用上 AI',    en: 'Get AI Working', color: [136,196,104], hex: '#88c468' },
      { id: 'design', label: '拿得出手',   en: 'Make it Shine',  color: [200,144,216], hex: '#c890d8' },
      { id: 'web',    label: '自己的网站', en: 'Your Own Site',  color: [104,180,216], hex: '#68b4d8' },
      { id: 'collab', label: '自动化',     en: 'Automate it',    color: [212,115,74],  hex: '#d4734a' },
      { id: 'radar',  label: '跟上 AI',    en: 'AI Radar',       color: [224,176,112], hex: '#e0b070' }
    ];

    var activeIndex = 0;
    setActiveColors(0, true);
    updateWrapperHeight();

    orbs.forEach(function(orb) {
      orb.addEventListener('click', function() {
        var idx = parseInt(orb.getAttribute('data-index'));
        switchTo(idx);
      });
    });

    var startX = 0, startY = 0, swiping = false;

    wheel.addEventListener('touchstart', function(e) {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      swiping = true;
    }, { passive: true });

    wheel.addEventListener('touchmove', function(e) {
      if (!swiping) return;
      if (Math.abs(e.touches[0].clientY - startY) > Math.abs(e.touches[0].clientX - startX) && Math.abs(e.touches[0].clientY - startY) > 20) {
        swiping = false;
      }
    }, { passive: true });

    wheel.addEventListener('touchend', function(e) {
      if (!swiping) return;
      swiping = false;
      var dx = e.changedTouches[0].clientX - startX;
      var dy = e.changedTouches[0].clientY - startY;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        if (dx < 0) switchTo((activeIndex + 1) % N);
        else switchTo((activeIndex + N - 1) % N);
      }
    }, { passive: true });

    document.addEventListener('keydown', function(e) {
      if (!wheel.closest('#main')) return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { switchTo((activeIndex + 1) % N); e.preventDefault(); }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { switchTo((activeIndex + N - 1) % N); e.preventDefault(); }
      if (e.key >= '1' && e.key <= String(N)) { switchTo(parseInt(e.key) - 1); }
    });

    function switchTo(index) {
      if (index === activeIndex) return;
      var oldIndex = activeIndex;
      activeIndex = index;

      orbs.forEach(function(o) { o.classList.remove('active'); });
      orbs[index].classList.add('active');

      if (centerName) {
        centerName.style.opacity = '0';
        setTimeout(function() {
          centerName.textContent = CATS[index].label;
          centerName.style.opacity = '1';
        }, 150);
      }
      if (centerSub) {
        centerSub.style.opacity = '0';
        setTimeout(function() {
          centerSub.textContent = CATS[index].en;
          centerSub.style.opacity = '1';
        }, 150);
      }

      var direction = index > oldIndex ? 1 : -1;
      if (oldIndex === 0 && index === N - 1) direction = -1;
      if (oldIndex === N - 1 && index === 0) direction = 1;

      var oldPanel = panels[oldIndex];
      var newPanel = panels[index];

      if (oldPanel) {
        oldPanel.classList.add('leaving');
        oldPanel.classList.add(direction >= 0 ? 'leaving-left' : 'leaving-right');
        setTimeout(function() {
          oldPanel.classList.remove('active', 'leaving', 'leaving-left', 'leaving-right');
        }, reducedMotion ? 0 : 350);
      }

      setTimeout(function() {
        if (newPanel) newPanel.classList.add('active');
        updateWrapperHeight();
      }, reducedMotion ? 0 : 150);

      setActiveColors(index, false);
      if (navigator.vibrate) navigator.vibrate(10);
    }

    function setActiveColors(index, instant) {
      var cat = CATS[index];
      var r = document.documentElement;
      if (instant || reducedMotion) {
        r.style.setProperty('--gold', cat.hex);
        r.style.setProperty('--gold-dim', 'rgba(' + cat.color.join(',') + ',0.14)');
        r.style.setProperty('--gold-glow', 'rgba(' + cat.color.join(',') + ',0.07)');
        return;
      }

      var startColor = getComputedStyle(r).getPropertyValue('--gold').trim();
      var startRGB = parseRGB(startColor);
      var endRGB = cat.color;
      var duration = 500;
      var startTime = null;

      function frame(ts) {
        if (!startTime) startTime = ts;
        var t = Math.min((ts - startTime) / duration, 1);
        t = 1 - Math.pow(1 - t, 3);
        var cr = Math.round(startRGB[0] + (endRGB[0] - startRGB[0]) * t);
        var cg = Math.round(startRGB[1] + (endRGB[1] - startRGB[1]) * t);
        var cb = Math.round(startRGB[2] + (endRGB[2] - startRGB[2]) * t);
        r.style.setProperty('--gold', 'rgb(' + cr + ',' + cg + ',' + cb + ')');
        r.style.setProperty('--gold-dim', 'rgba(' + cr + ',' + cg + ',' + cb + ',0.14)');
        r.style.setProperty('--gold-glow', 'rgba(' + cr + ',' + cg + ',' + cb + ',0.07)');
        if (t < 1) requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    }

    function parseRGB(str) {
      if (str.charAt(0) === '#') {
        var hex = str.replace('#', '');
        return [parseInt(hex.substr(0,2),16), parseInt(hex.substr(2,2),16), parseInt(hex.substr(4,2),16)];
      }
      var m = str.match(/(\d+)/g);
      return m ? [parseInt(m[0]), parseInt(m[1]), parseInt(m[2])] : [136, 196, 104];
    }

    function updateWrapperHeight() {
      if (!wrapper) return;
      var active = wrapper.querySelector('.ow-panel.active');
      if (active) {
        wrapper.style.height = active.scrollHeight + 'px';
        setTimeout(function() { wrapper.style.height = 'auto'; }, 600);
      }
    }

    offerWheelAPI = {
      CATS: CATS,
      switchTo: switchTo,
      setActiveColors: setActiveColors,
      getActive: function () { return activeIndex; }
    };
  }

  /* -------------------------------------------------------
     18a-2. OPENER COPY — 开口模板一键复制（offer.html）
  ------------------------------------------------------- */
  function initOpenerCopy() {
    var btn = document.getElementById('openerCopy');
    if (!btn) return;

    var defaultText = btn.textContent;
    var resetTimer = null;

    btn.addEventListener('click', function () {
      var text = btn.getAttribute('data-copy');

      function done(ok) {
        btn.textContent = ok ? '已复制，去微信粘贴吧' : '复制失败，长按上面这句话吧';
        btn.classList.toggle('copied', ok);
        clearTimeout(resetTimer);
        resetTimer = setTimeout(function () {
          btn.textContent = defaultText;
          btn.classList.remove('copied');
        }, 2500);
      }

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(fallbackCopy(text)); });
      } else {
        done(fallbackCopy(text));
      }
    });

    function fallbackCopy(text) {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) {}
      document.body.removeChild(ta);
      return ok;
    }
  }

  /* -------------------------------------------------------
     18a-3. OFFER DIAL — 点中心展开的全屏转盘（offer.html）
  ------------------------------------------------------- */
  function initOfferDial() {
    var overlay = document.getElementById('odOverlay');
    var trigger = document.querySelector('#offerWheel .ow-center');
    if (!overlay || !trigger || !offerWheelAPI) return;

    var dial = document.getElementById('odDial');
    var arms = $$('.od-arm', dial);
    var nameEl = overlay.querySelector('.od-name');
    var subEl = overlay.querySelector('.od-sub');
    var leadEl = overlay.querySelector('.od-lead');
    var closeBtn = overlay.querySelector('.od-close');
    var pageRing = document.querySelector('#offerWheel .ow-ring');
    var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    var CATS = offerWheelAPI.CATS;
    var leads = $$('.ow-panel .ow-panel-lead').map(function (el) { return el.textContent; });

    var STEP = 72;
    var FLING_MS = 260;   // 惯性投影时长——越大甩得越远
    var FLING_MAX = 144;  // 惯性最大角度（2 格）
    var SNAP_MS = 420;    // 吸附动画时长

    var open = false;
    var previousFocus = null;
    var theta = 0;
    var activeIdx = 0;
    var raf = null;

    function mod(n, m) { return ((n % m) + m) % m; }
    function currentIndex() { return mod(Math.round(-theta / STEP), CATS.length); }

    function renderCenter(idx) {
      arms.forEach(function (a, i) { a.classList.toggle('active', i === idx); });
      nameEl.textContent = CATS[idx].label;
      subEl.textContent = CATS[idx].en;
      leadEl.textContent = leads[idx] || '';
    }

    function setWheel(deg, silent) {
      theta = deg;
      dial.style.setProperty('--wheel', deg + 'deg');
      if (silent) return;
      var idx = currentIndex();
      if (idx !== activeIdx) {
        activeIdx = idx;
        renderCenter(idx);
        offerWheelAPI.setActiveColors(idx, reducedMotion);
        try { if (navigator.vibrate) navigator.vibrate(8); } catch (err) {}
      }
    }

    function cancelAnim() { if (raf) { cancelAnimationFrame(raf); raf = null; } }

    // 吸附动画。非 silent 时 settle 即选中（转到哪个，就是哪个）
    function snapTo(target, opts) {
      opts = opts || {};
      function settle() {
        if (!opts.silent) offerWheelAPI.switchTo(currentIndex());
        if (opts.onDone) opts.onDone();
      }
      if (reducedMotion) { setWheel(target, opts.silent); settle(); return; }
      cancelAnim();
      var start = theta, t0 = null;
      var dur = opts.duration || SNAP_MS;
      function frame(ts) {
        if (t0 === null) t0 = ts;
        var p = Math.min((ts - t0) / dur, 1);
        p = 1 - Math.pow(1 - p, 3);
        setWheel(start + (target - start) * p, opts.silent);
        if (p < 1) { raf = requestAnimationFrame(frame); }
        else { raf = null; settle(); }
      }
      raf = requestAnimationFrame(frame);
    }

    /* ——— 出入场（FLIP：从页面轮盘原位缩放） ——— */
    function fromTransform() {
      var r = pageRing.getBoundingClientRect();
      var d = dial.getBoundingClientRect();
      var scale = r.width / d.width;
      var dx = (r.left + r.width / 2) - (d.left + d.width / 2);
      var dy = (r.top + r.height / 2) - (d.top + d.height / 2);
      return 'translate(' + dx + 'px,' + dy + 'px) scale(' + scale + ')';
    }

    function openDial() {
      if (open) return;
      open = true;
      previousFocus = document.activeElement;
      var entry = offerWheelAPI.getActive();
      activeIdx = entry;
      renderCenter(entry);
      overlay.hidden = false;
      lockPage();
      if (reducedMotion) {
        setWheel(-entry * STEP, true);
        overlay.classList.add('open');
        closeBtn.focus({ preventScroll: true });
        return;
      }
      // 以零位（与页面五边形方位一致）长出来，再把选中球转上顶部
      setWheel(0, true);
      dial.style.transition = 'none';
      dial.style.transform = fromTransform();
      void dial.offsetWidth;
      dial.style.transition = '';
      dial.style.transform = '';
      setTimeout(function () {
        overlay.classList.add('open');
        closeBtn.focus({ preventScroll: true });
      }, 20);
      if (entry !== 0) {
        var delta = mod(-entry * STEP + 180, 360) - 180;
        setTimeout(function () {
          if (open) snapTo(delta, { silent: true, duration: 600 });
        }, 250);
      }
    }

    function closeDial() {
      if (!open) return;
      open = false;
      cancelAnim();
      offerWheelAPI.switchTo(currentIndex());
      overlay.classList.remove('open');
      if (!reducedMotion) {
        // 缩回原位的同时最短路径转回零位——球各归五边形原座，与静止层无缝交接
        var home = theta + (mod(-theta + 180, 360) - 180);
        snapTo(home, { silent: true, duration: 480 });
        dial.style.transform = fromTransform();
      }
      setTimeout(function () {
        overlay.hidden = true;
        unlockPage();
        var focusTarget = previousFocus && document.contains(previousFocus) ? previousFocus : trigger;
        previousFocus = null;
        focusTarget.focus({ preventScroll: true });
        cancelAnim();
        dial.style.transition = 'none';
        dial.style.transform = '';
        void dial.offsetWidth;
        dial.style.transition = '';
      }, reducedMotion ? 0 : 480);
    }

    /* ——— 拖动旋转 ——— */
    var dragging = false;
    var lastAngle = 0;
    var downX = 0, downY = 0, tapped = true;
    var samples = [];

    function pointerAngle(e) {
      var r = dial.getBoundingClientRect();
      return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180 / Math.PI;
    }

    dial.addEventListener('pointerdown', function (e) {
      cancelAnim();
      dragging = true;
      tapped = true;
      downX = e.clientX;
      downY = e.clientY;
      lastAngle = pointerAngle(e);
      samples = [{ t: e.timeStamp, theta: theta }];
      try { dial.setPointerCapture(e.pointerId); } catch (err) {}
    });

    dial.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      if (tapped && Math.abs(e.clientX - downX) + Math.abs(e.clientY - downY) > 14) tapped = false;
      if (tapped) return;
      var a = pointerAngle(e);
      var d = a - lastAngle;
      if (d > 180) d -= 360;
      if (d < -180) d += 360;
      lastAngle = a;
      setWheel(theta + d);
      samples.push({ t: e.timeStamp, theta: theta });
      if (samples.length > 4) samples.shift();
    });

    dial.addEventListener('pointerup', function (e) {
      if (!dragging) return;
      dragging = false;
      if (dial.hasPointerCapture && dial.hasPointerCapture(e.pointerId)) {
        dial.releasePointerCapture(e.pointerId);
      }
      if (tapped) { handleTap(e); return; }
      var v = 0;
      if (samples.length >= 2) {
        var s0 = samples[0], s1 = samples[samples.length - 1];
        if (s1.t > s0.t) v = (s1.theta - s0.theta) / (s1.t - s0.t);
      }
      var fling = Math.max(-FLING_MAX, Math.min(FLING_MAX, v * FLING_MS));
      snapTo(Math.round((theta + fling) / STEP) * STEP);
    });

    dial.addEventListener('pointercancel', function () {
      if (!dragging) return;
      dragging = false;
      snapTo(Math.round(theta / STEP) * STEP);
    });

    function handleTap() {
      // setPointerCapture 会把 pointerup 的 target 重定向为 dial，
      // 因此按坐标取按下位置的真实元素，而非依赖 event target
      var el = document.elementFromPoint(downX, downY);
      if (!el || !el.closest) return;
      var orb = el.closest('.od-orb');
      if (orb) {
        var idx = parseInt(orb.parentElement.getAttribute('data-index'));
        if (idx === currentIndex()) { closeDial(); return; }
        var target = -idx * STEP;
        var delta = mod(target - theta + 180, 360) - 180;
        snapTo(theta + delta);
        return;
      }
      if (el.closest('.od-center')) closeDial();
    }

    /* ——— 关闭与键盘 ——— */
    closeBtn.addEventListener('click', function () { closeDial(); });
    overlay.addEventListener('click', function (e) { if (e.target === overlay) closeDial(); });

    document.addEventListener('keydown', function (e) {
      if (!open) return;
      if (e.key === 'Tab') {
        trapDialogKey(e, overlay, closeDial);
        return;
      }
      if (e.key === 'Escape') closeDial();
      else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') snapTo(Math.round(theta / STEP) * STEP - STEP);
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') snapTo(Math.round(theta / STEP) * STEP + STEP);
      else if (e.key === 'Enter') closeDial();
      else return;
      e.preventDefault();
      e.stopPropagation();
    }, true);

    trigger.addEventListener('click', openDial);
    trigger.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDial(); }
    });
  }

  /* -------------------------------------------------------
     18b. PASSION WHEEL — Color orb navigation (legacy, safe no-op)
  ------------------------------------------------------- */
  function initPassionWheel() {
    var wheel = document.getElementById('passionWheel');
    if (!wheel) return;

    var orbs = $$('.pw-orb', wheel);
    var contents = $$('.tab-content');
    var centerName = document.getElementById('pwCenterName');
    var centerSub = document.getElementById('pwCenterSub');
    var wrapper = document.querySelector('.tab-content-wrapper');
    var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    var CATS = [
      { id: 'sports', label: '运动', en: 'Sports', color: [168,204,136], hex: '#a8cc88', bright: [192,224,160] },
      { id: 'music',  label: '音乐', en: 'Music',  color: [196,160,232], hex: '#c4a0e8', bright: [216,186,240] },
      { id: 'books',  label: '阅读', en: 'Books',  color: [212,165,116], hex: '#d4a574', bright: [224,188,146] },
      { id: 'skills', label: '技能', en: 'Skills', color: [110,184,212], hex: '#6eb8d4', bright: [142,204,228] }
    ];

    var activeIndex = 0;

    setActiveColors(0, true);
    updateWrapperHeight();

    // Click to select
    orbs.forEach(function(orb) {
      orb.addEventListener('click', function() {
        var idx = parseInt(orb.getAttribute('data-index'));
        switchTo(idx);
      });
    });

    // Touch swipe on wheel
    var startX = 0, startY = 0, swiping = false;

    wheel.addEventListener('touchstart', function(e) {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      swiping = true;
    }, { passive: true });

    wheel.addEventListener('touchmove', function(e) {
      if (!swiping) return;
      if (Math.abs(e.touches[0].clientY - startY) > Math.abs(e.touches[0].clientX - startX) && Math.abs(e.touches[0].clientY - startY) > 20) {
        swiping = false;
      }
    }, { passive: true });

    wheel.addEventListener('touchend', function(e) {
      if (!swiping) return;
      swiping = false;
      var dx = e.changedTouches[0].clientX - startX;
      var dy = e.changedTouches[0].clientY - startY;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        if (dx < 0) switchTo((activeIndex + 1) % 4);
        else switchTo((activeIndex + 3) % 4);
      }
    }, { passive: true });

    // Keyboard
    document.addEventListener('keydown', function(e) {
      if (!wheel.closest('#main')) return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { switchTo((activeIndex + 1) % 4); e.preventDefault(); }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { switchTo((activeIndex + 3) % 4); e.preventDefault(); }
      if (e.key >= '1' && e.key <= '4') { switchTo(parseInt(e.key) - 1); }
    });

    function switchTo(index) {
      if (index === activeIndex) return;
      var oldIndex = activeIndex;
      activeIndex = index;

      // Update orbs
      orbs.forEach(function(o) { o.classList.remove('active'); });
      orbs[index].classList.add('active');

      // Fade center text
      if (centerName) {
        centerName.style.opacity = '0';
        setTimeout(function() {
          centerName.textContent = CATS[index].label;
          centerName.style.opacity = '1';
        }, 150);
      }
      if (centerSub) {
        centerSub.style.opacity = '0';
        setTimeout(function() {
          centerSub.textContent = CATS[index].en;
          centerSub.style.opacity = '1';
        }, 150);
      }

      // Content slide direction
      var direction = index > oldIndex ? 1 : -1;
      if (oldIndex === 0 && index === 3) direction = -1;
      if (oldIndex === 3 && index === 0) direction = 1;

      var oldContent = contents[oldIndex];
      var newContent = contents[index];

      if (oldContent) {
        oldContent.classList.add('leaving');
        oldContent.classList.add(direction >= 0 ? 'leaving-left' : 'leaving-right');
        setTimeout(function() {
          oldContent.classList.remove('active', 'leaving', 'leaving-left', 'leaving-right');
        }, reducedMotion ? 0 : 350);
      }

      setTimeout(function() {
        if (newContent) newContent.classList.add('active');
        updateWrapperHeight();
        newContent.querySelectorAll('.reveal, .reveal-left, .reveal-scale').forEach(function(el) {
          el.classList.remove('revealed');
          setTimeout(function() { el.classList.add('revealed'); }, 50);
        });
        newContent.querySelectorAll('.skill-level').forEach(function(bar) {
          var w = bar.style.width;
          bar.style.width = '0%';
          setTimeout(function() { bar.style.width = w; }, 100);
        });
      }, reducedMotion ? 0 : 150);

      setActiveColors(index, false);
      if (navigator.vibrate) navigator.vibrate(10);
    }

    function setActiveColors(index, instant) {
      var cat = CATS[index];
      var r = document.documentElement;
      if (instant || reducedMotion) {
        r.style.setProperty('--gold', cat.hex);
        r.style.setProperty('--gold-bright', 'rgb(' + cat.bright.join(',') + ')');
        r.style.setProperty('--gold-dim', 'rgba(' + cat.color.join(',') + ',0.14)');
        r.style.setProperty('--gold-glow', 'rgba(' + cat.color.join(',') + ',0.07)');
        return;
      }

      var startColor = getComputedStyle(r).getPropertyValue('--gold').trim();
      var startRGB = parseRGB(startColor);
      var endRGB = cat.color;
      var duration = 500;
      var startTime = null;

      function frame(ts) {
        if (!startTime) startTime = ts;
        var t = Math.min((ts - startTime) / duration, 1);
        t = 1 - Math.pow(1 - t, 3);
        var cr = Math.round(startRGB[0] + (endRGB[0] - startRGB[0]) * t);
        var cg = Math.round(startRGB[1] + (endRGB[1] - startRGB[1]) * t);
        var cb = Math.round(startRGB[2] + (endRGB[2] - startRGB[2]) * t);
        r.style.setProperty('--gold', 'rgb(' + cr + ',' + cg + ',' + cb + ')');
        r.style.setProperty('--gold-dim', 'rgba(' + cr + ',' + cg + ',' + cb + ',0.14)');
        r.style.setProperty('--gold-glow', 'rgba(' + cr + ',' + cg + ',' + cb + ',0.07)');
        if (t < 1) requestAnimationFrame(frame);
        else r.style.setProperty('--gold-bright', 'rgb(' + cat.bright.join(',') + ')');
      }
      requestAnimationFrame(frame);
    }

    function parseRGB(str) {
      if (str.charAt(0) === '#') {
        var hex = str.replace('#', '');
        return [parseInt(hex.substr(0,2),16), parseInt(hex.substr(2,2),16), parseInt(hex.substr(4,2),16)];
      }
      var m = str.match(/(\d+)/g);
      return m ? [parseInt(m[0]), parseInt(m[1]), parseInt(m[2])] : [168, 204, 136];
    }

    function updateWrapperHeight() {
      if (!wrapper) return;
      var active = wrapper.querySelector('.tab-content.active');
      if (active) {
        wrapper.style.height = active.scrollHeight + 'px';
        setTimeout(function() { wrapper.style.height = 'auto'; }, 600);
      }
    }
  }

  /* -------------------------------------------------------
     PRODUCT THEATER — in-page live product experience
  ------------------------------------------------------- */
  function initProductTheater() {
    // Delegated: theater CTAs can be re-rendered at any time
    // (the Growth Rings stage rebuilds its card on every switch).
    var overlay = null;
    var title, openLink, closeBtn, frame, loading;
    var iframe = null;
    var previousFocus = null;

    function ensureOverlay() {
      if (overlay) return;
      overlay = document.createElement('div');
      overlay.className = 'product-theater';
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');
      overlay.setAttribute('aria-labelledby', 'productTheaterTitle');
      overlay.innerHTML =
        '<div class="pt-bar">' +
          '<span class="pt-title" id="productTheaterTitle"></span>' +
          '<a class="pt-open" href="" target="_blank" rel="noopener">新窗口打开 ↗</a>' +
          '<button class="pt-close" aria-label="Close">×</button>' +
        '</div>' +
        '<div class="pt-frame"><span class="pt-loading">LOADING…</span></div>';
      document.body.appendChild(overlay);

      title = overlay.querySelector('.pt-title');
      openLink = overlay.querySelector('.pt-open');
      closeBtn = overlay.querySelector('.pt-close');
      frame = overlay.querySelector('.pt-frame');
      loading = overlay.querySelector('.pt-loading');
      closeBtn.addEventListener('click', closeTheater);
    }

    function openTheater(url, name) {
      ensureOverlay();
      previousFocus = document.activeElement;
      title.textContent = name;
      openLink.href = url;
      loading.style.display = '';
      // Lazy-create the iframe only when the visitor asks for it
      iframe = document.createElement('iframe');
      iframe.setAttribute('allow', 'clipboard-write');
      iframe.addEventListener('load', function () {
        loading.style.display = 'none';
      });
      iframe.src = url;
      frame.appendChild(iframe);
      overlay.classList.add('open');
      lockPage();
      window.requestAnimationFrame(function () { closeBtn.focus(); });
    }

    function closeTheater() {
      if (!overlay || !overlay.classList.contains('open')) return;
      overlay.classList.remove('open');
      unlockPage();
      if (iframe) { iframe.remove(); iframe = null; }
      if (previousFocus && previousFocus.focus) previousFocus.focus();
      previousFocus = null;
    }

    document.addEventListener('click', function (e) {
      var el = e.target && e.target.closest
        ? e.target.closest('.timeline-cta[data-theater-title]')
        : null;
      if (!el) return;
      e.preventDefault();
      openTheater(el.getAttribute('href'), el.getAttribute('data-theater-title'));
    });

    document.addEventListener('keydown', function (e) {
      if (overlay && overlay.classList.contains('open')) trapDialogKey(e, overlay, closeTheater);
    });
  }

  /* -------------------------------------------------------
     WORK STATUS — live day counter since 2026-05-08
  ------------------------------------------------------- */
  function initWorkStatus() {
    var el = $('#workStatusDay');
    if (!el) return;

    var days = daysSinceStart();

    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || !('IntersectionObserver' in window)) {
      el.textContent = days;
      return;
    }

    el.textContent = '0';
    var io = new IntersectionObserver(function (entries) {
      if (!entries[0].isIntersecting) return;
      io.disconnect();
      var t0 = null;
      var dur = 1200;
      function tick(t) {
        if (t0 === null) t0 = t;
        var p = Math.min((t - t0) / dur, 1);
        p = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.round(p * days);
        if (p < 1) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    }, { threshold: 0.4 });
    io.observe(el);
  }

  /* -------------------------------------------------------
     GROWTH RINGS — the Work page as a tree cross-section.
     One ring per project, growing outward from the seed
     (2026-05-08). Content lives in the hidden semantic list
     #ringsData (SEO / screen readers / no-JS); the canvas is
     purely its visualization. Hover / tap a ring, use the
     steppers, arrow keys, or swipe the stage to browse.
  ------------------------------------------------------- */
  function initGrowthRings() {
    var wrap = $('#ringsWrap');
    var canvas = $('#ringsCanvas');
    var stage = $('#ringsStage');
    var dataEl = $('#ringsData');
    if (!wrap || !canvas || !stage || !dataEl) return;

    var works = $$('#ringsData > li').map(function (li) {
      var h3 = li.querySelector('h3');
      var p = li.querySelector('p');
      return {
        index: li.getAttribute('data-index') || '',
        type: li.getAttribute('data-type') || '',
        chip: li.getAttribute('data-chip') || '',
        year: li.getAttribute('data-year') || '',
        img: li.getAttribute('data-img') || '',
        width: li.getAttribute('data-width') || '',
        height: li.getAttribute('data-height') || '',
        url: li.getAttribute('data-url') || '#',
        cta: li.getAttribute('data-cta') || '查看',
        theater: li.getAttribute('data-theater'),
        tags: (li.getAttribute('data-tags') || '').split(',').filter(Boolean),
        title: h3 ? h3.innerHTML : '',
        desc: p ? p.innerHTML : ''
      };
    });
    var N = works.length;
    if (!N) return;
    // Real (grown) rings — the trailing "next" slot is a ring not yet formed
    var nReal = works.filter(function (w) { return w.type !== 'next'; }).length;

    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Deterministic PRNG — the tree must look the same on every visit
    function mulberry32(seed) {
      return function () {
        seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
        var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }

    // Per-boundary low-frequency harmonics → organic, hand-drawn rings
    var harmonics = [];
    for (var i = 0; i <= N; i++) {
      var rnd = mulberry32(i * 977 + 13);
      harmonics.push([
        { k: 2, a: 0.5 + rnd() * 0.5, p: rnd() * Math.PI * 2 },
        { k: 3, a: 0.3 + rnd() * 0.5, p: rnd() * Math.PI * 2 },
        { k: 5, a: 0.15 + rnd() * 0.35, p: rnd() * Math.PI * 2 }
      ]);
    }

    var ctx = canvas.getContext('2d');
    var side = 0, dpr = 1, cx = 0, cy = 0, R0 = 0, band = 0;
    var grain = null;

    function layout() {
      var rect = wrap.getBoundingClientRect();
      side = Math.floor(Math.min(rect.width, rect.height));
      if (side < 120) side = 120;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = side * dpr;
      canvas.height = side * dpr;
      canvas.style.width = side + 'px';
      canvas.style.height = side + 'px';
      cx = cy = side / 2;
      R0 = side * 0.05;
      var usable = side / 2 - side * 0.06 - R0;
      band = usable / (N + 0.35);
      buildGrain();
    }

    // Static wood-grain flecks, pre-rendered once per layout
    function buildGrain() {
      grain = document.createElement('canvas');
      grain.width = side * dpr;
      grain.height = side * dpr;
      var g = grain.getContext('2d');
      g.scale(dpr, dpr);
      var rnd = mulberry32(4242);
      for (var i = 0; i < 420; i++) {
        var a = rnd() * Math.PI * 2;
        var rr = R0 + rnd() * band * nReal;
        var s = 0.4 + rnd() * 0.9;
        g.fillStyle = 'rgba(228,224,216,' + (0.02 + rnd() * 0.05).toFixed(3) + ')';
        g.fillRect(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, s, s);
      }
    }

    function boundaryRadius(i, theta, drift) {
      var r = R0 + i * band;
      var amp = band * 0.11;
      var h = harmonics[i];
      for (var j = 0; j < 3; j++) {
        r += Math.sin(h[j].k * theta + h[j].p + drift * (j + 1) * 0.6) * amp * h[j].a;
      }
      return r;
    }

    var SEG = 130;
    function tracePath(i, drift, sweep) {
      var end = (sweep === undefined || sweep >= 1)
        ? SEG
        : Math.max(2, Math.round(SEG * sweep));
      ctx.beginPath();
      for (var s = 0; s <= end; s++) {
        var th = (s / SEG) * Math.PI * 2 - Math.PI / 2;
        var r = boundaryRadius(i, th, drift);
        var x = cx + Math.cos(th) * r;
        var y = cy + Math.sin(th) * r;
        if (s === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      if (sweep === undefined || sweep >= 1) ctx.closePath();
    }

    var selected = 0;
    var entrance = reduce ? 1 : 0;
    var entranceT0 = null;
    var started = false;
    var running = false;

    function fillBand(k, alpha, drift) {
      ctx.save();
      ctx.beginPath();
      var s, th, r, x, y;
      for (s = 0; s <= SEG; s++) {
        th = (s / SEG) * Math.PI * 2 - Math.PI / 2;
        r = boundaryRadius(k + 1, th, drift);
        x = cx + Math.cos(th) * r;
        y = cy + Math.sin(th) * r;
        if (s === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath();
      for (s = 0; s <= SEG; s++) {
        th = (s / SEG) * Math.PI * 2 - Math.PI / 2;
        r = boundaryRadius(k, th, drift);
        x = cx + Math.cos(th) * r;
        y = cy + Math.sin(th) * r;
        if (s === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fillStyle = 'rgba(168,204,136,' + alpha + ')';
      ctx.fill('evenodd');
      ctx.restore();
    }

    function draw(t) {
      var drift = reduce ? 0 : (t || 0) * 0.00004;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, side, side);

      if (grain && entrance >= 1) {
        ctx.drawImage(grain, 0, 0, side, side);
      }

      if (entrance >= 1) fillBand(selected, 0.09, drift);

      for (var i = 1; i <= N; i++) {
        var k = i - 1;
        var sweep = 1;
        if (entrance < 1) {
          var startAt = (k / N) * 0.62;
          var local = (entrance - startAt) / 0.38;
          if (local <= 0) continue;
          sweep = local >= 1 ? 1 : 1 - Math.pow(1 - local, 3);
        }
        var type = works[k].type;
        var isSel = k === selected && entrance >= 1;
        ctx.save();
        if (type === 'next') {
          // The ring not yet formed — dashed, slowly breathing
          var tt0 = t || 0;
          var breathe = reduce ? 0.28 : 0.22 + 0.14 * Math.sin(tt0 / 2400 * Math.PI * 2);
          ctx.strokeStyle = 'rgba(168,204,136,' + (isSel ? 0.6 : breathe).toFixed(3) + ')';
          ctx.lineWidth = 1;
          ctx.setLineDash([2.5, 6.5]);
          if (!reduce) ctx.lineDashOffset = -tt0 * 0.004;
          if (isSel) {
            ctx.shadowColor = 'rgba(168,204,136,0.35)';
            ctx.shadowBlur = 8;
          }
        } else if (type === 'flagship') {
          ctx.strokeStyle = isSel ? 'rgba(200,230,168,0.95)' : 'rgba(168,204,136,0.55)';
          ctx.lineWidth = 1.8;
          ctx.shadowColor = 'rgba(168,204,136,0.4)';
          ctx.shadowBlur = isSel ? 10 : 6;
        } else {
          ctx.strokeStyle = isSel ? 'rgba(200,230,168,0.85)' : 'rgba(228,224,216,0.16)';
          ctx.lineWidth = isSel ? 1.4 : 1;
          if (isSel) {
            ctx.shadowColor = 'rgba(168,204,136,0.35)';
            ctx.shadowBlur = 8;
          }
        }
        tracePath(i, drift, sweep < 1 ? sweep : undefined);
        ctx.stroke();
        ctx.restore();
      }

      // Seed dot — the origin, 2026-05-08
      var pop = entrance < 0.08 ? entrance / 0.08 : 1;
      ctx.save();
      ctx.fillStyle = 'rgba(168,204,136,0.95)';
      ctx.shadowColor = 'rgba(168,204,136,0.8)';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(cx, cy, 2.4 * pop, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Selected ring index at 12 o'clock
      if (entrance >= 1) {
        var rMid = R0 + (selected + 0.5) * band;
        ctx.save();
        ctx.font = '700 10px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = 'rgba(200,230,168,0.9)';
        ctx.fillText(works[selected].index, cx, cy - rMid);
        ctx.restore();
      }

    }

    var lastFrame = 0;
    function loop(t) {
      if (!running) return;
      lastFrame = t;
      if (entrance < 1 && started) {
        if (entranceT0 === null) entranceT0 = t;
        entrance = Math.min(1, (t - entranceT0) / 1600);
      }
      draw(t);
      requestAnimationFrame(loop);
    }

    function rafAlive() {
      return running && (performance.now() - lastFrame < 200);
    }

    // If rAF or the IntersectionObserver is frozen (page loaded in a
    // background tab), finish the entrance by timer so the tree is
    // there — and interactive — when the tab is revealed.
    function ensureEntranceFallback() {
      setTimeout(function () {
        if (!started) { started = true; startCaption(); }
        if (entrance < 1) { entrance = 1; draw(0); }
      }, 2400);
    }

    function setRunning(v) {
      if (v === running) return;
      running = v;
      if (v) requestAnimationFrame(loop);
    }

    /* ——— Stage (the product card) ——— */
    var content = document.createElement('div');
    content.className = 'stage-content';
    stage.appendChild(content);

    var foot = document.createElement('div');
    foot.className = 'stage-foot';
    foot.innerHTML =
      '<div class="rings-stepper">' +
        '<button type="button" class="rs-prev" aria-label="上一件作品">‹</button>' +
        '<span class="rs-pos"><em class="rs-cur">01</em><span class="rs-sep"> / </span>' +
          '<span class="rs-total">' + (N < 10 ? '0' + N : N) + '</span></span>' +
        '<button type="button" class="rs-next" aria-label="下一件作品">›</button>' +
      '</div>';
    stage.appendChild(foot);
    var posCur = foot.querySelector('.rs-cur');

    function stageHTML(w) {
      var chipClass = 'status-chip' + (w.chip.indexOf('Live') > -1 ? ' live' : '');
      var tags = w.tags.map(function (tg) {
        return '<span class="tag">' + tg + '</span>';
      }).join('');
      if (w.type === 'next') {
        // The reserved slot — no product, just the promise
        return (
          '<div class="stage-meta">' +
            '<span class="section-number">Next / ' + w.index + '</span>' +
          '</div>' +
          '<h3 class="stage-title">' + w.title + '</h3>' +
          '<p class="stage-desc">' + w.desc + '</p>'
        );
      }
      return (
        '<div class="stage-meta">' +
          '<span class="section-number">' + w.index + ' / ' + w.year + '</span>' +
          '<span class="' + chipClass + '">' + w.chip + '</span>' +
        '</div>' +
        '<h3 class="stage-title">' + w.title + '</h3>' +
        '<div class="stage-thumb"><img src="' + w.img + '" alt="' + w.title + '截图"' +
          ' width="' + w.width + '" height="' + w.height + '" decoding="async" fetchpriority="high"></div>' +
        '<p class="stage-desc">' + w.desc + '</p>' +
        '<div class="timeline-tags">' + tags + '</div>' +
        '<a class="timeline-cta" href="' + w.url + '" target="_blank"' +
          (w.theater ? ' data-theater-title="' + w.theater + '"' : ' rel="noopener"') +
        '>' + w.cta + '</a>'
      );
    }

    function renderStage(k) {
      content.innerHTML = stageHTML(works[k]);
      content.classList.toggle('stage-next', works[k].type === 'next');
    }

    var prevBtn = foot.querySelector('.rs-prev');
    var nextBtn = foot.querySelector('.rs-next');

    var switching = false;
    function setWork(k, instant) {
      // Clamp at both ends — the shelf has a first and a last ring
      k = Math.max(0, Math.min(N - 1, k));
      var changed = k !== selected;
      if (!changed && content.innerHTML !== '') return;
      selected = k;
      posCur.textContent = works[k].index;
      prevBtn.disabled = k === 0;
      nextBtn.disabled = k === N - 1;
      if (reduce || instant) {
        renderStage(k);
        if (reduce || !rafAlive()) draw(0);
        return;
      }
      if (switching) return; // timeout below renders the latest `selected`
      switching = true;
      content.classList.add('stage-out');
      setTimeout(function () {
        renderStage(selected);
        posCur.textContent = works[selected].index;
        content.classList.remove('stage-out');
        switching = false;
        if (!rafAlive()) draw(0);
      }, 170);
    }

    /* ——— Interaction ——— */
    // snap=true: clamp to the nearest ring (fat-finger friendly) —
    // only a distance far beyond the outer ring counts as a miss.
    function bandFromEvent(e, snap) {
      var rect = canvas.getBoundingClientRect();
      var x = e.clientX - rect.left - cx;
      var y = e.clientY - rect.top - cy;
      var d = Math.sqrt(x * x + y * y);
      if (snap) {
        if (d > R0 + N * band + band * 1.5) return -1;
        return Math.max(0, Math.min(N - 1, Math.floor((d - R0) / band)));
      }
      var k = Math.floor((d - R0) / band);
      if (d < R0) k = 0;
      return (k >= 0 && k < N) ? k : -1;
    }

    function buzz() {
      try {
        if (navigator.vibrate) navigator.vibrate(8);
      } catch (err) { /* no haptics — fine */ }
    }

    // Drag-scrub: press and slide radially to dial through the rings.
    // Precision comes from dragging + live highlight, not from landing
    // a single tap on an 8px band.
    var dragging = false;

    canvas.addEventListener('pointerdown', function (e) {
      dragging = true;
      try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
      var k = bandFromEvent(e, true);
      if (k >= 0 && k !== selected) { setWork(k, true); buzz(); }
    });

    canvas.addEventListener('pointermove', function (e) {
      if (dragging) {
        var k = bandFromEvent(e, true);
        if (k >= 0 && k !== selected) { setWork(k, true); buzz(); }
        return;
      }
      if (e.pointerType === 'mouse') {
        var h = bandFromEvent(e);
        canvas.style.cursor = h >= 0 ? 'pointer' : '';
        if (h >= 0 && h !== selected) setWork(h);
      }
    });

    canvas.addEventListener('pointerup', function () { dragging = false; });
    canvas.addEventListener('pointercancel', function () { dragging = false; });

    canvas.addEventListener('click', function (e) {
      var k = bandFromEvent(e, true);
      if (k >= 0) setWork(k);
    });

    stage.addEventListener('click', function (e) {
      var el = e.target;
      if (!el || !el.closest) return;
      if (el.closest('.rs-prev')) setWork(selected - 1);
      else if (el.closest('.rs-next')) setWork(selected + 1);
    });

    wrap.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault(); setWork(selected - 1);
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault(); setWork(selected + 1);
      }
    });

    var swipeX = null;
    stage.addEventListener('touchstart', function (e) {
      swipeX = e.touches[0].clientX;
    }, { passive: true });
    stage.addEventListener('touchend', function (e) {
      if (swipeX === null) return;
      var dx = e.changedTouches[0].clientX - swipeX;
      swipeX = null;
      if (Math.abs(dx) > 40) setWork(selected + (dx < 0 ? 1 : -1));
    }, { passive: true });

    /* ——— Caption: ● N 圈年轮 ── 第 D 天，仍在生长 ——— */
    function animateCount(el, target, dur) {
      if (!el) return;
      if (reduce) { el.textContent = target; return; }
      var t0 = null;
      function tick(t) {
        if (t0 === null) t0 = t;
        var p = Math.min((t - t0) / dur, 1);
        p = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.round(p * target);
        if (p < 1) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    }

    var captionDone = false;
    function startCaption() {
      if (captionDone) return;
      captionDone = true;
      var cap = $('#ringsCaption');
      if (cap) cap.classList.add('on');
      animateCount($('#ringsCount'), nReal, 1600);
    }

    /* ——— Boot ——— */
    layout();
    setWork(0, true);

    // Re-layout whenever the wrap's box changes (initial 0-size layout,
    // font load reflow, rotation) — not just window resize.
    if ('ResizeObserver' in window) {
      var lastSide = side;
      var ro = new ResizeObserver(function () {
        layout();
        if (side !== lastSide) {
          lastSide = side;
          if (reduce || !running) draw(0);
        }
      });
      ro.observe(wrap);
    } else {
      window.addEventListener('resize', function () {
        layout();
        if (reduce || !running) draw(0);
      });
    }

    if (reduce) {
      entrance = 1;
      draw(0);
      startCaption();
      return;
    }

    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        var vis = entries[0].isIntersecting;
        if (vis && !started) { started = true; startCaption(); }
        setRunning(vis && started);
      }, { threshold: 0.2 });
      io.observe(wrap);
    } else {
      started = true;
      startCaption();
      setRunning(true);
    }
    ensureEntranceFallback();
  }

  /* -------------------------------------------------------
     BECOMING STATUS — unfinished sentence typewriter
     Cycles the 8 statement labels after "I AM BECOMING",
     cursor never stops blinking. Reduced motion → static
     prefix + solid cursor (a sentence left unfinished).
  ------------------------------------------------------- */
  function initBecomingStatus() {
    var word = $('#becomingWord');
    if (!word) return;
    var status = word.closest('.becoming-status');

    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;

    var WORDS = [
      'CLEAR THINKER',
      'PROBLEM DEFINER',
      'ENGLISH INFO INPUT',
      'AI COLLABORATOR',
      'TOOL BUILDER',
      'CLEAR COMMUNICATOR',
      'LIFELONG LEARNER',
      'NARRATIVE CONSISTENCY'
    ];

    // 第九个词：还没解析出来的身份 — 乱码 + 结尾一个 ?
    var GLITCH_CHARS = '█▓▒░#%/\\<>*+=';
    var GLITCH_LEN = 9;

    function randGlitch(n) {
      var s = '';
      for (var i = 0; i < n; i++) {
        s += GLITCH_CHARS.charAt(Math.floor(Math.random() * GLITCH_CHARS.length));
      }
      return s + '?';
    }

    var wi = 0;
    var ci = 0;
    var deleting = false;
    var current = WORDS[0];

    function holdThenDelete(w) {
      deleting = true;
      status.classList.remove('is-typing');
      if (wi === WORDS.length) {
        // 乱码词在停顿期间持续闪变，末尾的 ? 不动
        var flickers = 0;
        var fl = setInterval(function () {
          current = randGlitch(GLITCH_LEN);
          word.textContent = current;
          flickers++;
          if (flickers >= 25) {
            clearInterval(fl);
            setTimeout(tick, 300);
          }
        }, 80);
      } else {
        setTimeout(tick, 2000);
      }
    }

    function tick() {
      if (!deleting) {
        ci++;
        word.textContent = current.slice(0, ci);
        if (ci === current.length) {
          holdThenDelete(current);
          return;
        }
        status.classList.add('is-typing');
        setTimeout(tick, 70);
      } else {
        ci--;
        word.textContent = current.slice(0, ci);
        if (ci === 0) {
          deleting = false;
          wi = (wi + 1) % (WORDS.length + 1);
          if (wi === WORDS.length) {
            current = randGlitch(GLITCH_LEN);
            status.classList.add('is-glitch');
          } else {
            current = WORDS[wi];
            status.classList.remove('is-glitch');
          }
          status.classList.remove('is-typing');
          setTimeout(tick, 500);
          return;
        }
        setTimeout(tick, 35);
      }
    }

    setTimeout(tick, 900);
  }

  /* -------------------------------------------------------
     ME PAGE — Creative 1: Exploded blueprint (mobile trigger)
     Desktop explodes on :hover via CSS; mobile explodes on
     scroll-in, holds 3.2s, then reassembles.
  ------------------------------------------------------- */
  function initDecompose() {
    var card = $('.me-card-decompose');
    if (!card || canFineHover()) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          setTimeout(function () { card.classList.add('is-decomposed'); }, 400);
          setTimeout(function () { card.classList.remove('is-decomposed'); }, 3600);
        }
      });
    }, { threshold: 0.7 });
    io.observe(card);
  }

  /* -------------------------------------------------------
     ME PAGE — Creative 2: The curve that remembers
     1 second on page = 1 day. y = 1.01^days, drawn live.
     Days persist in localStorage across visits; the curve
     is allowed to climb out of its chart slot ("escape").
  ------------------------------------------------------- */
  function initCompound() {
    var canvas = $('#compoundCanvas');
    var label = $('#compoundLabel');
    var escapeEl = $('#compoundEscape');
    var memory = $('#compoundMemory');
    if (!canvas || !canvas.getContext) return;

    var KEY = 'jue_compound_days';
    var days = parseFloat(storageGet(KEY, '0')) || 0;

    if (days >= 1 && memory) {
      memory.textContent = '这条曲线记得你上次来 — 已累计 ' + Math.floor(days) + ' 天。它一直在长。';
    }

    var ctx = canvas.getContext('2d');
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var W = 0, H = 0;
    var CONTAINER = 2.4;    // the dashed "container" is anchored at ×2.4 (a value, not a pixel)
    var vmax = 2.6;         // top of the visible y-domain; the camera pulls back as value grows

    function resize() {
      W = canvas.clientWidth;
      H = canvas.clientHeight;
      canvas.width = W * dpr;      // note: resetting width clears the canvas
      canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener('resize', function () { resize(); draw(); });

    function valueAt(d) { return Math.pow(1.01, d); }
    function vmaxTarget() { return Math.max(2.6, valueAt(days) * 1.12); }
    function yOf(v) { return H - (v - 1) / (vmax - 1) * (H - 14); }   // 14px top padding

    function fmtMult(v) {
      if (v < 10) return '×' + v.toFixed(2);
      if (v < 100) return '×' + v.toFixed(1);
      if (v < 10000) return '×' + Math.round(v);
      return '×' + (v / 10000).toFixed(1) + '万';
    }

    function draw() {
      ctx.clearRect(0, 0, W, H);

      // the "container" — anchored at ×2.4; sinks toward the floor as the camera pulls back
      var cy = yOf(CONTAINER);
      ctx.strokeStyle = 'rgba(228, 224, 216, 0.09)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 5]);
      ctx.beginPath();
      ctx.moveTo(0, cy);
      ctx.lineTo(W, cy);
      ctx.stroke();
      ctx.setLineDash([]);

      // the curve — gold below the container value, warm orange beyond it
      var maxDay = Math.max(120, days);
      var cStop = Math.min(Math.max((H - cy) / H, 0), 0.88);   // container position, from bottom
      var grad = ctx.createLinearGradient(0, H, 0, 0);
      grad.addColorStop(0, 'rgba(168, 204, 136, 0.9)');
      grad.addColorStop(cStop, 'rgba(168, 204, 136, 0.9)');
      grad.addColorStop(Math.min(cStop + 0.12, 1), 'rgba(212, 115, 74, 0.9)');
      grad.addColorStop(1, 'rgba(212, 115, 74, 0.9)');
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      var steps = 80;
      for (var i = 0; i <= steps; i++) {
        var d = days * (i / steps);
        var x = W * (d / maxDay);
        var y = yOf(valueAt(d));
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // tip dot
      var value = valueAt(days);
      var tipX = W * (days / maxDay);
      var tipY = yOf(value);
      var escaped = value > CONTAINER;
      ctx.fillStyle = escaped ? 'rgba(212, 115, 74, 1)' : 'rgba(192, 224, 160, 1)';
      ctx.beginPath();
      ctx.arc(tipX, tipY, 2.2, 0, 7);
      ctx.fill();

      if (label) label.textContent = 'DAY ' + Math.floor(days) + ' → ' + fmtMult(value);
      if (escaped && escapeEl) escapeEl.classList.add('visible');
    }

    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { vmax = vmaxTarget(); draw(); return; }

    var rafId = null;
    var last = null;
    var lastSave = 0;

    function frame(t) {
      if (last !== null && !document.hidden) {
        days += (t - last) / 1000;   // 1 real second = 1 day
        if (t - lastSave > 2000) {
          lastSave = t;
          storageSet(KEY, days.toFixed(2));
        }
      }
      last = t;
      vmax += (vmaxTarget() - vmax) * 0.05;   // the camera pulls back to keep the curve in frame
      draw();
      rafId = requestAnimationFrame(frame);
    }

    var io = new IntersectionObserver(function (entries) {
      if (entries[0].isIntersecting) {
        if (!rafId) { last = null; rafId = requestAnimationFrame(frame); }
      } else if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
        storageSet(KEY, days.toFixed(2));
      }
    }, { threshold: 0.2 });
    io.observe(canvas);

    window.addEventListener('pagehide', function () {
      storageSet(KEY, days.toFixed(2));
    });
  }

  /* -------------------------------------------------------
     ME PAGE — Creative 3: Interactive shell
     Boots with 4 auto-typed lines, then hands the prompt
     to the visitor. Real commands, real easter eggs.
  ------------------------------------------------------- */
  function initShell() {
    var win = $('#terminalWindow');
    var output = $('#terminalOutput');
    var inputRow = $('#terminalInputRow');
    var input = $('#terminalInput');
    if (!win || !output || !input) return;

    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var PROMPT = 'visitor@jue:~$ ';

    var BOOT = [
      ['whoami', '大一学生'],
      ['direction', '计算机科学与技术'],
      ['rhythm', '稳步前进，不急于求成'],
      ['mission', '做一个有趣的人 ━ 为世界创造美和价值']
    ];

    function scrollDown() { win.scrollTop = win.scrollHeight; }

    function addLine(spans) {
      var div = document.createElement('div');
      spans.forEach(function (s) {
        var el = document.createElement('span');
        el.className = s[0];
        el.textContent = s[1];
        div.appendChild(el);
      });
      output.appendChild(div);
      scrollDown();
      return div;
    }

    function echo(text, cls) { addLine([[cls || 't-val', text]]); }

    function uptimeDays() {
      var start = new Date(2026, 4, 8);
      var d = Math.floor((Date.now() - start.getTime()) / 86400000) + 1;
      return d < 1 ? 1 : d;
    }

    // friends' birthdays — placeholder names for now, month/day only (this is public source)
    var FRIENDS = {
      '占位名一': '5月20日',
      '占位名二': '11月3日'
    };

    function run(raw) {
      var cmd = raw.trim();
      addLine([['t-prompt', PROMPT], ['t-cmd', cmd]]);
      if (!cmd) { scrollDown(); return; }

      var parts = cmd.split(/\s+/);
      var head = parts[0].toLowerCase();

      if (head === 'help') {
        echo('可用命令：');
        echo('  whoami        你是谁');
        echo('  uptime        我构建了多久');
        echo('  ls            看看这里有什么');
        echo('  cat <file>    读一个文件');
        echo('  sudo <想做的>  试试就知道');
        echo('  clear / exit');
      } else if (head === 'whoami') {
        echo('访客。但输入 sudo hug 可以升级为朋友。');
      } else if (head === 'uptime') {
        echo('已持续构建 ' + uptimeDays() + ' 天（自 2026-05-08，仍在运行）');
      } else if (head === 'ls') {
        var dir = (parts[1] || '').replace(/\/$/, '');
        if (dir === 'friends') {
          echo('surprise.txt');
        } else if (!dir) {
          echo('values/   dreams.txt   passions/   friends/');
        } else {
          echo('ls: ' + dir + ': 没有这个目录');
        }
      } else if (head === 'cat') {
        var file = parts[1] || '';
        if (file === 'dreams.txt' || file === 'dreams') {
          echo('我在成为:');
          echo('  01 清晰思考者： 把混乱问题整理成清晰结构');
          echo('  02 问题定义者：先定义问题,再寻找答案');
          echo('  03 英语信息输入者：把英语当作信息接口');
          echo('  04 AI 协作者：用 AI 放大判断力,而不是替代思考');
          echo('  05 工具创造者：把真实痛点做成可用工具');
          echo('  06 清晰表达者：用写作整理思考');
          echo('  07 长期学习者：让知识在多年里持续复利');
          echo('  08 叙事一致者：让行动逐渐匹配所说的方向');
        } else if (file === 'friends/surprise.txt' || file === 'surprise.txt') {
          echo('你可以在输入框里直接输入你的名字试试,如果我记得你的话,这里会显示你的生日哦~', 't-accent');
        } else if (!file) {
          echo('cat: 想读哪个文件？试试 cat dreams.txt');
        } else {
          echo('cat: ' + file + ': 没有这个文件。试试 cat dreams.txt');
        }
      } else if (head === 'sudo') {
        echo('权限不需要~我们已经是朋友啦。', 't-accent');
      } else if (head === 'clear') {
        output.textContent = '';
      } else if (head === 'exit') {
        echo('exit: 你不能退出别人的人生 :)');
      } else if (head === 'direction') {
        echo('计算机科学与技术');
      } else if (head === 'rhythm') {
        echo('稳步前进，不急于求成');
      } else if (head === 'mission') {
        echo('做一个有趣的人 ━ 为世界创造美和价值');
      } else if (FRIENDS[cmd]) {
        echo('记得你!你的生日是 ' + FRIENDS[cmd] + ' 🎂 —— 见到你真好。', 't-accent');
      } else {
        echo('command not found: ' + head + ' —— 但我想认识你。输入 help 看看能做什么。');
      }
      scrollDown();
    }

    function activate() {
      inputRow.classList.add('active');
      // desktop: focus right away so the gold caret is immediately visible
      if (window.innerWidth >= 769) input.focus({ preventScroll: true });
      win.addEventListener('click', function () {
        var sel = window.getSelection();
        if (sel && sel.toString()) return;   // don't steal an active text selection
        input.focus({ preventScroll: true });
      });
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          run(input.value);
          input.value = '';
        }
      });
      $$('.terminal-chip').forEach(function (chip) {
        chip.addEventListener('click', function () {
          run(chip.getAttribute('data-cmd') || '');
        });
      });
    }

    function bootInstant() {
      BOOT.forEach(function (pair) {
        addLine([['t-prompt', PROMPT], ['t-cmd', pair[0]]]);
        echo(pair[1]);
      });
      activate();
    }

    function bootTyped(idx) {
      if (idx >= BOOT.length) { activate(); return; }
      var line = addLine([['t-prompt', PROMPT], ['t-cmd', '']]);
      var cmdSpan = line.lastChild;
      var text = BOOT[idx][0];
      var i = 0;
      (function typeChar() {
        i++;
        cmdSpan.textContent = text.slice(0, i);
        if (i < text.length) {
          setTimeout(typeChar, 55 + Math.random() * 45);
        } else {
          setTimeout(function () {
            echo(BOOT[idx][1]);
            setTimeout(function () { bootTyped(idx + 1); }, 350);
          }, 200);
        }
      })();
    }

    var fired = false;
    var io = new IntersectionObserver(function (entries) {
      if (!entries[0].isIntersecting || fired) return;
      fired = true;
      io.disconnect();
      if (reduce) bootInstant();
      else bootTyped(0);
    }, { threshold: 0.3 });
    io.observe(win);
  }

  /* -------------------------------------------------------
     ME PAGE — Creative 4: Condensation whisper
     The sentence floats as scattered fog. Stop scrolling
     for 1.5s and the characters condense into place.
     Scroll again and they disperse to new random spots.
  ------------------------------------------------------- */
  function initQuietWhisper() {
    var box = $('#meWhisper');
    var p = $('#whisperText');
    if (!box || !p) return;

    var text = p.textContent;
    p.textContent = '';
    var chars = [];
    text.split('').forEach(function (ch) {
      var s = document.createElement('span');
      s.className = 'whisper-char';
      s.textContent = ch;
      p.appendChild(s);
      chars.push(s);
    });

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    function scatter() {
      chars.forEach(function (s) {
        s.style.setProperty('--dx', (Math.random() * 80 - 40).toFixed(1) + 'px');
        s.style.setProperty('--dy', (Math.random() * 50 - 25).toFixed(1) + 'px');
        s.style.setProperty('--dl', (Math.random() * 0.35).toFixed(2) + 's');
      });
    }
    scatter();

    var inView = false;
    var timer = null;

    function armCondense() {
      clearTimeout(timer);
      timer = setTimeout(function () {
        if (!inView) return;
        box.classList.add('condensed');
        box.classList.add('noted');   // the explainer note, earned once, stays
      }, 1500);
    }

    var io = new IntersectionObserver(function (entries) {
      inView = entries[0].isIntersecting;
      if (inView) armCondense();
      else clearTimeout(timer);
    }, { threshold: 0.25 });
    io.observe(box);

    window.addEventListener('scroll', function () {
      if (!inView) return;
      if (box.classList.contains('condensed')) {
        box.classList.remove('condensed');
        scatter();
      }
      armCondense();
    }, { passive: true });
  }

  /* -------------------------------------------------------
     ME PAGE — Creative 5: INFP stage takeover
     Idle letters breathe. Click one: it dominates the
     stage in its own color while its annotation types out.
  ------------------------------------------------------- */
  function initINFP() {
    var type = $('#meType');
    var stage = $('#infpStage');
    var word = $('#infpStageWord');
    var note = $('#infpStageNote');
    var hint = $('#infpHint');
    if (!type || !stage) return;
    var letters = $$('.infp-letter', type);
    if (!letters.length) return;

    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!reduce) type.classList.add('breathing');

    var typeToken = 0;
    var userTouched = false;

    function activate(letter) {
      typeToken++;
      var tk = typeToken;
      letters.forEach(function (l) { l.classList.remove('active'); });
      letter.classList.add('active');
      type.classList.add('staged');
      stage.classList.add('active');
      stage.style.setProperty('--sc', letter.style.getPropertyValue('--lc') || '#a8cc88');
      word.textContent = letter.getAttribute('data-word') || '';
      var txt = letter.getAttribute('data-note') || '';
      if (reduce) { note.textContent = txt; return; }
      note.textContent = '';
      (function typeChar(i) {
        if (tk !== typeToken || i > txt.length) return;
        note.textContent = txt.slice(0, i);
        setTimeout(function () { typeChar(i + 1); }, 55);
      })(1);
    }

    function deactivate() {
      typeToken++;
      letters.forEach(function (l) { l.classList.remove('active'); });
      type.classList.remove('staged');
      stage.classList.remove('active');
      word.textContent = '';
      note.textContent = '';
    }

    letters.forEach(function (letter) {
      letter.addEventListener('click', function () {
        userTouched = true;
        if (hint) hint.classList.remove('visible');
        if (letter.classList.contains('active')) deactivate();
        else activate(letter);
      });
    });

    if (window.innerWidth < 769 && !reduce) {
      // mobile: auto-demo I → N → F → P once, then invite
      var io = new IntersectionObserver(function (entries) {
        if (!entries[0].isIntersecting) return;
        io.disconnect();
        var i = 0;
        (function step() {
          if (userTouched) return;
          if (i >= letters.length) {
            deactivate();
            if (hint) hint.classList.add('visible');
            return;
          }
          activate(letters[i]);
          i++;
          setTimeout(step, 1900);
        })();
      }, { threshold: 0.5 });
      io.observe(type);
    } else {
      setTimeout(function () {
        if (hint && !userTouched) hint.classList.add('visible');
      }, 2500);
    }
  }

  /* -------------------------------------------------------
     ME PAGE — Creative 6: The page eater
     Canvas black hole: dust spirals in along a tilted
     accretion disc, photon ring glows. Click: a black
     circle swallows the viewport, then → universe.html.
  ------------------------------------------------------- */
  function initBlackhole() {
    var link = $('#blackholeLink');
    var canvas = $('#blackholeCanvas');
    var caption = $('#blackholeCaption');
    if (!link || !canvas || !canvas.getContext) return;

    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var ctx = canvas.getContext('2d');
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var size = 0, cx = 0, cy = 0;

    function resize() {
      size = link.clientWidth;
      canvas.width = size * dpr;   // note: resetting width clears the canvas
      canvas.height = size * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cx = size / 2;
      cy = size / 2;
    }
    resize();
    window.addEventListener('resize', function () {
      resize();
      if (reduce) drawStatic();
    });

    function outerR() { return size * 0.5; }
    function horizonR() { return size * 0.085; }

    var mobile = window.innerWidth < 769;
    var N = mobile ? 80 : 140;
    var parts = [];

    function spawn(p, initial) {
      p.r = outerR() * (initial ? (0.3 + Math.random() * 0.68) : (0.82 + Math.random() * 0.16));
      p.a = Math.random() * Math.PI * 2;
      p.w = 0.5 + Math.random() * 0.5;
      p.warm = Math.random() < 0.25;
      p.pr = p.r;
      p.pa = p.a;
    }
    for (var i = 0; i < N; i++) { var pt = {}; spawn(pt, true); parts.push(pt); }

    var speed = 1, targetSpeed = 1;
    var precess = 0;
    var TILT = 0.55;

    function drawDiscGlow(R, h, intensity) {
      // soft accretion glow: hot warm inner rim fading to green — drawn tilted
      var glow = ctx.createRadialGradient(0, 0, h * 1.1, 0, 0, R * 0.8);
      glow.addColorStop(0, 'rgba(212, 115, 74, ' + (0.22 * intensity).toFixed(3) + ')');
      glow.addColorStop(0.3, 'rgba(168, 204, 136, ' + (0.1 * intensity).toFixed(3) + ')');
      glow.addColorStop(1, 'rgba(168, 204, 136, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(0, 0, R * 0.8, 0, 7);
      ctx.fill();
    }

    function drawRingAndCore(h, glowUp) {
      // dark well the hole sinks into
      var grd = ctx.createRadialGradient(cx, cy, h * 0.7, cx, cy, h * 2.2);
      grd.addColorStop(0, 'rgba(0, 0, 0, 0.95)');
      grd.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(cx, cy, h * 2.2, 0, 7);
      ctx.fill();

      ctx.globalCompositeOperation = 'lighter';
      // soft halo of the photon ring
      ctx.beginPath();
      ctx.arc(cx, cy, h * 1.2, 0, 7);
      ctx.strokeStyle = 'rgba(168, 204, 136, ' + (0.16 + 0.12 * glowUp).toFixed(3) + ')';
      ctx.lineWidth = 5;
      ctx.shadowColor = 'rgba(168, 204, 136, 0.9)';
      ctx.shadowBlur = 16 + 10 * glowUp;
      ctx.stroke();
      // crisp photon ring
      ctx.beginPath();
      ctx.arc(cx, cy, h * 1.2, 0, 7);
      ctx.strokeStyle = 'rgba(212, 230, 190, ' + (0.55 + 0.3 * glowUp).toFixed(3) + ')';
      ctx.lineWidth = 1.4;
      ctx.shadowBlur = 5;
      ctx.stroke();
      // gravitational-lensing highlight: the upper arc burns brighter
      ctx.beginPath();
      ctx.arc(cx, cy, h * 1.2, Math.PI * 1.1, Math.PI * 1.9);
      ctx.strokeStyle = 'rgba(240, 248, 225, ' + (0.5 + 0.35 * glowUp).toFixed(3) + ')';
      ctx.lineWidth = 2;
      ctx.shadowBlur = 10;
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.globalCompositeOperation = 'source-over';

      // event horizon — absolute black
      ctx.beginPath();
      ctx.arc(cx, cy, h, 0, 7);
      ctx.fillStyle = '#000';
      ctx.fill();
    }

    function drawStatic() {
      resize();
      var R = outerR();
      var h = horizonR();
      ctx.clearRect(0, 0, size, size);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(1, TILT);
      drawDiscGlow(R, h, 1);
      ctx.restore();
      drawRingAndCore(h, 0);
    }

    function frame() {
      speed += (targetSpeed - speed) * 0.04;
      precess += 0.0006 * speed;
      ctx.clearRect(0, 0, size, size);

      var R = outerR();
      var h = horizonR();

      // tilted accretion disc — additive light so streaks glow and stack
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(precess);
      ctx.scale(1, TILT);
      ctx.globalCompositeOperation = 'lighter';

      drawDiscGlow(R, h, 0.7 + 0.5 * (speed - 1));

      parts.forEach(function (p) {
        var norm = p.r / R;
        var da = 0.012 * p.w * speed / Math.pow(Math.max(norm, 0.1), 1.2);
        p.a += da;
        p.r -= (0.08 + 0.5 * Math.pow(1 - norm, 2)) * speed;
        if (p.r <= h * 1.18) { spawn(p, false); return; }

        // comet tail: an arc along the orbit, longer the faster it whirls
        var trail = Math.min(da * 16, 1.1) + 0.05;
        var depth = 1 - p.r / R;
        var alpha = 0.12 + 0.75 * Math.pow(depth, 1.6);
        // doppler beaming — the approaching side burns brighter
        alpha *= 0.75 + 0.55 * Math.sin(p.a);
        if (alpha < 0.03) alpha = 0.03;
        if (alpha > 0.95) alpha = 0.95;
        ctx.strokeStyle = p.warm
          ? 'rgba(224, 138, 92, ' + alpha.toFixed(3) + ')'
          : 'rgba(178, 214, 146, ' + alpha.toFixed(3) + ')';
        ctx.lineWidth = 0.9 + depth * 1.6;
        ctx.beginPath();
        ctx.arc(0, 0, p.r, p.a - trail, p.a);
        ctx.stroke();
      });

      ctx.globalCompositeOperation = 'source-over';
      ctx.restore();

      drawRingAndCore(h, (speed - 1) / 2);

      // gravity tugs the cursor ring toward the hole (desktop)
      if (bhPull) {
        var rect = link.getBoundingClientRect();
        bhPull.x = rect.left + rect.width / 2;
        bhPull.y = rect.top + rect.height / 2;
      }

      rafId = requestAnimationFrame(frame);
    }

    if (reduce) {
      drawStatic();
      if (caption) caption.classList.add('visible');
      return;   // click falls through to initPageTransition's normal fade
    }

    var rafId = null;
    var io = new IntersectionObserver(function (entries) {
      if (entries[0].isIntersecting) {
        if (!rafId) rafId = requestAnimationFrame(frame);
        if (mobile) {
          targetSpeed = 1.6;
          if (caption) caption.classList.add('visible');
        }
      } else if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    }, { threshold: 0.1 });
    io.observe(canvas);

    link.addEventListener('mouseenter', function () {
      targetSpeed = 3;
      if (caption) caption.classList.add('visible');
      bhPull = { x: 0, y: 0, s: 0.4 };
    });
    link.addEventListener('mouseleave', function () {
      targetSpeed = mobile ? 1.6 : 1;
      bhPull = null;
    });

    // the swallow
    link.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      var href = link.getAttribute('href');
      bhPull = null;

      var rect = link.getBoundingClientRect();
      var x = rect.left + rect.width / 2;
      var y = rect.top + rect.height / 2;

      var sw = document.createElement('div');
      sw.className = 'blackhole-swallow';
      sw.style.left = x + 'px';
      sw.style.top = y + 'px';
      document.body.appendChild(sw);

      var main = $('#main');
      if (main) {
        main.style.setProperty('--bh-x', (x / window.innerWidth * 100).toFixed(1) + '%');
        main.style.setProperty('--bh-y', (y / window.innerHeight * 100).toFixed(1) + '%');
        main.classList.add('being-swallowed');
      }

      requestAnimationFrame(function () {
        requestAnimationFrame(function () { sw.classList.add('expand'); });
      });
      setTimeout(function () { window.location.href = href; }, 720);
    });
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
    initMenuHint();
    initActiveNav();
    initOfferWheel();
    initOfferDial();
    initOpenerCopy();
    initPassionWheel();
    initTabs();
    initPageTransition();
    initFullscreenUniverseLink();
    initLightbox();
    initProjectLightbox();
    initProductTheater();
    initGrowthRings();
    initWorkStatus();
    initBecomingStatus();
    initMarquee();
    initTypewriter();
    initParallax();
    initPortraitParallax();
    initDecompose();
    initCompound();
    initShell();
    initQuietWhisper();
    initINFP();
    initBlackhole();
  });

  window.addEventListener('pageshow', function (e) {
    if (e.persisted) {
      var main = $('#main');
      if (main) {
        main.style.opacity = '';
        main.style.transform = '';
        main.style.transition = '';
        main.classList.remove('being-swallowed');
        if (!main.classList.contains('visible')) {
          main.classList.remove('hidden');
          main.classList.add('visible');
        }
      }
      $$('.blackhole-swallow').forEach(function (el) { el.remove(); });
    }
  });

})();
