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
import katex from 'katex';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONTENT_DIR = path.join(ROOT, 'content', 'minecraft');
const OUT_DIR = path.join(ROOT, 'mc');
const TPL_DIR = path.join(ROOT, 'tools', 'mc-templates');

const SITE_ORIGIN = 'yijian6.com';
const STALE_DAYS = 60;
const TODAY = new Date().toLocaleDateString('sv-SE'); // 本地时区的 YYYY-MM-DD
const IMG_WARN_BYTES = 500 * 1024;
const IMG_ERROR_BYTES = 1200 * 1024;

const errors = [];
const warnings = [];
const notices = [];

// Obsidian 的附件文件夹：用户在 Obsidian 里粘贴图片时会全部存到这里，
// 位置由用户自己的设置决定，所以直接读他们的配置，而不是要求他们迁就脚本。
function readAttachmentDir() {
  const cfg = path.join(CONTENT_DIR, '.obsidian', 'app.json');
  if (!fs.existsSync(cfg)) return null;
  try {
    const p = JSON.parse(fs.readFileSync(cfg, 'utf8'))['attachmentFolderPath'];
    if (!p || typeof p !== 'string') return null;
    // "./" 开头或 "/" 表示库根，其余是库内相对路径
    const clean = p.replace(/^\.?\//, '').trim();
    return clean ? clean.split('/')[0] : null;
  } catch {
    return null;
  }
}

const ATTACHMENT_DIR = readAttachmentDir();

// ---------- 工具函数 ----------

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function normalizeDate(value, file, opts = {}) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    return value.trim();
  }
  if (!opts.quiet) {
    errors.push(`✗ ${file}\n  「日期」格式不对，应该是 2026-07-21 这样。`);
  }
  return null;
}

function baseName(filename) {
  return filename.replace(/\.md$/i, '').trim();
}

function slugFromFilename(filename) {
  return filename
    .replace(/\.md$/i, '')
    .replace(/^\d{4}-\d{2}-\d{2}[-_\s]*/, '')
    .trim();
}

// 网址：优先用 frontmatter 的「网址」字段（英文短链接），否则回退到日期。
// 大小写不该卡人，统一转小写；只有真正没法放进网址的字符才报错。
function articleSlug(fm, date, file) {
  const custom = (fm['网址'] || '').toString().trim().toLowerCase();
  if (!custom) return date;
  if (!/^[a-z0-9-]+$/.test(custom)) {
    const suggestion = custom.replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
    errors.push(
      `✗ ${file}\n  「网址」里有不能用在网址上的字符（空格、中文或符号）。` +
        (suggestion ? `改成「${suggestion}」这样就可以。` : '请用英文字母、数字和连字符。')
    );
    return date;
  }
  return custom;
}

// 缺日期时自动补今天，并写回源文件——这样日期被永久记录（重新 clone 也不丢），
// 用户又完全不用手填。只做最小化文本插入，不重新序列化整块 frontmatter，
// 避免打乱用户其它属性的写法和顺序。
function writeBackDate(mdFile, today) {
  const raw = fs.readFileSync(mdFile, 'utf8');
  let next;
  if (/^﻿?---\r?\n/.test(raw)) {
    next = raw.replace(/^(﻿?---\r?\n)/, `$1日期: ${today}\n`);
  } else {
    next = `---\n日期: ${today}\n---\n\n${raw}`;
  }
  fs.writeFileSync(mdFile, next, 'utf8');
  notices.push(`  · ${relDisplay(mdFile)} → 日期: ${today}`);
}

// 按公共前缀长度挑最接近的蓝图项（「Shell实验之前」→「Shell实验引入」）
function nearestBlueprintItem(claim, blueprint) {
  let best = null;
  let bestLen = 0;
  for (const item of blueprint) {
    let n = 0;
    while (n < claim.length && n < item.length && claim[n] === item[n]) n += 1;
    if (n > bestLen) {
      bestLen = n;
      best = item;
    }
  }
  return bestLen >= 2 ? best : null;
}

