# Media Compatibility Regression Prevention Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复现有移动端图片裁切与微信 WebView 加载问题，并建立一套让后续新增页面、替换图片或修改样式时自动发现同类回归的长期机制。

**Architecture:** 用显式媒体语义区分“完整展示”和“允许裁切”，禁止通用选择器静默改变图片比例；用共享兼容层提供一次性微信图片恢复与可复制诊断；用自动发现生产页面的静态检查、多引擎整页滚动测试、CI 与发布脚本形成部署门禁。所有规则以 HTML 属性和小型 JSON 配置为单一事实来源，不引入前端框架或运行时依赖。

**Tech Stack:** HTML、CSS、原生 JavaScript、Node.js 内置模块、Python Playwright、Cloudflare Pages、GitHub Actions

---

## File map

- Create `tools/site-policy.json`: 只保存明确排除的原型页、资源预算和目标视口。
- Modify `tools/mobile-compat-check.mjs`: 自动发现所有生产 HTML，检查媒体语义、图片属性、资源与 CSS 禁止规则。
- Modify `tools/mobile-compat-smoke.py`: 滚动完整页面，等待图片解码，验证自然尺寸、渲染比例、生命周期恢复和微信 UA。
- Modify `passion.html`: 为图片容器声明 `data-media-fit`，修正移动图库的完整展示语义。
- Modify `css/style.css`: 将裁切能力限制到显式 `data-media-fit="cover"` 容器；手机图库按自然比例显示。
- Modify `js/script.js`: 让二维码、灯箱和动态作品截图遵守同一媒体契约。
- Modify `js/compat.js`: 增加一次性图片恢复和 `?imageDiag=1` 诊断能力。
- Create `package.json`: 暴露统一的 `check`、`test:compat`、`verify` 命令，不增加运行时依赖。
- Create `.github/workflows/compatibility.yml`: 在提交进入 `master` 前运行静态检查和多引擎回归。
- Create `tools/release.ps1`: 验证、提交状态检查、推送、部署和生产冒烟的唯一发布入口。
- Create `tools/production-media-smoke.mjs`: 检查生产 HTML 与图片的 HTTP 状态、MIME 和正文类型。
- Create `docs/compatibility/media-policy.md`: 记录维护规则和问题排查方法。
- Modify `AGENTS.md`: 将媒体规则与发布门禁变成后续 Codex/人工维护的强制约束。

---

### Task 0: 先让生产部署可追溯

**Files:**
- Modify: `.gitignore`
- Track after secret scan: `functions/`, `wrangler.toml`, `AGENTS.md`, `offer-detail-ai.html`

- [ ] **Step 1: 确认当前未跟踪的生产文件**

```text
git status --short
git ls-files functions wrangler.toml AGENTS.md offer-detail-ai.html
```

Expected: 当前生产部署会包含若干未被 Git 跟踪的文件；这意味着相同 commit 不能可靠重建当前部署。

- [ ] **Step 2: 在纳入版本控制前做秘密扫描**

```text
rg -n -i "(api[_-]?key|secret|token|password|authorization|bearer)" functions wrangler.toml
```

Expected: 不存在硬编码的真实凭据。若发现真实凭据，停止本任务，先迁移到 Cloudflare 环境变量并轮换凭据，禁止提交。

- [ ] **Step 3: 排除纯本地目录与原型**

在 `.gitignore` 追加：

```gitignore
# Local agent sessions
.claude/
.superpowers/

# Local visual prototype
hero-demos.html
```

- [ ] **Step 4: 跟踪真实生产文件**

```text
git add .gitignore functions wrangler.toml AGENTS.md offer-detail-ai.html
git commit -m "chore: make production deployment reproducible"
```

此步骤只纳入当前生产所需文件，不修改留言 API 响应格式、鉴权逻辑或 Worker 行为。

---

### Task 1: 让新增页面自动进入检查范围

