"""Mobile Chromium smoke checks.

Run with:
    python scripts/mobile-smoke.py

Set BASE_URL to test an existing local server or a deployed site.
"""

import os
import threading
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parent.parent
BASE_URL = os.environ.get("BASE_URL", "").rstrip("/")
PAGES = [
    "index.html",
    "work.html",
    "offer.html",
    "me.html",
    "passion.html",
    "prediction.html",
    "universe.html",
]
if os.environ.get("SMOKE_PAGES"):
    PAGES = [name for name in PAGES if name in os.environ["SMOKE_PAGES"].split(",")]
VIEWPORTS = [
    ("fold-280", 280, 653),
    ("iphone-se-320", 320, 568),
    ("iphone-8-375", 375, 667),
    ("iphone-14-390", 390, 844),
    ("iphone-plus-430", 430, 932),
    ("landscape-844", 844, 390),
    ("ipad-touch", 820, 1180),
]
if os.environ.get("SMOKE_VIEWPORTS"):
    requested = set(os.environ["SMOKE_VIEWPORTS"].split(","))
    VIEWPORTS = [item for item in VIEWPORTS if item[0] in requested]


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass


server = None
if not BASE_URL:
    server = ThreadingHTTPServer(
        ("127.0.0.1", 0),
        partial(QuietHandler, directory=str(ROOT)),
    )
    threading.Thread(target=server.serve_forever, daemon=True).start()
    BASE_URL = f"http://127.0.0.1:{server.server_port}"


def assert_no_overflow(page, label):
    overflow = page.evaluate(
        """() => ({
          viewport: window.innerWidth,
          document: document.documentElement.scrollWidth,
          body: document.body.scrollWidth
        })"""
    )
    widest = max(overflow["document"], overflow["body"])
    wide_elements = page.evaluate(
        "Array.from(document.querySelectorAll('*')).map((e) => ({"
        "name:e.tagName+'.'+e.className,"
        "right:Math.ceil(e.getBoundingClientRect().right),"
        "width:Math.ceil(e.getBoundingClientRect().width)"
        "})).filter((e) => e.right > innerWidth + 1 || e.right - e.width < -1)"
        ".slice(0, 5)"
    )
    assert widest <= overflow["viewport"] + 1, (
        f"{label}: horizontal overflow {widest}px > {overflow['viewport']}px; "
        f"wide elements: {wide_elements}"
    )


def exercise_menu(page, label):
    hamburger = page.locator(".hamburger")
    if not hamburger.count() or not hamburger.is_visible():
        return

    hamburger.click()
    assert hamburger.get_attribute("aria-expanded") == "true", (
        f"{label}: hamburger did not expose its open state"
    )
    assert page.locator(".mobile-menu").evaluate(
        "(element) => element.classList.contains('open')"
    ), f"{label}: mobile menu did not open"
    assert page.evaluate("document.body.style.overflow") == "hidden", (
        f"{label}: background scroll was not locked"
    )

    hamburger.click()
    assert hamburger.get_attribute("aria-expanded") == "false", (
        f"{label}: hamburger did not expose its closed state"
    )
    assert page.evaluate("document.body.style.overflow") == "", (
        f"{label}: background scroll was not restored"
    )