// 群系 → 地图配色键。填错或没填都退回 stone，不让内容库的手滑卡住发布。
const BIOMES = {
  石: 'stone', 林: 'forest', 沙: 'sand', 海: 'ocean', 岩: 'nether',
  stone: 'stone', forest: 'forest', sand: 'sand', ocean: 'ocean', nether: 'nether',
};

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
  // Obsidian 粘贴的图片会进用户配置的附件文件夹（库级），也兜底找一次库根
  if (ATTACHMENT_DIR) candidates.push(path.join(CONTENT_DIR, ATTACHMENT_DIR, src));
  candidates.push(path.join(CONTENT_DIR, src));

  for (const abs of candidates) {
    if (fs.existsSync(abs) && fs.statSync(abs).isFile()) return abs;
  }
  const searched = candidates.map((c) => path.dirname(relDisplay(c))).join('\n    ');
  errors.push(`✗ ${relDisplay(mdFile)}\n  找不到图片「${src}」。检查文件名（含后缀）是否完全一致。已经找过这些位置：\n    ${searched}`);
  return null;
}

function imageHtml(abs, alt, widthHint) {
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
  // Obsidian 的 |300 显示宽度：真实尺寸仍写进 width/height，显示宽度用内联样式控制
  const sizeStyle = widthHint ? ` style="width:min(${widthHint}px, 100%)"` : '';
  return `<img src="${esc(srcRel)}" alt="${esc(altText)}" width="${dims.width}" height="${dims.height}" loading="lazy" decoding="async" data-media-fit="natural"${sizeStyle}>`;
}

