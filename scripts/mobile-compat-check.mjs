import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function check(condition, message) {
  if (!condition) failures.push(message);
}

function checkBackdropPrefixes(relativePath) {
  const lines = read(relativePath).split(/\r?\n/);

  lines.forEach((line, index) => {
    const match = line.match(/^\s*backdrop-filter:\s*([^;]+);/);
    if (!match) return;

    const nearby = lines.slice(Math.max(0, index - 2), index + 3).join('\n');
    const escaped = match[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    check(
      new RegExp(`-webkit-backdrop-filter:\\s*${escaped};`).test(nearby),
      `${relativePath}:${index + 1} 缺少同值 -webkit-backdrop-filter`
    );
  });
}

function checkViewportFallbacks(relativePath) {
  const lines = read(relativePath).split(/\r?\n/);

  lines.forEach((line, index) => {
    if (!/(?:s|d)vh/.test(line)) return;

    const property = line.match(/([a-z-]+)\s*:/i);
    if (!property) return;

    const before = lines.slice(Math.max(0, index - 2), index + 1).join(' ');
    const escapedProperty = property[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    check(
      new RegExp(`${escapedProperty}\\s*:[^;]*(?<![sd])vh`).test(before),
      `${relativePath}:${index + 1} 的 ${property[1]} 缺少 vh 回退`
    );
  });
}

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}(`);
  if (start === -1) return null;

  const brace = source.indexOf('{', start);
  let depth = 0;
  for (let index = brace; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  return null;
}

function checkDateParser() {
  const source = read('universe.html');
  const functionSource = extractFunction(source, 'parseDbDate');
  check(Boolean(functionSource), 'universe.html 缺少 parseDbDate');
  if (!functionSource) return;

  const context = vm.createContext({ Date, String });
  vm.runInContext(`${functionSource}; this.parseDbDate = parseDbDate;`, context);

  const cases = [
    ['2026-07-18 08:00:00', '2026-07-18T08:00:00.000Z'],
    ['2026-07-18T08:00:00Z', '2026-07-18T08:00:00.000Z'],
    ['2026-07-18T16:00:00+08:00', '2026-07-18T08:00:00.000Z'],
  ];

  cases.forEach(([input, expected]) => {
    const parsed = context.parseDbDate(input);
    check(
      !Number.isNaN(parsed.getTime()) && parsed.toISOString() === expected,
      `parseDbDate(${JSON.stringify(input)}) 结果不正确`
    );
  });

  [null, 'not-a-date'].forEach((input) => {
    check(
      Number.isNaN(context.parseDbDate(input).getTime()),
      `parseDbDate(${JSON.stringify(input)}) 应返回 Invalid Date`
    );
  });

  check(
    !/new Date\(\s*(?:msg|star)\.created_at\s*\)/.test(source),
    'universe.html 仍直接把 created_at 传给 new Date'
  );
}

function checkViewports() {
  const htmlFiles = fs.readdirSync(root).filter((name) => name.endsWith('.html'));
  htmlFiles.forEach((name) => {
    const source = read(name);
    check(!/user-scalable\s*=\s*no/i.test(source), `${name} 禁止了页面缩放`);
  });
}

function checkLocalReferences() {
  const htmlFiles = fs.readdirSync(root).filter((name) => name.endsWith('.html'));
  const missing = new Set();

  htmlFiles.forEach((name) => {
    const source = read(name);
    const referencePattern = /(?:src|href)="([^"#?]+)(?:[?#][^"]*)?"/g;
    let match;

    while ((match = referencePattern.exec(source)) !== null) {
      const reference = match[1];
      if (/^(?:https?:|mailto:|tel:|javascript:|data:)/i.test(reference)) continue;

      const target = path.resolve(root, path.dirname(name), decodeURIComponent(reference));
      if (!fs.existsSync(target)) missing.add(`${name} → ${reference}`);
    }
  });

  check(missing.size === 0, `本地资源引用缺失：${Array.from(missing).join(', ')}`);
}

function checkTouchBehavior() {
  const script = read('js/script.js');
  const styles = read('css/style.css');
  const universe = read('universe.html');

  check(
    script.includes("(hover: hover) and (pointer: fine)"),
    '自定义光标和 Me 拆解动画未按输入能力判断'
  );
  check(
    script.includes("setAttribute('aria-expanded'"),
    '汉堡菜单没有同步 aria-expanded'
  );
  check(
    styles.includes('@media (hover: none)'),
    '共享样式缺少触控设备 hover 复位'
  );
  check(
    universe.includes('window.visualViewport'),
    'Universe 没有同步软键盘可视视口'
  );
}

function checkUniverseAnimation() {
  const source = read('universe.html');
  const drawSource = extractFunction(source, 'drawConstellations') || '';

  check(
    source.includes('function precomputeConstellations'),
    'Universe 缺少预计算星座连线'
  );
  check(
    !/Math\.sqrt/.test(drawSource),
    'Universe 绘制连线时仍重复执行距离计算'
  );
  check(
    source.includes('document.hidden') &&
      source.includes("window.addEventListener('pagehide'") &&
      source.includes("window.addEventListener('pageshow'"),
    'Universe 没有完整的页面可见性与 bfcache 动画生命周期'
  );
  check(
    source.includes('pointer: coarse') && source.includes('1.5'),
    'Universe 粗指针设备没有降低 DPR 上限'
  );
}

checkBackdropPrefixes('css/style.css');
checkBackdropPrefixes('universe.html');
checkViewportFallbacks('css/style.css');
checkDateParser();
checkViewports();
checkLocalReferences();
checkTouchBehavior();
checkUniverseAnimation();

if (failures.length) {
  console.error(`移动兼容检查失败（${failures.length} 项）：`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('移动兼容检查通过。');
