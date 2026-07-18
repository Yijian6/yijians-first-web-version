"""Local multi-engine mobile compatibility smoke test.

Requires: pip install playwright && playwright install chromium firefox webkit
"""

import argparse
import http.server
import json
import threading

from playwright.sync_api import sync_playwright


PAGES = [
    "index.html",
    "work.html",
    "offer.html",
    "me.html",
    "passion.html",
    "prediction.html",
    "offer-detail-doc.html",
    "offer-detail-doc-view.html",
    "universe.html",
    "十五五人工智能产业安全发展规划建议报告稿-智算7班第3组.html",
]
VIEWPORTS = [
    (280, 653),
    (320, 568),
    (375, 667),
    (390, 844),
    (430, 932),
    (844, 390),
    (1024, 768),
    (1366, 768),
]
KNOWN_WEBKIT_WARNING = 'Viewport argument key "interactive-widget" not recognized'


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass


class QuietServer(http.server.ThreadingHTTPServer):
    def handle_error(self, _request, _client_address):
        pass


def run(engine_names, quick):
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
            for width, height in viewports:
                options = {
                    "viewport": {"width": width, "height": height},
                    "has_touch": width <= 1024,
                }
                if engine_name != "firefox":
                    options["is_mobile"] = width <= 430
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
                        page.wait_for_timeout(100)
                        overflow = page.evaluate(
                            "() => document.documentElement.scrollWidth "
                            "> document.documentElement.clientWidth + 1"
                        )
                        if overflow or page_errors or bad_responses:
                            issues.append(
                                {
                                    "engine": engine_name,
                                    "viewport": f"{width}x{height}",
                                    "page": page_name,
                                    "overflow": overflow,
                                    "errors": page_errors,
                                    "responses": bad_responses,
                                }
                            )
                    except Exception as error:
                        issues.append(
                            {
                                "engine": engine_name,
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
