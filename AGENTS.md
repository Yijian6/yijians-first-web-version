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
