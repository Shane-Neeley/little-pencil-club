# Little Pencil Club

Paper-first drawing practice for teen and adult beginners. The hosted edition is for ages 13+ (16+ in the EU, or older where required).

Start with [Little fox](https://little-pencil-club.fort-rock.chatgpt.site/#draw/little-fox), or open [Pencil Basics](https://little-pencil-club.fort-rock.chatgpt.site/#draw/pencil-basics) to practice pressure. The library has 49 lessons across seven topics. [See the 14 new sketches](docs/new-lesson-sketches.png).

- Lessons open in **Paper** mode with a large animated example. Follow along on paper with **Back**, **Replay**, and **Next** below the picture.
- For drawing on screen, choose **Trace on screen** or **Blank canvas** in the mode menu. Open **Pencil tip** for detailed help.
- Use Apple Pencil, a finger, or a mouse. Turn on **Pencil only** below the canvas if you prefer to draw with the stylus while resting your hand on the screen.
- Finish a lesson to unlock a remix idea. Find your work in **Sketchbook**, and use **Save** to download a PNG you can keep.

The five featured sketches offer a choice within the drawing, from Fox’s tail to Moon Moth’s wing markings. [Compare the two Fox drawings](docs/fox-sketch-study.png).

In Sketchbook, **Wiggle** animates a digital drawing locally. **Move lesson progress** exports a file with finished-lesson checkmarks and merges it into another browser’s Sketchbook.

Progress and drawings live in this browser's local storage. Clearing site data removes them. The game uses no accounts, tracking, or API calls.

## Run locally

With Python 3 installed, run this command from the checkout and open [the local game](http://127.0.0.1:8473/).

```sh
python3 -m http.server 8473 --bind 127.0.0.1 --directory dist
```

The game files in `dist/` use plain HTML, CSS, and JavaScript. Lesson instructions and art paths live in `dist/lessons.js` and `dist/studio-lessons.js`, and the same art paths drive the previews, replays, and tracing guides. To check syntax with Node.js, run:

```sh
for file in dist/*.js; do
  node --check "$file" || exit 1
done
```

The optional [paper-photo prototype](prototypes/paper-photo/README.md) runs separately on loopback for synthetic testing. It lives outside `dist/` and has no hosting setup.
