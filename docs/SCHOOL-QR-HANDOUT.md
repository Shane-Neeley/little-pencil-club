# School handout and QR tools

[School handout and first-draw issue #4](https://github.com/Shane-Neeley/little-pencil-club/issues/4)

## Private classroom invitations

The planned school cards are private classroom invitations. They use the QR code as the only link and are intended to open the class gallery directly, without a printed address, typing, sign-in, or a separate Join step. School distribution remains on hold while hosting and the private invitation flow are verified.

The existing public drawing game is separate. Retire the earlier public-game cards from school use. Keep live class invite URLs and printable invitation sheets out of GitHub and Library.

## Offline exercise

The [light and dark pencil practice](print/pencil-practice.pdf) is a black-and-white US Letter page that needs only a pencil. It can be regenerated on its own.

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r scripts/requirements-qr.txt
.venv/bin/python scripts/generate_qr_cards.py \
  --fallback-output docs/print/pencil-practice.pdf
```

## Optional public QR tool

The generic nine-card generator is available for public forks and local layout checks. It requires an explicit `--url` and rejects the held ChatGPT Sites test destination. The layout prints a QR code and a scan hint, with one PDF link over each code.

Use a reserved address to verify the generic layout. Keep the fixture out of distribution.

```sh
qa_dir="$(mktemp -d)"
.venv/bin/python -m pip install zxing-cpp
.venv/bin/python scripts/generate_qr_cards.py \
  --url https://example.invalid/little-pencil-club/ \
  --output "$qa_dir/qr-fixture.pdf"
pdftoppm -r 150 -gray -png -singlefile "$qa_dir/qr-fixture.pdf" "$qa_dir/qr-fixture"
.venv/bin/python - "$qa_dir/qr-fixture.png" <<'PY'
import sys

from PIL import Image
import zxingcpp

codes = zxingcpp.read_barcodes(
    Image.open(sys.argv[1]), formats=zxingcpp.BarcodeFormat.QRCode
)
assert len(codes) == 9
assert {code.text for code in codes} == {"https://example.invalid/little-pencil-club/"}
PY
```
