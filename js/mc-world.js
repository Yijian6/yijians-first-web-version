// mc-world.js — Minecraft 世界页天际线渲染
// 读取 window.MC_WORLD（由 mc/world-data.js 提供），把每个领域渲染成一栋建筑。
// 无数据时安全降级：页面保持只有告示牌的原始状态。

(function () {
  var data = window.MC_WORLD;
  var row = document.getElementById('mcRow');
  var logEl = document.getElementById('mcLog');
  if (!data || !row || !data.domains || data.domains.length === 0) return;
  row.classList.add('has-buildings');

  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text) node.textContent = text;
    return node;
  }

  data.domains.forEach(function (domain) {
    var building = el('a', 'mcw-building');
    building.href = 'mc/' + domain.slug + '/';

    // 脚手架（永远在楼顶）
    var scaffold = el('span', 'mcw-scaffold' + (domain.stale ? ' mcw-scaffold--vine' : ''));
    scaffold.setAttribute('aria-hidden', 'true');
    building.appendChild(scaffold);

    // 蓝图幽灵段（未认领的规划层）
    if (domain.ghosts && domain.ghosts.length) {
      var ghost = el('span', 'mcw-ghost');
      ghost.style.height = Math.min(domain.ghosts.length, 8) * 14 + 'px';
      ghost.setAttribute('aria-hidden', 'true');
      building.appendChild(ghost);
    }

    // 楼体：一层一排窗
    var body = el('span', 'mcw-body');
    var floors = domain.floors.length;
    for (var i = floors - 1; i >= 0; i--) {
      var floor = el('span', 'mcw-floor-row');
      // 最新一层的窗更亮
      var win = el('span', 'mcw-win' + (i === floors - 1 ? ' mcw-win--bright' : ''));
      floor.appendChild(win);
      floor.appendChild(el('span', 'mcw-win mcw-win--dim'));
      body.appendChild(floor);
    }
    building.appendChild(body);

    // 楼名 + 层数
    building.appendChild(el('span', 'mcw-name', domain.name));
    building.appendChild(
      el('span', 'mcw-stat', floors + ' 层' + (domain.ghosts && domain.ghosts.length ? ' / 规划 ' + (floors + domain.ghosts.length) : ''))
    );

    row.appendChild(building);
  });

  // 横滑提示：世界宽于视口时出现
  var strip = document.getElementById('mcStrip');
  var hint = document.getElementById('mcHint');
  if (strip && hint && strip.scrollWidth > strip.clientWidth + 8) {
    hint.hidden = false;
  }

  // 冒险日志
  if (logEl && data.log && data.log.length) {
    var title = el('p', 'mcw-log-title', '— 冒险日志 —');
    logEl.appendChild(title);
    data.log.forEach(function (item) {
      var line = el('a', 'mcw-log-line');
      line.href = item.url;
      line.appendChild(el('span', 'mcw-log-date', item.date.slice(5)));
      line.appendChild(el('span', 'mcw-log-domain', item.domainName));
      line.appendChild(el('span', 'mcw-log-title-text', item.title));
      logEl.appendChild(line);
    });
    logEl.hidden = false;
  }
})();