**Files:**
- Create: `tools/site-policy.json`
- Modify: `tools/mobile-compat-check.mjs`
- Modify: `tools/mobile-compat-smoke.py`

- [ ] **Step 1: 创建生产面配置**

```json
{
  "excludedHtml": [
    "design-preview.html",
    "hero-demos.html",
    "test.html"
  ],
  "viewports": [
    [280, 653],
    [320, 568],
    [375, 667],
    [390, 844],
    [430, 932],
    [844, 390],
    [1024, 768],
    [1366, 768]
  ],
  "assetBudgetBytes": {
    "warning": 350000,
    "error": 1200000
  }
}
```

- [ ] **Step 2: 先写自动发现断言**

在 `tools/mobile-compat-check.mjs` 中加入：

```js
function discoverProductionPages() {
  const policy = JSON.parse(fs.readFileSync(path.join(root, 'tools/site-policy.json'), 'utf8'));
  return fs.readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.html'))
    .map((entry) => entry.name)
    .filter((file) => !policy.excludedHtml.includes(file))
    .sort();
}

const pages = discoverProductionPages();
for (const requiredPage of ['offer-detail-ai.html', 'offer-detail-auto.html']) {
  if (!pages.includes(requiredPage)) {
    errors.push(`production page discovery omitted ${requiredPage}`);
  }
}
```

- [ ] **Step 3: 运行静态检查，确认新详情页不再漏检**

Run:

```text
node tools/mobile-compat-check.mjs
```

Expected: 新增的 `offer-detail-ai.html` 与 `offer-detail-auto.html` 被统计；由于缺少图片尺寸，检查暂时失败。

- [ ] **Step 4: 让浏览器测试读取同一配置**

在 `tools/mobile-compat-smoke.py` 中删除手写 `PAGES` 与 `VIEWPORTS`，替换为：

```python
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
POLICY = json.loads((ROOT / "tools" / "site-policy.json").read_text(encoding="utf-8"))
PAGES = sorted(
    path.name
    for path in ROOT.glob("*.html")
    if path.name not in POLICY["excludedHtml"]
)
VIEWPORTS = [tuple(item) for item in POLICY["viewports"]]
```

- [ ] **Step 5: 提交**

```text
git add tools/site-policy.json tools/mobile-compat-check.mjs tools/mobile-compat-smoke.py
git commit -m "test: auto-discover production pages"
```

---

### Task 2: 建立不可静默裁切的媒体契约

**Files:**
- Modify: `passion.html`
- Modify: `css/style.css`
- Modify: `js/script.js`
- Modify: `offer-detail-ai.html`
- Modify: `offer-detail-auto.html`
- Modify: `tools/mobile-compat-check.mjs`

- [ ] **Step 1: 先增加会失败的媒体规则**

每个静态 `<img>` 必须：

- 有非空 `alt`。
- 有数字 `width` 与 `height`。
- 图片自身声明 `data-media-fit="natural"`、`contain` 或 `cover`。
- 只有显式 `cover` 才允许裁切。

在静态检查中加入：

