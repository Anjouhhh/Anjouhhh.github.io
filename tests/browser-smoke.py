#!/usr/bin/env python3
"""Responsive browser smoke coverage for the complete static site."""

from __future__ import annotations

import argparse
import os
import re
import shutil
import sys
import tempfile
import time
from contextlib import contextmanager
from pathlib import Path
from urllib.parse import urljoin, urlparse

try:
    from playwright.sync_api import Browser, Error as PlaywrightError, Page, sync_playwright
except ImportError as error:
    raise SystemExit(
        "Playwright for Python is required. Install it with "
        "`python -m pip install playwright`, then install Chromium or use system Edge/Chrome."
    ) from error


ENTRY_VIEWPORTS = (
    (360, 640),
    (390, 844),
    (430, 932),
    (768, 1024),
    (1024, 768),
    (1366, 768),
    (1440, 900),
    (1920, 1080),
)
ENTRY_COMPOSITION_VIEWPORTS = (
    (390, 844),
    (1440, 900),
)
VALID_POST_SLUG = "proof-writing-is-a-design-problem"
VALID_PROJECT_SLUG = "math-note-knowledge-base"
EXPECTED_POST_COUNT = 5
ROUTES = (
    "",
    "index.html",
    "home.html",
    "about.html",
    "writing.html",
    "projects.html",
    "now.html",
    f"post.html?slug={VALID_POST_SLUG}",
    f"project.html?slug={VALID_PROJECT_SLUG}",
    "zh/home.html",
    "zh/about.html",
    "zh/writing.html",
    "zh/projects.html",
    "zh/now.html",
    f"zh/post.html?slug={VALID_POST_SLUG}",
    f"zh/project.html?slug={VALID_PROJECT_SLUG}",
)
INTERNAL_ROUTES = ROUTES[2:]
ENTRY_LINK_NAME = "Open the door and enter Anjou's personal blog"
TOPIC_LABELS = ("All", "Math", "Workflow", "AI", "Growth")
TOPIC_POST_TITLES = {
    "Math": ("Proof Writing Is Also a Design Problem",),
}
NAVIGATION_LINKS = (
    ("Home", "home.html"),
    ("About", "about.html"),
    ("Writing", "writing.html"),
    ("Projects", "projects.html"),
    ("Now", "now.html"),
)


class SmokeSuite:
    def __init__(self) -> None:
        self.checks = 0
        self.failures: list[str] = []
        self.screenshots: list[Path] = []
        self._screenshot_directory: Path | None = None

    def expect(self, condition: object, message: str) -> None:
        self.checks += 1
        if not condition:
            self.failures.append(message)

    def fail(self, message: str) -> None:
        """Record an unplanned harness/diagnostic failure without changing check accounting."""
        self.failures.append(message)

    def capture(self, page: Page, label: str) -> None:
        if page.is_closed():
            return
        if self._screenshot_directory is None:
            self._screenshot_directory = Path(
                tempfile.mkdtemp(prefix="browser-smoke-")
            )
        safe_label = re.sub(r"[^a-z0-9]+", "-", label.lower()).strip("-") or "failure"
        screenshot = self._screenshot_directory / f"{len(self.screenshots) + 1:02d}-{safe_label}.png"
        try:
            page.screenshot(path=str(screenshot), full_page=True)
            self.screenshots.append(screenshot)
        except Exception as error:  # pragma: no cover - only reached after another browser failure
            self.failures.append(
                f"{label}: could not save failure screenshot: {type(error).__name__}: {error}"
            )


class PageDiagnostics:
    """Buffer asynchronous page diagnostics until the page has deterministically settled."""

    def __init__(self, page: Page, base_url: str) -> None:
        self.page = page
        self.base_url = base_url
        self.messages: list[str] = []

        page.on("console", self._record_console)
        page.on("pageerror", self._record_page_error)
        page.on("response", self._record_response)
        page.on("requestfailed", self._record_request_failure)

    def _record_console(self, message) -> None:
        if message.type == "error":
            self.messages.append(f"console error at {self.page.url}: {message.text}")

    def _record_page_error(self, error) -> None:
        self.messages.append(f"uncaught page error at {self.page.url}: {error}")

    def _record_response(self, response) -> None:
        if response.status >= 400 and is_local_resource(response.url, self.base_url):
            self.messages.append(f"HTTP {response.status} {response.url}")

    def _record_request_failure(self, request) -> None:
        if is_local_resource(request.url, self.base_url):
            self.messages.append(
                f"request failed {request.url} ({request.failure or 'unknown failure'})"
            )

    def flush(self, suite: SmokeSuite, label: str) -> None:
        for message in self.messages:
            suite.fail(f"{label}: {message}")
        self.messages.clear()


def settle_page(page: Page, *, script_execution: bool = True) -> None:
    """Settle static-page resources, rendering work, and queued diagnostics."""
    if page.is_closed():
        return
    if not script_execution:
        page.wait_for_load_state("load")
        page.wait_for_load_state("networkidle")
        # With script execution disabled, rAF callbacks cannot run. Two in-memory
        # compositor captures provide equivalent deterministic rendering barriers.
        page.screenshot()
        page.screenshot()
        return
    for attempt in range(2):
        try:
            page.wait_for_load_state("load")
            page.wait_for_load_state("networkidle")
            page.evaluate(
                """() => new Promise((resolve) => {
                  const raf = window.__browserSmokeNativeRaf ?? window.requestAnimationFrame.bind(window);
                  raf(() => raf(() => setTimeout(resolve, 0)));
                })"""
            )
            return
        except PlaywrightError:
            if attempt == 1 or page.is_closed():
                raise


