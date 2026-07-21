/* Shared runtime compatibility helpers for mobile browsers and WebViews. */
(function (window, document) {
  'use strict';

  var root = document.documentElement;
  var storage = {
    get: function (key, fallback) {
      try {
        var value = window.localStorage.getItem(key);
        return value === null ? (fallback === undefined ? null : fallback) : value;
      } catch (err) {
        return fallback === undefined ? null : fallback;
      }
    },
    set: function (key, value) {
      try {
        window.localStorage.setItem(key, String(value));
        return true;
      } catch (err) {
        return false;
      }
    },
    remove: function (key) {
      try {
        window.localStorage.removeItem(key);
        return true;
      } catch (err) {
        return false;
      }
    }
  };

  function isWeChat() {
    return /MicroMessenger/i.test(window.navigator.userAgent || '');
  }

  function mediaMatches(query) {
    return typeof window.matchMedia === 'function' && window.matchMedia(query).matches;
  }

  function getInputCapabilities() {
    return {
      hover: mediaMatches('(hover: hover)'),
      finePointer: mediaMatches('(pointer: fine)'),
      coarsePointer: mediaMatches('(pointer: coarse)'),
      anyHover: mediaMatches('(any-hover: hover)'),
      anyFinePointer: mediaMatches('(any-pointer: fine)'),
      touch: 'ontouchstart' in window || (window.navigator.maxTouchPoints || 0) > 0
    };
  }

  function onInputCapabilitiesChange(callback) {
    if (typeof callback !== 'function' || typeof window.matchMedia !== 'function') {
      return function () {};
    }
    var queries = ['(hover: hover)', '(pointer: fine)', '(pointer: coarse)', '(any-hover: hover)', '(any-pointer: fine)'];
    var lists = queries.map(function (query) { return window.matchMedia(query); });
    var handler = function () { callback(getInputCapabilities()); };
    lists.forEach(function (list) {
      if (list.addEventListener) list.addEventListener('change', handler);
      else if (list.addListener) list.addListener(handler);
    });
    return function () {
      lists.forEach(function (list) {
        if (list.removeEventListener) list.removeEventListener('change', handler);
        else if (list.removeListener) list.removeListener(handler);
      });
    };
  }

  function syncVisualViewport() {
    var viewport = window.visualViewport;
    var height = viewport ? viewport.height : window.innerHeight;
    var top = viewport ? viewport.offsetTop : 0;
    var bottom = Math.max(0, window.innerHeight - height - top);
    root.style.setProperty('--visual-viewport-height', Math.round(height) + 'px');
    root.style.setProperty('--visual-viewport-top', Math.round(top) + 'px');
    root.style.setProperty('--visual-viewport-bottom', Math.round(bottom) + 'px');
  }

  var viewportInstalled = false;
  function installVisualViewport() {
    if (!viewportInstalled) {
      viewportInstalled = true;
      window.addEventListener('resize', syncVisualViewport, { passive: true });
      window.addEventListener('orientationchange', syncVisualViewport, { passive: true });
      if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', syncVisualViewport, { passive: true });
        window.visualViewport.addEventListener('scroll', syncVisualViewport, { passive: true });
      }
    }
    syncVisualViewport();
    return syncVisualViewport;
  }

  var scrollLock = null;
  function lockBodyScroll() {
    if (scrollLock || !document.body) return;
    var body = document.body;
    var scrollY = window.pageYOffset || document.documentElement.scrollTop || 0;
    var scrollbarWidth = Math.max(0, window.innerWidth - document.documentElement.clientWidth);
    scrollLock = {
      scrollY: scrollY,
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
      overflow: body.style.overflow,
      paddingRight: body.style.paddingRight
    };
    body.style.position = 'fixed';
    body.style.top = -scrollY + 'px';
    body.style.left = '0';
    body.style.right = '0';
    body.style.width = '100%';
    body.style.overflow = 'hidden';
    if (scrollbarWidth) body.style.paddingRight = scrollbarWidth + 'px';
    root.classList.add('scroll-locked');
  }

  function unlockBodyScroll() {
    if (!scrollLock || !document.body) return;
    var body = document.body;
    var saved = scrollLock;
    scrollLock = null;
    body.style.position = saved.position;
    body.style.top = saved.top;
    body.style.left = saved.left;
    body.style.right = saved.right;
    body.style.width = saved.width;
    body.style.overflow = saved.overflow;
    body.style.paddingRight = saved.paddingRight;
    root.classList.remove('scroll-locked');
    window.scrollTo(0, saved.scrollY);
  }

  function fetchWithTimeout(input, options, timeoutMs) {
    var opts = options ? Object.assign({}, options) : {};
    var timeout = typeof timeoutMs === 'number' ? timeoutMs : 10000;
    if (!window.AbortController) return window.fetch(input, opts);

    var controller = new window.AbortController();
    var upstreamSignal = opts.signal;
    var abortFromUpstream = function () { controller.abort(); };
    if (upstreamSignal) {
      if (upstreamSignal.aborted) controller.abort();
      else upstreamSignal.addEventListener('abort', abortFromUpstream, { once: true });
    }
    opts.signal = controller.signal;
    var timer = window.setTimeout(function () { controller.abort(); }, timeout);
    return window.fetch(input, opts).finally(function () {
      window.clearTimeout(timer);
      if (upstreamSignal) upstreamSignal.removeEventListener('abort', abortFromUpstream);
    });
  }

  function collectImageDiagnostics() {
    return Array.prototype.map.call(document.images, function (image) {
      var rect = image.getBoundingClientRect();
      var style = window.getComputedStyle(image);
      return {
        src: image.getAttribute('src'),
        currentSrc: image.currentSrc,
        complete: image.complete,
        naturalWidth: image.naturalWidth,
        naturalHeight: image.naturalHeight,
        renderedWidth: Math.round(rect.width),
        renderedHeight: Math.round(rect.height),
        loading: image.loading || 'auto',
        objectFit: style.objectFit,
        aspectRatio: style.aspectRatio,
        mediaFit: image.dataset.mediaFit || 'missing',
        state: image.dataset.imageState || 'unknown',
        retry: image.dataset.imageRetry === '1'
      };
    });
  }

  function installImageRecovery() {
    function mark(event) {
      var image = event.target;
      if (!image || image.tagName !== 'IMG') return;
      image.dataset.imageState = event.type === 'load' ? 'loaded' : 'error';
    }

    function recoverVisibleImages() {
      Array.prototype.forEach.call(document.images, function (image) {
        var rect = image.getBoundingClientRect();
        var visible = rect.width > 0
          && rect.bottom >= -100
          && rect.top <= window.innerHeight * 1.5;
        if (!visible || image.naturalWidth > 0 || image.dataset.imageRetry === '1') return;
        image.dataset.imageRetry = '1';
        image.loading = 'eager';
        var source = image.currentSrc || image.getAttribute('src');
        if (!source) return;
        try {
          var retryUrl = new URL(source, window.location.href);
          retryUrl.searchParams.set('__image_retry', '1');
          image.src = retryUrl.href;
        } catch (err) {
          image.src = source;
        }
      });
    }

    document.addEventListener('load', mark, true);
    document.addEventListener('error', mark, true);
    window.addEventListener('pageshow', recoverVisibleImages);
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) recoverVisibleImages();
    });
    window.addEventListener('orientationchange', recoverVisibleImages, { passive: true });
    window.setTimeout(recoverVisibleImages, 1500);
  }

  function installImageDiagnostics() {
    if (!/[?&]imageDiag=1(?:&|$)/.test(window.location.search)) return;

    var panel = document.createElement('aside');
    panel.setAttribute('aria-label', 'Image diagnostics');
    panel.style.cssText = [
      'position:fixed', 'z-index:2147483647', 'left:8px', 'right:8px', 'bottom:8px',
      'max-height:45vh', 'overflow:auto', 'padding:10px', 'background:#111',
      'border:1px solid #a8cc88', 'color:#e4e0d8', 'font:11px/1.4 monospace',
      'white-space:pre-wrap', 'word-break:break-word'
    ].join(';');

    var button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'Copy image diagnostics';
    button.style.cssText = 'margin-bottom:8px;padding:6px 10px;background:#a8cc88;color:#111;border:0;';
    var output = document.createElement('pre');
    output.style.margin = '0';
    panel.appendChild(button);
    panel.appendChild(output);
    document.body.appendChild(panel);

    function render() {
      output.textContent = JSON.stringify({
        userAgent: navigator.userAgent,
        viewport: [window.innerWidth, window.innerHeight],
        devicePixelRatio: window.devicePixelRatio,
        images: collectImageDiagnostics()
      }, null, 2);
    }

    button.addEventListener('click', function () {
      var text = output.textContent;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).catch(function () {});
      }
    });
    document.addEventListener('load', render, true);
    render();
    window.setTimeout(render, 1500);
  }

  var api = {
    storage: storage,
    isWeChat: isWeChat,
    getInputCapabilities: getInputCapabilities,
    onInputCapabilitiesChange: onInputCapabilitiesChange,
    installVisualViewport: installVisualViewport,
    lockBodyScroll: lockBodyScroll,
    unlockBodyScroll: unlockBodyScroll,
    patchScrollLock: function (newScrollY) { if (scrollLock) scrollLock.scrollY = newScrollY; },
    fetchWithTimeout: fetchWithTimeout,
    collectImageDiagnostics: collectImageDiagnostics,
    installImageRecovery: installImageRecovery
  };

  window.JueCompat = api;
  root.dataset.browserContext = isWeChat() ? 'wechat' : 'browser';
  installVisualViewport();
  installImageRecovery();
  installImageDiagnostics();
})(window, document);