// 小节锚点：[[文章#小节标题]] → 文章.html#sN。
// 渲染器给 h2/h3 按出现顺序编号（s1、s2……），这里用同样的顺序预扫一遍正文，
// 得到「标题原文 → 锚点」的对照表。围栏代码块里的 # 不是标题，先剔掉。
function headingAnchors(body) {
  const map = new Map();
  const clean = body.replace(/^```[\s\S]*?^```/gm, '');
  let n = 0;
  for (const m of clean.matchAll(/^(#{1,3})\s+(.+?)\s*$/gm)) {
    n += 1;
    const key = m[2].replace(/\s+/g, ' ').trim();
    if (!map.has(key)) map.set(key, `s${n}`);
  }
  return map;
}

// 内链解析：[[文章名]] / [[文章名|显示文字]] / [[文章名#小节]] → 站内链接
function resolveWikiLink(targetRaw, label) {
  const hashAt = targetRaw.indexOf('#');
  const base = (hashAt < 0 ? targetRaw : targetRaw.slice(0, hashAt)).trim();
  const section = hashAt < 0 ? '' : targetRaw.slice(hashAt + 1).replace(/\s+/g, ' ').trim();
  const text = esc(label || base);
  if (!base) {
    errors.push(`✗ ${relDisplay(ctx.mdFile)}\n  内链「[[${targetRaw}]]」是空的。`);
    return text;
  }
  const currentSlug = ctx.domain.slug;
  // 先同领域、后跨领域：按标题 / 文件名（Obsidian [[ 补全插入的就是文件名）/ 网址匹配
  const pools = [ctx.index.filter((e) => e.domainSlug === currentSlug), ctx.index.filter((e) => e.domainSlug !== currentSlug)];
  for (const pool of pools) {
    const hit = pool.find(
      (e) => e.title === base || e.slug === base || e.basename === base || e.nameSlug === base
    );
    if (hit) {
      let href = hit.domainSlug === currentSlug ? `${hit.slug}` : `../${hit.domainSlug}/${hit.slug}`;
      if (section) {
        const anchor = hit.headings.get(section);
        if (anchor) href += `#${anchor}`;
        else warnings.push(`⚠ ${relDisplay(ctx.mdFile)} 的内链「[[${targetRaw}]]」找不到小节「${section}」，已链到文章开头。`);
      }
      // 没写别名时显示文章标题——Obsidian 的 [[ 补全插进来的是带日期前缀的文件名，
      // 直接显示会很难看
      const linkText = label ? esc(label) : esc(hit.title);
      return `<a href="${esc(href)}">${linkText}</a>`;
    }
  }
  // 匹配领域名 → 领域立面页
  const domainHit = ctx.domains.find((d) => d.name === base || d.nameEn === base);
  if (domainHit) {
    const href = domainHit.slug === currentSlug ? './' : `../${domainHit.slug}/`;
    return `<a href="${esc(href)}">${text}</a>`;
  }
  // 和 Obsidian 一样：指不到东西的内链就是一段普通文字，不该挡住发布。
  // 但要报出来，免得真写错标题的链接悄悄变成白字。
  warnings.push(`⚠ ${relDisplay(ctx.mdFile)} 的内链「[[${targetRaw}]]」找不到目标，已按纯文字显示。\n  （想让它变成链接：文字要和目标文章的标题或文件名完全一致；目标还是草稿的话，先发布它。）`);
  return text;
}

// ---------- 数学公式 ----------

const PIPE_SENTINEL = String.fromCharCode(0xe000); // Unicode 私用区，正文里不会出现

// 公式必须在 markdown 碰它之前就被整块吃掉：LaTeX 里的 \\[4pt](1-a) 会被
// markdown 当成链接、_下标_ 当成斜体、\\ 当成转义反斜杠。这里先截获再交给
// KaTeX 在构建时渲染成 HTML，页面上不需要任何 JS。
function renderMath(rawTex, displayMode) {
  // 表格行里被临时替换掉的竖线，交给 KaTeX 之前换回来
  const tex = rawTex.split(PIPE_SENTINEL).join('|');
  try {
    return katex.renderToString(tex, {
      displayMode,
      throwOnError: true,
      strict: false,
      output: 'html',
    });
  } catch (err) {
    // 公式写错不该挡住发布，但要让人看得见是哪一条
    warnings.push(`⚠ ${relDisplay(ctx.mdFile)} 有一条公式 KaTeX 读不懂，已按原文显示：${tex.trim().slice(0, 60)}\n  （${err.message.replace(/\s+/g, ' ').slice(0, 120)}）`);
    return `<code>${esc(displayMode ? `$$${tex}$$` : `$${tex}$`)}</code>`;
  }
}

// 独占一行的 $$…$$ — 行间公式
const mathBlockExt = {
  name: 'mathBlock',
  level: 'block',
  start(src) { const m = /(^|\n)\$\$/.exec(src); return m ? m.index + (m[1] ? 1 : 0) : undefined; },
  tokenizer(src) {
    const m = /^\$\$([\s\S]+?)\$\$[ \t]*(?:\n+|$)/.exec(src);
    if (m) return { type: 'mathBlock', raw: m[0], tex: m[1] };
  },
  renderer(token) {
    return `<div class="mc-math-block">${renderMath(token.tex, true)}</div>\n`;
  },
};

// $…$ — 行内公式。
// 三条约束把「文字里的美元符号 / shell 提示符 $」挡在外面：
// 开定界符后不跟空白、闭定界符前不是空白、闭定界符后不跟数字，且不跨行。
const mathInlineExt = {
  name: 'mathInline',
  level: 'inline',
  start(src) { const i = src.indexOf('$'); return i < 0 ? undefined : i; },
  tokenizer(src) {
    const m = /^\$\$([^\n]+?)\$\$/.exec(src);
    if (m) return { type: 'mathInline', raw: m[0], tex: m[1], display: true };
    const inline = /^\$(?![\s$])([^\n$]*[^\s$])\$(?!\d)/.exec(src);
    if (inline) return { type: 'mathInline', raw: inline[0], tex: inline[1], display: false };
  },
  renderer(token) {
    // 段落中间写的 $$…$$ 同样是行间公式，也要给它滚动容器（这里得用 span，
    // 因为它出现在 <p> 里面）
    if (token.display) return `<span class="mc-math-block">${renderMath(token.tex, true)}</span>`;
    return renderMath(token.tex, false);
  },
};

// ---------- Obsidian 方言扩展 ----------

// ![[图.png]] / ![[图.png|300]] / ![[图.png|说明文字]] — 图片嵌入（文件名可含空格）
const wikiEmbedExt = {
  name: 'wikiEmbed',
  level: 'inline',
  start(src) { const i = src.indexOf('![['); return i < 0 ? undefined : i; },
  tokenizer(src) {
    const m = /^!\[\[([^\]|]+?)(?:\|([^\]]*))?\]\]/.exec(src);
    if (m) return { type: 'wikiEmbed', raw: m[0], file: m[1].trim(), hint: (m[2] || '').trim() };
  },
  renderer(token) {
    const abs = resolveImage(token.file, ctx.mdFile);
    if (!abs) return '';
    let alt = '';
    let widthHint = null;
    if (/^\d+(?:x\d+)?$/.test(token.hint)) widthHint = parseInt(token.hint, 10);
    else alt = token.hint;
    return imageHtml(abs, alt, widthHint);
  },
};

