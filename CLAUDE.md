# CLAUDE.md

这是 Claude Code 在 self_web 仓库中的强制入口。

开始任何修改前，必须阅读：

1. `AGENTS.md`
2. `docs/compatibility/media-policy.md`

## 必须遵守

- 手机端优先，不改变现有视觉语言。
- 图片必须有真实尺寸、alt、`decoding="async"` 和 `data-media-fit`。
- 证书、截图、书封、人物照和带文字图片不得被通用 CSS 裁切。
- 不要通过排除页面、降低断言或删除测试来让检查通过。
- 不要使用 `git add .`。
- 不要直接运行 `wrangler pages deploy .`。
- 未经明确要求，不要推送、部署或修改后台 API 响应格式。
- 管理员密码只能从 Cloudflare Secret `ADMIN_PASSWORD` 读取。

## 验证

完成修改后必须运行：

```text
npm run verify
```

快速反馈可以运行：

```text
npm run check
npm run test:compat:quick
```

所有发布必须使用：

```powershell
powershell -File tools/release.ps1
```

如果出现图片问题，使用 `?imageDiag=1` 收集自然尺寸、渲染尺寸、加载状态和 User Agent，不要只凭截图猜测。

## 协作边界

Claude 可以完成明确范围内的设计、代码或测试子任务，但必须报告：

- 修改了哪些文件
- 运行了哪些验证
- 是否发现未解决问题

不要与其他代理同时修改同一个文件。不要在子任务中自行推送或部署。
