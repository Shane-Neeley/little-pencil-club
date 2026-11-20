"""Run with Python Playwright installed and python3 -m unittest discover -s prototypes/drawing-motion."""

import os
import subprocess
import threading
import unittest
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from playwright.sync_api import expect, sync_playwright


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


class MotionTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.folder = Path(__file__).resolve().parent
        handler = partial(QuietHandler, directory=cls.folder)
        server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
        cls.addClassCleanup(server.server_close)
        threading.Thread(target=server.serve_forever, daemon=True).start()
        cls.addClassCleanup(server.shutdown)
        cls.origin = f"http://127.0.0.1:{server.server_port}"
        playwright = cls.enterClassContext(sync_playwright())
        browser = getattr(playwright, os.getenv("PENCIL_TEST_BROWSER", "chromium"))
        cls.browser = browser.launch(executable_path=os.getenv("PENCIL_TEST_BROWSER_PATH"))
        cls.addClassCleanup(cls.browser.close)

    def open_demo(self, width=390, height=664, *, touch=True, reduce=False, file=False):
        context = self.browser.new_context(
            viewport={"width": width, "height": height},
            is_mobile=touch,
            has_touch=touch,
            reduced_motion="reduce" if reduce else "no-preference",
        )
        self.addCleanup(context.close)
        page = context.new_page()
        requests = []
        errors = []
        page.on("request", lambda request: requests.append((request.method, request.url)))
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.goto((self.folder / "index.html").as_uri() if file else self.origin)
        self.addCleanup(lambda: self.assertEqual(errors, []))
        if not file:
            self.addCleanup(lambda: self.assertTrue(all(
                method == "GET" and url.startswith(self.origin + "/") for method, url in requests
            ), requests))
        expect(page.get_by_role("heading", name="Make it move!")).to_be_visible()
        return page

    def assert_still(self, image):
        self.assertEqual(image.evaluate("(image) => getComputedStyle(image).transform"), "none")
        self.assertEqual(image.evaluate("(image) => image.getAnimations().length"), 0)

    def test_touch_stop_replay_and_original_png(self):
        page = self.open_demo()
        image = page.get_by_role("img", name="Pencil drawing", exact=False)
        stop = page.get_by_role("button", name="Stop", exact=True)
        play = page.get_by_role("button", name="Play", exact=True)
        replay = page.get_by_role("button", name="Replay", exact=True)
        status = page.get_by_role("status")
        self.assert_still(image)
        expect(stop).to_be_disabled()
        expect(status).to_have_text("Ready to play.")
        play.tap()
        expect(status).to_have_text("Playing wiggle.")
        self.assertEqual(image.evaluate("(image) => image.getAnimations()[0].effect.getTiming().iterations"), 1)
        stop.tap()
        expect(status).to_have_text("Stopped.")
        expect(replay).to_be_focused()
        self.assert_still(image)
        replay.tap()
        expect(status).to_have_text("Ready to replay.", timeout=3000)
        self.assert_still(image)
        page.locator("label").filter(has=page.get_by_role("radio", name="Bounce", exact=True)).tap()
        play.tap()
        expect(status).to_have_text("Playing bounce.")
        keyframes = image.evaluate("(image) => image.getAnimations()[0].effect.getKeyframes()")
        self.assertTrue(any("translateY(-9%)" in frame["transform"] for frame in keyframes), keyframes)
        stop.tap()
        self.assert_still(image)
        with page.expect_download() as result:
            page.get_by_role("link", name="Save still PNG").tap()
        self.assertEqual(result.value.path().read_bytes(), (self.folder / "jellyfish.png").read_bytes())

    def test_keyboard_and_direct_local_file(self):
        page = self.open_demo(1100, 800, touch=False, file=True)
        image = page.get_by_role("img", name="Pencil drawing", exact=False)
        page.keyboard.press("Tab")
        expect(page.get_by_role("radio", name="Wiggle")).to_be_focused()
        page.keyboard.press("ArrowRight")
        expect(page.get_by_role("radio", name="Bounce")).to_be_checked()
        page.keyboard.press("Tab")
        expect(page.get_by_role("button", name="Play", exact=True)).to_be_focused()
        page.keyboard.press("Enter")
        expect(page.get_by_role("status")).to_have_text("Playing bounce.")
        page.keyboard.press("Tab")
        expect(page.get_by_role("button", name="Stop", exact=True)).to_be_focused()
        page.keyboard.press("Space")
        expect(page.get_by_role("button", name="Replay", exact=True)).to_be_focused()
        self.assert_still(image)

    def test_reduced_motion_uses_static_poses(self):
        page = self.open_demo(reduce=True)
        image = page.get_by_role("img", name="Pencil drawing", exact=False)
        expect(page.locator("[data-motion-frames]")).to_be_hidden()
        page.get_by_role("button", name="Play", exact=True).tap()
        stills = page.get_by_role("group", name="Wiggle still frames")
        expect(stills).to_be_visible()
        self.assertEqual(stills.locator("figcaption").all_text_contents(), ["Tilt left", "Center", "Tilt right"])
        self.assert_still(image)
        expect(page.get_by_role("button", name="Stop", exact=True)).to_be_disabled()
        page.locator("label").filter(has=page.get_by_role("radio", name="Bounce", exact=True)).tap()
        expect(stills).to_be_hidden()
        page.get_by_role("button", name="Play", exact=True).tap()
        expect(page.get_by_role("group", name="Bounce still frames")).to_be_visible()
        self.assert_still(image)

    def test_switching_to_reduced_motion_stops_a_running_preview(self):
        page = self.open_demo()
        page.get_by_role("button", name="Play", exact=True).tap()
        expect(page.get_by_role("status")).to_have_text("Playing wiggle.")
        page.emulate_media(reduced_motion="reduce")
        expect(page.get_by_role("group", name="Wiggle still frames")).to_be_visible()
        expect(page.get_by_role("status")).to_have_text("Wiggle shown in still frames.")
        self.assert_still(page.get_by_role("img", name="Pencil drawing", exact=False))

    def test_control_fit(self):
        for width, height in [(320, 568), (390, 664), (568, 320), (932, 430), (820, 1180), (1180, 820)]:
            with self.subTest(width=width, height=height):
                page = self.open_demo(width, height)
                self.assertLessEqual(page.evaluate("document.documentElement.scrollWidth"), width)
                expect(page.get_by_role("img", name="Pencil drawing", exact=False)).to_be_in_viewport()
                for control in [
                    page.locator(".choice").first,
                    page.locator(".choice").last,
                    page.get_by_role("button", name="Play", exact=True),
                    page.get_by_role("button", name="Stop", exact=True),
                ]:
                    rect = control.bounding_box()
                    self.assertGreaterEqual(rect["width"], 44)
                    self.assertGreaterEqual(rect["height"], 44)
                    self.assertLessEqual(rect["y"] + rect["height"], height)

    def test_optional_mock_lab(self):
        with subprocess.Popen(
            ["node", str(self.folder / "lab" / "server.mjs")],
            stdout=subprocess.PIPE,
            text=True,
        ) as server:
            try:
                prefix = "Mock motion lab at "
                line = server.stdout.readline()
                self.assertTrue(line.startswith(prefix), line)
                origin = line.removeprefix(prefix).strip()
                self.exercise_lab(origin)
            finally:
                server.terminate()

    def exercise_lab(self, origin):
        context = self.browser.new_context(viewport={"width": 820, "height": 1180})
        self.addCleanup(context.close)
        page = context.new_page()
        posts = []
        errors = []
        page.on("request", lambda request: posts.append(request.url) if request.method == "POST" else None)
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.goto(origin)
        lab = page.get_by_role("region", name="Synthetic motion lab")
        status = lab.get_by_role("status")
        preset = lab.get_by_role("button", name="Suggest a move")
        generate = lab.get_by_role("button", name="Prepare mock GIF")
        image = page.locator("[data-motion-image]")
        gif = lab.locator("[data-gif-image]")
        expect(status).to_have_text("Ready to compare.")
        self.assertEqual(posts, [])
        preset.click()
        expect(status).to_have_text("Move selected. Tap Play in the local player.")
        self.assert_still(image)
        generate.click()
        expect(status).to_have_text("Mock GIF ready.")
        expect(gif).to_be_hidden()
        lab.get_by_role("button", name="Play GIF", exact=True).click()
        expect(gif).to_be_visible()
        first_url = gif.get_attribute("src")
        lab.get_by_role("button", name="Stop GIF", exact=True).click()
        expect(gif).to_be_hidden()
        lab.get_by_role("button", name="Replay GIF", exact=True).click()
        self.assertNotEqual(first_url, gif.get_attribute("src"))
        page.emulate_media(reduced_motion="reduce")
        expect(gif).to_be_hidden()
        generate.click()
        expect(status).to_contain_text("Reduced motion is on.")
        self.assertEqual(posts, [origin + "preview/preset", origin + "preview/gif"])
        self.assert_still(image)

        page.emulate_media(reduced_motion="no-preference")
        page.route("**/preview/gif", lambda route: route.fulfill(json={"kind": "local"}))
        generate.click()
        expect(status).to_have_text("Preview unavailable. Use Wiggle or Bounce in the local player.")
        page.get_by_role("button", name="Play", exact=True).click()
        expect(page.locator("[data-motion-status]")).to_have_text("Playing wiggle.")
        self.assertEqual(errors, [])