// [[文章名]] / [[文章名|显示文字]] — 站内内链
const wikiLinkExt = {
  name: 'wikiLink',
  level: 'inline',
  start(src) { const i = src.indexOf('[['); return i < 0 ? undefined : i; },
  tokenizer(src) {
    const m = /^\[\[([^\]|]+?)(?:\|([^\]]*))?\]\]/.exec(src);
    if (m) return { type: 'wikiLink', raw: m[0], target: m[1].trim(), label: (m[2] || '').trim() };
  },
  renderer(token) {
    return resolveWikiLink(token.target, token.label);
  },
};

// ==高亮== → <mark>
const highlightExt = {
  name: 'obsHighlight',
  level: 'inline',
  start(src) { const i = src.indexOf('=='); return i < 0 ? undefined : i; },
  tokenizer(src) {
    const m = /^==([^=\n]+?)==/.exec(src);
    if (m) {
      const token = { type: 'obsHighlight', raw: m[0], tokens: [] };
      this.lexer.inline(m[1], token.tokens);
      return token;
    }
  },
  renderer(token) {
    return `<mark>${this.parser.parseInline(token.tokens)}</mark>`;
  },
};

// 行首 Tab / 4 空格缩进的普通文字：Obsidian 里常用来排版，
// 标准 Markdown 会当成代码块——这里改为按普通段落渲染（真正的代码请用 ``` 围栏）
const indentedTextExt = {
  name: 'indentedText',
  level: 'block',
  start(src) {
    const m = /(^|\n)(?: {4}|\t)/.exec(src);
    return m ? m.index + m[1].length : undefined;
  },
  tokenizer(src) {
    const m = /^((?: {4}|\t)[^\n]*(?:\n(?: {4}|\t)[^\n]*)*)/.exec(src);
    if (m) {
      const text = m[1].replace(/^(?: {4}|\t)+/gm, '');
      const token = { type: 'indentedText', raw: m[1], tokens: [] };
      this.lexer.inline(text, token.tokens);
      return token;
    }
  },
  renderer(token) {
    return `<p class="mc-indent">${this.parser.parseInline(token.tokens)}</p>\n`;
  },
};

