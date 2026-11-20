# Paper photo prototype

[Issue #10](https://github.com/Shane-Neeley/little-pencil-club/issues/10) explores keeping a paper drawing in the browser after drawing. This prototype can run on its own or in an opt-in local fork. Use loopback and synthetic artwork for testing. The ordinary `dist/` package remains the teen and adult drawing game.

## Run the standalone editor

Start the loopback server from the repository root.

```sh
python3 -m http.server 8732 --bind 127.0.0.1 --directory prototypes/paper-photo
```

Open `http://127.0.0.1:8732/` on the same machine. Keep using the same address and browser profile to see the saved copy after reopening. The page uses its three static files from the local server and works without internet access.

- **Take a photo** asks the device’s file input for its rear-facing camera. **Choose a photo** opens the regular picker when Camera is unavailable or declined. Use a locally available synthetic image for testing.
- Drag the corners to crop. The clear part of the preview shows what will be kept. When a corner has keyboard focus, use the arrow keys or hold Shift for a larger move. Canceling a crop or dismissing a picker leaves the saved drawing in place.
- Use **Save here** to keep the crop in IndexedDB. **Download PNG** exports a separate copy. **Delete saved drawing** clears the browser copy after confirmation. Clearing this browser’s site data also clears the browser copy. Original photos in Photos or Files and separately downloaded PNGs remain outside the app’s deletion controls. An already-open tab may show a stale preview after a change in another tab until it reloads.

## Build a local Sketchbook fork

Run this from the repository root. The builder copies the current game into a new output directory and adds **Sketchbook → Keep a paper drawing** to that copy.

```sh
fork_dir="$(mktemp -d)/little-pencil-photo-fork"
python3 prototypes/paper-photo/build_fork.py "$fork_dir"
python3 -m http.server 8732 --bind 127.0.0.1 --directory "$fork_dir"
```

Open `http://127.0.0.1:8732/` and choose **Sketchbook → Keep a paper drawing**. Use **Back to Sketchbook** to return to your lessons. Keep using the same browser address and profile to see a saved crop after reopening.

The builder leaves `dist/` and its Sites configuration unchanged. Its separate output is a local fork for synthetic testing. A future hosted photo release needs explicit authorization for the target host and package. Verify the actual device checks below and confirm the proposed package keeps the photo local with no upload, analytics, AI, gallery, or backup routes.

## Local limits

The input size limit is 20 MiB. JPEG, PNG, WebP and HEIF are accepted when the browser can decode them. If a browser cannot open a photo, choose a JPEG or PNG copy. The prototype rejects images above 32 megapixels, including a pre-decode size check for PNGs. A temporary preview is at most 2048 pixels on its longest side.

Each save encodes new PNG pixels from the crop, so the original file, its filename and its source metadata are excluded. The browser holds one crop of up to 1600 pixels on its longest side and 3 MiB. Saving another crop replaces that copy. The page uses no upload route, analytics, AI, account or cloud storage. Its Content Security Policy blocks outgoing fetches and form submissions.

## Browser checks

The test runner creates synthetic inputs and serves the ordinary game and the generated photo fork on loopback. Install Playwright with its WebKit and Chromium browsers to run the tests.

```sh
python3 -m pip install playwright
python3 -m playwright install webkit chromium
python3 prototypes/paper-photo/test_paper_photo.py -v
PAPER_PHOTO_BROWSER=chromium python3 prototypes/paper-photo/test_paper_photo.py -v
```

The browser suite uses iPad Pro 11 portrait (834 × 1194) and landscape (1194 × 834) profiles with synthetic PNG and JPEG inputs. It intercepts file choosers and blocks HTTP requests between known local page loads. It checks that the ordinary static package has no photo entry and that the optional Sketchbook round trip preserves lesson progress on iPad- and iPhone-sized profiles. It checks invalid and empty selection, canceled retake, crop pixels, output bounds, metadata removal, local save and replacement, reopening, PNG export, and deletion.

For a real iPad check, use a test device and synthetic artwork. Verify the native rear-camera chooser, a declined or canceled capture followed by the regular picker, photo orientation and HEIF decoding, touch cropping in both orientations, and opening the exported PNG in Files. Check that reopening restores the browser copy and deleting it leaves any separately exported file intact.
