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

  // ---------- 大纲：本层房间 ----------
  // 按钮固定在视口上，因为大纲最有用的时刻是读到文章中间的时候。
  // 少于两个小标题就什么都不建——短文章不需要目录。
  var heads = body ? body.querySelectorAll('h2[id], h3[id]') : [];
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
      a.className = 'mco-item' + (h.tagName === 'H3' ? ' mco-item--sub' : '');
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