marked.use({
  gfm: true,
  breaks: true, // 和 Obsidian 一致：单次换行就是换行
  extensions: [mathBlockExt, wikiEmbedExt, wikiLinkExt, mathInlineExt, highlightExt, indentedTextExt],
  renderer: {
    image({ href, text }) {
      const abs = resolveImage(href, ctx.mdFile);
      if (!abs) return '';
      return imageHtml(abs, text);
    },
    // 给小标题按顺序编号做锚点，供大纲跳转。
    // 用序号而不是标题文字：中文 id 分享出去会变成一长串编码。
    // 正文里的 h1 也算一级小标题——第一个 h1 已经被当成文章标题摘走了，
    // 剩下的都是作者用来分大段的（试卷讲解里的「五、计算题」就是这么写的）。
    heading({ tokens, depth }) {
      const text = this.parser.parseInline(tokens);
      if (depth > 3) return `<h${depth}>${text}</h${depth}>\n`;
      ctx.headingCount += 1;
      return `<h${depth} id="s${ctx.headingCount}">${text}</h${depth}>\n`;
    },
  },
});

// 表格里的公式常带竖线（|X|、P(A|B)），而表格的单元格也是用 | 分的，
// markdown 会先按 | 切格子再轮到公式扩展，公式就被劈成两半。
// 解决办法：进 markdown 之前把表格行里公式内部的 | 换成一个占位字符，
// 交给 KaTeX 之前再换回来。
function protectTablePipes(body) {
  return body
    .split('\n')
    .map((line) => {
      if (!/^\s*\|/.test(line)) return line;
      return line.replace(/\$(?![\s$])([^\n$]*[^\s$])\$(?!\d)/g, (m) => m.split('|').join(PIPE_SENTINEL));
    })
    .join('\n');
}

function renderMarkdown(body, mdFile, domain, domains, index) {
  ctx = { mdFile, domain, domains, index, headingCount: 0 };
  let html = marked.parse(protectTablePipes(body));
  ctx = null;
  // 没被当成公式的占位字符（比如那段 $ 其实不是公式）还原成普通竖线
  html = html.split(PIPE_SENTINEL).join('|');
  // 表格包滚动容器，防手机端溢出
  html = html
    .replace(/<table>/g, '<div class="mc-table-wrap"><table>')
    .replace(/<\/table>/g, '</table></div>');
  return html;
}

