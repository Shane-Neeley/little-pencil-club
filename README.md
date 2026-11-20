# Little Pencil Club

[Open Little Pencil Club](https://little-pencil-club.fort-rock.chatgpt.site/) in Safari on iPad or in a modern desktop or mobile browser. Start with **Little fox**, or choose from 32 lessons in Animals, Food, Fashion, Nature, Things, and Fantasy.

- Lessons open in **Paper** mode with a large animated example. Follow along on paper with **Back**, **Replay**, and **Next** below the picture.
- For drawing on screen, choose **Trace on screen** or **Blank canvas** in the mode menu. Open **Pencil tip** for detailed help.
- Use Apple Pencil, a finger, or a mouse. Turn on **Pencil only** below the canvas if you prefer to draw with the stylus while resting your hand on the screen.
- Finish a lesson to unlock a remix idea. Find your work in **Sketchbook**, and use **Save** to download a PNG you can keep.

Progress and drawings live in this browser's local storage. Clearing site data removes them. The game uses no accounts, tracking, or API calls.

See the [ranked roadmap](ROADMAP.md) for what comes next and the [issue tracker](https://github.com/Shane-Neeley/little-pencil-club/issues) for work ready to pick up.

## Run locally

With Python 3 installed, run this command from the checkout and open [the local game](http://127.0.0.1:8473/).

```sh
python3 -m http.server 8473 --bind 127.0.0.1 --directory dist
```

The app uses plain HTML, CSS, and JavaScript. ChatGPT Sites serves `dist/` directly. Lesson instructions and art paths live in `dist/lessons.js`, and the same art paths drive the previews, replays, and tracing guides. To check syntax with Node.js, run:

```sh
for file in dist/*.js; do
  node --check "$file" || exit 1
done
```

## Teaching references

Simply Draw's starter fish builds from an outline to shading and patterns. ShadowDraw reveals an artist's strokes in sequence. Art for Kids Hub teaches by drawing alongside the learner. Little Pencil Club uses original lessons, silent replays, and optional tips you can open at your own pace. [Simply Draw](https://draw-help.hellosimply.com/en/articles/10258428-how-soon-will-i-get-to-draw-something) · [ShadowDraw](https://www.shadowdrawapp.com/features) · [Art for Kids Hub](https://artforkidshub.com/)

## Print QR cards

The generator makes one US Letter PDF with nine Pencil Pal cards and dotted cut lines. It runs locally and uses the same logo as the site.

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r scripts/requirements-qr.txt
.venv/bin/python scripts/generate_qr_cards.py --output little-pencil-club-qr-cards.pdf
```

The default QR destination is Little Pencil Club. For a fork, pass the published URL of your own site.

```sh
.venv/bin/python scripts/generate_qr_cards.py --url https://your-site.example/ --output my-qr-cards.pdf
```

Print at actual size (100%) and cut along the dotted lines.
