# self_web 项目规范

继承 `~/Desktop/AGENTS.md` 中的全局规范。

## 项目信息

- 类型：个人静态网站
- 技术栈：HTML + CSS + 原生 JS
- 部署：Cloudflare Pages（项目名 `yijian6`）
- 仓库：https://github.com/Yijian6/yijians-first-web-version

## 设计原则

- **手机端优先**：所有页面改动先保证手机端观感最佳，桌面端是增强体验
- 实现顺序：先调手机端 → 再适配桌面端
- 字号、间距、动画效果以手机端表现为基准

## 部署流程

每次代码变更后必须：
1. `git add` + `git commit`
2. `git push`
3. `wrangler pages deploy . --project-name=yijian6`

## 页面结构

- `index.html` — 首页
- `work.html` — 作品
- `offer.html` — 技能/服务
- `passion.html` — 热情/理念
- `hobby.html` — 爱好（Sports / Music / Books / Skills 四个 Tab）
- `prediction.html` — Becoming（成为）
- `test.html` — 测试页面

## Compact Instructions

压缩时请保留：
- 当前正在实现的功能需求和设计决策
- 已确认的 bug 和修复方案
- 未完成的任务列表
- 用户的偏好和约束
- 部署流程和 Cloudflare 配置信息