// 公式样式表只在真有公式的页面上引，没公式的文章不用为它多花一次请求
function mathAssets(bodyHtml) {
  if (!bodyHtml.includes('class="katex')) return '';
  return '\n    <link rel="stylesheet" href="../../css/katex.css">';
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
    // 还没有文章的文件夹不算领域，静默跳过——在 Obsidian 里随手建的空文件夹不该让发布失败。
    // 只有「已经有文章却缺 _领域.md」才是真的写错了。
    const hasArticles = fs
      .readdirSync(dir, { withFileTypes: true })
      .some((e) => e.isFile() && e.name.endsWith('.md') && !e.name.startsWith('_'));
    if (hasArticles) {
      errors.push(`✗ ${relDisplay(dir)}\n  这个文件夹里有文章，但缺少 _领域.md。每个领域需要一个 _领域.md 声明「名称」和「英文」（照抄别的领域改一下就行）。`);
    }
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

  // 简介 / 群系：世界地图用。两个都可选——world-data.js 是构建产物，
  // 内容库里还没填这两个字段时构建必须照跑，所以只给默认值不报错。
  const summary = String(meta['简介'] || '').trim();
  const biome = BIOMES[String(meta['群系'] || '').trim()] || 'stone';

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
    // 还没动笔的空笔记：在 Obsidian 里新建一篇待写的笔记是常态，不该挡住发布
    if (!body.trim()) continue;

    let date = normalizeDate(fm['日期'], relDisplay(mdFile), { quiet: true });
    if (!date) {
      date = TODAY;
      writeBackDate(mdFile, date);
    }

    const titleMatch = body.match(/^#\s+(.+)$/m);
    const title = titleMatch ? titleMatch[1].trim() : slugFromFilename(entry.name);
    const bodyWithoutTitle = titleMatch ? body.replace(titleMatch[0], '').trim() : body.trim();

    articles.push({
      mdFile,
      filename: entry.name,
      basename: baseName(entry.name),
      nameSlug: slugFromFilename(entry.name),
      slug: articleSlug(fm, date, relDisplay(mdFile)),
      hasCustomSlug: Boolean((fm['网址'] || '').toString().trim()),
      title,
      date,
      summary: (fm['简介'] || '').toString().trim(),
      blueprintClaim: (fm['蓝图'] || '').toString().trim(),
      body: bodyWithoutTitle,
    });
  }

  // 楼层顺序：蓝图清单就是阅读顺序，认领了蓝图项的按清单排；
  // 没认领的排在后面，按日期。领域没写蓝图时自然退化成纯日期顺序。
  const bpIndex = (a) => (a.blueprintClaim ? blueprint.indexOf(a.blueprintClaim) : -1);
  articles.sort((a, b) => {
    const ia = bpIndex(a);
    const ib = bpIndex(b);
    if (ia >= 0 && ib >= 0) return ia - ib;
    if (ia >= 0) return -1;
    if (ib >= 0) return 1;
    return a.date === b.date ? a.filename.localeCompare(b.filename) : a.date.localeCompare(b.date);
  });

  // slug 冲突处理：自定义网址重复直接报错；日期回退的自动加序号
  const seen = new Set();
  for (const a of articles) {
    if (!seen.has(a.slug)) {
      seen.add(a.slug);
      continue;
    }
    if (a.hasCustomSlug) {
      errors.push(`✗ ${relDisplay(a.mdFile)}\n  「网址」填的「${a.slug}」和同领域另一篇文章重复了，换一个。`);
      continue;
    }
    let n = 2;
    while (seen.has(`${a.slug}-${n}`)) n += 1;
    a.slug = `${a.slug}-${n}`;
    seen.add(a.slug);
  }

  // 蓝图认领校验：找不到时挑一个最接近的项作为提示，多半就是笔误
  for (const a of articles) {
    if (a.blueprintClaim && !blueprint.includes(a.blueprintClaim)) {
      const closest = nearestBlueprintItem(a.blueprintClaim, blueprint);
      errors.push(
        `✗ ${relDisplay(a.mdFile)}\n  「蓝图」填了「${a.blueprintClaim}」，但 _领域.md 的蓝图清单里没有这一项。` +
          (closest ? `你是不是想填「${closest}」？` : '检查文字是否完全一致。')
      );
    }
  }

  return { dirName, dir, name, nameEn, slug: domainSlug(nameEn), order, summary, biome, blueprint, articles };
}

// ---------- 生成页面 ----------

