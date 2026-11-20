# School QR handout

[School QR and first-draw issue #4](https://github.com/Shane-Neeley/little-pencil-club/issues/4)

## Print and use

- [Pencil Pal cards](print/pencil-pal-cards.pdf) — nine cards on one US Letter sheet. Select **Actual size (100%)** in the print dialog and cut along the dotted lines.
- [Light and dark pencil practice](print/pencil-practice.pdf) — one black-and-white US Letter page for a blocked network. A pencil is enough to follow the examples and draw a leaf.
- On iPad, open Camera, aim at the code, and tap the link. If Camera is unavailable, type `https://little-pencil-club.fort-rock.chatgpt.site/` in Safari. Tap **Draw the little fox** and follow the first mark on paper.

## Verified on November 20, 2026

- **PDFs** — Both are one US Letter page. All nine codes decoded from a 150 dpi grayscale render to the exact public game URL printed on the cards. The nine QR links and nine text links have that same destination. Visual review confirmed the text, cut lines, and practice marks are legible in grayscale.
- **Emulated browser** — Playwright WebKit 26.5 with clean iPad Pro 11 touch profiles at 834 × 1194 and 1194 × 834. Navigation using the address extracted from the PDF returned the live game. One tap opened Paper mode and showed the first marked example, “Sketch the head.” Replay, Next, and Back worked in both orientations. A simulated camera denial did not block the route. The lesson opened without sign-in, a tour, or an Apple Pencil.
- **Paper finish** — The live build said “Little fox is in your sketchbook.” Confirm the progress-versus-physical-drawing wording again when the lesson change is available.
- **School device check pending** — Print a card at 100% and scan it using the Camera on a school-managed iPad on its normal network. Open Safari with a clean session and check the typed address with Camera disabled. Verify that a paper-and-pencil learner can reach the first example in portrait and landscape. The physical print, Camera scan, device policies, and school network still need that check.

## Regenerate and verify

Use the default public destination for the school handout. The generator’s custom URL option is for published forks.

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r scripts/requirements-qr.txt
.venv/bin/python scripts/generate_qr_cards.py \
  --output docs/print/pencil-pal-cards.pdf \
  --fallback-output docs/print/pencil-practice.pdf
```

To recheck the rendered QR payloads with Poppler and ZXing:

```sh
.venv/bin/python -m pip install zxing-cpp
pdftoppm -r 150 -gray -png -singlefile docs/print/pencil-pal-cards.pdf /tmp/pencil-pal-cards
.venv/bin/python - <<'PY'
from PIL import Image
import zxingcpp

codes = zxingcpp.read_barcodes(
    Image.open("/tmp/pencil-pal-cards.png"),
    formats=zxingcpp.BarcodeFormat.QRCode,
)
assert len(codes) == 9
assert {code.text for code in codes} == {"https://little-pencil-club.fort-rock.chatgpt.site/"}
PY
```
