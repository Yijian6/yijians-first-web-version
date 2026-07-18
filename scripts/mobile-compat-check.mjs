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

checkBackdropPrefixes('css/style.css');
checkBackdropPrefixes('universe.html');
checkViewportFallbacks('css/style.css');
checkDateParser();
checkViewports();
checkLocalReferences();

if (failures.length) {
  console.error(`移动兼容检查失败（${failures.length} 项）：`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('移动兼容检查通过。');