```js
const allowedFits = new Set(['natural', 'contain', 'cover']);
let highPriorityImages = 0;

for (const match of html.matchAll(/<img\b([^>]*)>/gi)) {
  const attrs = match[1];
  const src = attrs.match(/\bsrc\s*=\s*["']([^"']+)/i)?.[1] || '';
  const alt = attrs.match(/\balt\s*=\s*["']([^"']*)["']/i)?.[1];
  const width = attrs.match(/\bwidth\s*=\s*["'](\d+)["']/i)?.[1];
  const height = attrs.match(/\bheight\s*=\s*["'](\d+)["']/i)?.[1];
  const fit = attrs.match(/\bdata-media-fit\s*=\s*["']([^"']+)["']/i)?.[1];
  const loading = attrs.match(/\bloading\s*=\s*["']([^"']+)["']/i)?.[1];
  const decoding = attrs.match(/\bdecoding\s*=\s*["']([^"']+)["']/i)?.[1];
  const highPriority = /\bfetchpriority\s*=\s*["']high["']/i.test(attrs);

  if (alt === undefined || !alt.trim()) errors.push(`${page}: image alt is empty (${src})`);
  if (!width || !height) errors.push(`${page}: image width/height is required (${src})`);
  if (!fit || !allowedFits.has(fit)) {
    errors.push(`${page}: image must declare data-media-fit (${src})`);
  }
  if (decoding !== 'async') errors.push(`${page}: image decoding must be async (${src})`);
  if (loading && !['lazy', 'eager'].includes(loading)) {
    errors.push(`${page}: invalid loading policy (${src})`);
  }
  if (highPriority) {
    highPriorityImages += 1;
    if (loading === 'lazy') errors.push(`${page}: high-priority image cannot be lazy (${src})`);
  }
}

if (highPriorityImages > 1) errors.push(`${page}: at most one image may use fetchpriority=high`);
```

- [ ] **Step 2: 给内容型图片标记自然比例**

Passion 图库示例：

```html
<figure class="pe-gallery-item">
  <img
    src="跑步2.webp"
    alt="10km勋章"
    width="1080"
    height="1575"
    loading="lazy"
    decoding="async"
    data-media-fit="natural">
</figure>
```

对证书、作品截图、书封、人物照、带文字图片使用 `natural` 或 `contain`。只有纯装饰性全幅照片使用 `cover`。

- [ ] **Step 3: 让动态创建的图片遵守相同规则**

二维码必须声明真实尺寸：

```js
'<img src="Wechat Photo.jpg" alt="WeChat QR Code"' +
' width="820" height="1208" decoding="async" data-media-fit="contain">'
```

动态作品截图必须追加：

```js
' data-media-fit="natural">'
```

项目灯箱图片使用 `data-media-fit="contain"`；打开灯箱时从触发图片复制 `naturalWidth`、`naturalHeight` 或 HTML `width`、`height`，确保灯箱也有稳定的比例信息。

- [ ] **Step 4: 修复缺少尺寸的新详情页图片**

读取实际资源尺寸，并在 `offer-detail-ai.html` 与 `offer-detail-auto.html` 中补齐：

```html
<img
  src="offer-detail/example.jpg"
  alt="..."
  width="实际宽度"
  height="实际高度"
  loading="lazy"
  decoding="async"
  data-media-fit="natural">
```

执行时必须用 Pillow 读取真实尺寸，禁止根据视觉猜测。

- [ ] **Step 5: 把裁切规则移到显式容器**

在 `css/style.css` 中加入：

```css
img[data-media-fit="natural"],
img[data-media-fit="contain"] {
  display: block;
  max-width: 100%;
  height: auto;
  aspect-ratio: auto;
}

img[data-media-fit="contain"] {
  object-fit: contain;
}

[data-media-frame="cover"] {
  position: relative;
  overflow: hidden;
}

[data-media-frame="cover"] > img[data-media-fit="cover"] {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
```

删除移动端通用规则：

```css
.pe-gallery-item img { aspect-ratio: 1; }
.pe-gallery-item:last-child:nth-child(odd) img { aspect-ratio: 16 / 9; }
```

手机图库改为单列自然比例：

```css
@media (max-width: 768px) {
  .pe-gallery-track {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 12px;
  }

  .pe-gallery-item {
    width: auto;
  }

  .pe-gallery-item img {
    width: 100%;
    height: auto;
    aspect-ratio: auto;
    object-fit: contain;
  }
}
```

- [ ] **Step 6: 禁止通用图片选择器再次引入裁切**

在 `checkCss()` 中加入规则：出现包含 `img` 的选择器且设置 `aspect-ratio` 或 `object-fit: cover` 时，必须同时包含 `[data-media-fit="cover"]`。

Expected: `.pe-gallery-item img { object-fit: cover; }` 失败；`[data-media-frame="cover"] > img[data-media-fit="cover"]` 通过。

