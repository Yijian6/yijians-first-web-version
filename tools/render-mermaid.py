"""render-mermaid.py — 构建时把 Mermaid 源码渲染成 SVG。

由 tools/build-mc.mjs 调用，不需要手动运行。
stdin:  {"lib": "<mermaid.min.js 路径>", "config": {...}, "items": [{"key": "...", "code": "..."}]}
stdout: {"<key>": {"svg": "..."} | {"error": "..."}}

Mermaid 要靠真实浏览器量字宽、排版，纯 Node 跑不了。这里借用兼容性测试
已经在用的 Playwright Chromium，一次启动渲染完所有没缓存的图。
"""

import json
import sys

from playwright.sync_api import sync_playwright

# 量字宽用的字体要和读者设备上的接近：中文字是等宽方块，各平台宽度一致；
# 西文差一点点，靠节点内边距吸收。
PAGE = """<!doctype html><html><head><meta charset="utf-8">
<style>body{margin:0;font-family:'PingFang SC','Microsoft YaHei','Noto Sans CJK SC',sans-serif}</style>
</head><body><div id="stage"></div></body></html>"""

RENDER_JS = """async ({ config, items }) => {
  mermaid.initialize(Object.assign({ startOnLoad: false }, config));
  const out = {};
  for (const it of items) {
    try {
      const { svg } = await mermaid.render('mmd-' + it.key.slice(0, 10), it.code);
      out[it.key] = { svg };
    } catch (e) {
      out[it.key] = { error: String((e && e.message) || e).replace(/\\s+/g, ' ').slice(0, 200) };
    }
    // mermaid.render 失败时会在 body 里留下一块报错 SVG，清掉免得影响下一张
    document.querySelectorAll('body > [id^="dmmd-"]').forEach((n) => n.remove());
  }
  return out;
}"""


def main():
    req = json.loads(sys.stdin.buffer.read().decode("utf-8"))
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        page.set_content(PAGE)
        page.add_script_tag(path=req["lib"])
        result = page.evaluate(RENDER_JS, {"config": req["config"], "items": req["items"]})
        browser.close()
    sys.stdout.buffer.write(json.dumps(result, ensure_ascii=False).encode("utf-8"))


if __name__ == "__main__":
    main()
