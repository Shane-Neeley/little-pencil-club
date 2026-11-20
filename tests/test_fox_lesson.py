"""Run with python3 -m unittest discover -s tests -v.

Install Python Playwright and run playwright install chromium, or set
PENCIL_TEST_CHROMIUM_PATH to use an existing Chromium executable.
For WebKit, run playwright install webkit and set PENCIL_TEST_BROWSER=webkit.
Set PENCIL_TEST_WEBKIT_PATH to use an existing WebKit executable.
"""

import base64
import os
import threading
import unittest
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from playwright.sync_api import expect, sync_playwright


THUMBNAIL_HAS_INK = """canvas => canvas.getContext('2d').getImageData(
    0, 0, canvas.width, canvas.height
  ).data.some((value, index) => index % 4 === 3 && value > 0)"""


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
            executable = os.environ.get("PENCIL_TEST_WEBKIT_PATH")
            cls.browser = playwright.webkit.launch(executable_path=executable)
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
        expect(page.get_by_role("button", name="Try on your own")).to_have_count(0)
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

    def open_optional_skill(self, page, name, level):
        page.get_by_role("button", name="Skills", exact=True).click()
        topics = page.get_by_role("group", name="Lesson topics")
        expect(topics.get_by_role("button", name="Skills")).to_have_attribute("aria-pressed", "true")
        page.get_by_role("link", name=f"{name} 2 min {level}", exact=True).click()
        expect(page.get_by_role("heading", name=name, exact=True)).to_be_visible()
        expect(page.locator("#drawing-mode")).to_have_value("paper")

    def test_optional_pebble_overlap_and_independent_balloons(self):
        page = self.page_at()
        self.open_optional_skill(page, "Behind and in front", "Easy")
        expect(page.get_by_role("heading", name="Draw a pebble", exact=True)).to_be_visible()
        expect(page.get_by_role("img", name="One rounded pebble drawn as a closed loop.")).to_be_visible()
        self.paper_control(page, "Next").tap()
        expect(page.get_by_role("heading", name="Draw a pebble behind it")).to_be_visible()
        expect(page.get_by_role("img", name="The back pebble’s line stops", exact=False)).to_be_visible()
        page.reload()
        expect(page.get_by_role("heading", name="Draw a pebble behind it")).to_be_visible()
        self.paper_control(page, "Finish").tap()
        page.get_by_role("button", name="Try on your own").tap()
        expect(page.get_by_role("heading", name="Draw overlapping balloons")).to_be_visible()
        self.assert_model_hidden(page)
        page.get_by_role("button", name="Skip", exact=True).tap()
        expect(page.get_by_role("heading", name="You drew it!")).to_be_visible()
        self.assertEqual(page.evaluate("""() => {
            const { step, completed } = JSON.parse(localStorage.getItem('little-pencil-club/pebble-overlap'));
            return [step, Boolean(completed), localStorage.getItem('little-pencil-club/little-fox')];
        }"""), [1, True, None])

    def assert_model_hidden(self, page):
        for selector in ["#guide", "#ink", "#drawing-mode"]:
            expect(page.locator(selector)).to_be_hidden()
        expect(page.locator(".lesson-reference")).to_have_count(0)
        expect(page.get_by_role("button", name="Replay", exact=True)).to_have_count(0)

    def test_leaf_observation_and_independent_transfer(self):
        page = self.page_at()
        self.open_optional_skill(page, "Look, draw, look again", "Medium")
        reference = page.get_by_role("img", name="Dark brackets mark the widest", exact=False)
        cue = page.get_by_role("img", name="Two brackets mark the leaf’s widest span.")
        expect(page.get_by_role("heading", name="Find the widest spot")).to_be_visible()
        expect(reference).to_be_visible()
        expect(cue).to_be_visible()
        self.paper_control(page, "Next").tap()
        expect(page.get_by_text("Look back at the leaf before drawing its outside edge.")).to_be_visible()
        expect(reference).to_be_visible()
        expect(page.get_by_role("img", name="One continuous line", exact=False)).to_be_visible()
        page.locator("#drawing-mode").select_option("copy")
        expect(reference).to_be_visible()
        expect(page.locator("#ink")).to_be_visible()
        page.locator("#drawing-mode").select_option("paper")
        self.paper_control(page, "Next").tap()
        expect(page.get_by_role("heading", name="Add one detail")).to_be_visible()
        expect(reference).to_be_visible()
        self.paper_control(page, "Back").tap()
        expect(reference).to_be_visible()
        self.paper_control(page, "Next").tap()
        self.paper_control(page, "Finish").tap()
        expect(reference).to_be_hidden()
        page.get_by_role("button", name="Try on your own").tap()
        expect(page.get_by_role("heading", name="Sketch a nearby object")).to_be_visible()
        expect(page.locator(".step-text")).to_have_text("Keep the object in view while you sketch it.")
        self.assert_model_hidden(page)
        page.reload()
        self.assert_model_hidden(page)
        page.get_by_role("button", name="Done", exact=True).tap()
        expect(page.get_by_role("heading", name="You drew it!")).to_be_visible()

    def test_leaf_reference_and_demo_fit(self):
        for width, height in [(320, 568), (375, 550), (390, 664), (568, 320), (820, 1180), (1180, 820)]:
            with self.subTest(width=width, height=height):
                page = self.page_at(width, height)
                self.open_optional_skill(page, "Look, draw, look again", "Medium")
                self.paper_control(page, "Next").tap()
                page.evaluate("window.scrollTo(0, 0)")
                self.assert_no_overflow(page, width)
                image = page.locator(".lesson-reference img")
                guide = page.locator("#guide")
                expect(image).to_be_in_viewport(ratio=.98)
                expect(guide).to_be_in_viewport(ratio=.98)
                for label in ["Back", "Replay", "Next"]:
                    control = self.paper_control(page, label)
                    expect(control).to_be_in_viewport(ratio=1)
                reference_box, guide_box = image.bounding_box(), guide.bounding_box()
                self.assertGreaterEqual(reference_box["height"], 72)
                self.assertGreaterEqual(guide_box["height"], 72)
                if width <= 520 and height > 630:
                    self.assertLessEqual(reference_box["y"] + reference_box["height"], guide_box["y"])
                else:
                    self.assertLessEqual(reference_box["x"] + reference_box["width"], guide_box["x"])

    def test_leaf_replay_holds_finished_edge(self):
        page = self.page_at(1180, 820, touch=False, still=False)
        self.open_optional_skill(page, "Look, draw, look again", "Medium")
        self.paper_control(page, "Next").click()
        reference = page.locator(".lesson-reference img")
        guide = page.locator("#guide")
        page.wait_for_function("session.progress === 1")
        held = guide.evaluate("(canvas) => canvas.toDataURL()")
        replay = self.paper_control(page, "Replay")
        replay.press("Enter")
        page.wait_for_function("session.progress > 0 && session.progress < .5")
        self.assertNotEqual(held, guide.evaluate("(canvas) => canvas.toDataURL()"))
        expect(reference).to_be_visible()
        page.wait_for_function("session.progress === 1")
        self.assertEqual(held, guide.evaluate("(canvas) => canvas.toDataURL()"))

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
        for width, height, touch in [
            (320, 568, True), (375, 550, True), (390, 664, True), (430, 932, True),
            (568, 320, True), (730, 360, True), (731, 360, True), (812, 375, True),
            (932, 430, True), (744, 1133, True), (1133, 744, True),
            (820, 1180, True), (1180, 820, True), (1024, 1366, True), (1366, 1024, True),
            (1440, 900, False),
        ]:
            with self.subTest(width=width, height=height):
                page = self.page_at(width, height, touch=touch)
                self.assert_no_overflow(page, width)
                self.open_fox(page, touch=touch)
                for _ in range(5):
                    self.assert_paper_layout(page, width, height, ["Back", "Replay", "Next"])
                    self.press_paper_control(page, "Next", touch)
                expect(page.get_by_role("heading", name="Pick a tail pattern")).to_be_visible()
                self.assert_paper_layout(page, width, height, ["Back", "Replay", "Finish", "Skip"])
                self.press_paper_control(page, "Finish", touch)
                expect(page.get_by_role("heading", name="You drew it!")).to_be_visible()
                page.get_by_role("link", name="Lessons", exact=True).click()
                self.open_basics(page, touch=touch)
                self.assert_paper_layout(page, width, height, ["Back", "Replay", "Finish", "Skip"])
                self.press_paper_control(page, "Skip", touch)
                expect(page.get_by_role("heading", name="You drew it!")).to_be_visible()

    def press_paper_control(self, page, name, touch):
        # Coordinate input exercises the visible hit target without scrolling it into view.
        button = self.paper_control(page, name).bounding_box()
        x, y = button["x"] + button["width"] / 2, button["y"] + button["height"] / 2
        if touch:
            page.touchscreen.tap(x, y)
        else:
            page.mouse.click(x, y)

    def assert_no_overflow(self, page, width):
        self.assertLessEqual(page.evaluate("document.documentElement.scrollWidth"), width)

    def assert_paper_layout(self, page, width, height, controls):
        page.evaluate("window.scrollTo(0, 0)")
        self.assert_no_overflow(page, width)
        guide = page.locator("#guide").bounding_box()
        self.assertGreaterEqual(guide["height"], 115)
        for name in controls:
            control = self.paper_control(page, name)
            button = control.bounding_box()
            self.assertGreaterEqual(button["height"], 44)
            self.assertGreaterEqual(button["width"], 44)
            self.assertGreaterEqual(button["y"], guide["y"] + guide["height"] - 1)
            self.assertLessEqual(button["y"] + button["height"], height)
            if control.is_enabled():
                self.assertTrue(control.evaluate("""button => {
                    const bounds = button.getBoundingClientRect();
                    const hit = document.elementFromPoint(
                        bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
                    return button.contains(hit);
                }"""), f"{name} must be hittable without scrolling")

    def test_sketchbook_paints_distant_thumbnail_when_scrolled_into_view(self):
        page = self.page_at(width=390, height=844)
        last_id = page.evaluate("""() => {
            for (const lesson of lessons) {
              localStorage.setItem('little-pencil-club/' + lesson.id, JSON.stringify({
                strokes: [{ tool: 'pencil', points: [[200, 200, 60], [700, 420, 80]] }]
              }));
            }
            return lessons.at(-1).id;
        }""")
        page.get_by_role("navigation").get_by_role("link", name="Sketchbook").tap()
        page.reload()
        visible = page.locator('canvas[data-ink]').first
        distant = page.locator(f'canvas[data-lesson="{last_id}"][data-ink]')
        page.wait_for_function(THUMBNAIL_HAS_INK, arg=visible.element_handle())
        self.assertFalse(distant.evaluate(THUMBNAIL_HAS_INK))
        distant.scroll_into_view_if_needed()
        page.wait_for_function(THUMBNAIL_HAS_INK, arg=distant.element_handle())

    def test_another_tabs_mode_change_preserves_finished_checkmark(self):
        first = self.page_at()
        second = first.context.new_page()
        self.addCleanup(second.close)
        second.goto(self.url + "/#draw/pencil-basics")
        expect(second.get_by_role("heading", name="Try light and dark")).to_be_visible()
        self.open_basics(first)
        self.paper_control(first, "Finish").tap()
        expect(first.get_by_role("heading", name="You drew it!")).to_be_visible()

        second.locator("#drawing-mode").select_option("copy")
        second.get_by_role("navigation").get_by_role("link", name="Sketchbook").tap()
        second.reload()
        expect(second.get_by_role("link", name="Pencil Basics Lesson finished")).to_be_visible()
        second.get_by_role("link", name="Pencil Basics Lesson finished").tap()
        expect(second.get_by_role("heading", name="You drew it!")).to_be_visible()
        expect(second.locator("#drawing-mode")).to_have_value("copy")

    def test_sketchbook_file_transfer_wiggle_and_png(self):
        from json import loads

        source = self.page_at()
        self.open_basics(source)
        self.paper_control(source, "Finish").tap()
        source.get_by_role("link", name="Sketchbook", exact=True).first.tap()
        source.get_by_text("Move lesson progress", exact=True).tap()
        with source.expect_download() as exported:
            source.get_by_role("button", name="Save progress file").tap()
        progress = exported.value.path().read_bytes()
        self.assertEqual(loads(progress), {
            "format": "little-pencil-club-progress", "version": 1, "completed": ["pencil-basics"],
        })

        target = self.page_at(width=320, height=568, still=False)
        self.open_basics(target)
        target.locator("#drawing-mode").select_option("copy")
        ink = target.locator("#ink")
        ink.scroll_into_view_if_needed()
        bounds = ink.bounding_box()
        target.mouse.move(bounds["x"] + 25, bounds["y"] + 25)
        target.mouse.down()
        target.mouse.move(bounds["x"] + 68, bounds["y"] + 74, steps=5)
        target.mouse.up()
        before = target.evaluate("localStorage.getItem('little-pencil-club/pencil-basics')")
        self.assertTrue(loads(before)["strokes"])
        target.get_by_role("navigation").get_by_role("link", name="Sketchbook").tap()
        target.get_by_text("Move lesson progress", exact=True).tap()
        picker = target.locator('.progress-files input[type="file"]')
        picker.set_input_files({"name": "bad.json", "mimeType": "application/json", "buffer": b"{}"})
        expect(target.locator(".import-status")).to_contain_text("Choose a progress file")
        file = {"name": "progress.json", "mimeType": "application/json", "buffer": progress}
        picker.set_input_files(file)
        expect(target.locator(".import-status")).to_have_text("1 checkmark added.")
        picker.set_input_files(file)
        expect(target.locator(".import-status")).to_have_text("0 checkmarks added.")
        target.reload()
        expect(target.get_by_text("Finished drawing", exact=True)).to_be_visible()
        card = target.locator(".ink-card")
        canvas = card.locator("canvas")
        canvas.scroll_into_view_if_needed()
        target.wait_for_function(THUMBNAIL_HAS_INK, arg=canvas.element_handle())
        png_before = canvas.evaluate("c => c.toDataURL()")
        wiggle = card.get_by_role("button", name="Wiggle", exact=False)
        wiggle.tap()
        self.assertTrue(canvas.evaluate("c => c.getAnimations().length > 0"))
        target.emulate_media(reduced_motion="reduce")
        wiggle.tap()
        expect(canvas).to_have_class("picture-canvas still-tilt")
        self.assertEqual(canvas.evaluate("c => c.toDataURL()"), png_before)
        with target.expect_download() as drawing:
            card.get_by_role("button", name="Save", exact=False).tap()
        self.assertEqual(drawing.value.suggested_filename, "pencil-basics-sketch.png")
        self.assertEqual(drawing.value.path().read_bytes()[:8], b"\x89PNG\r\n\x1a\n")
        self.assertEqual(target.evaluate("localStorage.getItem('little-pencil-club/pencil-basics')"), before)

    def test_completion_feedback_distinguishes_unsaved_ink(self):
        page = self.page_at(touch=False)
        self.open_basics(page, touch=False)
        page.get_by_label("Drawing mode").select_option("copy")
        page.evaluate("""() => {
          const set = Storage.prototype.setItem;
          Storage.prototype.setItem = function (key, value) {
            if (key === 'little-pencil-club/pencil-basics')
              throw new DOMException('Synthetic quota limit', 'QuotaExceededError');
            return set.call(this, key, value);
          };
        }""")
        ink = page.locator("#ink")
        ink.scroll_into_view_if_needed()
        bounds = ink.bounding_box()
        page.mouse.move(bounds["x"] + 20, bounds["y"] + 20)
        page.mouse.down()
        page.mouse.move(bounds["x"] + 65, bounds["y"] + 55, steps=4)
        page.mouse.up()
        page.get_by_role("button", name="Finish", exact=True).click()
        expect(page.locator("#finish-message")).to_contain_text("Save a PNG")
        reopened = page.context.new_page()
        reopened.goto(self.url + "/#sketchbook")
        expect(reopened.get_by_role("link", name="Pencil Basics Lesson finished")).to_be_visible()
        expect(reopened.get_by_role("button", name="Save your Pencil Basics drawing as a PNG")).to_have_count(0)

    def defer_progress_reads(self, page):
        from json import dumps

        page.evaluate("""() => {
            const read = File.prototype.text;
            window.progressReads = new Map();
            File.prototype.text = function() {
                return new Promise(resolve => {
                    window.progressReads.set(this.name, () => resolve(read.call(this)));
                });
            };
        }""")

        def select(lesson):
            name = lesson + ".json"
            content = dumps({
                "format": "little-pencil-club-progress", "version": 1, "completed": [lesson],
            }).encode()
            page.locator('.progress-files input').set_input_files({
                "name": name, "mimeType": "application/json", "buffer": content,
            })
            page.wait_for_function("name => window.progressReads.has(name)", arg=name)

        def finish(lesson):
            page.evaluate("name => window.progressReads.get(name)()", lesson + ".json")
            page.wait_for_function(
                "id => localStorage.getItem('little-pencil-club/finished/' + id) === 'true'", arg=lesson
            )

        return select, finish

    def test_sketchbook_refreshes_after_progress_reads_finish_out_of_order(self):
        page = self.page_at(touch=False)
        page.locator("#nav-sketchbook").click()
        page.get_by_text("Move lesson progress", exact=True).click()
        select, finish = self.defer_progress_reads(page)
        select("little-fox")
        select("pencil-basics")
        finish("pencil-basics")
        expect(page.locator(".book-description")).to_contain_text("1 of 49")
        expect(page.locator(".import-status")).to_have_text("1 checkmark added.")
        page.locator(".progress-files summary").focus()
        finish("little-fox")
        expect(page.locator(".book-description")).to_contain_text("2 of 49")
        expect(page.locator(".card-title")).to_have_text(["Little fox", "Pencil Basics"])
        expect(page.locator(".progress-files summary")).to_be_focused()
        expect(page.locator(".import-status")).to_have_text("1 checkmark added.")

    def test_progress_read_keeps_navigation_and_refreshes_a_reopened_sketchbook(self):
        page = self.page_at(width=320, height=568, touch=False)
        page.evaluate("""() => {
            const fixtures = lessons.filter(item => !['little-fox', 'pencil-basics'].includes(item.id)).slice(0, 8);
            for (const lesson of fixtures) localStorage.setItem('little-pencil-club/finished/' + lesson.id, 'true');
        }""")
        page.reload()
        page.locator("#nav-sketchbook").click()
        page.get_by_text("Move lesson progress", exact=True).click()
        select, finish = self.defer_progress_reads(page)
        select("pencil-basics")
        page.locator("#nav-lessons").click()
        self.open_fox(page, touch=False)
        finish("pencil-basics")
        expect(page.get_by_role("heading", name="Sketch the head")).to_be_visible()
        expect(page).to_have_url(self.url + "/#draw/little-fox")

        page.locator("#nav-sketchbook").click()
        expect(page.locator(".book-description")).to_contain_text("9 of 49")
        page.get_by_text("Move lesson progress", exact=True).click()
        select("little-fox")
        page.locator("#nav-lessons").click()
        page.locator("#nav-sketchbook").click()
        expect(page.locator(".book-description")).to_contain_text("9 of 49")
        card = page.locator(".lesson-card").filter(has_text="Pencil Basics")
        card.focus()
        page.evaluate("window.scrollTo({top: 130, behavior: 'instant'})")
        top = page.evaluate("window.scrollY")
        self.assertGreater(top, 0)
        finish("little-fox")
        expect(page.locator(".book-description")).to_contain_text("10 of 49")
        expect(card).to_be_focused()
        self.assertEqual(page.evaluate("window.scrollY"), top)
        self.assertFalse(page.locator(".progress-files").evaluate("element => element.open"))
