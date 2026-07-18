import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const pages = [
  'index.html',
  'work.html',
  'offer.html',
  'me.html',
  'passion.html',
  'prediction.html',
  'offer-detail-doc.html',
  'offer-detail-doc-view.html',
  'universe.html',
  '十五五人工智能产业安全发展规划建议报告稿-智算7班第3组.html'
];
const ignoredHtml = ['design-preview.html', 'hero-demos.html', 'test.html'];
const errors = [];
const warnings = [];

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

function isExternal(value) {
  return /^(?:[a-z]+:|\/\/|#|%)/i.test(value) || value.startsWith('/');
}

function checkTarget(owner, target) {
  const clean = target.split(/[?#]/, 1)[0];
  if (!clean || isExternal(clean) || clean.startsWith('data:')) return;
  const full = path.resolve(path.dirname(path.join(root, owner)), clean);
  if (!full.startsWith(root) || !fs.existsSync(full)) {
    errors.push(`${owner}: missing local resource ${target}`);
  }
}

for (const page of pages) {
  const html = read(page);
  if (/user-scalable\s*=\s*no/i.test(html)) errors.push(`${page}: user-scalable=no is forbidden`);
  const viewport = html.match(/<meta\s+name=["']viewport["'][^>]*content=["']([^"']+)["']/i)?.[1] || '';
  if (!/viewport-fit=cover/i.test(viewport) || !/interactive-widget=resizes-content/i.test(viewport)) {
    errors.push(`${page}: viewport compatibility directives are incomplete`);
  }
  if (!/<script\s+src=["']js\/compat\.js["']/i.test(html)) {
    errors.push(`${page}: shared compatibility layer is not loaded`);
  }
  if (/new\s+Date\s*\([^)]*created_at/i.test(html)) errors.push(`${page}: direct created_at Date parsing`);
  if (/<img\b/i.test(html)) {
    for (const match of html.matchAll(/<img\b([^>]*)>/gi)) {
      const attrs = match[1];
      const src = attrs.match(/\bsrc\s*=\s*["']([^"']+)/i)?.[1];
      if (src) checkTarget(page, src);
      if (!/\bwidth\s*=\s*["'][^"']+["']/i.test(attrs) ||
          !/\bheight\s*=\s*["'][^"']+["']/i.test(attrs)) {
        warnings.push(`${page}: image is missing width/height (${src || 'dynamic'})`);
      }
    }
  }
  for (const match of html.matchAll(/\b(?:href|src)\s*=\s*["']([^"']+)["']/gi)) {
    checkTarget(page, match[1]);
  }
  for (const match of html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) {
    checkCss(`${page} inline style`, match[1]);
  }
}

function checkCss(owner, css) {
  for (const match of css.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/gi)) {
    checkTarget(owner, match[1]);
  }
  for (const block of css.matchAll(/\{([\s\S]*?)\}/g)) {
    const body = block[1];
    if (/\bbackdrop-filter\s*:/.test(body) && !/-webkit-backdrop-filter\s*:/.test(body)) {
      errors.push(`${owner}: backdrop-filter is missing -webkit-backdrop-filter`);
    }
    const usesModernViewport = /\b(?:svh|dvh|lvh)\b/.test(body);
    const hasVhFallback = /(?<![sdl])vh\b/.test(body);
    if (usesModernViewport && !hasVhFallback) {
      errors.push(`${owner}: svh/dvh/lvh declaration is missing a vh fallback`);
    }
  }
}

checkCss('css/style.css', read('css/style.css'));
for (const file of ['js/script.js', 'universe.html']) {
  if (/\blocalStorage\s*\./.test(read(file)) && file !== 'js/compat.js') {
    errors.push(`${file}: business code accesses localStorage directly`);
  }
}

for (const page of ignoredHtml) {
  if (fs.existsSync(path.join(root, page))) warnings.push(`${page}: excluded prototype/test page`);
}

if (errors.length) {
  console.error(errors.map((item) => `ERROR ${item}`).join('\n'));
}
if (warnings.length) {
  console.warn(warnings.map((item) => `WARN ${item}`).join('\n'));
}
console.log(`Checked ${pages.length} production pages; ${errors.length} errors, ${warnings.length} warnings`);
process.exitCode = errors.length ? 1 : 0;
