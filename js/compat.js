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

  var api = {
    storage: storage,
    isWeChat: isWeChat,
    getInputCapabilities: getInputCapabilities,
    onInputCapabilitiesChange: onInputCapabilitiesChange,
    installVisualViewport: installVisualViewport,
    lockBodyScroll: lockBodyScroll,
    unlockBodyScroll: unlockBodyScroll,
    fetchWithTimeout: fetchWithTimeout
  };

  window.JueCompat = api;
  root.dataset.browserContext = isWeChat() ? 'wechat' : 'browser';
  installVisualViewport();
})(window, document);
