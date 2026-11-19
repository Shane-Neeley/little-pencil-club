# Little Pencil Club

[Open Little Pencil Club](https://little-pencil-club.fort-rock.chatgpt.site/) in Safari on iPad or in a modern desktop or mobile browser. Start with **Little fox**, or choose from 20 lessons in Animals, Food, Fashion, Nature, Things, and Fantasy.

- Lessons open in **Paper** mode with a large example to follow in a real sketchbook. Choose **Trace** for a faint guide on the canvas or **Copy** for a blank canvas alongside the demonstration.
- Tap the demonstration to replay the latest strokes. Open **Pencil tip** for help with technique.
- Use Apple Pencil, a finger, or a mouse. Turn on **Pencil only** below the canvas if you prefer to draw with the stylus while resting your hand on the screen.
- Finish a lesson to unlock a remix idea. Find your work in **Sketchbook**, and use **Save** to download a PNG you can keep.

Progress and drawings live in this browser's local storage. Clearing site data removes them. The game uses no accounts, tracking, or API calls.

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
