"""Local browser smoke tests. All photo inputs are generated synthetic images."""

from base64 import b64decode
from contextlib import contextmanager
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import os
from pathlib import Path
import random
import re
import shutil
import struct
from tempfile import TemporaryDirectory
from threading import Thread
import unittest
import zlib
from urllib.error import HTTPError
from urllib.request import urlopen

from playwright.sync_api import expect, sync_playwright


from build_fork import DIST, build_fork
PROFILES = ("iPad Pro 11", "iPad Pro 11 landscape")
PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"
SOURCE_TAG = b"SYNTHETIC_SOURCE_METADATA"
MAX_SAVED_BYTES = 3 * 1024 * 1024


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass


def chunk(kind, data):
    return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data))


def png_dimensions(png):
    assert png.startswith(PNG_SIGNATURE)
    return struct.unpack_from(">II", png, 16)


def make_png(width, height, rows):
    header = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    pixels = b"".join(b"\0" + row for row in rows)
    return (
        PNG_SIGNATURE
        + chunk(b"IHDR", header)
        + chunk(b"tEXt", b"Comment\0" + SOURCE_TAG)
        + chunk(b"IDAT", zlib.compress(pixels, level=1))
        + chunk(b"IEND", b"")
    )


def drawing():
    width, height = 2200, 1800
    border = b"\xe5\x3b\x31"
    paper = b"\xff\xf6\xe8"
    mark = b"\x55\x34\x88"
    table = border * width
    frame = border * 220
    blank = frame + paper * 1760 + frame
    stroke = frame + paper * 540 + mark * 680 + paper * 540 + frame
    rows = [table] * 180 + [blank] * 600 + [stroke] * 240 + [blank] * 600 + [table] * 180
    return make_png(width, height, rows)


def choose_photo(page, label, pixels, media_type="image/png"):
    with page.expect_file_chooser() as chooser:
        page.get_by_role("button", name=label, exact=True).tap()
    extension = media_type.split("/")[-1]
    chooser.value.set_files({"name": "synthetic-paper." + extension, "mimeType": media_type, "buffer": pixels})


def camera_fixture(page):
    data = page.evaluate("""() => {
        const canvas = document.createElement('canvas');
        canvas.width = 180;
        canvas.height = 240;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff6e8';
        ctx.fillRect(0, 0, 180, 240);
        ctx.fillStyle = '#553488';
        ctx.fillRect(48, 60, 90, 120);
        return canvas.toDataURL('image/jpeg').split(',')[1];
    }""")
    jpeg = b64decode(data)
    assert jpeg.startswith(b"\xff\xd8")
    description = SOURCE_TAG + b"\0"
    tiff = struct.pack("<2sHIH", b"II", 42, 8, 1)
    tiff += struct.pack("<HHIII", 0x010E, 2, len(description), 26, 0)
    exif = b"Exif\0\0" + tiff + description
    return jpeg[:2] + b"\xff\xe1" + struct.pack(">H", len(exif) + 2) + exif + jpeg[2:]


def stored_state(page):
    return page.evaluate("""() => new Promise((resolve, reject) => {
        const request = indexedDB.open('little-pencil-paper-photo', 1);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            const db = request.result;
            const transaction = db.transaction('drawings', 'readonly');
            const records = transaction.objectStore('drawings').getAll();
            transaction.oncomplete = () => {
                db.close();
                resolve(records.result.map(bytes => [bytes instanceof ArrayBuffer, bytes.byteLength]));
            };
            transaction.onabort = () => { db.close(); reject(transaction.error); };
        };
    })""")


def take_snapshot(page, name):
    target = os.environ.get("PAPER_PHOTO_SCREENSHOTS")
    if target:
        page.screenshot(path=Path(target) / (name + ".png"), full_page=True)


class PaperPhotoTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        temporary = TemporaryDirectory()
        cls.addClassCleanup(temporary.cleanup)
        root = Path(temporary.name)
        cls.normal = root / "normal"
        cls.fork = build_fork(root / "fork")
        shutil.copytree(DIST, cls.normal)
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), partial(QuietHandler, directory=str(root)))
        cls.server_thread = Thread(target=cls.server.serve_forever, daemon=True)
        cls.server_thread.start()
        site = f"http://127.0.0.1:{cls.server.server_port}/"
        cls.normal_url = site + "normal/"
        cls.game = site + "fork/"
        cls.base = cls.game + "paper-photo/"
        cls.playwright = sync_playwright().start()
        cls.addClassCleanup(cls.playwright.stop)
        cls.addClassCleanup(cls.server.server_close)
        cls.addClassCleanup(cls.server.shutdown)
        engine = os.environ.get("PAPER_PHOTO_BROWSER", "webkit")
        browser_type = {"webkit": cls.playwright.webkit, "chromium": cls.playwright.chromium}[engine]
        executable = os.environ.get("PAPER_PHOTO_BROWSER_EXECUTABLE")
        if not executable and engine == "webkit":
            executable = os.environ.get("PAPER_PHOTO_WEBKIT")
        cls.browser = browser_type.launch(executable_path=executable)
        print(f"{engine} {cls.browser.version}", flush=True)
        cls.addClassCleanup(cls.browser.close)

    @contextmanager
    def offline_tab(self, profile):
        context = self.browser.new_context(**self.playwright.devices[profile])
        self.addCleanup(context.close)
        requests, errors = [], []
        local_assets = {self.base, self.base + "style.css", self.base + "paper-photo.js"}
        loading_assets = False

        def block_network(route):
            if loading_assets and route.request.url in local_assets:
                route.continue_()
            else:
                route.abort()

        context.route(re.compile(r"^https?://"), block_network)
        context.add_init_script("""Object.defineProperty(navigator, 'mediaDevices', {
            value: { getUserMedia() {
                window.cameraRequests = (window.cameraRequests || 0) + 1;
                return Promise.reject(new DOMException('Simulated denial', 'NotAllowedError'));
            } }
        });""")
        page = context.new_page()
        def record_request(request):
            if request.url.startswith(("https://", "http://")):
                requests.append(request.url)

        page.on("request", record_request)
        page.on("pageerror", lambda error: errors.append(str(error)))
        def load_page():
            nonlocal loading_assets
            self.assertEqual(requests, [])
            loading_assets = True
            try:
                page.goto(self.base, wait_until="load")
                self.assertEqual(set(requests), local_assets)
            finally:
                loading_assets = False
                requests.clear()

        # WebKit's offline toggle also disables its internal Blob loader.
        # Gate HTTP traffic directly so file and Blob APIs can keep working.
        load_page()
        try:
            yield page, load_page
            self.assertEqual(errors, [])
            self.assertEqual(requests, [])
            self.assertEqual(page.evaluate("window.cameraRequests || 0"), 0)
        finally:
            context.close()

    def test_crop_save_export_reopen_delete(self):
        pixels = drawing()
        for profile in PROFILES:
            with self.subTest(profile=profile), self.offline_tab(profile) as (page, load_page):
                suffix = "landscape" if profile.endswith("landscape") else "portrait"
                crop = page.get_by_role("region", name="Crop your photo")
                saved = page.get_by_role("region", name="Your saved drawing")
                picker = page.locator("#picker")
                photo = page.locator("#photo")
                status = page.get_by_role("status")

                expect(page.locator("#capture")).to_have_attribute("capture", "environment")
                self.assertIsNone(picker.get_attribute("capture"))
                expect(page.get_by_role("button", name="Take a photo")).to_be_in_viewport()
                expect(page.get_by_role("button", name="Choose a photo")).to_be_in_viewport()
                take_snapshot(page, "chooser-" + suffix)

                picker.set_input_files([])
                expect(crop).to_be_hidden()
                choose_photo(page, "Choose a photo", b"this is an invalid image")
                expect(status).to_have_text("Choose a JPEG, PNG, WebP, or HEIF photo.")
                expect(crop).to_be_hidden()
                choose_photo(page, "Choose a photo", pixels)
                expect(crop).to_be_visible()
                expect(photo).to_have_attribute("width", "2048")
                self.assertEqual(stored_state(page), [])

                upper_left = page.get_by_role("button", name="Top left crop corner")
                lower_right = page.get_by_role("button", name="Bottom right crop corner")
                stage = page.locator("#stage")
                expect(stage).to_be_in_viewport()
                expect(page.get_by_role("button", name="Save here")).to_be_in_viewport()
                box = stage.bounding_box()
                page.mouse.move(box["x"], box["y"])
                page.mouse.down()
                page.mouse.move(box["x"] + box["width"] * .18, box["y"] + box["height"] * .18)
                page.mouse.up()
                crop_position = upper_left.get_attribute("style")
                self.assertGreater(upper_left.evaluate("handle => parseFloat(handle.style.left)"), 15)
                lower_right.press("Shift+ArrowLeft")
                lower_right.press("Shift+ArrowUp")
                lower_right.press("Shift+ArrowLeft")
                lower_right.press("Shift+ArrowUp")
                take_snapshot(page, "crop-" + suffix)

                # Cancel and a broken retake both preserve the current draft.
                page.locator("#capture").dispatch_event("cancel")
                picker.set_input_files([])
                expect(upper_left).to_have_attribute("style", crop_position)
                choose_photo(page, "Retake photo", PNG_SIGNATURE + b"bad image")
                expect(status).to_contain_text("This browser could not open that photo")
                expect(upper_left).to_have_attribute("style", crop_position)

                page.get_by_role("button", name="Save here").tap()
                expect(saved).to_be_visible()
                expect(crop).to_be_hidden()
                saved_image = page.locator("#saved-image")
                page.wait_for_function("document.querySelector('#saved-image').naturalWidth > 0")
                self.assertEqual(
                    saved_image.evaluate("""async image => {
                        await image.decode();
                        const c = document.createElement('canvas');
                        c.width = image.naturalWidth;
                        c.height = image.naturalHeight;
                        const ctx = c.getContext('2d');
                        ctx.drawImage(image, 0, 0);
                        return [...ctx.getImageData(2, 2, 1, 1).data];
                    }"""),
                    [255, 246, 232, 255],
                )
                with page.expect_download() as export:
                    page.get_by_role("link", name="Download PNG").tap()
                download = export.value
                self.assertEqual(download.suggested_filename, "paper-drawing.png")
                encoded = download.path().read_bytes()
                self.assertNotIn(SOURCE_TAG, encoded)
                self.assertLessEqual(len(encoded), MAX_SAVED_BYTES)
                self.assertGreater(max(png_dimensions(encoded)), 1200)
                self.assertLess(max(png_dimensions(encoded)), 1350)
                self.assertEqual(stored_state(page), [[True, len(encoded)]])
                take_snapshot(page, "saved-" + suffix)

                # A valid capture is only a draft. Cancel leaves the saved crop alone.
                choose_photo(page, "Take a photo", camera_fixture(page), media_type="image/jpeg")
                expect(crop).to_be_visible()
                expect(photo).to_have_attribute("height", "240")
                expect(page.get_by_role("button", name="Replace saved copy")).to_be_visible()
                page.get_by_role("button", name="Cancel", exact=True).tap()
                expect(crop).to_be_hidden()
                self.assertEqual(stored_state(page), [[True, len(encoded)]])

                # Reopening loads the three static assets from localhost again.
                load_page()
                expect(saved).to_be_visible()
                page.get_by_role("button", name="Delete saved drawing").tap()
                page.get_by_role("button", name="Keep it").tap()
                expect(saved).to_be_visible()
                page.get_by_role("button", name="Delete saved drawing").tap()
                page.get_by_role("button", name="Delete drawing", exact=True).tap()
                expect(saved).to_be_hidden()
                self.assertEqual(stored_state(page), [])
                self.assertEqual(download.path().read_bytes(), encoded)
                load_page()
                expect(saved).to_be_hidden()

    def test_sketchbook_round_trip_keeps_lesson_progress(self):
        game_assets = {self.game + path for path in (
            "", "app.js", "art.js", "coach.js", "lessons.js", "logo.svg", "style.css"
        )}
        photo_assets = {self.base + path for path in ("", "paper-photo.js", "style.css")}
        for profile in (*PROFILES, "iPhone 13"):
            with self.subTest(profile=profile):
                context = self.browser.new_context(**self.playwright.devices[profile])
                try:
                    allowed, requests, errors = set(), [], []
                    def handle_request(route):
                        if route.request.url in allowed:
                            route.continue_()
                        else:
                            route.abort()

                    context.route(re.compile(r"^https?://"), handle_request)
                    page = context.new_page()
                    page.on("request", lambda request: requests.append(request.url)
                            if request.url.startswith(("http://", "https://")) else None)
                    page.on("pageerror", lambda error: errors.append(str(error)))

                    def load(url, assets, control=None):
                        self.assertEqual(requests, [])
                        allowed.update(assets)
                        try:
                            if control is None:
                                page.goto(url, wait_until="load")
                            else:
                                with page.expect_navigation(url=url, wait_until="load"):
                                    control.tap()
                            self.assertEqual(set(requests), assets)
                        finally:
                            allowed.clear()
                            requests.clear()

                    load(self.game, game_assets)
                    photo_link = page.get_by_role("link", name="Keep a paper drawing")
                    expect(photo_link).to_have_count(0)
                    page.get_by_role("link", name="Draw the little fox").first.tap()
                    expect(page.get_by_role("heading", name="Sketch the head")).to_be_visible()
                    expect(page.locator("#drawing-mode")).to_have_value("paper")
                    expect(photo_link).to_have_count(0)
                    page.get_by_role("group", name="Paper lesson controls").get_by_role(
                        "button", name="Next", exact=True).tap()
                    expect(page.get_by_role("heading", name="Give it ears")).to_be_visible()

                    page.get_by_role("navigation", name="Main navigation").get_by_role(
                        "link", name="Sketchbook").tap()
                    expect(page.get_by_role("heading", name="Your sketchbook")).to_be_visible()
                    fox_card = page.locator('.card-grid a[href="#draw/little-fox"]')
                    expect(fox_card).to_be_visible()
                    progress = page.evaluate("Object.fromEntries(Object.entries(localStorage))")
                    self.assertTrue(progress)
                    expect(photo_link).to_be_visible()
                    load(self.base, photo_assets, photo_link)

                    choose_photo(page, "Choose a photo", camera_fixture(page), media_type="image/jpeg")
                    expect(page.get_by_role("region", name="Crop your photo")).to_be_visible()
                    page.get_by_role("button", name="Save here").tap()
                    saved = page.get_by_role("region", name="Your saved drawing")
                    expect(saved).to_be_visible()
                    with page.expect_download() as exported:
                        page.get_by_role("link", name="Download PNG").tap()
                    png = exported.value.path().read_bytes()
                    self.assertEqual(png_dimensions(png), (180, 240))
                    self.assertNotIn(SOURCE_TAG, png)
                    self.assertEqual(page.evaluate("Object.fromEntries(Object.entries(localStorage))"), progress)

                    load(self.game + "#sketchbook", game_assets, page.get_by_role(
                        "link", name="Back to Sketchbook"))
                    expect(fox_card).to_be_visible()
                    self.assertEqual(page.evaluate("Object.fromEntries(Object.entries(localStorage))"), progress)
                    load(self.base, photo_assets, photo_link)
                    expect(saved).to_be_visible()
                    page.get_by_role("button", name="Delete saved drawing").tap()
                    page.get_by_role("button", name="Delete drawing", exact=True).tap()
                    expect(saved).to_be_hidden()
                    self.assertEqual(stored_state(page), [])
                    self.assertEqual(exported.value.path().read_bytes(), png)
                    self.assertEqual(requests, [])
                    self.assertEqual(errors, [])
                finally:
                    context.close()

    def test_normal_static_package_stays_photo_free(self):
        expected = {"app.js", "art.js", "coach.js", "index.html", "lessons.js", "logo.svg", "style.css"}
        self.assertEqual({file.name for file in DIST.iterdir()}, expected)
        self.assertEqual({file.name for file in self.normal.iterdir()}, expected)
        for name in expected:
            self.assertEqual((DIST / name).read_bytes(), (self.normal / name).read_bytes())
        with urlopen(self.normal_url, timeout=3) as response:
            self.assertIn(b"Ages 13+ (16+ in the EU", response.read())
        with self.assertRaises(HTTPError) as missing:
            urlopen(self.normal_url + "paper-photo/", timeout=3)
        self.assertEqual(missing.exception.code, 404)
        self.assertNotIn("./paper-photo/", (self.normal / "app.js").read_text(encoding="utf-8"))
        self.assertEqual({file.name for file in self.fork.iterdir()}, expected | {"paper-photo"})
        self.assertEqual(
            {file.name for file in (self.fork / "paper-photo").iterdir()},
            {"index.html", "paper-photo.js", "style.css"},
        )
        with self.assertRaises(ValueError):
            build_fork(DIST / "paper-photo")
        with self.assertRaises(FileExistsError):
            build_fork(self.fork)

    def test_input_and_storage_bounds(self):
        with self.offline_tab(PROFILES[0]) as (page, _load_page):
            picker = page.locator("#picker")
            status = page.get_by_role("status")
            picker.set_input_files({
                "name": "large-file.png", "mimeType": "image/png",
                "buffer": b"x" * (20 * 1024 * 1024 + 1),
            })
            expect(status).to_have_text("Choose a photo smaller than 20 MB.")
            oversized_header = PNG_SIGNATURE + chunk(
                b"IHDR", struct.pack(">IIBBBBB", 8000, 8000, 8, 2, 0, 0, 0)
            )
            picker.set_input_files({
                "name": "large-dimensions.png", "mimeType": "image/png", "buffer": oversized_header,
            })
            expect(status).to_have_text("That photo is too large. Choose a smaller copy.")

            rng = random.Random(483)
            width = height = 1600
            pixels = make_png(width, height, (rng.randbytes(width * 3) for _ in range(height)))
            choose_photo(page, "Choose a photo", pixels)
            page.get_by_role("button", name="Save here").tap()
            expect(page.get_by_role("region", name="Your saved drawing")).to_be_visible()
            records = stored_state(page)
            self.assertEqual(len(records), 1)
            self.assertTrue(records[0][0])
            self.assertLessEqual(records[0][1], MAX_SAVED_BYTES)
            with page.expect_download() as export:
                page.get_by_role("link", name="Download PNG").tap()
            self.assertLess(max(png_dimensions(export.value.path().read_bytes())), 1600)

            jpeg = camera_fixture(page)
            self.assertIn(SOURCE_TAG, jpeg)
            choose_photo(page, "Take a photo", jpeg, media_type="image/jpeg")
            page.get_by_role("button", name="Replace saved copy").tap()
            expect(status).to_have_text("Drawing saved here.")
            with page.expect_download() as export:
                page.get_by_role("link", name="Download PNG").tap()
            encoded = export.value.path().read_bytes()
            self.assertEqual(png_dimensions(encoded), (180, 240))
            self.assertNotIn(SOURCE_TAG, encoded)
            self.assertNotIn(b"eXIf", encoded)
            self.assertEqual(stored_state(page), [[True, len(encoded)]])


if __name__ == "__main__":
    unittest.main()