function buildArticlePage(domain, article, floorNum, articleTpl, domains, linkIndex) {
  const bodyHtml = renderMarkdown(article.body, article.mdFile, domain, domains, linkIndex);
  const total = domain.articles.length;

  // 楼梯：上一层 / 回到这栋楼 / 下一层。中间那个每层都有——
  // 读完任意一层都该能直接回楼，而不是一层层走下去。
  const stairs = [];
  if (floorNum > 1) {
    const prev = domain.articles[floorNum - 2];
    stairs.push(`            <a href="${esc(prev.slug)}" class="mca-stair">↓ ${floorNum - 1}F ${esc(prev.title)}</a>`);
  } else {
    stairs.push('            <span class="mca-stair mca-stair--empty"></span>');
  }
  stairs.push(`            <a href="./" class="mca-stair mca-stair--home">▤ 回到这栋楼</a>`);
  if (floorNum < total) {
    const next = domain.articles[floorNum];
    stairs.push(`            <a href="${esc(next.slug)}" class="mca-stair mca-stair--next">${floorNum + 1}F ${esc(next.title)} ↑</a>`);
  } else {
    stairs.push('            <span class="mca-stair mca-stair--empty"></span>');
  }

  return fill(articleTpl, {
    HEAD_EXTRA: mathAssets(bodyHtml),
    TITLE: esc(article.title),
    TITLE_ESC: esc(article.title),
    SUMMARY_ESC: esc(article.summary || `${domain.name} · ${article.title}`),
    SOURCE_URL: esc(`${SITE_ORIGIN}/mc/${domain.slug}/${article.slug}`),
    CRUMB_HREF: './',
    CRUMB_TEXT: esc(`← 回到 ${domain.name}`),
    META: `${floorNum}F · ${article.date} · 约 ${readMinutes(bodyHtml)} 分钟`,
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
    rows.push(`                <a class="mcd-floor" href="${esc(a.slug)}"><span class="mcd-floor-num">${i + 1}F</span><span class="mcd-floor-title">${esc(a.title)}</span><span class="mcd-floor-date">${a.date}</span></a>`);
  }

  return fill(domainTpl, {
    DOMAIN_NAME: esc(domain.name),
    NAME_EN: esc(domain.nameEn),
    FLOOR_COUNT: String(total),
    PLAN_COUNT: ghosts.length ? `，规划 ${ghosts.length} 层` : '',
    FACADE: rows.join('\n'),
  });
}

// 附页：库根目录下的笔记（不在任何领域文件夹里）。
// 它们是资料而不是思考沉淀，所以照常渲染成可被 [[链接]] 指到的页面，
// 但不占楼层、不进天际线、不上冒险日志。
const NOTES_SLUG = 'notes';
// 使用说明是写给作者自己看的（含本机路径和发布步骤），不发布
const NOTES_EXCLUDE = new Set(['使用说明.md']);

function noteSlug(fm, basename, file) {
  const custom = (fm['网址'] || '').toString().trim().toLowerCase();
  if (custom) {
    if (/^[a-z0-9-]+$/.test(custom)) return custom;
    errors.push(`✗ ${file}\n  「网址」里有不能用在网址上的字符，请用英文字母、数字和连字符。`);
  }
  const auto = basename
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (auto) return auto;
  warnings.push(`⚠ ${file} 的文件名里没有英文，网址会是一串编码。想要干净的网址，在属性里加一个「网址」字段。`);
  return basename;
}

function parseRootNotes() {
  const notes = [];
  for (const entry of fs.readdirSync(CONTENT_DIR, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
    if (entry.name.startsWith('_') || NOTES_EXCLUDE.has(entry.name)) continue;

    const mdFile = path.join(CONTENT_DIR, entry.name);
    const { data: fm, content: body } = matter.read(mdFile);
    if (fm['草稿'] === true || !body.trim()) continue;

    const bn = baseName(entry.name);
    const titleMatch = body.match(/^#\s+(.+)$/m);
    notes.push({
      mdFile,
      filename: entry.name,
      basename: bn,
      nameSlug: bn,
      slug: noteSlug(fm, bn, relDisplay(mdFile)),
      title: titleMatch ? titleMatch[1].trim() : bn,
      body: titleMatch ? body.replace(titleMatch[0], '').trim() : body.trim(),
      summary: (fm['简介'] || '').toString().trim(),
      date: normalizeDate(fm['日期'], relDisplay(mdFile), { quiet: true }),
    });
  }
  return notes;
}

function buildNotePage(note, articleTpl, domains, linkIndex) {
  const pseudoDomain = { slug: NOTES_SLUG, name: '附页' };
  const bodyHtml = renderMarkdown(note.body, note.mdFile, pseudoDomain, domains, linkIndex);
  return fill(articleTpl, {
    HEAD_EXTRA: mathAssets(bodyHtml),
    TITLE: esc(note.title),
    TITLE_ESC: esc(note.title),
    SUMMARY_ESC: esc(note.summary || note.title),
    SOURCE_URL: esc(`${SITE_ORIGIN}/mc/${NOTES_SLUG}/${note.slug}`),
    CRUMB_HREF: '../../minecraft',
    CRUMB_TEXT: '← 回到世界',
    META: ['附页', note.date, `约 ${readMinutes(bodyHtml)} 分钟`].filter(Boolean).join(' · '),
    BODY: bodyHtml,
    STAIRS: '            <a href="../../minecraft" class="mca-stair mca-stair--home">▤ 回到世界</a>',
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
    // 跳过隐藏目录、下划线开头的目录（如 _模板、_日记）、assets 和 Obsidian 附件文件夹
    if (!entry.isDirectory() || entry.name.startsWith('.') || entry.name.startsWith('_')) continue;
    if (entry.name === 'assets' || entry.name === ATTACHMENT_DIR) continue;
    const d = parseDomain(entry.name);
    if (d) domains.push(d);
  }
  domains.sort((a, b) => a.order - b.order || a.slug.localeCompare(b.slug));

  const articleTpl = readTemplate('article.html');
  const domainTpl = readTemplate('domain.html');
  const today = new Date();

  const notes = parseRootNotes();

  // 内链索引：渲染前先收齐全部文章和附页（标题 + slug），供 [[内链]] 解析
  const linkIndex = [];
  for (const d of domains) {
    for (const a of d.articles) {
      linkIndex.push({
        domainSlug: d.slug,
        slug: a.slug,
        basename: a.basename,
        nameSlug: a.nameSlug,
        title: a.title,
        headings: headingAnchors(a.body),
      });
    }
  }
  for (const n of notes) {
    linkIndex.push({
      domainSlug: NOTES_SLUG,
      slug: n.slug,
      basename: n.basename,
      nameSlug: n.nameSlug,
      title: n.title,
      headings: headingAnchors(n.body),
    });
  }

  // 先渲染全部（渲染过程会追加校验错误），有错则不写任何文件
  const output = new Map(); // 相对路径 → 内容
  const worldDomains = [];
  const log = [];

  for (const note of notes) {
    output.set(path.join('mc', NOTES_SLUG, `${note.slug}.html`), buildNotePage(note, articleTpl, domains, linkIndex));
  }

  for (const domain of domains) {
    const lastDate = domain.articles.length ? domain.articles[domain.articles.length - 1].date : null;
    const staleDays = lastDate ? Math.floor((today - new Date(lastDate)) / 86400000) : null;
    const stale = staleDays !== null && staleDays > STALE_DAYS;

    output.set(path.join('mc', domain.slug, 'index.html'), buildDomainPage(domain, domainTpl, stale));

    domain.articles.forEach((article, idx) => {
      output.set(
        path.join('mc', domain.slug, `${article.slug}.html`),
        buildArticlePage(domain, article, idx + 1, articleTpl, domains, linkIndex)
      );
      log.push({
        date: article.date,
        title: article.title,
        domainName: domain.name,
        url: `mc/${domain.slug}/${article.slug}`,
      });
    });

    const claimed = new Set(domain.articles.map((a) => a.blueprintClaim).filter(Boolean));
    const ghosts = domain.blueprint.filter((t) => !claimed.has(t));
    worldDomains.push({
      name: domain.name,
      nameEn: domain.nameEn,
      slug: domain.slug,
      summary: domain.summary,
      biome: domain.biome,
      floors: domain.articles.map((a, i) => ({ n: i + 1, title: a.title, date: a.date })),
      ghosts,
      // total = 已建 + 规划：世界地图按「圈下多大的地」定地块尺寸，不按已经建了几篇
      total: domain.articles.length + ghosts.length,
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
  if (notices.length) {
    console.log(`\n📅 这些文章没填日期，已自动补上今天并写进文件：\n${notices.join('\n')}`);
  }
  const floorTotal = worldDomains.reduce((s, d) => s + d.floors.length, 0);
  console.log(`✅ 构建完成：${worldDomains.length} 个领域，${floorTotal} 层楼，共生成 ${output.size} 个文件。`);
}

main();
