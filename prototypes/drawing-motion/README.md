# Drawing motion prototype

Open `index.html` directly in a browser. Wiggle and Bounce animate the same synthetic jellyfish PNG for one 1.44-second run after Play or Replay. Stop restores the still. Save still PNG downloads the original bytes. With reduced motion, Play shows three static poses in order and leaves the original in place.

`attachDrawingMotion(root)` uses the labeled controls and the source image inside `root`. It changes only the display transform and returns a cleanup function. For Sketchbook integration, supply the approved local crop URL as the image source and the still-download target, then call cleanup before replacing that card or releasing its local URL.

## Private synthetic comparison

Run `node prototypes/drawing-motion/lab/server.mjs` and open the loopback address it prints. The standard prototype has no connection to this lab. The lab uses the checked-in synthetic fixture and mock responses. It accepts no user images and makes no provider requests.

| Path | What the prototype verifies | Trade-off |
| --- | --- | --- |
| **Luna Decisions** | Builds an image-input `gpt-6-luna` choice on `POST /v1/decisions`. It accepts only `wiggle` or `bounce` and selects the radio. The tester presses Play to start motion. | The original lines are preserved because animation transforms the original pixels. |
| **Image API GIF edit** | Builds an edit on `POST /v1/images/edits` with `gpt-image-2.6-flare`, GIF output, six frames and 240 ms per frame. The mock GIF is derived locally from the PNG. It plays separately on demand and can be stopped. | An actual edit could redraw details or add latency. Check recognizability against the original and inspect the resulting motion before using this path. |

[OpenAI Decisions guide](https://developers.openai.com/api/docs/guides/decisions) · [Image generation and animated GIF](https://developers.openai.com/api/docs/guides/image-generation#generate-animated-gif-output) · [Image edit reference](https://developers.openai.com/api/reference/resources/images/methods/edit)

A timeout, rejected response, invalid preset, or malformed GIF returns to the local player. Reduced motion skips mock requests, stops an active GIF, and keeps the local still-frames option. The mock can verify behavior and request shape only. It cannot measure model accuracy, image fidelity, provider latency, or account access.

A provider trial would need an explicitly approved existing project allowance covering at most three requests and zero added charges, after the separate Decisions safety trial has reserved its allowance. Confirm that the exact PNG, both endpoints, model access, and retention terms are approved. Then add a server-only transport scoped to those endpoints and the fixture, with a request cap and no retries. The prototype contains no provider transport, credential setup, or user-image input.

## Tests

With Python Playwright and a browser installed, run:

```sh
python3 -m unittest discover -s prototypes/drawing-motion -v
node --test prototypes/drawing-motion/lab/server.test.mjs
```

Set `PENCIL_TEST_BROWSER=webkit` to use WebKit, or set `PENCIL_TEST_BROWSER_PATH` to an installed executable for the selected browser. The layout checks are simulations.
