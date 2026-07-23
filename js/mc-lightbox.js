// mc-lightbox.js — Minecraft 文章页图片点击放大
// 挂在 .mca-body 上的事件委托：点图片开灯箱，点任意处 / Esc 关闭。
(function () {
  var body = document.querySelector('.mca-body');
  if (!body) return;

  var overlay = null;

  function close() {
    if (!overlay) return;
    overlay.remove();
    overlay = null;
    document.documentElement.classList.remove('mc-lightbox-open');
  }

  function open(img) {
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
  }

  body.addEventListener('click', function (e) {
    var img = e.target && e.target.closest ? e.target.closest('img') : null;
    if (img && body.contains(img)) open(img);
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') close();
  });
})();