- [ ] **Step 7: 运行检查并提交**

```text
node tools/mobile-compat-check.mjs
git add passion.html offer-detail-ai.html offer-detail-auto.html css/style.css js/script.js tools/mobile-compat-check.mjs
git commit -m "fix: enforce explicit image fitting"
```

---

### Task 3: 建立微信 WebView 的一次性图片恢复与诊断

**Files:**
- Modify: `js/compat.js`
- Modify: `tools/mobile-compat-smoke.py`

- [ ] **Step 1: 写失败场景**

浏览器测试中模拟可见图片 `complete === true && naturalWidth === 0`，触发 `pageshow` 后要求：

- 图片最多重试一次。
- `data-image-state` 从 `error` 变成 `loaded` 或保持 `error`。
- 其他图片不重新请求。

- [ ] **Step 2: 在兼容层加入状态记录**

```js
function installImageRecovery() {
  function mark(event) {
    var image = event.target;
    if (!image || image.tagName !== 'IMG') return;
    image.dataset.imageState = event.type === 'load' ? 'loaded' : 'error';
  }

  document.addEventListener('load', mark, true);
  document.addEventListener('error', mark, true);

  function recoverVisibleImages() {
    Array.prototype.forEach.call(document.images, function (image) {
      var rect = image.getBoundingClientRect();
      var visible = rect.bottom >= 0 && rect.top <= window.innerHeight * 1.5;
      if (!visible || image.naturalWidth > 0 || image.dataset.imageRetry === '1') return;
      image.dataset.imageRetry = '1';
      image.loading = 'eager';
      var source = image.currentSrc || image.getAttribute('src');
      if (!source) return;
      var retryUrl = new URL(source, window.location.href);
      retryUrl.searchParams.set('__image_retry', '1');
      image.src = retryUrl.href;
    });
  }

  window.addEventListener('pageshow', recoverVisibleImages);
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) recoverVisibleImages();
  });
  window.addEventListener('orientationchange', recoverVisibleImages, { passive: true });
  window.setTimeout(recoverVisibleImages, 1500);
}
```

恢复逻辑对所有浏览器安全启用；只有失败图片才重试，不按 UA 分叉布局。

- [ ] **Step 3: 加入永久但默认关闭的诊断模式**

```js
function collectImageDiagnostics() {
  return Array.prototype.map.call(document.images, function (image) {
    var rect = image.getBoundingClientRect();
    var style = window.getComputedStyle(image);
    return {
      src: image.getAttribute('src'),
      currentSrc: image.currentSrc,
      complete: image.complete,
      naturalWidth: image.naturalWidth,
      naturalHeight: image.naturalHeight,
      renderedWidth: Math.round(rect.width),
      renderedHeight: Math.round(rect.height),
      loading: image.loading,
      objectFit: style.objectFit,
      aspectRatio: style.aspectRatio,
      state: image.dataset.imageState || 'unknown'
    };
  });
}
```

当 URL 包含 `?imageDiag=1` 时，在控制台输出并提供页面内“复制诊断 JSON”按钮；普通访问不创建 UI。

- [ ] **Step 4: 导出并安装**

```js
api.installImageRecovery = installImageRecovery;
api.collectImageDiagnostics = collectImageDiagnostics;
installImageRecovery();
```

- [ ] **Step 5: 运行生命周期测试并提交**

```text
python tools/mobile-compat-smoke.py --engines webkit chromium --quick
git add js/compat.js tools/mobile-compat-smoke.py
git commit -m "fix: recover images across webview lifecycle"
```

---

### Task 4: 让浏览器测试真正验证每张图片

**Files:**
- Modify: `tools/mobile-compat-smoke.py`

- [ ] **Step 1: 增加逐屏滚动**

