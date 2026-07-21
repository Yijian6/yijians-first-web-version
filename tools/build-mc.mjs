// build-mc.mjs — Minecraft 思考沉淀空间构建脚本
// 用法：npm run build:mc
// 输入：content/minecraft/<领域>/(_领域.md + *.md + assets/)
// 输出：mc/<域slug>/index.html、mc/<域slug>/<文章slug>.html、mc/world-data.js

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import { marked } from 'marked';
import { imageSize } from 'image-size';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONTENT_DIR = path.join(ROOT, 'content', 'minecraft');
const OUT_DIR = path.join(ROOT, 'mc');
const TPL_DIR = path.join(ROOT, 'tools', 'mc-templates');

const STALE_DAYS = 60;
const IMG_WARN_BYTES = 500 * 1024;
const IMG_ERROR_BYTES = 1200 * 1024;

const errors = [];
const warnings = [];

// ---------- 工具函数 ----------

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function normalizeDate(value, file) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    return value.trim();
  }
  errors.push(`✗ ${file}\n  「日期」缺失或格式不对。请在 Obsidian 属性面板填写日期（格式 2026-07-21）。`);
  return null;
}

function slugFromFilename(filename) {
  return filename
    .replace(/\.md$/i, '')
    .replace(/^\d{4}-\d{2}-\d{2}[-_\s]*/, '')
    .trim();
}

function domainSlug(nameEn) {
  return String(nameEn).trim().toLowerCase().replace(/\s+/g, '-');
}

function readTemplate(name) {
  return fs.readFileSync(path.join(TPL_DIR, name), 'utf8');
}

function fill(template, vars) {
  return template.replace(/\{\{(\w+)\}\}/g, (m, key) =>
    key in vars ? vars[key] : m
  );
}

function relDisplay(abs) {
  return path.relative(ROOT, abs).replace(/\\/g, '/');
}

// ---------- Markdown 处理 ----------

// 当前正在渲染的文章上下文（供图片 renderer 使用）
let ctx = null;

function resolveImage(src, mdFile) {
  // 只处理本地相对路径；网络图片原样保留
  if (/^(https?:)?\/\//.test(src) || src.startsWith('data:')) return null;
  const domainDir = path.dirname(mdFile);
  const candidates = [
    path.join(domainDir, src),
    path.join(domainDir, 'assets', src),
  ];
  for (const abs of candidates) {
    if (fs.existsSync(abs) && fs.statSync(abs).isFile()) return abs;
  }
  errors.push(`✗ ${relDisplay(mdFile)}\n  找不到图片「${src}」。请确认图片放在文章旁边或 assets/ 文件夹里，文件名一致。`);
  return null;
}

function imageHtml(abs, alt) {
  const buf = fs.readFileSync(abs);
  let dims;
  try {
    dims = imageSize(new Uint8Array(buf));
  } catch {
    errors.push(`✗ ${relDisplay(abs)}\n  读取不到图片尺寸，可能文件已损坏或格式不支持。`);
    return '';
  }
  if (!dims.width || !dims.height) {
    errors.push(`✗ ${relDisplay(abs)}\n  图片没有可用的宽高信息。`);
    return '';
  }
  if (buf.length > IMG_ERROR_BYTES) {
    errors.push(`✗ ${relDisplay(abs)}\n  图片超过 1.2MB（当前 ${(buf.length / 1024 / 1024).toFixed(1)}MB）。请先压缩（推荐 squoosh.app，导出 WebP）再发布。`);
  } else if (buf.length > IMG_WARN_BYTES) {
    warnings.push(`⚠ ${relDisplay(abs)} 超过 500KB，建议压缩以提升手机加载速度。`);
  }
  // 从 mc/<域slug>/文章.html 指回 content 里的原图
  const srcRel = '../../' + relDisplay(abs);
  const altText = alt && alt.trim() ? alt.trim() : path.basename(abs, path.extname(abs));
  return `<img src="${esc(srcRel)}" alt="${esc(altText)}" width="${dims.width}" height="${dims.height}" loading="lazy" decoding="async" data-media-fit="natural">`;
}

marked.use({
  gfm: true,
  renderer: {
    image({ href, text }) {
      const abs = resolveImage(href, ctx.mdFile);
      if (!abs) return '';
      return imageHtml(abs, text);
    },
  },
});

// ![[图.png]] / ![[图.png|说明]] → 标准 Markdown 图片语法
function convertWikiImages(body) {
  return body.replace(/!\[\[([^\]|]+?)(?:\|([^\]]+))?\]\]/g, (m, file, alt) => {
    const altText = (alt || '').trim();
    return `![${altText}](${file.trim()})`;
  });
}

function renderMarkdown(body, mdFile) {
  ctx = { mdFile };
  let html = marked.parse(convertWikiImages(body));
  ctx = null;
  // 表格包滚动容器，防手机端溢出
  html = html
    .replace(/<table>/g, '<div class="mc-table-wrap"><table>')
    .replace(/<\/table>/g, '</table></div>');
  return html;
}