def exercise_key_interactions(page, page_name, device_name):
    if page_name == "work.html":
        page.locator("#ringsWrap").press("ArrowRight")
        stepper = page.locator(".rings-stepper button:not([disabled])")
        if stepper.count():
            stepper.last.click()
    elif page_name == "offer.html":
        page.locator('.ow-orb[data-index="1"]').click()
        assert page.locator('.ow-orb[data-index="1"]').evaluate(
            "(element) => element.classList.contains('active')"
        )
        page.locator(".ow-center").click()
        assert page.locator("#odOverlay").is_visible()
        page.locator(".od-close").click()
    elif page_name == "me.html":
        terminal = page.locator("#terminalInput")
        terminal.fill("help")
        terminal.press("Enter")
        assert terminal.evaluate(
            "(element) => parseFloat(getComputedStyle(element).fontSize)"
        ) >= 16
    elif page_name == "passion.html":
        gallery = page.locator(".pe-gallery-track").first
        if gallery.count():
            gallery.evaluate("(element) => { element.scrollLeft = element.scrollWidth; }")
    elif page_name == "universe.html":
        assert page.evaluate(
            "document.getElementById('mainCanvas').width / innerWidth"
        ) <= 1.51
        assert page.evaluate(
            "getComputedStyle(document.body, '::after').display"
        ) == "none"
        page.locator("#postBtn").click()
        assert page.locator("#postModal").evaluate(
            "(element) => element.classList.contains('active')"
        )
        page.locator("#nickname").fill("mobile-smoke")
        visual_height = page.evaluate(
            "parseFloat(getComputedStyle(document.documentElement)"
            ".getPropertyValue('--visual-viewport-height'))"
        )
        assert visual_height > 0
        page.locator("#cancelPost").click()
        assert page.evaluate("window.__rafPendingCount()") <= 1

        if device_name == "iphone-14-390":
            page.emulate_media(reduced_motion="reduce")
            page.reload(wait_until="domcontentloaded")
            page.wait_for_timeout(350)
            assert page.evaluate("window.__rafPendingCount()") == 0
            page.emulate_media(reduced_motion="no-preference")
            page.goto("about:blank")
            page.go_back(wait_until="domcontentloaded")
            page.wait_for_timeout(350)
            assert page.evaluate("window.__rafPendingCount()") <= 1


try:
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(channel="chrome", headless=True)
        failures = []

        for device_name, width, height in VIEWPORTS:
            context = browser.new_context(
                viewport={"width": width, "height": height},
                device_scale_factor=2,
                has_touch=True,
                is_mobile=True,
            )
            context.add_init_script(
                """(() => {
                  const nativeRequest = window.requestAnimationFrame.bind(window);
                  const nativeCancel = window.cancelAnimationFrame.bind(window);
                  const pending = new Set();
                  window.requestAnimationFrame = (callback) => {
                    let id;
                    id = nativeRequest((timestamp) => {
                      pending.delete(id);
                      callback(timestamp);
                    });
                    pending.add(id);
                    return id;
                  };
                  window.cancelAnimationFrame = (id) => {
                    pending.delete(id);
                    nativeCancel(id);
                  };
                  window.__rafPendingCount = () => pending.size;
                })();"""
            )
            page = context.new_page()
            page.set_default_timeout(5000)
            page.route(
                "**/api/messages",
                lambda route: route.fulfill(
                    status=200,
                    content_type="application/json",
                    body="[]",
                ),
            )
            errors = []
            page.on("pageerror", lambda error: errors.append(str(error)))

            for page_name in PAGES:
                label = f"{device_name}/{page_name}"
                errors.clear()
                try:
                    print(f"START {label}", flush=True)
                    page.goto(f"{BASE_URL}/{page_name}", wait_until="domcontentloaded")
                    page.wait_for_timeout(350)
                    assert page.evaluate("matchMedia('(hover: none)').matches"), (
                        f"{label}: touch media query did not match"
                    )
                    assert page.locator(".cursor-dot, .cursor-ring").count() == 0, (
                        f"{label}: custom cursor was created on a touch device"
                    )
                    assert_no_overflow(page, label)
                    exercise_menu(page, label)
                    page.evaluate("scrollTo(0, document.documentElement.scrollHeight)")
                    page.wait_for_timeout(120)
                    assert_no_overflow(page, label)
                    if device_name in {"iphone-14-390", "ipad-touch"}:
                        exercise_key_interactions(page, page_name, device_name)
                    assert not errors, f"{label}: uncaught errors: {errors}"
                    print(f"PASS {label}")
                except Exception as error:
                    failures.append(f"{label}: {error}")
                    print(f"FAIL {label}: {error}")

            context.close()

        browser.close()
finally:
    if server:
        server.shutdown()

if failures:
    raise SystemExit("\n".join(["Mobile smoke checks failed:", *failures]))

print(f"Mobile smoke checks passed ({len(VIEWPORTS)} viewports × {len(PAGES)} pages).")