```python
def scroll_full_page(page):
    page.evaluate(
        """async () => {
          const step = Math.max(240, Math.floor(window.innerHeight * 0.65));
          for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
            window.scrollTo(0, y);
            await new Promise(resolve => setTimeout(resolve, 80));
          }
          window.scrollTo(0, 0);
        }"""
    )
```

- [ ] **Step 2: 等待解码并收集媒体结果**

```python
def inspect_images(page):
    return page.evaluate(
        """async () => {
          const images = [...document.images];
          await Promise.all(images.map(async image => {
            try { if (image.decode) await image.decode(); } catch (_) {}
          }));
          return images.map(image => {
            const rect = image.getBoundingClientRect();
            const fit = image.dataset.mediaFit;
            const naturalRatio = image.naturalWidth / image.naturalHeight;
            const renderedRatio = rect.width / rect.height;
            return {
              src: image.getAttribute('src'),
              complete: image.complete,
              naturalWidth: image.naturalWidth,
              naturalHeight: image.naturalHeight,
              fit,
              ratioError: fit === 'natural' && naturalRatio
                ? Math.abs(renderedRatio - naturalRatio) / naturalRatio
                : 0
            };
          });
        }"""
    )
```

- [ ] **Step 3: 增加失败条件**

任何图片出现以下情况时测试失败：

```python
broken_images = [
    image for image in inspect_images(page)
    if not image["complete"]
    or image["naturalWidth"] <= 0
    or image["naturalHeight"] <= 0
    or image["ratioError"] > 0.02
]
```

- [ ] **Step 4: 增加微信 WebKit 上下文**

```python
WECHAT_IOS_UA = (
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) "
    "AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 "
    "MicroMessenger/8.0.50 NetType/WIFI Language/zh_CN"
)
```

WebKit 至少运行普通 Safari UA 与微信 UA 两组上下文。

- [ ] **Step 5: 增加返回、恢复和旋转**

每个核心页面执行：

```python
page.goto(url)
scroll_full_page(page)
page.goto(f"{origin}/index.html")
page.go_back(wait_until="domcontentloaded")
page.set_viewport_size({"width": height, "height": width})
page.set_viewport_size({"width": width, "height": height})
```

然后再次检查图片、滚动锁和横向溢出。

- [ ] **Step 6: 运行完整矩阵并提交**

```text
python tools/mobile-compat-smoke.py --engines chromium firefox webkit
git add tools/mobile-compat-smoke.py
git commit -m "test: verify image loading and aspect ratios"
```

Expected: 所有生产页、三个引擎、八个视口、Safari/微信两类 UA 均为 0 issues。

---

### Task 5: 建立静态资源与生产响应门禁

**Files:**
- Create: `tools/production-media-smoke.mjs`
- Modify: `tools/mobile-compat-check.mjs`

- [ ] **Step 1: 增加本地资源预算**

静态检查读取本地图片大小：

```js
const bytes = fs.statSync(full).size;
if (bytes > policy.assetBudgetBytes.error) {
  errors.push(`${owner}: image exceeds hard budget (${bytes} bytes): ${target}`);
} else if (bytes > policy.assetBudgetBytes.warning) {
  warnings.push(`${owner}: image exceeds warning budget (${bytes} bytes): ${target}`);
}
```

- [ ] **Step 2: 增加新资源命名规则**

新图片统一使用小写 ASCII kebab-case。现有中文文件先加入明确的 legacy allowlist，避免一次性大改；任何不在 allowlist 的新非 ASCII 文件都失败。

- [ ] **Step 3: 创建生产资源检查**

`tools/production-media-smoke.mjs`：

