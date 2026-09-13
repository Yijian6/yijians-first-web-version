// mc-world.js — Minecraft 世界页地图渲染
// 读取 window.MC_WORLD（由 mc/world-data.js 提供），把每个领域渲染成一块地。
// 无数据时安全降级：页面保持只有告示牌的原始状态。
// 必须是 ES5（var + function）：tools/mobile-compat-check.mjs 会遍历 js/ 检查。

(function () {
  var data = window.MC_WORLD;
  var map = document.getElementById('mcMap');
  var logEl = document.getElementById('mcLog');
  var legendEl = document.getElementById('mcLegend');
  if (!data || !map || !data.domains || data.domains.length === 0) return;

  // 一块地最多画多少个格子。超过就按比例缩——写到上百篇时格子会细成一根线。
  var CELL_CAP = 60;

  // 方块是固定尺寸的正方形（CSS 里按档位给 --mcm-cell），从左上角铺成一片聚落。
  // 列数取 sqrt(格子数 × 1.6) 让聚落略宽于高；再按档位限制行数，别撞进铭牌带。
  var MAX_ROWS = { 1: 1, 2: 1, 3: 5, 4: 5 };

  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text) node.textContent = text;
    return node;
  }

  // 地块尺寸看「已建 + 规划」，不看已建数：地块是圈下的地，填充才是建成的部分。
  function tierOf(total) {
    if (total <= 3) return 1;
    if (total <= 8) return 2;
    if (total <= 16) return 3;
    return 4;
  }

  // 最近动土的那块地，插一支火把
  var freshest = '';
  data.domains.forEach(function (d) {
    if (d.lastDate && d.lastDate > freshest) freshest = d.lastDate;
  });

  data.domains.forEach(function (domain, idx) {
    var built = domain.floors ? domain.floors.length : 0;
    var ghosts = domain.ghosts ? domain.ghosts.length : 0;
    var total = domain.total || built + ghosts || 1;
    var tier = tierOf(total);

    var cls = 'mcm-plot press-scale mcm-plot--t' + tier + ' mcm-plot--' + (domain.biome || 'stone');
    if (domain.stale) cls += ' is-stale';
    var plot = el('a', cls);
    plot.href = 'mc/' + domain.slug + '/';
    plot.style.animationDelay = idx * 60 + 'ms';

    // 格子层：已建 = 实心，规划 = 虚线暗格
    var cells = Math.min(total, CELL_CAP);
    var builtCells = built;
    if (total > CELL_CAP) {
      // 按比例缩。built > 0 时至少留一格亮着，否则写过的领域会显示成一片空地。
      builtCells = Math.round((built / total) * CELL_CAP);
      if (built > 0 && builtCells < 1) builtCells = 1;
    }
    if (builtCells > cells) builtCells = cells;
    var cols = Math.ceil(Math.sqrt(cells * 1.6));
    cols = Math.max(cols, Math.ceil(cells / MAX_ROWS[tier]));
    cols = Math.max(1, Math.min(cells, cols));

    var fill = el('span', 'mcm-fill');
    fill.setAttribute('aria-hidden', 'true');
    fill.style.gridTemplateColumns = 'repeat(' + cols + ', var(--mcm-cell))';
    for (var i = 0; i < cells; i++) {
      fill.appendChild(el('span', 'mcm-cell' + (i < builtCells ? ' is-built' : '')));
    }
    plot.appendChild(fill);

    var meta = el('span', 'mcm-meta');
    meta.appendChild(el('span', 'mcm-name', domain.name));
    // 简介只在大地块上放得下，小地块塞进去会把名字挤没
    if (domain.summary && tier >= 3) {
      meta.appendChild(el('span', 'mcm-summary', domain.summary));
      plot.className += ' has-summary';
    }
    meta.appendChild(el('span', 'mcm-stat', ghosts ? built + ' / ' + total + ' 篇' : built + ' 篇'));
    plot.appendChild(meta);

    if (domain.lastDate && domain.lastDate === freshest) {
      var torch = el('span', 'mcm-torch');
      torch.setAttribute('aria-hidden', 'true');
      plot.appendChild(torch);
    }
    if (domain.stale) {
      var vine = el('span', 'mcm-vine');
      vine.setAttribute('aria-hidden', 'true');
      plot.appendChild(vine);
    }

    map.appendChild(plot);
  });

  if (legendEl) legendEl.hidden = false;

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