function readMinutes(html) {
  const textLen = html.replace(/<[^>]+>/g, '').replace(/\s+/g, '').length;
  return Math.max(1, Math.round(textLen / 400));
}

// ---------- 解析内容库 ----------

function parseDomain(dirName) {
  const dir = path.join(CONTENT_DIR, dirName);
  const metaFile = path.join(dir, '_领域.md');
  if (!fs.existsSync(metaFile)) {
    errors.push(`✗ ${relDisplay(dir)}\n  缺少 _领域.md。每个领域文件夹需要一个 _领域.md 声明「名称」和「英文」。`);
    return null;
  }
  const { data: meta, content: metaBody } = matter.read(metaFile);
  const name = meta['名称'];
  const nameEn = meta['英文'];
  if (!name || !nameEn) {
    errors.push(`✗ ${relDisplay(metaFile)}\n  「名称」或「英文」缺失。英文名用于生成网址，例如 Data Structures。`);
    return null;
  }
  const order = Number(meta['排序']) || 999;

  // 蓝图：正文里的任务清单
  const blueprint = [];
  for (const m of metaBody.matchAll(/^[-*]\s*\[[ xX]\]\s*(.+)$/gm)) {
    blueprint.push(m[1].trim());
  }

  // 文章
  const articles = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.md') || entry.name.startsWith('_')) continue;
    const mdFile = path.join(dir, entry.name);
    const { data: fm, content: body } = matter.read(mdFile);
    if (fm['草稿'] === true) continue;

    const date = normalizeDate(fm['日期'], relDisplay(mdFile));
    if (!date) continue;

    const titleMatch = body.match(/^#\s+(.+)$/m);
    const title = titleMatch ? titleMatch[1].trim() : slugFromFilename(entry.name);
    const bodyWithoutTitle = titleMatch ? body.replace(titleMatch[0], '').trim() : body.trim();

    articles.push({
      mdFile,
      filename: entry.name,
      slug: slugFromFilename(entry.name),
      title,
      date,
      summary: (fm['简介'] || '').toString().trim(),
      blueprintClaim: (fm['蓝图'] || '').toString().trim(),
      body: bodyWithoutTitle,
    });
  }

  articles.sort((a, b) => (a.date === b.date ? a.filename.localeCompare(b.filename) : a.date.localeCompare(b.date)));

  // slug 冲突检查
  const seen = new Set();
  for (const a of articles) {
    if (seen.has(a.slug)) {
      errors.push(`✗ ${relDisplay(a.mdFile)}\n  文章标识「${a.slug}」重复（去掉日期前缀后文件名相同）。请改一下文件名。`);
    }
    seen.add(a.slug);
  }

  // 蓝图认领校验
  for (const a of articles) {
    if (a.blueprintClaim && !blueprint.includes(a.blueprintClaim)) {
      errors.push(`✗ ${relDisplay(a.mdFile)}\n  「蓝图」填了「${a.blueprintClaim}」，但 _领域.md 的蓝图清单里没有这一项。检查文字是否完全一致。`);
    }
  }

  return { dirName, dir, name, nameEn, slug: domainSlug(nameEn), order, blueprint, articles };
}

// ---------- 生成页面 ----------

function buildArticlePage(domain, article, floorNum, articleTpl) {
  const bodyHtml = renderMarkdown(article.body, article.mdFile);
  const total = domain.articles.length;

  const stairs = [];
  if (floorNum > 1) {
    const prev = domain.articles[floorNum - 2];
    stairs.push(`            <a href="${esc(prev.slug)}.html" class="mca-stair">↓ ${floorNum - 1}F ${esc(prev.title)}</a>`);
  } else {
    stairs.push(`            <a href="index.html" class="mca-stair">↓ 回到立面</a>`);
  }
  if (floorNum < total) {
    const next = domain.articles[floorNum];
    stairs.push(`            <a href="${esc(next.slug)}.html" class="mca-stair mca-stair--next">${floorNum + 1}F ${esc(next.title)} ↑</a>`);
  }

  return fill(articleTpl, {
    TITLE: esc(article.title),
    TITLE_ESC: esc(article.title),
    SUMMARY_ESC: esc(article.summary || `${domain.name} · ${article.title}`),
    DOMAIN_NAME: esc(domain.name),
    FLOOR_LABEL: `${floorNum}F`,
    DATE: article.date,
    READ_MIN: String(readMinutes(bodyHtml)),
    BODY: bodyHtml,
    STAIRS: stairs.join('\n'),
  });
}