```js
import fs from 'node:fs';

const base = process.argv[2];
if (!base) throw new Error('Usage: node tools/production-media-smoke.mjs <origin>');

const policy = JSON.parse(fs.readFileSync('tools/site-policy.json', 'utf8'));
const pages = fs.readdirSync('.')
  .filter((name) => name.endsWith('.html') && !policy.excludedHtml.includes(name));

const failures = [];
for (const page of pages) {
  const pageUrl = new URL(page.replace(/\.html$/, ''), `${base}/`);
  const response = await fetch(pageUrl, { redirect: 'follow' });
  const html = await response.text();
  if (!response.ok || !response.headers.get('content-type')?.startsWith('text/html')) {
    failures.push(`${page}: invalid HTML response`);
    continue;
  }
  for (const match of html.matchAll(/<img\b[^>]*\bsrc=["']([^"']+)["']/gi)) {
    const assetUrl = new URL(match[1], pageUrl);
    const asset = await fetch(assetUrl, { redirect: 'follow', cache: 'no-store' });
    const type = asset.headers.get('content-type') || '';
    const body = await asset.arrayBuffer();
    if (!asset.ok || !type.startsWith('image/') || body.byteLength === 0) {
      failures.push(`${page}: invalid production image ${assetUrl} (${asset.status}, ${type})`);
    }
  }
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log(`Production media smoke passed for ${pages.length} pages`);
```

- [ ] **Step 4: 本地运行并提交**

```text
node tools/mobile-compat-check.mjs
node tools/production-media-smoke.mjs https://yijian6.pages.dev
git add tools/mobile-compat-check.mjs tools/production-media-smoke.mjs tools/site-policy.json
git commit -m "test: enforce media assets in production"
```

---

### Task 6: 建立 CI 与唯一发布入口

**Files:**
- Create: `package.json`
- Create: `.github/workflows/compatibility.yml`
- Create: `tools/release.ps1`

- [ ] **Step 1: 创建统一命令**

```json
{
  "private": true,
  "scripts": {
    "check": "node tools/mobile-compat-check.mjs",
    "test:compat:quick": "python tools/mobile-compat-smoke.py --engines chromium --quick",
    "test:compat": "python tools/mobile-compat-smoke.py --engines chromium firefox webkit",
    "verify": "npm run check && npm run test:compat"
  }
}
```

- [ ] **Step 2: 创建 GitHub Actions**

```yaml
name: compatibility

on:
  pull_request:
  push:
    branches: [master]

jobs:
  compatibility:
    runs-on: ubuntu-latest
    timeout-minutes: 20
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - uses: actions/setup-python@v5
        with:
          python-version: "3.11"
      - run: pip install playwright
      - run: playwright install --with-deps chromium firefox webkit
      - run: npm run verify
```

- [ ] **Step 3: 创建发布脚本**

`tools/release.ps1` 必须：

1. 检查整个 working tree（包括未跟踪文件）是否干净。
2. 运行 `npm run verify`。
3. 推送当前提交。
4. 从当前 commit 生成临时部署目录，禁止直接部署工作区。
5. 执行 Cloudflare Pages 部署。
6. 对部署 URL 执行生产资源检查。

核心命令：

```powershell
$changes = git status --porcelain
if ($changes) { throw "Working tree is dirty; classify, commit, or ignore every file before release." }

npm run verify
if ($LASTEXITCODE -ne 0) { throw "Compatibility verification failed." }

git push
if ($LASTEXITCODE -ne 0) { throw "Git push failed." }

$sha = git rev-parse HEAD
$archive = Join-Path $env:TEMP "yijian6-$sha.zip"
$deployDir = Join-Path $env:TEMP "yijian6-$sha"

try {
  git archive --format=zip --output=$archive HEAD
  Expand-Archive -LiteralPath $archive -DestinationPath $deployDir

  wrangler pages deploy $deployDir --project-name=yijian6 --branch=master
  if ($LASTEXITCODE -ne 0) { throw "Cloudflare Pages deployment failed." }

  node tools/production-media-smoke.mjs https://yijian6.pages.dev
  if ($LASTEXITCODE -ne 0) { throw "Production media smoke failed." }
}
finally {
  if (Test-Path -LiteralPath $archive) { Remove-Item -LiteralPath $archive }
  if (Test-Path -LiteralPath $deployDir) { Remove-Item -LiteralPath $deployDir -Recurse }
}
```

