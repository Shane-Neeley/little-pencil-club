# Little Pencil Club engineering experiment

Three independent passes used `0b92cac` as the baseline. They measured Sketchbook rendering, compared retained progress with a seeded reference model, and traced file reads across navigation. The checks use synthetic artwork and local browser storage. This trial contributes browser evidence for the [existing cross-device and progress checks](../ROADMAP.md#next-if-the-first-pilot-is-useful).

## Draw thumbnails when they are needed

Sketchbook now uses the library’s viewport observer to paint previews as learners approach them. The local Chrome benchmark used 11 samples per combination on an Apple M4. The 24- and 49-sketch fixtures contained eight strokes of 96 points each, including erasing and pressure. The six-sketch fixture used three strokes per sketch.

| Sketches | Phone navigation work | Desktop navigation work |
| ---: | ---: | ---: |
| 6 | 2.8 → 1.1 ms | 2.5 → 1.2 ms |
| 24 | 12.8 → 1.3 ms | 12.7 → 1.3 ms |
| 49 | 25.7 → 2.1 ms | 25.2 → 2.1 ms |

At 49 sketches, thumbnail paint work over the first four browser frames fell from 42.7 to 7.6 ms on the phone viewport and from 41.9 to 11.2 ms on desktop. All initially visible previews painted within that sampled window. All 98 scrolled-to thumbnail PNG hashes and dimensions matched. The timing measures local route and rendering work. Physical iPad behavior and input-to-screen latency were outside the measurement.

## Retain progress across saves and imports

- A stale tab changing drawing mode erased a lesson completion from a different tab. New finishes record a separate checkmark using the existing progress-file marker. The checkmark survived a fresh tab and a full Chromium restart on the same synthetic profile. Concurrent changes to drawing strokes still use the existing whole-record save.
- When storage accepted the checkmark but rejected the drawing, the old finish screen could claim the drawing was in Sketchbook. The finish screen now distinguishes the retained checkmark from a drawing that should be downloaded as a PNG. Five injected storage scenarios passed, including partial import and retry in a separate check.
- Two imports could both persist while one stayed missing from the open Sketchbook. Late reads now refresh the active book and retain its scroll, focus, and file controls when the initiating panel has been replaced. A read finishing during a lesson leaves that lesson open.

The seeded browser simulation matched an independent progress model for 57 commands across three seeds. It exercised lesson steps, finishing, file import and export, malformed inputs, and browser reload. The product suite passed all 17 tests on Chromium and all 17 on WebKit. The local paper-photo fork passed its four WebKit tests. Browser and viewport coverage was emulated.

## Changed files and reproduction

- [app.js](../dist/app.js) limits thumbnail painting and records finish outcomes. [sketchbook.js](../dist/sketchbook.js) owns delayed import updates. [test_fox_lesson.py](../tests/test_fox_lesson.py) covers the new regressions, and the [changelog](../CHANGELOG.md) covers the learner-facing changes.
- The [benchmark](../scripts/bench-sketchbook.mjs) uses Node and local Chrome. Set `PENCIL_TEST_CHROMIUM_PATH` for another Chromium executable. The [seeded simulation](../scripts/test-progress-sequences.cjs) uses Node Playwright. Set `PENCIL_TEST_PLAYWRIGHT` to its module path if needed.

```sh
node scripts/bench-sketchbook.mjs ../little-pencil-club/dist dist
node scripts/test-progress-sequences.cjs dist
python3 -m unittest discover -s tests -v
PENCIL_TEST_BROWSER=webkit python3 -m unittest discover -s tests -v
python3 -m http.server 8479 --bind 127.0.0.1 --directory dist
```

Run from the experiment checkout and use a separate baseline checkout for the first command. The last command serves the game locally. Finish Pencil Basics to see its saved checkmark. [Open the local lesson preview](http://127.0.0.1:8479/#draw/pencil-basics).
