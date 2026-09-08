// vendor-katex.mjs — 把 node_modules 里的 KaTeX 样式和字体搬进仓库
// 用法：npm run vendor:katex（升级 katex 依赖后重跑一次）
//
// 站点的字体一律自托管，不走 CDN，公式字体也照这个规矩来：
//   css/katex.css        ← katex.min.css，字体路径改成站内相对路径
//   fonts/katex/*.woff2  ← 只留 woff2（不支持的老浏览器退回系统衬线字体，仍可读）

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'node_modules', 'katex', 'dist');
const CSS_OUT = path.join(ROOT, 'css', 'katex.css');
const FONT_OUT = path.join(ROOT, 'fonts', 'katex');

if (!fs.existsSync(DIST)) {
  console.error('✗ 找不到 node_modules/katex/dist，先运行 npm install。');
  process.exit(1);
}

const version = JSON.parse(fs.readFileSync(path.join(ROOT, 'node_modules', 'katex', 'package.json'), 'utf8')).version;

// woff2 之外的 src 全部丢掉，字体目录指向 fonts/katex/
const css = fs
  .readFileSync(path.join(DIST, 'katex.min.css'), 'utf8')
  .replace(
    /src:url\(fonts\/([^)]+)\.woff2\) format\("woff2"\)(?:,url\(fonts\/[^)]+\) format\("[^"]+"\))*/g,
    'src:url(../fonts/katex/$1.woff2) format("woff2")'
  );

if (/url\(fonts\//.test(css)) {
  console.error('✗ 还有没改写的字体路径，KaTeX 的 CSS 格式可能变了，检查 tools/vendor-katex.mjs。');
  process.exit(1);
}

fs.writeFileSync(CSS_OUT, `/* KaTeX ${version} — 由 npm run vendor:katex 生成，不要手改 */\n${css}\n`, 'utf8');

fs.rmSync(FONT_OUT, { recursive: true, force: true });
fs.mkdirSync(FONT_OUT, { recursive: true });
const fonts = fs.readdirSync(path.join(DIST, 'fonts')).filter((f) => f.endsWith('.woff2'));
for (const f of fonts) {
  fs.copyFileSync(path.join(DIST, 'fonts', f), path.join(FONT_OUT, f));
}

console.log(`✅ KaTeX ${version}：css/katex.css + fonts/katex/（${fonts.length} 个 woff2）`);
