// mc-article.js — Minecraft 文章页交互：图片灯箱 + 导出 PDF
(function () {
  var body = document.querySelector('.mca-body');

  // ---------- 图片点击放大 ----------
  if (body) {
    var overlay = null;

    var close = function () {
      if (!overlay) return;
      overlay.remove();
      overlay = null;
      document.documentElement.classList.remove('mc-lightbox-open');
    };

    var open = function (img) {
      close();
      overlay = document.createElement('div');
      overlay.className = 'mc-lightbox';
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');
      overlay.setAttribute('aria-label', img.alt || '图片预览');

      var big = document.createElement('img');
      big.src = img.currentSrc || img.src;
      big.alt = img.alt || '';
      overlay.appendChild(big);

      // 手写的说明文字才显示为图注；粘贴图片的自动文件名（Pasted image 202xxxxx）不显示
      if (img.alt && !/^Pasted image \d+$/i.test(img.alt)) {
        var cap = document.createElement('p');
        cap.className = 'mc-lightbox-cap';
        cap.textContent = img.alt;
        overlay.appendChild(cap);
      }

      var hint = document.createElement('span');
      hint.className = 'mc-lightbox-hint';
      hint.textContent = '点击任意处关闭';
      overlay.appendChild(hint);

      overlay.addEventListener('click', close);
      document.body.appendChild(overlay);
      document.documentElement.classList.add('mc-lightbox-open');
    };

    body.addEventListener('click', function (e) {
      var img = e.target && e.target.closest ? e.target.closest('img') : null;
      if (img && body.contains(img)) open(img);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') close();
    });
  }

  // ---------- 导出 PDF（走浏览器打印，样式见模板里的 @media print） ----------
  var exportBtn = document.getElementById('mcaExport');
  if (exportBtn) {
    exportBtn.addEventListener('click', function () {
      window.print();
    });
  }

  // ---------- 返回上一页 ----------
  // 「有没有上一页」看 referrer：它是这次导航真实的来源，刷新和 bfcache 恢复都不会错乱，
  // 比自己维护一套访问栈可靠。跳转用 history.back()：保留滚动位置、走 bfcache，
  // 回去正好落在读者点内链的那一行；location 赋值做不到这件事。
  var TITLE_KEY = 'mc-nav-titles';
  var TITLE_MAX = 40;

  function sessionApi() {
    return window.JueCompat && window.JueCompat.session ? window.JueCompat.session : null;
  }

  function readTitles() {
    var store = sessionApi();
    if (!store) return null;
    try {
      var raw = store.get(TITLE_KEY, '');
      var map = raw ? JSON.parse(raw) : null;
      return map && typeof map === 'object' ? map : {};
    } catch (err) {
      return {};
    }
  }

  // 不用 new URL：老一点的微信内置浏览器上不一定有。<a> 解析是最稳的写法。
  // 同一个页面会以两种形式出现：站内链接写的是 xxx.html，而 Pages 的干净网址
  // 会把它重定向成不带后缀的 /xxx —— referrer 拿到的是重定向后那个。
  // 不抹平这层差异，「来路是不是面包屑那一页」永远判不出来。
  function pathOf(url) {
    var probe = document.createElement('a');
    probe.href = url;
    var path = probe.pathname || '';
    if (path.charAt(0) !== '/') path = '/' + path;
    try {
      path = decodeURIComponent(path);
    } catch (err) {}
    path = path.replace(/\.html$/i, '').replace(/\/index$/i, '').replace(/\/+$/, '');
    return { host: probe.host, path: path || '/' };
  }

  // referrer 只给 URL 不给标题，所以每页把自己的标题记进一张会话级的表，
  // 下一页的返回按钮靠它显示「回到 《上一篇》」。
  function rememberTitle(titles, here) {
    var titleEl = document.querySelector('.mca-title');
    if (!titles || !titleEl) return;
    var keys = Object.keys(titles);
    while (keys.length >= TITLE_MAX) {
      delete titles[keys.shift()];
    }
    delete titles[here.path];
    titles[here.path] = titleEl.textContent.trim();
    var store = sessionApi();
    if (store) store.set(TITLE_KEY, JSON.stringify(titles));
  }

  function buildBack(href, title) {
    // 正文里的目录锚点（mc/notes 下有几篇有）点一次就往历史里压一条，
    // 那之后 history.back() 只会退回本页上一个滚动位置。发生过就改用直接赋值 location。
    var hashJumps = 0;
    window.addEventListener('hashchange', function () {
      hashJumps += 1;
    });

    var back = document.createElement('button');
    back.type = 'button';
    back.className = 'mca-back';
    back.setAttribute('aria-label', title ? '返回上一页：' + title : '返回上一页');
    if (title) back.title = title;

    var arrow = document.createElement('span');
    arrow.setAttribute('aria-hidden', 'true');
    arrow.textContent = '←';

    var brief = document.createElement('span');
    brief.className = 'mca-back-text';
    brief.textContent = '返回';

    var full = document.createElement('span');
    full.className = 'mca-back-title';
    full.textContent = title ? '回到 ' + title : '返回上一页';

    back.appendChild(arrow);
    back.appendChild(brief);
    back.appendChild(full);

    back.addEventListener('click', function () {
      if (hashJumps) {
        window.location.href = href;
      } else {
        window.history.back();
      }
    });

    document.body.appendChild(back);
  }

  var here = pathOf(window.location.href);
  var titles = readTitles();
  rememberTitle(titles, here);

  var ref = document.referrer;
  if (ref) {
    var from = pathOf(ref);
    var crumb = document.querySelector('.mca-crumb');
    var crumbPath = crumb ? pathOf(crumb.href).path : '';
    // 站外进来的、自链接、以及「面包屑已经在做同一件事」这三种情况都不建按钮——
    // 多一个作用重复的控件就是噪音。
    var skip =
      from.host !== window.location.host ||
      from.path === here.path ||
      from.path === crumbPath;
    if (!skip) buildBack(ref, titles ? titles[from.path] : '');
  }

  // ---------- 大纲：本层房间 ----------
  // 按钮固定在视口上，因为大纲最有用的时刻是读到文章中间的时候。
  // 少于两个小标题就什么都不建——短文章不需要目录。
  var heads = body ? body.querySelectorAll('h1[id], h2[id], h3[id]') : [];
  // 每篇文章的分级习惯不一样：有的从 ## 起，有的正文里就用 #。
  // 用「本文出现过的最浅一级」当作大纲的顶层，比一刀切按 h2 判断更贴合作者的结构。
  var topLevel = 6;
  Array.prototype.forEach.call(heads, function (h) {
    var level = parseInt(h.tagName.charAt(1), 10);
    if (level < topLevel) topLevel = level;
  });
  if (heads.length >= 2) {
    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var isMobile = function () { return window.matchMedia('(max-width: 768px)').matches; };

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'mco-btn';
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-label', '本层房间');
    btn.innerHTML = '<span>☰</span><span class="mco-btn-text">大纲</span>';

    var panel = document.createElement('nav');
    panel.className = 'mco-panel';
    panel.setAttribute('aria-label', '文章大纲');
    var label = document.createElement('span');
    label.className = 'mco-label';
    label.textContent = '本层房间';
    panel.appendChild(label);

    var backdrop = document.createElement('div');
    backdrop.className = 'mco-backdrop';

    var items = [];
    Array.prototype.forEach.call(heads, function (h) {
      var a = document.createElement('a');
      a.className = 'mco-item' + (parseInt(h.tagName.charAt(1), 10) > topLevel ? ' mco-item--sub' : '');
      a.href = '#' + h.id;
      a.textContent = h.textContent.trim();
      a.addEventListener('click', function (e) {
        e.preventDefault();
        h.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
        history.replaceState(null, '', '#' + h.id);
        // 立刻高亮点中的条目：用户意图是明确的，不必等平滑滚动结束
        setActive(a);
        if (isMobile()) setOpen(false);
      });
      panel.appendChild(a);
      items.push({ link: a, head: h });
    });

    function setOpen(open) {
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      panel.classList.toggle('open', open);
      backdrop.classList.toggle('open', open);
    }

    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      setOpen(btn.getAttribute('aria-expanded') !== 'true');
    });
    backdrop.addEventListener('click', function () { setOpen(false); });
    document.addEventListener('click', function (e) {
      if (panel.classList.contains('open') && !panel.contains(e.target) && e.target !== btn) {
        setOpen(false);
      }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') setOpen(false);
    });

    document.body.appendChild(backdrop);
    document.body.appendChild(btn);
    document.body.appendChild(panel);

    function setActive(link) {
      items.forEach(function (it) {
        it.link.classList.toggle('active', it.link === link);
      });
    }

    // 高亮当前所在的小节：取所有已经滚过标题线的标题里最靠下的那个
    function markActive() {
      var line = (document.querySelector('.navbar') || {}).offsetHeight || 72;
      var current = items[0];
      items.forEach(function (it) {
        if (it.head.getBoundingClientRect().top <= line + 24) current = it;
      });
      setActive(current.link);
    }

    // 用「取消上一帧」而不是 ticking 标志：页面隐藏时 rAF 会暂停，
    // 布尔标志会被永久锁在 true，之后的滚动全部丢失。
    var rafId = null;
    window.addEventListener(
      'scroll',
      function () {
        if (rafId) window.cancelAnimationFrame(rafId);
        rafId = window.requestAnimationFrame(function () {
          rafId = null;
          markActive();
        });
      },
      { passive: true }
    );
    markActive();
  }
})();