@contextmanager
def scenario(
    suite: SmokeSuite,
    page: Page,
    label: str,
    diagnostics: PageDiagnostics,
    *,
    script_execution: bool = True,
):
    failure_count = len(suite.failures)
    try:
        yield
    except Exception as error:
        suite.fail(f"{label}: browser check raised {type(error).__name__}: {error}")
    finally:
        try:
            settle_page(page, script_execution=script_execution)
        except Exception as error:
            suite.fail(f"{label}: page settling failed: {type(error).__name__}: {error}")
        diagnostics.flush(suite, label)
        if len(suite.failures) > failure_count:
            suite.capture(page, label)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--base-url",
        required=True,
        help="Base URL of the locally served site, for example http://127.0.0.1:8000/",
    )
    return parser.parse_args()


def system_browser_paths() -> list[tuple[str, Path]]:
    candidates: list[tuple[str, Path]] = []
    seen: set[Path] = set()

    def add_candidate(name: str, path: Path | str | None) -> None:
        if not path:
            return
        candidate = Path(path).expanduser()
        try:
            resolved = candidate.resolve()
        except OSError:
            resolved = candidate
        if candidate.is_file() and resolved not in seen:
            seen.add(resolved)
            candidates.append((name, candidate))

    for executable in (
        "google-chrome",
        "google-chrome-stable",
        "chromium",
        "chromium-browser",
        "chrome",
        "msedge",
        "microsoft-edge",
    ):
        add_candidate(f"PATH {executable}", shutil.which(executable))

    if os.name == "nt":
        roots = {
            "Program Files": os.environ.get("ProgramFiles"),
            "Program Files (x86)": os.environ.get("ProgramFiles(x86)"),
            "Local AppData": os.environ.get("LOCALAPPDATA"),
        }
        relative_paths = (
            ("Microsoft Edge", Path("Microsoft/Edge/Application/msedge.exe")),
            ("Google Chrome", Path("Google/Chrome/Application/chrome.exe")),
        )
        for root_name, root in roots.items():
            if not root:
                continue
            for browser_name, relative_path in relative_paths:
                add_candidate(f"{root_name} {browser_name}", Path(root) / relative_path)
    elif sys.platform == "darwin":
        for name, path in (
            ("macOS Google Chrome", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"),
            ("macOS Microsoft Edge", "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"),
            ("macOS Chromium", "/Applications/Chromium.app/Contents/MacOS/Chromium"),
        ):
            add_candidate(name, path)
    else:
        for name, path in (
            ("Linux Google Chrome", "/usr/bin/google-chrome"),
            ("Linux Google Chrome stable", "/usr/bin/google-chrome-stable"),
            ("Linux Chromium", "/usr/bin/chromium"),
            ("Linux Chromium browser", "/usr/bin/chromium-browser"),
            ("Linux Microsoft Edge", "/usr/bin/microsoft-edge"),
        ):
            add_candidate(name, path)

    return candidates


def launch_chromium(chromium) -> tuple[Browser, str]:
    launch_errors: list[str] = []

    def attempt(label: str, **options) -> tuple[Browser, str] | None:
        try:
            browser = chromium.launch(headless=True, **options)
            identity = browser.version
            return browser, f"{label} ({identity})"
        except PlaywrightError as error:
            launch_errors.append(f"{label}: {error}")
            return None

    launched = attempt("bundled Playwright Chromium")
    if launched:
        return launched

    for channel in ("chrome", "msedge"):
        launched = attempt(f"Playwright channel {channel}", channel=channel)
        if launched:
            return launched

    discovered = system_browser_paths()
    for name, executable_path in discovered:
        label = f"discovered {name} ({executable_path})"
        launched = attempt(label, executable_path=str(executable_path))
        if launched:
            return launched

    if not discovered:
        launch_errors.append(
            "portable executable discovery: no browser found via shutil.which or known "
            f"{sys.platform} paths"
        )

    details = "\n\n".join(launch_errors)
    raise RuntimeError(
        "Unable to launch a Chromium browser. Attempts are listed in order below.\n\n"
        f"{details}"
    )


def is_local_resource(resource_url: str, base_url: str) -> bool:
    resource = urlparse(resource_url)
    base = urlparse(base_url)
    return resource.scheme in {"http", "https"} and resource.netloc == base.netloc


def new_context(browser: Browser, suite: SmokeSuite, base_url: str, **options):
    context = browser.new_context(**options)
    base = urlparse(base_url)

    def keep_requests_local(route) -> None:
        request_url = urlparse(route.request.url)
        if request_url.scheme in {"http", "https"} and request_url.netloc != base.netloc:
            suite.fail(f"external resource request blocked: {route.request.url}")
            route.abort()
        else:
            route.continue_()

    context.route("**/*", keep_requests_local)
    return context


def attach_diagnostics(page: Page, base_url: str) -> PageDiagnostics:
    return PageDiagnostics(page, base_url)


def goto(page: Page, suite: SmokeSuite, base_url: str, path: str, label: str) -> None:
    response = page.goto(urljoin(base_url, path), wait_until="load")
    suite.expect(response is not None, f"{label}: navigation returned no response")
    if response is not None:
        suite.expect(response.status == 200, f"{label}: expected HTTP 200, got {response.status}")


def overflow_metrics(page: Page) -> dict[str, int]:
    return page.evaluate(
        """() => ({
          scrollWidth: document.documentElement.scrollWidth,
          innerWidth: window.innerWidth
        })"""
    )


def locator_is_visible(locator) -> bool:
    return locator.count() > 0 and locator.first.is_visible()


def first_text(locator) -> str:
    texts = locator.all_inner_texts()
    return texts[0].strip() if texts else ""


def first_attribute(locator, name: str) -> str | None:
    values = locator.evaluate_all(
        "(elements, attribute) => elements.map((element) => element.getAttribute(attribute))",
        name,
    )
    return values[0] if values else None


def check_entry_viewports(browser: Browser, base_url: str, suite: SmokeSuite) -> None:
    for width, height in ENTRY_VIEWPORTS:
        label = f"entry {width}x{height}"
        context = new_context(
            browser,
            suite,
            base_url,
            viewport={"width": width, "height": height},
            reduced_motion="reduce",
        )
        page = context.new_page()
        diagnostics = attach_diagnostics(page, base_url)
        with scenario(suite, page, label, diagnostics):
            goto(page, suite, base_url, "index.html", label)
            metrics = overflow_metrics(page)
            suite.expect(
                metrics["scrollWidth"] <= metrics["innerWidth"],
                f"{label}: horizontal overflow {metrics}",
            )
            key_text = " ".join(
                page.locator(".entry-intro, .portal-hint").all_inner_texts()
            )
            suite.expect("\ufffd" not in page.title(), f"{label}: replacement character in title")
            suite.expect("\ufffd" not in key_text, f"{label}: replacement character in visible key text")
            entry_link = page.get_by_role("link", name=ENTRY_LINK_NAME, exact=True)
            suite.expect(entry_link.count() == 1, f"{label}: expected one accessible entry link")
            suite.expect(locator_is_visible(entry_link), f"{label}: entry link is not visible")
            href = first_attribute(entry_link, "href") or ""
            suite.expect(
                urlparse(urljoin(page.url, href)).path.endswith("/home.html"),
                f"{label}: entry link does not target /home.html: {href!r}",
            )
        page.close()
        context.close()


def check_entry_composition(browser: Browser, base_url: str, suite: SmokeSuite) -> None:
    for width, height in ENTRY_COMPOSITION_VIEWPORTS:
        label = f"entry composition {width}x{height}"
        boxes = {}
        for motion_name, reduced_motion in (("normal", "no-preference"), ("reduced", "reduce")):
            context = new_context(
                browser,
                suite,
                base_url,
                viewport={"width": width, "height": height},
                reduced_motion=reduced_motion,
            )
            page = context.new_page()
            diagnostics = attach_diagnostics(page, base_url)
            with scenario(suite, page, f"{label} {motion_name}", diagnostics):
                goto(page, suite, base_url, "", f"{label} {motion_name}")
                if motion_name == "normal":
                    page.wait_for_timeout(2100)
                box = page.locator(".orbit-garden").bounding_box()
                boxes[motion_name] = box
            page.close()
            context.close()

        normal = boxes.get("normal")
        reduced = boxes.get("reduced")
        if normal is None or reduced is None:
            suite.expect(False, f"{label}: orbit garden bounding box is unavailable")
            suite.expect(False, f"{label}: orbit garden width cannot be compared")
            suite.expect(False, f"{label}: orbit garden center x cannot be compared")
            suite.expect(False, f"{label}: orbit garden center y cannot be compared")
            continue

        normal_center = (normal["x"] + normal["width"] / 2, normal["y"] + normal["height"] / 2)
        reduced_center = (reduced["x"] + reduced["width"] / 2, reduced["y"] + reduced["height"] / 2)
        tolerance = 2.0
        suite.expect(abs(normal["width"] - reduced["width"]) <= tolerance, f"{label}: orbit widths differ: {normal} vs {reduced}")
        suite.expect(abs(normal["height"] - reduced["height"]) <= tolerance, f"{label}: orbit heights differ: {normal} vs {reduced}")
        suite.expect(abs(normal_center[0] - reduced_center[0]) <= tolerance, f"{label}: orbit center x differs: {normal_center} vs {reduced_center}")
        suite.expect(abs(normal_center[1] - reduced_center[1]) <= tolerance, f"{label}: orbit center y differs: {normal_center} vs {reduced_center}")


def check_entry_activation(browser: Browser, base_url: str, suite: SmokeSuite) -> None:
    for method in ("primary click", "Enter key"):
        label = f"reduced-motion entry activation by {method}"
        context = new_context(
            browser,
            suite,
            base_url,
            viewport={"width": 390, "height": 844},
            reduced_motion="reduce",
        )
        page = context.new_page()
        diagnostics = attach_diagnostics(page, base_url)
        with scenario(suite, page, label, diagnostics):
            goto(page, suite, base_url, "index.html", label)
            entry_link = page.get_by_role("link", name=ENTRY_LINK_NAME, exact=True)
            activation_started = time.perf_counter()
            if method == "primary click":
                entry_link.click()
            else:
                entry_link.focus()
                suite.expect(
                    entry_link.evaluate("element => document.activeElement === element"),
                    f"{label}: entry link did not receive keyboard focus",
                )
                page.keyboard.press("Enter")

            suite.expect(
                page.locator("body").evaluate("body => body.classList.contains('is-entering')"),
                f"{label}: body.is-entering was not added immediately",
            )
            suite.expect(
                first_attribute(entry_link, "aria-disabled") == "true",
                f"{label}: aria-disabled was not set immediately",
            )
            fade_duration = page.locator(".entry-shell").evaluate(
                "element => parseFloat(getComputedStyle(element).transitionDuration)"
            )
            suite.expect(0.16 <= fade_duration <= 0.22, f"{label}: reduced fade duration is {fade_duration}s")
            page.wait_for_timeout(80)
            fade_opacity = page.locator(".entry-shell").evaluate(
                "element => parseFloat(getComputedStyle(element).opacity)"
            )
            suite.expect(0.03 < fade_opacity < 0.95, f"{label}: fade was not measurable at 80ms: opacity={fade_opacity}")
            suite.expect(
                not urlparse(page.url).path.endswith("/home.html"),
                f"{label}: navigated before the reduced-motion fade completed",
            )
            page.wait_for_url("**/home.html", wait_until="load")
            elapsed = time.perf_counter() - activation_started
            suite.expect(0.14 <= elapsed <= 0.70, f"{label}: reduced navigation took {elapsed:.3f}s")
            suite.expect(
                urlparse(page.url).path.endswith("/home.html"),
                f"{label}: final navigation did not reach /home.html: {page.url}",
            )
        page.close()
        context.close()


def check_normal_entry_activation(browser: Browser, base_url: str, suite: SmokeSuite) -> None:
    label = "normal-motion entry activation"
    context = new_context(
        browser,
        suite,
        base_url,
        viewport={"width": 1440, "height": 900},
        reduced_motion="no-preference",
    )
    page = context.new_page()
    diagnostics = attach_diagnostics(page, base_url)
    with scenario(suite, page, label, diagnostics):
        goto(page, suite, base_url, "", label)
        page.wait_for_timeout(2100)
        shell = page.locator(".entry-shell")
        initial_transform = shell.evaluate("element => getComputedStyle(element).transform")
        entry_link = page.get_by_role("link", name=ENTRY_LINK_NAME, exact=True)
        activation_started = time.perf_counter()
        entry_link.click()
        suite.expect(
            page.locator("body").evaluate("body => body.classList.contains('is-entering')"),
            f"{label}: body.is-entering was not added",
        )
        animation_duration = shell.evaluate(
            "element => parseFloat(getComputedStyle(element).animationDuration)"
        )
        suite.expect(1.54 <= animation_duration <= 1.56, f"{label}: entry animation duration changed to {animation_duration}s")
        page.wait_for_timeout(350)
        progressed_transform = shell.evaluate("element => getComputedStyle(element).transform")
        suite.expect(
            progressed_transform not in {"none", initial_transform},
            f"{label}: scene did not progress: {initial_transform!r} -> {progressed_transform!r}",
        )
        suite.expect(
            not urlparse(page.url).path.endswith("/home.html"),
            f"{label}: navigated during the scene transition",
        )
        page.wait_for_url("**/home.html", wait_until="load")
        elapsed = time.perf_counter() - activation_started
        suite.expect(1.45 <= elapsed <= 2.20, f"{label}: normal navigation took {elapsed:.3f}s")
        suite.expect(
            urlparse(page.url).path.endswith("/home.html"),
            f"{label}: final navigation did not reach /home.html: {page.url}",
        )
    page.close()
    context.close()


def check_home_content(browser: Browser, base_url: str, suite: SmokeSuite) -> None:
    label = "home content"
    context = new_context(
        browser, suite, base_url, viewport={"width": 1366, "height": 768}
    )
    page = context.new_page()
    diagnostics = attach_diagnostics(page, base_url)
    with scenario(suite, page, label, diagnostics):
        goto(page, suite, base_url, "home.html", label)
        suite.expect(
            page.locator("#home-posts > .item").count() == 3,
            f"{label}: expected 3 recent post items",
        )
        suite.expect(
            page.locator("#home-projects > .card").count() == 2,
            f"{label}: expected 2 featured project cards",
        )
        now_text = page.locator("#home-now").inner_text().strip()
        suite.expect(bool(now_text), f"{label}: Now snapshot is empty")
        suite.expect("Learning:" in now_text and "Building:" in now_text and "Thinking:" in now_text,
                     f"{label}: Now snapshot is incomplete")
        active_home = page.locator('.site-header nav a[aria-current="page"]')
        suite.expect(active_home.count() == 1, f"{label}: expected one current navigation link")
        suite.expect(first_text(active_home) == "Home", f"{label}: Home nav is not current")
    page.close()
    context.close()


def check_mobile_navigation(browser: Browser, base_url: str, suite: SmokeSuite) -> None:
    label = "mobile navigation 390px"
    context = new_context(
        browser, suite, base_url, viewport={"width": 390, "height": 844}
    )
    page = context.new_page()
    diagnostics = attach_diagnostics(page, base_url)
    with scenario(suite, page, label, diagnostics):
        goto(page, suite, base_url, "home.html", label)
        toggle = page.get_by_role("button", name="Toggle navigation", exact=True)
        nav = page.locator(".site-header nav")
        suite.expect(toggle.is_visible(), f"{label}: toggle is not visible")
        suite.expect(toggle.get_attribute("aria-expanded") == "false", f"{label}: initial aria-expanded is not false")

        toggle.click()
        suite.expect(nav.is_visible() and nav.evaluate("nav => nav.classList.contains('open')"), f"{label}: click did not open nav")
        suite.expect(toggle.get_attribute("aria-expanded") == "true", f"{label}: open aria-expanded is not true")
        toggle.click()
        suite.expect(not nav.is_visible(), f"{label}: second click did not close nav")
        suite.expect(toggle.get_attribute("aria-expanded") == "false", f"{label}: closed aria-expanded is not false")

        goto(page, suite, base_url, "home.html", f"{label} keyboard reset")
        toggle.focus()
        suite.expect(toggle.evaluate("element => document.activeElement === element"), f"{label}: keyboard focus did not reach toggle")
        page.keyboard.press("Enter")
        suite.expect(nav.is_visible(), f"{label}: Enter did not open nav")
        suite.expect(toggle.get_attribute("aria-expanded") == "true", f"{label}: keyboard open did not update aria-expanded")
        page.keyboard.press("Enter")
        suite.expect(not nav.is_visible(), f"{label}: second Enter did not close nav")

        toggle.click()
        page.get_by_role("contentinfo").click()
        suite.expect(not nav.is_visible(), f"{label}: outside click did not close nav")
        suite.expect(toggle.get_attribute("aria-expanded") == "false", f"{label}: outside close did not reset aria-expanded")

        toggle.click()
        page.set_viewport_size({"width": 700, "height": 844})
        page.wait_for_function(
            "() => !document.querySelector('.site-header nav').classList.contains('open')",
            polling="raf",
        )
        suite.expect(not nav.evaluate("element => element.classList.contains('open')"), f"{label}: desktop resize did not close nav state")
        suite.expect(page.locator("#nav-toggle").get_attribute("aria-expanded") == "false", f"{label}: desktop resize did not reset aria-expanded")
        page.set_viewport_size({"width": 390, "height": 844})
        suite.expect(not nav.is_visible(), f"{label}: returning mobile reopened nav")
        suite.expect(page.locator("#nav-toggle").get_attribute("aria-expanded") == "false", f"{label}: returning mobile changed aria-expanded")
    page.close()
    context.close()


def check_scroll_to_top_motion(browser: Browser, base_url: str, suite: SmokeSuite) -> None:
    for motion_name, reduced_motion, expected_behavior in (
        ("normal", "no-preference", "smooth"),
        ("reduced", "reduce", "auto"),
    ):
        label = f"{motion_name}-motion scroll to top"
        context = new_context(
            browser,
            suite,
            base_url,
            viewport={"width": 1366, "height": 768},
            reduced_motion=reduced_motion,
        )
        page = context.new_page()
        diagnostics = attach_diagnostics(page, base_url)
        page.add_init_script(
            """
            window.__scrollToCalls = [];
            window.scrollTo = (options) => window.__scrollToCalls.push(options);
            """
        )
        with scenario(suite, page, label, diagnostics):
            goto(page, suite, base_url, "home.html", label)
            page.locator("#scroll-top").evaluate("element => element.click()")
            calls = page.evaluate("window.__scrollToCalls")
            suite.expect(
                len(calls) == 1 and calls[0].get("top") == 0 and calls[0].get("behavior") == expected_behavior,
                f"{label}: unexpected scrollTo calls: {calls}",
            )
        page.close()
        context.close()


def check_writing(browser: Browser, base_url: str, suite: SmokeSuite) -> None:
    label = "writing page"
    context = new_context(
        browser, suite, base_url, viewport={"width": 1366, "height": 768}
    )
    page = context.new_page()
    diagnostics = attach_diagnostics(page, base_url)
    with scenario(suite, page, label, diagnostics):
        goto(page, suite, base_url, "writing.html", label)
        posts = page.locator("#post-list > .item")
        buttons = page.locator("#topic-chips > button.chip")
        suite.expect(
            posts.count() == EXPECTED_POST_COUNT,
            f"{label}: expected all {EXPECTED_POST_COUNT} posts",
        )
        suite.expect(buttons.count() == len(TOPIC_LABELS), f"{label}: expected All plus 4 topic filters")
        for topic in TOPIC_LABELS:
            button = page.get_by_role("button", name=topic, exact=True)
            suite.expect(button.count() == 1, f"{label}: expected one {topic!r} topic button")
            suite.expect(locator_is_visible(button), f"{label}: {topic!r} topic button is not visible")
            suite.expect(first_attribute(button, "type") == "button", f"{label}: {topic!r} topic button is not type=button")
            suite.expect(first_attribute(button, "aria-pressed") in {"true", "false"}, f"{label}: {topic!r} topic button lacks aria-pressed")

        all_topics = page.get_by_role("button", name="All", exact=True)
        suite.expect(first_attribute(all_topics, "aria-pressed") == "true", f"{label}: All filter is not initially pressed")
        selected_topic = "Math"
        selected = page.get_by_role("button", name=selected_topic, exact=True)
        selected.click()
        suite.expect(first_attribute(selected, "aria-pressed") == "true", f"{label}: selected filter is not pressed")
        suite.expect(first_attribute(all_topics, "aria-pressed") == "false", f"{label}: All filter remained pressed")
        filtered_posts = page.locator("#post-list > .item")
        expected_titles = TOPIC_POST_TITLES[selected_topic]
        suite.expect(filtered_posts.count() == len(expected_titles), f"{label}: selecting {selected_topic!r} returned the wrong post count")
        for title in expected_titles:
            post = filtered_posts.filter(has=page.get_by_role("heading", name=title, exact=True))
            suite.expect(
                post.count() == 1 and selected_topic in " ".join(post.locator(".meta").all_inner_texts()),
                f"{label}: filtered post {title!r} does not match {selected_topic!r}",
            )
    page.close()
    context.close()


def check_projects_and_valid_details(browser: Browser, base_url: str, suite: SmokeSuite) -> None:
    context = new_context(
        browser, suite, base_url, viewport={"width": 1366, "height": 768}
    )
    for path, label, container in (
        ("projects.html", "projects page", "#project-list"),
        (f"post.html?slug={VALID_POST_SLUG}", "valid post detail", "#post-detail"),
        (f"project.html?slug={VALID_PROJECT_SLUG}", "valid project detail", "#project-detail"),
    ):
        page = context.new_page()
        diagnostics = attach_diagnostics(page, base_url)
        with scenario(suite, page, label, diagnostics):
            goto(page, suite, base_url, path, label)
            if path == "projects.html":
                suite.expect(page.locator(f"{container} > .card").count() == 4, f"{label}: expected all 4 projects")
            else:
                heading = page.locator(f"{container} h1")
                suite.expect(heading.count() == 1, f"{label}: expected one detail h1")
                suite.expect(locator_is_visible(heading), f"{label}: detail h1 is not visible")
                suite.expect("Loading" not in first_text(heading), f"{label}: loading state did not resolve")
                suite.expect(page.locator(f"{container} p").count() >= 2, f"{label}: detail data did not render")
        page.close()
    context.close()


def check_not_found_page(
    context,
    base_url: str,
    path: str,
    container_selector: str,
    outer_back_selector: str,
    heading: str,
    expected_title: str,
    recovery_href: str,
    suite: SmokeSuite,
) -> None:
    label = f"invalid {path}"
    page = context.new_page()
    diagnostics = attach_diagnostics(page, base_url)

    with scenario(suite, page, label, diagnostics):
        goto(page, suite, base_url, path.lstrip("/"), label)
        container = page.locator(container_selector)
        suite.expect(container.count() == 1, f"{label}: expected one {container_selector} container")
        suite.expect(locator_is_visible(container), f"{label}: {container_selector} container is not visible")
        heading_locator = container.get_by_role("heading", name=heading, exact=True, level=1)
        suite.expect(heading_locator.count() == 1, f"{label}: expected one h1 named {heading!r}")
        suite.expect(locator_is_visible(heading_locator), f"{label}: h1 named {heading!r} is not visible")
        recovery_link = container.get_by_role("link", name=re.compile("return to", re.IGNORECASE))
        suite.expect(recovery_link.count() == 1, f"{label}: expected one recovery link")
        suite.expect(
            locator_is_visible(recovery_link) and first_attribute(recovery_link, "href") == recovery_href,
            f"{label}: expected one visible recovery link to {recovery_href!r}",
        )

        outer_back = page.locator(outer_back_selector)
        suite.expect(outer_back.count() == 1, f"{label}: expected one adjacent outer recovery link")
        suite.expect(not locator_is_visible(outer_back), f"{label}: adjacent outer recovery link is visible")
        suite.expect(page.title() == expected_title, f"{label}: expected title {expected_title!r}, got {page.title()!r}")
    page.close()


def check_routes(browser: Browser, base_url: str, suite: SmokeSuite) -> None:
    context = new_context(
        browser, suite, base_url, viewport={"width": 1366, "height": 768}
    )
    page = context.new_page()
    diagnostics = attach_diagnostics(page, base_url)
    for path in ROUTES:
        label = f"route {path or '/'}"
        with scenario(suite, page, label, diagnostics):
            goto(page, suite, base_url, path, label)
            if path == "":
                suite.expect(
                    page.locator('body[data-page="entry"]').count() == 1,
                    f"{label}: root response is not the entry document",
                )
                suite.expect(
                    page.get_by_role("link", name=ENTRY_LINK_NAME, exact=True).count() == 1,
                    f"{label}: root response lacks entry semantics",
                )
    page.close()
    context.close()


def check_internal_layouts(browser: Browser, base_url: str, suite: SmokeSuite) -> None:
    for width, height in ENTRY_VIEWPORTS:
        context = new_context(
            browser, suite, base_url, viewport={"width": width, "height": height}
        )
        page = context.new_page()
        diagnostics = attach_diagnostics(page, base_url)
        for path in INTERNAL_ROUTES:
            label = f"internal {path} at {width}x{height}"
            with scenario(suite, page, label, diagnostics):
                goto(page, suite, base_url, path, label)
                metrics = overflow_metrics(page)
                suite.expect(metrics["scrollWidth"] <= metrics["innerWidth"], f"{label}: horizontal overflow {metrics}")
                suite.expect(page.locator("main").count() == 1, f"{label}: expected one main landmark")
                headings = page.locator("main h1")
                suite.expect(headings.count() >= 1, f"{label}: expected at least one main h1")
                suite.expect(locator_is_visible(headings), f"{label}: main h1 is not visible")
                stylesheets = page.evaluate(
                    """() => {
                      const links = [...document.querySelectorAll('link[rel~="stylesheet"]')];
                      return { count: links.length, loaded: links.every((link) => Boolean(link.sheet)) };
                    }"""
                )
                suite.expect(stylesheets["count"] >= 2, f"{label}: expected shared and page stylesheet links")
                suite.expect(stylesheets["loaded"], f"{label}: a stylesheet did not load")
        page.close()
        context.close()


def check_reduced_motion_cursor(browser: Browser, base_url: str, suite: SmokeSuite) -> None:
    label = "reduced-motion desktop"
    context = new_context(
        browser,
        suite,
        base_url,
        viewport={"width": 1440, "height": 900},
        reduced_motion="reduce",
    )
    page = context.new_page()
    diagnostics = attach_diagnostics(page, base_url)
    with scenario(suite, page, label, diagnostics):
        goto(page, suite, base_url, "home.html", label)
        suite.expect(page.locator(".custom-cursor-core").count() == 0, f"{label}: custom cursor core exists")
        suite.expect(page.locator(".custom-cursor-trail").count() == 0, f"{label}: custom cursor trail exists")
        suite.expect(not page.locator("body").evaluate("body => body.classList.contains('custom-cursor-enabled')"), f"{label}: custom cursor enable class should be absent")
    page.close()
    context.close()


def cursor_state(page: Page) -> dict[str, object]:
    return page.evaluate(
        """() => ({
          enabled: document.body.classList.contains('custom-cursor-enabled'),
          cores: document.querySelectorAll('.custom-cursor-core').length,
          trails: document.querySelectorAll('.custom-cursor-trail').length,
          cursor: getComputedStyle(document.body).cursor,
          animated: document.querySelector('.custom-cursor-core')?.style.transform.includes('translate3d') ?? false,
        })"""
    )


def wait_for_active_cursor(page: Page) -> None:
    page.wait_for_function(
        """() => document.body.classList.contains('custom-cursor-enabled') &&
          document.querySelectorAll('.custom-cursor-core').length === 1 &&
          document.querySelectorAll('.custom-cursor-trail').length === 1 &&
          document.querySelector('.custom-cursor-core').style.transform.includes('translate3d')""",
        polling="raf",
    )


def wait_for_inactive_cursor(page: Page) -> None:
    page.wait_for_function(
        """() => !document.body.classList.contains('custom-cursor-enabled') &&
          document.querySelectorAll('.custom-cursor-core').length === 0 &&
          document.querySelectorAll('.custom-cursor-trail').length === 0""",
        polling="raf",
    )


def check_dynamic_cursor_media_events(browser: Browser, base_url: str, suite: SmokeSuite) -> None:
    label = "dynamic cursor native media change events"
    context = new_context(
        browser,
        suite,
        base_url,
        viewport={"width": 1440, "height": 900},
        reduced_motion="no-preference",
    )
    page = context.new_page()
    diagnostics = attach_diagnostics(page, base_url)
    page.add_init_script(
        """
        window.__cursorMediaProbe = { registrations: [], changes: [] };
        const nativeAdd = EventTarget.prototype.addEventListener;
        const nativeRemove = EventTarget.prototype.removeEventListener;
        const wrappedListeners = new WeakMap();

        EventTarget.prototype.addEventListener = function(type, listener, options) {
          if (type !== 'change' || !(this instanceof MediaQueryList) || typeof listener !== 'function') {
            return nativeAdd.call(this, type, listener, options);
          }
          const target = this;
          let targetListeners = wrappedListeners.get(target);
          if (!targetListeners) {
            targetListeners = new WeakMap();
            wrappedListeners.set(target, targetListeners);
          }
          const wrapped = function(event) {
            window.__cursorMediaProbe.changes.push({ media: target.media, matches: target.matches });
            return listener.call(this, event);
          };
          targetListeners.set(listener, wrapped);
          window.__cursorMediaProbe.registrations.push(target.media);
          return nativeAdd.call(target, type, wrapped, options);
        };

        EventTarget.prototype.removeEventListener = function(type, listener, options) {
          const wrapped = wrappedListeners.get(this)?.get(listener) ?? listener;
          return nativeRemove.call(this, type, wrapped, options);
        };
        """
    )

    with scenario(suite, page, label, diagnostics):
        goto(page, suite, base_url, "home.html", label)
        registrations = page.evaluate("window.__cursorMediaProbe.registrations")
        suite.expect(
            "(pointer: fine)" in registrations and "(prefers-reduced-motion: reduce)" in registrations,
            f"{label}: production media listeners were not registered: {registrations}",
        )

        page.mouse.move(120, 140)
        wait_for_active_cursor(page)
        active = cursor_state(page)
        suite.expect(active["enabled"] and active["cores"] == 1 and active["trails"] == 1 and active["animated"], f"{label}: active state is invalid: {active}")

        page.emulate_media(reduced_motion="reduce")
        page.wait_for_function(
            """() => window.__cursorMediaProbe.changes.some(
              (change) => change.media === '(prefers-reduced-motion: reduce)' && change.matches
            )""",
            polling=50,
        )
        suite.expect(
            page.evaluate("window.__cursorMediaProbe.changes.some((change) => change.media === '(prefers-reduced-motion: reduce)' && change.matches)"),
            f"{label}: reduced-motion change event did not reach the production listener",
        )
        wait_for_inactive_cursor(page)
        reduced = cursor_state(page)
        suite.expect(not reduced["enabled"] and reduced["cores"] == 0 and reduced["trails"] == 0, f"{label}: event path did not tear down: {reduced}")
        suite.expect(reduced["cursor"] != "none", f"{label}: native cursor was not restored: {reduced}")

        page.emulate_media(reduced_motion="no-preference")
        page.wait_for_function(
            """() => window.__cursorMediaProbe.changes.some(
              (change) => change.media === '(prefers-reduced-motion: reduce)' && !change.matches
            )""",
            polling=50,
        )
        suite.expect(
            page.evaluate("window.__cursorMediaProbe.changes.some((change) => change.media === '(prefers-reduced-motion: reduce)' && !change.matches)"),
            f"{label}: no-preference change event did not reach the production listener",
        )
        page.mouse.move(180, 200)
        wait_for_active_cursor(page)
        restored = cursor_state(page)
        suite.expect(restored["enabled"] and restored["cores"] == 1 and restored["trails"] == 1, f"{label}: event path did not reinitialize one cursor pair: {restored}")
    page.close()
    context.close()


def check_dynamic_cursor_silent_fallback(browser: Browser, base_url: str, suite: SmokeSuite) -> None:
    label = "dynamic cursor silent-event pointer fallback"
    context = new_context(
        browser,
        suite,
        base_url,
        viewport={"width": 1440, "height": 900},
        reduced_motion="no-preference",
    )
    page = context.new_page()
    diagnostics = attach_diagnostics(page, base_url)
    page.add_init_script(
        """
        const nativeMatchMedia = window.matchMedia.bind(window);
        window.matchMedia = (query) => {
          const nativeQuery = nativeMatchMedia(query);
          return {
            get matches() { return nativeQuery.matches; },
            get media() { return nativeQuery.media; },
            addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {},
          };
        };
        """
    )

    with scenario(suite, page, label, diagnostics):
        goto(page, suite, base_url, "home.html", label)
        page.mouse.move(120, 140)
        wait_for_active_cursor(page)
        active = cursor_state(page)
        suite.expect(active["enabled"] and active["animated"], f"{label}: active state is invalid: {active}")

        page.emulate_media(reduced_motion="reduce")
        page.mouse.move(140, 160)
        wait_for_inactive_cursor(page)
        reduced = cursor_state(page)
        suite.expect(not reduced["enabled"] and reduced["cores"] == 0 and reduced["trails"] == 0, f"{label}: pointer fallback did not tear down: {reduced}")
        suite.expect(reduced["cursor"] != "none", f"{label}: native cursor was not restored: {reduced}")

        page.emulate_media(reduced_motion="no-preference")
        page.mouse.move(180, 200)
        wait_for_active_cursor(page)
        restored = cursor_state(page)
        suite.expect(restored["enabled"] and restored["cores"] == 1 and restored["trails"] == 1, f"{label}: pointer fallback did not restore one cursor pair: {restored}")
    page.close()
    context.close()


def check_javascript_disabled_mobile_navigation(
    browser: Browser, base_url: str, suite: SmokeSuite
) -> None:
    label = "JavaScript-disabled mobile internal navigation 390px"
    context = new_context(
        browser,
        suite,
        base_url,
        viewport={"width": 390, "height": 844},
        java_script_enabled=False,
    )
    page = context.new_page()
    diagnostics = attach_diagnostics(page, base_url)
    with scenario(suite, page, label, diagnostics, script_execution=False):
        goto(page, suite, base_url, "about.html", label)
        computed_cursor = page.locator("body").evaluate("body => getComputedStyle(body).cursor")
        suite.expect(computed_cursor != "none", f"{label}: expected a native cursor, got {computed_cursor!r}")

        nav = page.locator(".site-header nav")
        suite.expect(locator_is_visible(nav), f"{label}: static site-header navigation is not visible")
        for link_name, expected_href in NAVIGATION_LINKS:
            link = nav.get_by_role("link", name=link_name, exact=True)
            suite.expect(link.count() == 1, f"{label}: expected one {link_name!r} navigation link")
            suite.expect(locator_is_visible(link), f"{label}: {link_name!r} navigation link is not visible")
            href = first_attribute(link, "href") or ""
            suite.expect(
                urlparse(urljoin(page.url, href)).path.endswith(f"/{expected_href}"),
                f"{label}: {link_name!r} navigation link is not reachable at {expected_href!r}: {href!r}",
            )
    page.close()
    context.close()


def check_javascript_disabled_root_entry(
    browser: Browser, base_url: str, suite: SmokeSuite
) -> None:
    label = "JavaScript-disabled root entry navigation"
    context = new_context(
        browser,
        suite,
        base_url,
        viewport={"width": 390, "height": 844},
        java_script_enabled=False,
    )
    page = context.new_page()
    diagnostics = attach_diagnostics(page, base_url)
    with scenario(suite, page, label, diagnostics, script_execution=False):
        goto(page, suite, base_url, "", label)
        suite.expect(urlparse(page.url).path == "/", f"{label}: did not start at actual root: {page.url}")
        entry_link = page.get_by_role("link", name=ENTRY_LINK_NAME, exact=True)
        suite.expect(
            entry_link.count() == 1 and (first_attribute(entry_link, "href") or "").endswith("home.html"),
            f"{label}: real entry link is unavailable",
        )
        entry_link.click()
        page.wait_for_url("**/home.html", wait_until="load")
        suite.expect(
            urlparse(page.url).path.endswith("/home.html"),
            f"{label}: native navigation did not reach /home.html: {page.url}",
        )
    page.close()
    context.close()


def expected_planned_checks() -> int:
    """Derive the fixed assertion budget from declared cases, never live DOM counts."""
    entry_checks = len(ENTRY_VIEWPORTS) * 8
    entry_composition_checks = len(ENTRY_COMPOSITION_VIEWPORTS) * 8
    entry_activation_checks = (5 + 4) + (6 + 4)
    normal_entry_activation_checks = 8
    home_checks = 8
    mobile_navigation_checks = 20
    scroll_to_top_checks = 2 * 3
    writing_checks = 4 + (len(TOPIC_LABELS) * 4) + 4 + sum(
        len(titles) for titles in TOPIC_POST_TITLES.values()
    )
    project_and_detail_checks = 3 + (2 * 6)
    not_found_checks = 2 * 11
    route_checks = (len(ROUTES) * 2) + 2
    internal_layout_checks = len(ENTRY_VIEWPORTS) * len(INTERNAL_ROUTES) * 8
    javascript_disabled_navigation_checks = 4 + (len(NAVIGATION_LINKS) * 3)
    javascript_disabled_root_checks = 5
    cursor_checks = 5 + 9 + 6 + javascript_disabled_navigation_checks
    return (
        entry_checks
        + entry_composition_checks
        + entry_activation_checks
        + normal_entry_activation_checks
        + home_checks
        + mobile_navigation_checks
        + scroll_to_top_checks
        + writing_checks
        + project_and_detail_checks
        + not_found_checks
        + route_checks
        + internal_layout_checks
        + cursor_checks
        + javascript_disabled_root_checks
    )


def main() -> int:
    args = parse_args()
    base_url = args.base_url.rstrip("/") + "/"
    suite = SmokeSuite()

    with sync_playwright() as playwright:
        try:
            browser, browser_label = launch_chromium(playwright.chromium)
        except RuntimeError as error:
            print(f"Browser smoke setup failed:\n{error}", file=sys.stderr)
            return 1

        try:
            check_entry_viewports(browser, base_url, suite)
            check_entry_composition(browser, base_url, suite)
            check_entry_activation(browser, base_url, suite)
            check_normal_entry_activation(browser, base_url, suite)
            check_home_content(browser, base_url, suite)
            check_mobile_navigation(browser, base_url, suite)
            check_scroll_to_top_motion(browser, base_url, suite)
            check_writing(browser, base_url, suite)
            check_projects_and_valid_details(browser, base_url, suite)

            invalid_context = new_context(
                browser, suite, base_url, viewport={"width": 1440, "height": 900}
            )
            check_not_found_page(
                invalid_context,
                base_url,
                "/post.html?slug=missing",
                "#post-detail",
                "#post-back-link",
                "Post not found",
                "Post not found | Anjou Zhao",
                "writing.html",
                suite,
            )
            check_not_found_page(
                invalid_context,
                base_url,
                "/project.html?slug=missing",
                "#project-detail",
                "#project-back-link",
                "Project not found",
                "Project not found | Anjou Zhao",
                "projects.html",
                suite,
            )
            invalid_context.close()

            check_routes(browser, base_url, suite)
            check_internal_layouts(browser, base_url, suite)
            check_reduced_motion_cursor(browser, base_url, suite)
            check_dynamic_cursor_media_events(browser, base_url, suite)
            check_dynamic_cursor_silent_fallback(browser, base_url, suite)
            check_javascript_disabled_mobile_navigation(browser, base_url, suite)
            check_javascript_disabled_root_entry(browser, base_url, suite)
        finally:
            browser.close()

    planned_checks = expected_planned_checks()
    if suite.checks != planned_checks:
        suite.fail(
            f"check-accounting invariant: executed {suite.checks} of {planned_checks} planned checks"
        )

    summary = (
        f"{suite.checks}/{planned_checks} planned checks executed; "
        f"{len(ENTRY_VIEWPORTS)} entry viewports; {len(ROUTES)} routes; "
        f"{len(INTERNAL_ROUTES)} internal routes x {len(ENTRY_VIEWPORTS)} viewports "
        f"= {len(INTERNAL_ROUTES) * len(ENTRY_VIEWPORTS)} internal layouts"
    )
    if suite.failures:
        print(f"Browser smoke failed using {browser_label}: {summary}.", file=sys.stderr)
        for failure in suite.failures:
            print(f"- {failure}", file=sys.stderr)
        if suite.screenshots:
            print(f"Failure screenshots: {suite.screenshots[0].parent}", file=sys.stderr)
        return 1

    print(f"Browser smoke passed using {browser_label}: {summary}; 0 issues.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