- [ ] **Step 4: 将 CI 设为 master 的必要检查**

在 GitHub 仓库设置中为 `master` 启用 branch protection，并把 `compatibility` job 标记为 required status check。没有这一步，workflow 只能报告失败，不能阻止有问题的提交进入 `master`。

- [ ] **Step 5: 提交**

```text
git add package.json .github/workflows/compatibility.yml tools/release.ps1
git commit -m "ci: gate releases on compatibility checks"
```

---

### Task 7: 把规则写进项目维护说明

**Files:**
- Create: `docs/compatibility/media-policy.md`
- Modify: `AGENTS.md`

- [ ] **Step 1: 写媒体维护规则**

文档必须包含以下不可变规则：

```text
1. 新图片必须使用小写 ASCII kebab-case 文件名。
2. 每张图片必须有 alt、真实 width/height、decoding 和 data-media-fit。
3. 带文字、证书、截图、书封和人物照片默认 natural/contain。
4. cover 只能显式声明，且必须确认裁掉的区域不包含信息。
5. 首屏最多一张 fetchpriority=high；折叠线以下才允许 lazy。
6. 修改图片或媒体 CSS 后必须运行 npm run verify。
7. 只能通过 tools/release.ps1 发布。
8. 微信问题报告使用 ?imageDiag=1 导出诊断 JSON。
```

- [ ] **Step 2: 更新 AGENTS.md**

加入：

```markdown
## 媒体兼容强制规则

- 禁止在通用 `img` 选择器上新增固定 `aspect-ratio` 或 `object-fit: cover`。
- 图片必须声明 `data-media-fit`、真实 `width`/`height` 和有效 `alt`。
- 新页面默认属于生产面，除非显式加入 `tools/site-policy.json` 的排除列表。
- 修改 HTML、CSS、JS 或图片后，提交前必须运行 `npm run verify`。
- 禁止直接执行 `wrangler pages deploy .`；统一运行 `powershell -File tools/release.ps1`。
```

- [ ] **Step 3: 提交**

```text
git add docs/compatibility/media-policy.md AGENTS.md
git commit -m "docs: define media compatibility policy"
```

---

### Task 8: 真机建立基线并收束

**Files:**
- Modify: `docs/compatibility/media-policy.md`

- [ ] **Step 1: 自动化最终验证**

```text
npm run verify
```

Expected: 0 errors、0 broken images、0 natural-ratio violations、0 horizontal overflow。

- [ ] **Step 2: 微信真机矩阵**

至少验证：

- iPhone SE/mini、普通 iPhone、Pro Max。
- 当前 iOS 与仍支持的最低 iOS。
- 微信当前版本及前两个稳定版本。
- 微信聊天进入、返回、再次进入、快速滚动、横竖屏、弱网和断网恢复。

- [ ] **Step 3: 每台设备导出诊断**

访问：

```text
https://yijian6.pages.dev/passion?imageDiag=1
```

保存诊断 JSON；要求所有可见图片 `naturalWidth > 0`，自然比例图片的渲染比例误差不超过 2%。

- [ ] **Step 4: 发布**

```text
powershell -File tools/release.ps1
```

- [ ] **Step 5: 记录基线**

在 `docs/compatibility/media-policy.md` 追加已验证设备、iOS、微信版本、日期和结果。以后每次修改媒体基础设施时复用同一矩阵。

---

## Completion criteria

- 新增 HTML 页面无需修改检查脚本即可自动进入检查。
- 信息型图片不会被通用 CSS 静默裁切。
- 每张生产图片都能在浏览器测试中完成加载和解码。
- 页面返回、恢复、旋转后不会遗留空白图片。
- 微信问题可通过一个查询参数导出可复现证据。
- 静态检查、三引擎测试、生产资源检查任一失败时不能发布。
- 项目规范明确要求后续人和 Codex 使用同一媒体契约与发布入口。
