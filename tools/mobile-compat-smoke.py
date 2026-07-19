"""Local multi-engine mobile compatibility smoke test.

Requires: pip install playwright
          playwright install chromium firefox webkit
"""

import argparse
import http.server
import json
import os
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
POLICY = json.loads((ROOT / "tools" / "site-policy.json").read_text(encoding="utf-8"))
PAGES = sorted(
    path.name
    for path in ROOT.glob("*.html")
    if path.name not in POLICY["excludedHtml"]
)
VIEWPORTS = [tuple(item) for item in POLICY["viewports"]]
KNOWN_WEBKIT_WARNING = 'Viewport argument key "interactive-widget" not recognized'
WECHAT_IOS_UA = (
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) "
    "AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 "
    "MicroMessenger/8.0.50 NetType/WIFI Language/zh_CN"
)


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass


class QuietServer(http.server.ThreadingHTTPServer):
    def handle_error(self, _request, _client_address):
        pass


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


def run(engine_names, quick):
    os.chdir(ROOT)
    server = QuietServer(("127.0.0.1", 0), QuietHandler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    origin = f"http://127.0.0.1:{server.server_port}"
    issues = []
    viewports = [(390, 844), (1366, 768)] if quick else VIEWPORTS

    with sync_playwright() as playwright:
        launchers = {
            "chromium": playwright.chromium,
            "firefox": playwright.firefox,
            "webkit": playwright.webkit,
        }
        for engine_name in engine_names:
            browser = launchers[engine_name].launch(headless=True)
            ua_modes = [("browser", None)]
            if engine_name == "webkit":
                ua_modes.append(("wechat", WECHAT_IOS_UA))

            for mode_name, user_agent in ua_modes:
                for width, height in viewports:
                    options = {
                        "viewport": {"width": width, "height": height},
                        "has_touch": width <= 1024,
                    }
                    if engine_name != "firefox":
                        options["is_mobile"] = width <= 430
                    if user_agent:
                        options["user_agent"] = user_agent
                    context = browser.new_context(**options)

                    for page_name in PAGES:
                        page = context.new_page()
                        page_errors = []
                        bad_responses = []
                        page.on("pageerror", lambda error: page_errors.append(str(error)))
                        page.on(
                            "console",
                            lambda message: page_errors.append(message.text)
                            if message.type == "error"
                            and KNOWN_WEBKIT_WARNING not in message.text
                            else None,
                        )
                        page.on(
                            "response",
                            lambda response: bad_responses.append(
                                {"status": response.status, "url": response.url}
                            )
                            if response.status >= 400 and "/api/" not in response.url
                            else None,
                        )
                        if page_name == "universe.html":
                            page.route(
                                "**/api/messages",
                                lambda route: route.fulfill(
                                    status=200,
                                    content_type="application/json",
                                    body="[]",
                                ),
                            )

                        try:
                            page.goto(
                                f"{origin}/{page_name}",
                                wait_until="domcontentloaded",
                                timeout=20_000,
                            )
                            page.wait_for_timeout(150)
                            scroll_full_page(page)
                            page.wait_for_timeout(250)
                            image_results = inspect_images(page)
                            broken_images = [
                                image for image in image_results
                                if not image["complete"]
                                or image["naturalWidth"] <= 0
                                or image["naturalHeight"] <= 0
                                or image["ratioError"] > 0.02
                            ]
                            overflow = page.evaluate(
                                "() => document.documentElement.scrollWidth "
                                "> document.documentElement.clientWidth + 1"
                            )
                            if overflow or page_errors or bad_responses or broken_images:
                                issues.append(
                                    {
                                        "engine": engine_name,
                                        "mode": mode_name,
                                        "viewport": f"{width}x{height}",
                                        "page": page_name,
                                        "overflow": overflow,
                                        "errors": page_errors,
                                        "responses": bad_responses,
                                        "images": broken_images,
                                    }
                                )
                        except Exception as error:
                            issues.append(
                                {
                                    "engine": engine_name,
                                    "mode": mode_name,
                                    "viewport": f"{width}x{height}",
                                    "page": page_name,
                                    "exception": str(error),
                                }
                            )
                        finally:
                            page.close()
                    context.close()
            browser.close()

    server.shutdown()
    print(
        json.dumps(
            {
                "checked": len(engine_names) * len(viewports) * len(PAGES),
                "pages": len(PAGES),
                "issues": issues,
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    return 1 if issues else 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--engines",
        nargs="+",
        choices=["chromium", "firefox", "webkit"],
        default=["chromium", "firefox", "webkit"],
    )
    parser.add_argument("--quick", action="store_true")
    args = parser.parse_args()
    raise SystemExit(run(args.engines, args.quick))
