# CLAUDE.md

本文件为 Claude Code (claude.ai/code) 在本仓库中工作时提供指引。

## 项目概览

觉（刘奕健）的个人作品集网站。Neo-Brutalist Editorial × Dark Luxury 美学风格。无框架、无打包工具、无依赖 — 纯 HTML/CSS/JS 直接部署。

- **技术栈：** HTML5 + CSS3 + 原生 JS（IIFE 模式）
- **字体：** Lora（标题）、DM Sans（正文）、JetBrains Mono（代码/标签）— 通过 Google Fonts CDN 加载
- **部署：** Cloudflare Pages，项目名 `yijian6`
- **仓库：** https://github.com/Yijian6/yijians-first-web-version

## 开发

无构建步骤。在浏览器中打开 `index.html` 即可本地预览。

### 部署（每次代码变更后）

```bash
git add . && git commit -m "message"
git push
wrangler pages deploy . --project-name=yijian6
```

`universe-worker/` 后端单独部署：`cd universe-worker && wrangler deploy`。

## 架构

### 共享的单文件资源

所有 HTML 页面引入同样两个文件：

- `css/style.css`（约 2600 行）— 全部样式、设计 token、响应式规则
- `js/script.js`（约 480 行）— 全部交互逻辑，包裹在一个 IIFE 中

### CSS 结构（`css/style.css`）

设计 token 以 CSS 自定义属性的形式定义在 `:root` 中：

- 颜色：`--bg` (#0c0e0b)、`--bg-surface` (#141812)、`--gold` (#a8cc88 — 实际为绿色，变量名是历史遗留)、`--gold-bright`、`--gold-dim`、`--gold-glow`、`--accent2` (#d4734a)、`--white` (#e4e0d8)，以及透明度变体（`--white-90`、`--white-60`、`--white-30`、`--white-10`、`--white-05`）
- 边框：`--brutal-border`（2px solid var(--white-10)）、`--brutal-border-gold`
- 字体：`--font-display`（Lora）、`--font-body`（DM Sans）、`--font-mono`（JetBrains Mono）
- 缓动：`--ease-out-expo`、`--ease-out-quart`、`--ease-in-out-circ`
- 布局：`--nav-h`（72px）、`--section-gap`、`--side-pad`

关键模式：

- **响应式**：基础样式适配所有屏幕；`max-width` 媒体查询在 1024px（平板）、768px（手机）、480px（小屏手机）处覆盖；`min-width: 769px` 用于桌面端增强
- **流式尺寸**：通过 `clamp()` 实现字号和间距的流式缩放
- **滚动揭示**：元素添加 `.reveal`、`.reveal-left`、`.reveal-scale` 或 `.reveal-clip` 类，JS 通过 IntersectionObserver 切换为 `.revealed`
- **交错延迟**：`.delay-1` 到 `.delay-6` 类
- **新粗野主义边框**：使用 `var(--brutal-border)`
- 自定义光标（仅桌面端，`<769px` 时隐藏）
- 支持 `prefers-reduced-motion: reduce` — 禁用所有动画/过渡

### JavaScript 结构（`js/script.js`）

IIFE 封装，`$()` / `$$()` 为 querySelector 的简写。所有 init 函数在 `DOMContentLoaded` 时运行：

| 函数                   | 用途                              |
| ---------------------- | --------------------------------- |
| `initCursor`           | 自定义点+环光标（仅桌面端）       |
| `initKineticText`      | 标题文字悬停动效                  |
| `initReveal`           | IntersectionObserver 滚动揭示     |
| `initMagnetic`         | 元素磁力吸附效果                  |
| `initIntro`            | 开场动画（index.html）            |
| `initProgress`         | 滚动进度条                        |
| `initHamburger`        | 移动端菜单切换                    |
| `initActiveNav`        | 高亮当前页面导航链接              |
| `initTabs`             | 标签页切换（passion.html）        |
| `initPageTransition`   | 页面跳转前的淡出过渡              |
| `initLightbox`         | 微信二维码灯箱                    |
| `initProjectLightbox`  | 项目截图灯箱                      |
| `initMarquee`          | 自动滚动跑马灯                    |
| `initTypewriter`       | 打字机效果                        |
| `initParallax`         | 视差滚动效果                      |
| `initPortraitParallax` | 首页照片视差滚动                  |

### HTML 页面模式

每个页面遵循相同结构：

```
进度条 → 导航栏 → 移动端菜单 → #main 容器 → 页脚
```

导航使用 `data-index="01"` 属性标注序号。标签页切换使用 `data-tab="sports"` 等。内容以中文为主、英文为辅。

### 图片资源

图片存放在项目根目录（如 `照片.jpg`、`Wechat Photo.jpg`）和 `offer-detail/` 子目录中。没有 `assets/` 文件夹。

### Universe Worker（`universe-worker/`）

Cloudflare Worker + D1 数据库，用于"小宇宙"互动留言功能。

- `src/index.js` — REST API：`GET/POST/DELETE /api/messages`、`POST /api/admin/login`
- `schema.sql` — D1 表结构
- `wrangler.toml` — Worker 配置，D1 绑定名 `universe_messages`

## 页面

| 文件                         | 用途                                    |
| ---------------------------- | --------------------------------------- |
| `index.html`                 | 首页 — 开场动画、Hero、照片、CTA、跑马灯 |
| `work.html`                  | 作品集/项目时间线                       |
| `offer.html`                 | 技能/服务网格                           |
| `offer-detail-doc.html`      | 文档与设计服务详情页                    |
| `offer-detail-doc-view.html` | 文档与设计详情（查看模式）              |
| `me.html`                    | 关于我 — INFP 身份、价值观              |
| `passion.html`               | 爱好 — 运动/音乐/读书/技能 标签页      |
| `prediction.html`            | 「我在成为」— 电影感全屏声明            |
| `universe.html`              | 互动 canvas 留言星空                    |
| `design-preview.html`        | 设计预览页                              |
| `hero-demos.html`            | Hero 区域演示                           |
| `test.html`                  | 沙盒测试页                              |

## 设计原则

- **手机端优先**：所有改动先验证手机端效果。字号、间距、动画均以手机端表现为基准。
- 色板：`#0c0e0b` 背景、`#a8cc88` 主强调色（`--gold` 变量实际为绿色 — 历史命名）、`#d4734a` 暖色强调、`#e4e0d8` 米白文字。
- 字体层级：`Lora` 标题、`DM Sans` 正文、`JetBrains Mono` 标签/序号。

## 上下文压缩指引

压缩对话时须保留：

- 当前正在实现的功能需求和设计决策
- 已确认的 bug 和修复方案
- 未完成的任务列表
- 用户的偏好和约束
- 部署流程和 Cloudflare 配置信息
