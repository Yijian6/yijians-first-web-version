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
     18a. OFFER WHEEL — 5-orb service navigation
  ------------------------------------------------------- */
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
      { id: 'ai',     label: 'AI 工具',   en: 'AI Tools',    color: [136,196,104], hex: '#88c468' },
      { id: 'web',    label: '网站搭建',  en: 'Web Dev',     color: [104,180,216], hex: '#68b4d8' },
      { id: 'tutor',  label: '数理化',    en: 'Tutoring',    color: [224,176,112], hex: '#e0b070' },
      { id: 'design', label: '文档设计',  en: 'Design',      color: [200,144,216], hex: '#c890d8' },
      { id: 'collab', label: '协作管理',  en: 'Collab',      color: [112,192,168], hex: '#70c0a8' }
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
    var ctas = $$('.timeline-cta[data-theater-title]');
    if (!ctas.length) return;

    var overlay = document.createElement('div');
    overlay.className = 'product-theater';
    overlay.innerHTML =
      '<div class="pt-bar">' +
        '<span class="pt-title"></span>' +
        '<a class="pt-open" href="" target="_blank" rel="noopener">新窗口打开 ↗</a>' +
        '<button class="pt-close" aria-label="Close">×</button>' +
      '</div>' +
      '<div class="pt-frame"><span class="pt-loading">LOADING…</span></div>';
    document.body.appendChild(overlay);

    var title = overlay.querySelector('.pt-title');
    var openLink = overlay.querySelector('.pt-open');
    var closeBtn = overlay.querySelector('.pt-close');
    var frame = overlay.querySelector('.pt-frame');
    var loading = overlay.querySelector('.pt-loading');
    var iframe = null;

    function openTheater(url, name) {
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
      document.body.style.overflow = 'hidden';
    }

    function closeTheater() {
      if (!overlay.classList.contains('open')) return;
      overlay.classList.remove('open');
      document.body.style.overflow = '';
      if (iframe) { iframe.remove(); iframe = null; }
    }

    ctas.forEach(function (el) {
      el.addEventListener('click', function (e) {
        e.preventDefault();
        openTheater(el.getAttribute('href'), el.getAttribute('data-theater-title'));
      });
    });

    closeBtn.addEventListener('click', closeTheater);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeTheater();
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
    initActiveNav();
    initOfferWheel();
    initPassionWheel();
    initTabs();
    initPageTransition();
    initFullscreenUniverseLink();
    initLightbox();
    initProjectLightbox();
    initProductTheater();
    initMarquee();
    initTypewriter();
    initParallax();
    initPortraitParallax();
  });

})();
