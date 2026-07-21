import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const policy = JSON.parse(fs.readFileSync(path.join(root, 'tools/site-policy.json'), 'utf8'));
const ignoredHtml = policy.excludedHtml;
const errors = [];
const warnings = [];
const checkedTargets = new Set();

function discoverProductionPages() {
  const rootPages = fs.readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.html'))
    .map((entry) => entry.name)
    .filter((file) => !ignoredHtml.includes(file));

  // mc/ 为构建产物目录（Minecraft 思考空间），递归纳入检查
  const mcPages = [];
  const mcRoot = path.join(root, 'mc');
  if (fs.existsSync(mcRoot)) {
    const walk = (dir) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.isFile() && entry.name.endsWith('.html')) {
          mcPages.push(path.relative(root, full).split(path.sep).join('/'));
        }
      }
    };
    walk(mcRoot);
  }

  return [...rootPages, ...mcPages].sort();
}

const pages = discoverProductionPages();
for (const requiredPage of ['offer-detail-ai.html', 'offer-detail-auto.html']) {
  if (!pages.includes(requiredPage)) {
    errors.push(`production page discovery omitted ${requiredPage}`);
  }
}

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

function isExternal(value) {
  return /^(?:[a-z]+:|\/\/|#|%)/i.test(value) || value.startsWith('/');
}

function checkTarget(owner, target) {
  const clean = target.split(/[?#]/, 1)[0];
  if (!clean || isExternal(clean) || clean.startsWith('data:')) return;
  const targetKey = `${owner}:${clean}`;
  if (checkedTargets.has(targetKey)) return;
  checkedTargets.add(targetKey);
  const full = path.resolve(path.dirname(path.join(root, owner)), clean);
  const relative = path.relative(root, full);
  if (relative.startsWith('..') || path.isAbsolute(relative) || !fs.existsSync(full)) {
    errors.push(`${owner}: missing local resource ${target}`);
    return;
  }

  if (/\.(?:avif|gif|jpe?g|png|webp)$/i.test(full)) {
    const bytes = fs.statSync(full).size;
    if (bytes > policy.assetBudgetBytes.error) {
      errors.push(`${owner}: image exceeds hard budget (${bytes} bytes): ${target}`);
    } else if (bytes > policy.assetBudgetBytes.warning) {
      warnings.push(`${owner}: image exceeds warning budget (${bytes} bytes): ${target}`);
    }
  }
}

function checkCss(owner, css) {
  for (const match of css.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/gi)) {
    checkTarget(owner, match[1]);
  }
  for (const block of css.matchAll(/([^{}]+)\{([\s\S]*?)\}/g)) {
    const selector = block[1].trim();
    const body = block[2];
    if (/\bbackdrop-filter\s*:/.test(body) && !/-webkit-backdrop-filter\s*:/.test(body)) {
      errors.push(`${owner}: backdrop-filter is missing -webkit-backdrop-filter`);
    }
    const usesModernViewport = /\b(?:svh|dvh|lvh)\b/.test(body);
    const hasVhFallback = /(?<![sdl])vh\b/.test(body);
    if (usesModernViewport && !hasVhFallback) {
      errors.push(`${owner}: svh/dvh/lvh declaration is missing a vh fallback`);
    }
    if (/\b(?:aspect-ratio|object-fit)\s*:/.test(body) && /\bimg\b/.test(selector)) {
      if (!/\[data-media-fit=["']cover["']\]/.test(selector)
        && !/\[data-media-fit=["']contain["']\]/.test(selector)
        && !/\[data-media-fit=["']natural["']\]/.test(selector)) {
        warnings.push(`${owner}: image sizing rule should use an explicit data-media-fit selector (${selector})`);
      }
    }
  }
}

for (const page of pages) {
  const html = read(page);
  if (/user-scalable\s*=\s*no/i.test(html)) {
    errors.push(`${page}: user-scalable=no is forbidden`);
  }

  const viewport = html.match(
    /<meta\s+name=["']viewport["'][^>]*content=["']([^"']+)["']/i
  )?.[1] || '';
  if (!/viewport-fit=cover/i.test(viewport)
    || !/interactive-widget=resizes-content/i.test(viewport)) {
    errors.push(`${page}: viewport compatibility directives are incomplete`);
  }
  if (!/<script\s+src=["'](?:\.\.\/)*js\/compat\.js["']/i.test(html)) {
    errors.push(`${page}: shared compatibility layer is not loaded`);
  }
  if (/new\s+Date\s*\([^)]*created_at/i.test(html)) {
    errors.push(`${page}: direct created_at Date parsing`);
  }

  let highPriorityImages = 0;
  for (const match of html.matchAll(/<img\b([^>]*)>/gi)) {
    const attrs = match[1];
    const src = attrs.match(/\bsrc\s*=\s*["']([^"']+)/i)?.[1] || '';
    const alt = attrs.match(/\balt\s*=\s*["']([^"']*)["']/i)?.[1];
    const width = attrs.match(/\bwidth\s*=\s*["'](\d+)["']/i)?.[1];
    const height = attrs.match(/\bheight\s*=\s*["'](\d+)["']/i)?.[1];
    const loading = attrs.match(/\bloading\s*=\s*["']([^"']+)["']/i)?.[1];
    const decoding = attrs.match(/\bdecoding\s*=\s*["']([^"']+)["']/i)?.[1];
    const fit = attrs.match(/\bdata-media-fit\s*=\s*["']([^"']+)["']/i)?.[1];
    const highPriority = /\bfetchpriority\s*=\s*["']high["']/i.test(attrs);

    if (src) checkTarget(page, src);
    if (alt === undefined || !alt.trim()) {
      errors.push(`${page}: image alt is empty (${src || 'dynamic'})`);
    }
    if (!width || !height) {
      errors.push(`${page}: image width/height is required (${src || 'dynamic'})`);
    }
    if (decoding !== 'async') {
      errors.push(`${page}: image decoding must be async (${src || 'dynamic'})`);
    }
    if (loading && !['lazy', 'eager'].includes(loading)) {
      errors.push(`${page}: invalid loading policy (${src || 'dynamic'})`);
    }
    if (fit && !['natural', 'contain', 'cover'].includes(fit)) {
      errors.push(`${page}: invalid data-media-fit (${src || 'dynamic'})`);
    }
    if (!fit) {
      errors.push(`${page}: image must declare data-media-fit (${src || 'dynamic'})`);
    }
    if (highPriority) {
      highPriorityImages += 1;
      if (loading === 'lazy') {
        errors.push(`${page}: high-priority image cannot be lazy (${src || 'dynamic'})`);
      }
    }
  }
  if (highPriorityImages > 1) {
    errors.push(`${page}: at most one image may use fetchpriority=high`);
  }

  for (const match of html.matchAll(/\b(?:href|src)=["']([^"']+)["']/gi)) {
    checkTarget(page, match[1]);
  }
  for (const match of html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) {
    checkCss(`${page} inline style`, match[1]);
  }
}

checkCss('css/style.css', read('css/style.css'));
for (const file of ['js/script.js', 'universe.html']) {
  if (/\blocalStorage\s*\./.test(read(file))) {
    errors.push(`${file}: business code accesses localStorage directly`);
  }
}

for (const page of ignoredHtml) {
  if (fs.existsSync(path.join(root, page))) {
    warnings.push(`${page}: excluded prototype/test page`);
  }
}

if (errors.length) {
  console.error(errors.map((item) => `ERROR ${item}`).join('\n'));
}
if (warnings.length) {
  console.warn(warnings.map((item) => `WARN ${item}`).join('\n'));
}
console.log(`Checked ${pages.length} production pages; ${errors.length} errors, ${warnings.length} warnings`);
process.exitCode = errors.length ? 1 : 0;
