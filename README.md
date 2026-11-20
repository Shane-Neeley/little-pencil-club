# Little Pencil Club

[Run Little Pencil Club locally](#run-locally) in a modern browser. Start with **Little fox**, or choose from 32 lessons in Animals, Food, Fashion, Nature, Things, and Fantasy.

**School hosting and distribution are on hold** while a compatible host and the private classroom invitation flow are verified.

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

The game files in `dist/` use plain HTML, CSS, and JavaScript. Lesson instructions and art paths live in `dist/lessons.js`, and the same art paths drive the previews, replays, and tracing guides. To check syntax with Node.js, run:

```sh
for file in dist/*.js; do
  node --check "$file" || exit 1
done
```

The optional [paper-photo prototype](prototypes/paper-photo/README.md) runs separately on loopback for synthetic testing. It lives outside `dist/` and has no hosting setup.

## Teaching references

Simply Draw's starter fish builds from an outline to shading and patterns. ShadowDraw reveals an artist's strokes in sequence. Art for Kids Hub teaches by drawing alongside the learner. Little Pencil Club uses original lessons, silent replays, and optional tips you can open at your own pace. [Simply Draw](https://draw-help.hellosimply.com/en/articles/10258428-how-soon-will-i-get-to-draw-something) · [ShadowDraw](https://www.shadowdrawapp.com/features) · [Art for Kids Hub](https://artforkidshub.com/)

## School handout and print tools

The public drawing game is separate from the planned private classroom invitations. School distribution is on hold. The [offline pencil exercise](docs/print/pencil-practice.pdf) is available for printing.

The optional nine-card QR generator is a local tool for public forks and reserved test fixtures. It requires an explicit destination and prints no address. [School invitation status and local print instructions](docs/SCHOOL-QR-HANDOUT.md)
