# 网站兼容与媒体维护规范

这份文档是 Codex、Claude Code 和人工维护网站时共同遵守的唯一媒体规范。

## 修改图片时

1. 新图片文件名使用小写 ASCII kebab-case，例如 `library-reading.webp`。
2. 每张静态图片必须有：
   - 有意义的 `alt`
   - 真实的 `width` 和 `height`
   - `decoding="async"`
   - `data-media-fit="natural"`、`contain` 或 `cover`
3. 证书、截图、书封、人物照和带文字图片默认使用 `natural` 或 `contain`。
4. `cover` 只用于明确需要铺满并裁切的视觉容器；`object-fit: cover` 必须写在带有显式媒体语义的选择器上。
5. 禁止在通用 `img` 选择器或移动端统一规则中设置固定 `aspect-ratio`，除非选择器同时限定了 `data-media-fit`。
6. 首屏关键图片最多一张使用 `fetchpriority="high"`，且不能同时使用 `loading="lazy"`。
7. 折叠线以下图片可以使用 `loading="lazy"`；新增图片必须通过浏览器滚动测试。

## 修改 CSS 时

媒体比例由图片语义决定，而不是由页面宽度决定：

```css
img[data-media-fit="natural"],
img[data-media-fit="contain"] {
  width: 100%;
  height: auto;
  aspect-ratio: auto;
}
```

需要裁切时使用显式容器：

```css
[data-media-frame="cover"] {
  overflow: hidden;
}

[data-media-frame="cover"] > img[data-media-fit="cover"] {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
```

## 修改 JavaScript 动态图片时

动态生成的 `<img>` 也必须添加真实尺寸、`decoding="async"` 和 `data-media-fit`。二维码、灯箱和作品截图不能绕过媒体契约。

## 验证命令

日常快速检查：

```text
npm run check
npm run test:compat:quick
```

完整提交检查：

```text
npm run verify
```

微信图片问题诊断：

```text
https://yijian6.pages.dev/passion?imageDiag=1
```

诊断信息包括 User Agent、视口、设备像素比、图片请求地址、自然尺寸、渲染尺寸、fit 模式和恢复次数。

## 发布规则

- 不直接运行 `wrangler pages deploy .`。
- 不使用 `git add .`。
- 只有 `npm run verify` 通过且工作区干净时，才运行：

```powershell
powershell -File tools/release.ps1
```

发布脚本会从当前 Git commit 生成临时部署目录，推送 `master`，部署到 Cloudflare Pages，并检查生产环境 HTML 和图片 MIME。

## 微信兼容排查

看到“图片异常”时先区分：

- `naturalWidth === 0`：请求、路径、格式或 WebView 解码问题。
- `naturalWidth > 0` 但比例不对：CSS 裁切或布局问题。
- `complete === false`：懒加载或页面生命周期问题。
- 自然尺寸和渲染尺寸都正确但画面模糊：原图本身或素材质量问题。

不要先把所有图片改成 eager，也不要删除测试；先用 `imageDiag=1` 收集证据。
