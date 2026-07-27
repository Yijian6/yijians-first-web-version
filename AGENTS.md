# self_web 项目规范

这是一个 HTML + CSS + 原生 JavaScript 的个人静态网站，部署到 Cloudflare Pages，项目名为 `yijian6`。

## 工作原则

- 手机端优先：先验证手机，再验证桌面。
- 保持现有视觉与交互风格，不无故重构框架。
- 留言 API 响应格式保持不变。
- 不绕过测试，不通过把页面加入排除列表来“修复”测试。
- 修改前先阅读 `docs/compatibility/media-policy.md`。

## 图片与媒体

- 静态图片必须有 `alt`、真实 `width`/`height`、`decoding="async"` 和 `data-media-fit`。
- `natural`/`contain` 用于证书、截图、书封、人物照和带文字图片。
- `cover` 只能显式使用；禁止通用 `img` 选择器设置固定比例或裁切。
- 新图片使用小写 ASCII kebab-case 文件名。
- 动态生成的图片也必须遵守同一媒体契约。

完整规则见 `docs/compatibility/media-policy.md`。

## 开屏动画（index.html）

首页有一段约 3.5 秒的开屏动画：田字格画出来 → 「觉」落进格子 → 撤格 → 静场 → 「见」框里点亮一粒灼橙 → 揭幕 → 「觉」缩小飞向右上角的幽灵水印、一路减亮直到看不见，橙点同时汇进标题的「觉醒」。

**播放条件**：每次**直接打开首页**都播（刷新也播）。只有从站内其他页点进来才不播 —— 点导航回首页不该被拦三秒。

- 遮罩样式和判定脚本内联在 `index.html` 的 `<head>`：遮罩必须随第一次样式应用就存在，JS 注入的元素可能晚于首绘。
- 舞台样式在 `css/style.css` 的 BOOT 段，编排全在关键帧里；`js/script.js` 的 `initBoot()` 只做三件离散的事和自保。
- **时间轴写在两个地方，改一处必须两处一起改**：`js/script.js` 的 `BOOT` 常量，和 `css/style.css` BOOT 段那张「关键帧百分比 → 绝对毫秒」的表。
- 调试用 `?boot=1` 强制播放，它会绕过全部门控。

几个不能想当然的点：

- `jue.lastPage`（sessionStorage）只记录「你刚才在站内哪一页」，**没有「已经看过了」的语义**。v1 曾用 `jue.visited` 记「看过了」，结果后台标签页、Chrome 地址栏预渲染这些根本没播成的加载照样会写它，一次污染锁死整个会话 —— 这是当时「开屏经常不出现」的头号原因。不要再往这个方向改。
- 隐藏状态（预渲染 / 后台标签页 / 微信 WebView 还没显示）**照常挂遮罩，但时间轴推迟到真正可见那一刻**才开始。不要在判定脚本里用 `visibilityState` 提前 return。
- 跳过手势有 600ms 宽限期；`scroll` 还要求真实位移超过 8px。首页的 `history.scrollRestoration` 是浏览器默认的 `auto`（`manual` 只在 `initOfferWheel` 里设、offer 页专用），刷新会恢复滚动位置并派发 `scroll`，没有这两道就会被它干掉。**不要改成 `manual`** —— `isHistoryNav()` → `no-entrance` 的后退逃生门依赖浏览器自己恢复位置。
- `.boot-eye` 必须是 `.boot-stage` 的直接子元素，**不能挂在 `.boot-glyph` 下面**：挂在字里会继承字的 transform，收尾时字飞向右上角、点会跟着走，两条飞行线塌成一条。
- 眼点位置是量出来的：把「觉」渲进 canvas，对「见」框内非墨像素做距离变换取最大内切圆（圆心相对墨盒 `(0.6263, 0.5534)`）。改字号策略或换字体后必须重新量，不要手调。
- 飞行落点按 CSS 里的数几何推算，**不测量**：`.home-hero::after` 是伪元素，`getBoundingClientRect` 取不到。要求只是「大致方向正确」，所以没有断言、没有 abort 分支。
- 幽灵的真实位置离字心很近（375 宽的屏上只有 98px），照实飞读不出动作，所以 `BOOT.flyGain` / `BOOT.flyRise` 会放大位移并上抬，终点再夹回视口内 —— 桌面端本来就有 471px 位移，不夹会整个飞出画外。**准确度让位于可读性是有意的。**
- 验证脚本里要注意：**无头 Chromium 不出帧就不启动 CSS 动画**。只在最后截一次图，那一帧会成为动画零点，量出来的全是零态。先丢一张截图强制首绘再计时。

两条已知的检查盲区，改动这块时要自己把关：

1. `index.html` 的 `<head>` 内联 `<script>` **不受 ES5 检查**（`tools/mobile-compat-check.mjs` 只遍历 `js/` 目录）。这段必须手写 ES5。暂时无法扩大覆盖：`universe.html` 的内联脚本有 `const/let`，而规范禁止用排除页面的方式让检查通过。
2. 该内联脚本**直读 `sessionStorage`**，是全站唯一豁免点 —— 它跑在 `js/compat.js` 之前，用不上 `JueCompat.session`。其他任何地方都必须走 `JueCompat.storage` / `JueCompat.session`。

另外：`.main` 的初始态是 `opacity: 0`，全站唯一点亮它的地方是 `js/script.js` 的 `initPageEnter()`。删改它会让所有页面变空白，而这种故障不横向溢出、不报错、图片照常解码 —— smoke test 里那条 `#main` opacity 断言就是为它加的，不要删。

## 自动验证

修改 HTML、CSS、JS 或图片后运行：

```text
npm run verify
```

它会自动检查所有生产页面、图片资源、三种浏览器引擎、手机视口、懒加载、自然比例、控制台错误和横向溢出。

快速检查可以运行：

```text
npm run check
npm run test:compat:quick
```

## 发布

禁止直接运行 `wrangler pages deploy .`，禁止使用 `git add .`。

只有完整验证通过且工作区干净时，使用：

```powershell
powershell -File tools/release.ps1
```

发布脚本会从当前 Git commit 生成临时部署目录，推送 `master`，部署 Cloudflare Pages 和独立 `universe-api` Worker，并执行生产资源冒烟检查。

## 后端秘密

- 管理员密码只通过 Cloudflare Pages Secret `ADMIN_PASSWORD` 提供。
- 禁止把密码、Token 或其他真实凭据写入 HTML、JavaScript、Worker 或配置文件。
- 修改 Functions 前先检查秘密扫描结果，不改变留言 API 响应格式。

## Claude / Codex 协作

- Codex 先读本文件；Claude Code 先读 `CLAUDE.md`。
- 两者都必须继续阅读 `docs/compatibility/media-policy.md`。
- 并行任务不要同时修改同一个文件。
- 子任务完成后必须运行 `npm run verify`，再由主任务审查 diff。
- 未经明确要求，协作代理不得推送或部署。
