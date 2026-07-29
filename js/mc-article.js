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
})();