function buildDomainPage(domain, domainTpl, stale) {
  const total = domain.articles.length;
  const claimed = new Set(domain.articles.map((a) => a.blueprintClaim).filter(Boolean));
  const ghosts = domain.blueprint.filter((t) => !claimed.has(t));

  const rows = [];
  rows.push(`                <div class="mcd-scaffold">▨ 施工中 · 下一层还没盖${
    stale ? '<span class="mcd-vine">🌿 这里已经 60 天没有动工了……</span>' : ''
  }</div>`);
  ghosts
    .slice()
    .reverse()
    .forEach((topic, i) => {
      const n = total + ghosts.length - i;
      rows.push(`                <div class="mcd-ghost"><span class="mcd-floor-num">${n}F</span><span class="mcd-ghost-topic">${esc(topic)}</span><span class="mcd-ghost-tag">规划中</span></div>`);
    });
  for (let i = total - 1; i >= 0; i--) {
    const a = domain.articles[i];
    rows.push(`                <a class="mcd-floor" href="${esc(a.slug)}.html"><span class="mcd-floor-num">${i + 1}F</span><span class="mcd-floor-title">${esc(a.title)}</span><span class="mcd-floor-date">${a.date}</span></a>`);
  }

  return fill(domainTpl, {
    DOMAIN_NAME: esc(domain.name),
    NAME_EN: esc(domain.nameEn),
    FLOOR_COUNT: String(total),
    PLAN_COUNT: ghosts.length ? `，规划 ${ghosts.length} 层` : '',
    FACADE: rows.join('\n'),
  });
}

// ---------- 主流程 ----------

function main() {
  if (!fs.existsSync(CONTENT_DIR)) {
    console.error(`✗ 找不到内容目录 ${relDisplay(CONTENT_DIR)}。`);
    process.exit(1);
  }

  const domains = [];
  for (const entry of fs.readdirSync(CONTENT_DIR, { withFileTypes: true })) {
    // 跳过隐藏目录、下划线开头的目录（如 _模板、_日记）和 assets
    if (!entry.isDirectory() || entry.name.startsWith('.') || entry.name.startsWith('_') || entry.name === 'assets') continue;
    const d = parseDomain(entry.name);
    if (d) domains.push(d);
  }
  domains.sort((a, b) => a.order - b.order || a.slug.localeCompare(b.slug));

  const articleTpl = readTemplate('article.html');
  const domainTpl = readTemplate('domain.html');
  const today = new Date();

  // 先渲染全部（渲染过程会追加校验错误），有错则不写任何文件
  const output = new Map(); // 相对路径 → 内容
  const worldDomains = [];
  const log = [];

  for (const domain of domains) {
    const lastDate = domain.articles.length ? domain.articles[domain.articles.length - 1].date : null;
    const staleDays = lastDate ? Math.floor((today - new Date(lastDate)) / 86400000) : null;
    const stale = staleDays !== null && staleDays > STALE_DAYS;

    output.set(path.join('mc', domain.slug, 'index.html'), buildDomainPage(domain, domainTpl, stale));

    domain.articles.forEach((article, idx) => {
      output.set(
        path.join('mc', domain.slug, `${article.slug}.html`),
        buildArticlePage(domain, article, idx + 1, articleTpl)
      );
      log.push({
        date: article.date,
        title: article.title,
        domainName: domain.name,
        url: `mc/${domain.slug}/${article.slug}.html`,
      });
    });

    const claimed = new Set(domain.articles.map((a) => a.blueprintClaim).filter(Boolean));
    worldDomains.push({
      name: domain.name,
      nameEn: domain.nameEn,
      slug: domain.slug,
      floors: domain.articles.map((a, i) => ({ n: i + 1, title: a.title, date: a.date })),
      ghosts: domain.blueprint.filter((t) => !claimed.has(t)),
      lastDate,
      stale,
    });
  }

  log.sort((a, b) => b.date.localeCompare(a.date));
  const worldData =
    'window.MC_WORLD = ' +
    JSON.stringify({ builtAt: today.toISOString().slice(0, 10), domains: worldDomains, log: log.slice(0, 5) }, null, 2).replace(/<\//g, '<\\/') +
    ';\n';
  output.set(path.join('mc', 'world-data.js'), worldData);

  if (errors.length) {
    console.error('\n构建失败，发现以下问题：\n');
    for (const e of errors) console.error(e + '\n');
    console.error(`共 ${errors.length} 个问题。修复后重新运行。`);
    process.exit(1);
  }

  // 重新生成 mc/（完全由本脚本管理的构建产物目录）
  fs.rmSync(OUT_DIR, { recursive: true, force: true });
  for (const [rel, content] of output) {
    const abs = path.join(ROOT, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content, 'utf8');
  }

  for (const w of warnings) console.warn(w);
  const floorTotal = worldDomains.reduce((s, d) => s + d.floors.length, 0);
  console.log(`✅ 构建完成：${worldDomains.length} 个领域，${floorTotal} 层楼，共生成 ${output.size} 个文件。`);
}

main();
