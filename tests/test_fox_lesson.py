"""Run with python3 -m unittest discover -s tests -v.

Install Python Playwright and run playwright install chromium, or set
PENCIL_TEST_CHROMIUM_PATH to use an existing Chromium executable.
For WebKit, run playwright install webkit and set PENCIL_TEST_BROWSER=webkit.
"""

import base64
import os
import threading
import unittest
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from playwright.sync_api import expect, sync_playwright


class StaticGameHandler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


class FoxLessonTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        game = Path(__file__).resolve().parents[1] / "dist"
        cls.server = ThreadingHTTPServer(
            ("127.0.0.1", 0), partial(StaticGameHandler, directory=game)
        )
        cls.addClassCleanup(cls.server.server_close)
        threading.Thread(target=cls.server.serve_forever, daemon=True).start()
        cls.addClassCleanup(cls.server.shutdown)
        cls.url = f"http://127.0.0.1:{cls.server.server_port}"
        playwright = cls.enterClassContext(sync_playwright())
        browser = os.environ.get("PENCIL_TEST_BROWSER", "chromium")
        if browser == "webkit":
            cls.browser = playwright.webkit.launch()
        else:
            executable = os.environ.get("PENCIL_TEST_CHROMIUM_PATH")
            cls.browser = playwright.chromium.launch(executable_path=executable)
        cls.addClassCleanup(cls.browser.close)

    def page_at(self, width=820, height=1180, touch=True, still=True):
        context = self.browser.new_context(
            viewport={"width": width, "height": height},
            device_scale_factor=2 if touch else 1,
            is_mobile=touch,
            has_touch=touch,
            reduced_motion="reduce" if still else "no-preference",
        )
        self.addCleanup(context.close)
        page = context.new_page()
        errors = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.goto(self.url)
        self.addCleanup(self.assertEqual, errors, [])
        return page

    def open_fox(self, page, touch=True):
        entry = page.get_by_role("link", name="Draw the little fox").first
        entry.tap() if touch else entry.click()
        expect(page.get_by_role("heading", name="Sketch the head")).to_be_visible()
        expect(page.locator("#drawing-mode")).to_have_value("paper")
        expect(self.paper_control(page, "Back")).to_be_disabled()

    def paper_control(self, page, name):
        return page.get_by_role("group", name="Paper lesson controls").get_by_role(
            "button", name=name, exact=True
        )

    def open_basics(self, page, touch=True):
        entry = page.get_by_role("link", name="Pencil Basics", exact=True)
        entry.tap() if touch else entry.click()
        expect(page.get_by_role("heading", name="Pencil Basics")).to_be_visible()
        expect(page.get_by_role("heading", name="Try light and dark")).to_be_visible()
        expect(page.locator("#drawing-mode")).to_have_value("paper")
        expect(self.paper_control(page, "Back")).to_be_disabled()

    def to_tail(self, page):
        next_button = self.paper_control(page, "Next")
        for title in ["Give it ears", "Sit the fox down", "Curl the tail", "Add a face", "Pick a tail pattern"]:
            next_button.tap()
            expect(page.get_by_role("heading", name=title)).to_be_visible()

    def test_pencil_basics_light_and_dark_and_optional_challenge(self):
        page = self.page_at()
        self.open_basics(page)
        expect(page.locator('#drawing-mode option[value="trace"]')).to_have_count(0)
        guide = page.get_by_role("img", name="Two pencil marks", exact=False)
        marks = guide.evaluate("(canvas) => canvas.toDataURL()")
        self.assertEqual(self.mark_shades(guide), [True, True])
        dots = page.get_by_role("button", name="Start dots")
        dots.tap()
        expect(dots).to_have_attribute("aria-pressed", "true")
        with_dots = guide.evaluate("(canvas) => canvas.toDataURL()")
        self.assertNotEqual(marks, with_dots)
        self.paper_control(page, "Replay").tap()
        self.assertEqual(with_dots, guide.evaluate("(canvas) => canvas.toDataURL()"))
        dots.tap()
        self.assertEqual(marks, guide.evaluate("(canvas) => canvas.toDataURL()"))
        self.paper_control(page, "Finish").tap()

        finished = page.get_by_role("heading", name="You drew it!")
        expect(finished).to_be_visible()
        expect(page.locator("#finish-message")).to_have_text(
            "Only your lesson progress is saved. Your drawing stays on your paper."
        )
        page.reload()
        expect(finished).to_be_visible()
        challenge = page.get_by_role("button", name="Try Hard")
        challenge.tap()
        kite = page.get_by_role("heading", name="Invent a moon kite")
        expect(kite).to_be_visible()
        expect(page.locator("#guide")).to_be_hidden()
        expect(page.locator("#ink")).to_be_hidden()
        expect(page.locator("#drawing-mode")).to_be_hidden()
        page.reload()
        expect(kite).to_be_visible()
        page.get_by_text("Show and tell", exact=True).tap()
        expect(page.get_by_text("Point to your darkest mark.", exact=False)).to_be_visible()
        for control in ["Back", "Skip", "Done"]:
            page.get_by_role("button", name=control, exact=True).tap()
            expect(finished).to_be_visible()
            expect(challenge).to_be_focused()
            if control != "Done":
                challenge.tap()
        page.get_by_role("link", name="Sketchbook").first.tap()
        expect(page.get_by_role("link", name="Pencil Basics Lesson finished")
               .locator(".completion-mark")).to_be_visible()
        expect(page.get_by_role("link", name="Little fox Lesson finished")).to_have_count(0)

    def test_fox_goes_straight_to_tail_and_saves_completion(self):
        page = self.page_at()
        self.open_fox(page)
        self.to_tail(page)
        tail = page.get_by_role("heading", name="Pick a tail pattern")
        fluffy = page.locator("#guide").evaluate("(canvas) => canvas.toDataURL()")
        striped = page.get_by_role("button", name="Striped")
        striped.tap()
        expect(striped).to_have_attribute("aria-pressed", "true")
        self.assertNotEqual(fluffy, page.locator("#guide").evaluate("(canvas) => canvas.toDataURL()"))
        scorched = page.get_by_role("button", name="Dragon-scorched")
        scorched.tap()
        expect(scorched).to_have_attribute("aria-pressed", "true")
        page.reload()
        expect(tail).to_be_visible()
        expect(scorched).to_have_attribute("aria-pressed", "true")
        self.paper_control(page, "Back").tap()
        expect(page.get_by_role("heading", name="Add a face")).to_be_visible()
        self.paper_control(page, "Next").tap()
        expect(scorched).to_have_attribute("aria-pressed", "true")
        self.paper_control(page, "Finish").tap()
        finished = page.get_by_role("heading", name="You drew it!")
        expect(finished).to_be_visible()
        expect(page.locator("#finish-message")).to_have_text(
            "Only your lesson progress is saved. Your drawing stays on your paper."
        )
        expect(page.get_by_role("button", name="Try Hard")).to_have_count(0)
        page.goto(f"{self.url}/#challenge/little-fox")
        expect(finished).to_be_visible()
        self.assertTrue(page.url.endswith("#done/little-fox"))
        page.get_by_role("link", name="Sketchbook").first.tap()
        book_card = page.get_by_role("link", name="Little fox Lesson finished")
        expect(book_card.locator(".completion-mark")).to_be_visible()
        reopened = page.context.new_page()
        reopened.goto(self.url)
        home_card = reopened.get_by_role("link", name="Little fox 7 min Easy Lesson finished")
        expect(home_card.locator(".completion-mark")).to_be_visible()
        reopened.get_by_role("button", name="Hard", exact=True).tap()
        expect(home_card).to_have_count(0)
        reopened.get_by_role("button", name="Easy", exact=True).tap()
        expect(home_card.locator(".completion-mark")).to_be_visible()
        reopened.get_by_role("link", name="Sketchbook").first.tap()
        expect(reopened.get_by_role("link", name="Little fox Lesson finished")
               .locator(".completion-mark")).to_be_visible()

    @staticmethod
    def mark_shades(guide):
        return guide.evaluate("""canvas => {
            const { width, height } = canvas;
            const { data } = canvas.getContext('2d').getImageData(0, 0, width, height);
            const shades = [false, false];
            for (let index = 0; index < data.length; index += 4) {
                const onLeft = (index / 4) % width < width / 2;
                if (data[index + 3] !== 255) continue;
                if (onLeft && data[index] === 119 && data[index + 1] === 110) shades[0] = true;
                if (!onLeft && data[index] === 41 && data[index + 1] === 38) shades[1] = true;
            }
            return shades;
        }""")

    def test_live_marks_hold_and_replay(self):
        page = self.page_at(1180, 820, touch=False, still=False)
        self.open_basics(page, touch=False)
        guide = page.locator("#guide")
        page.wait_for_function("session.progress === 1")
        held = guide.evaluate("(canvas) => canvas.toDataURL()")
        self.assertEqual(self.mark_shades(guide), [True, True])
        replay = self.paper_control(page, "Replay")
        replay.focus()
        replay.press("Enter")
        page.wait_for_function("session.progress > 0 && session.progress < .5")
        self.assertNotEqual(held, guide.evaluate("(canvas) => canvas.toDataURL()"))
        page.wait_for_function("session.progress === 1")
        self.assertEqual(held, guide.evaluate("(canvas) => canvas.toDataURL()"))
        page.wait_for_function(
            "held => document.querySelector('#guide').toDataURL() === held", arg=held
        )
        expect(page.get_by_role("heading", name="Try light and dark")).to_be_visible()
        self.paper_control(page, "Skip").click()
        expect(page.get_by_role("heading", name="You drew it!")).to_be_visible()

    def test_resume_fox_when_old_warmup_or_tail_was_saved(self):
        for activity in ["marks", "tail"]:
            with self.subTest(activity=activity):
                page = self.page_at()
                page.evaluate("""activity => {
                    localStorage.setItem('little-pencil-club/little-fox', JSON.stringify({
                        step: 4, completed: 0, drawingMode: 'copy', foxActivity: activity,
                        tailTexture: 'striped', strokes: [{ tool: 'pencil', points: [[25, 25, 48]] }]
                    }));
                }""", activity)
                page.goto(f"{self.url}/#draw/little-fox")
                page.reload()
                expect(page.get_by_role("heading", name="Pick a tail pattern")).to_be_visible()
                expect(page.get_by_role("button", name="Striped", exact=True)).to_have_attribute("aria-pressed", "true")
                expect(page.locator("#drawing-mode")).to_have_value("copy")
                expect(page.get_by_role("button", name="Save drawing as PNG")).to_be_enabled()
                self.assertIsNone(page.evaluate("localStorage.getItem('little-pencil-club/pencil-basics')"))

    def test_library_levels_and_legacy_progress(self):
        page = self.page_at(375, 667)
        levels = page.get_by_role("group", name="Lesson levels")
        for index, label in enumerate(["Easy", "Medium", "Hard"], 1):
            control = levels.get_by_role("button", name=label, exact=True)
            if label == "Medium":
                control.focus()
                control.press("Space")
            else:
                control.tap()
            expect(control).to_have_attribute("aria-pressed", "true")
            cards = page.locator(".lesson-card .difficulty")
            self.assertGreater(cards.count(), 0)
            self.assertEqual(set(cards.all_text_contents()), {label})
            for badge in cards.all():
                expect(badge.locator(".filled")).to_have_count(index)
            expect(page.locator(".level-help")).not_to_be_empty()
        self.open_fox(page)

        page.evaluate("""() => {
            localStorage.setItem('little-pencil-club/little-fox',
              JSON.stringify({ step: 2, completed: 0, strokes: [], mode: 'trace' }));
        }""")
        page.reload()
        expect(page.get_by_role("heading", name="Sit the fox down")).to_be_visible()
        expect(page.locator("#drawing-mode")).to_have_value("paper")
        self.paper_control(page, "Back").tap()
        page.reload()
        expect(page.get_by_role("heading", name="Give it ears")).to_be_visible()
        self.assertEqual(
            page.evaluate("JSON.parse(localStorage.getItem('little-pencil-club/little-fox')).step"), 1
        )
        reopened = page.context.new_page()
        reopened.goto(self.url)
        reopened.get_by_role("button", name="Hard", exact=True).tap()
        reopened.get_by_role("link", name="Continue little fox").tap()
        expect(reopened.get_by_role("heading", name="Give it ears")).to_be_visible()

    def test_digital_sketchbook_and_png(self):
        page = self.page_at(1280, 820, touch=False)
        self.open_fox(page, touch=False)
        mode = page.locator("#drawing-mode")
        mode.select_option("trace")
        self.assertTrue(page.locator("#guide").evaluate("""canvas =>
            canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height)
              .data.some((value, index) => index % 4 === 3 && value > 0)"""))
        mode.select_option("copy")
        self.assertFalse(page.locator("#guide").evaluate("""canvas =>
            canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height)
              .data.some((value, index) => index % 4 === 3 && value > 0)"""))
        ink = page.locator("#ink").bounding_box()
        page.mouse.move(ink["x"] + 60, ink["y"] + 50)
        page.mouse.down()
        page.mouse.move(ink["x"] + 130, ink["y"] + 90, steps=5)
        page.mouse.up()
        panel = page.get_by_role("region", name="Drawing instructions")
        next_button = panel.get_by_role("button", name="Next", exact=True)
        for _ in range(5):
            next_button.click()
        panel.get_by_role("button", name="Finish", exact=True).click()
        expect(page.locator("#finish-message")).to_have_text("Little fox is in your sketchbook.")
        page.get_by_role("link", name="Sketchbook").first.click()
        page.get_by_role("link", name="Little fox Finished drawing").click()
        expect(mode).to_have_value("copy")
        with page.expect_download() as event:
            page.get_by_role("button", name="Save drawing as PNG").click()
        download = event.value
        self.assertEqual(download.suggested_filename, "little-fox-sketch.png")
        png = base64.b64encode(download.path().read_bytes()).decode("ascii")
        size_and_ink = page.evaluate("""async data => {
            const image = new Image();
            image.src = 'data:image/png;base64,' + data;
            await image.decode();
            const canvas = document.createElement('canvas');
            canvas.width = image.width;
            canvas.height = image.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(image, 0, 0);
            const hasInk = ctx.getImageData(0, 0, image.width, image.height)
              .data.some((value, index) => index % 4 === 0 && value < 120);
            return [image.width, image.height, hasInk];
        }""", png)
        self.assertEqual(size_and_ink, [1600, 1104, True])

    def test_paper_layouts(self):
        for width, height in [
            (320, 568), (430, 932), (568, 320), (932, 430),
            (744, 1133), (1133, 744), (820, 1180), (1180, 820),
            (1024, 1366), (1366, 1024),
        ]:
            with self.subTest(width=width, height=height):
                page = self.page_at(width, height)
                self.assert_no_overflow(page, width)
                self.open_fox(page)
                self.assert_paper_layout(page, width, height, ["Back", "Replay", "Next"])
                self.to_tail(page)
                self.assert_paper_layout(page, width, height, ["Back", "Replay", "Finish", "Skip"])
                page.get_by_role("link", name="Lessons", exact=True).tap()
                self.open_basics(page)
                self.assert_paper_layout(page, width, height, ["Back", "Replay", "Finish", "Skip"])

    def assert_no_overflow(self, page, width):
        self.assertLessEqual(page.evaluate("document.documentElement.scrollWidth"), width)

    def assert_paper_layout(self, page, width, height, controls):
        page.evaluate("window.scrollTo(0, 0)")
        self.assert_no_overflow(page, width)
        guide = page.locator("#guide").bounding_box()
        self.assertGreaterEqual(guide["height"], 115)
        for name in controls:
            button = self.paper_control(page, name).bounding_box()
            self.assertGreaterEqual(button["height"], 44)
            self.assertGreaterEqual(button["width"], 44)
            self.assertGreaterEqual(button["y"], guide["y"] + guide["height"] - 1)
            self.assertLessEqual(button["y"] + button["height"], height)
