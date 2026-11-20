# Little Pencil Club

Paper-first drawing practice for teen and adult beginners. The hosted edition is for ages 13+ (16+ in the EU, or older where required).

[Run Little Pencil Club locally](#run-locally) and start with **Little fox**, or practice pencil pressure in **Pencil Basics**.

- Lessons open in **Paper** mode with a large animated example. Follow along on paper with **Back**, **Replay**, and **Next** below the picture.
- For drawing on screen, choose **Trace on screen** or **Blank canvas** in the mode menu. Open **Pencil tip** for detailed help.
- Use Apple Pencil, a finger, or a mouse. Turn on **Pencil only** below the canvas if you prefer to draw with the stylus while resting your hand on the screen.
- Finish a lesson to unlock a remix idea. Find your work in **Sketchbook**, and use **Save** to download a PNG you can keep.

Progress and drawings live in this browser's local storage. Clearing site data removes them. The game uses no accounts, tracking, or API calls.

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
