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

## Staged Flare transport

`lab/flare-trial.mjs` is a server-side, one-shot adapter for the repository's synthetic jellyfish. It starts disabled, has no command-line entry point, reads no credentials from the environment, and is never imported by the loopback HTTP lab or production code. The operator's approved local runner must inject its existing scoped credential and fetch. The adapter rejects any reservation other than exactly one request, consumes that attempt before dispatch, and never retries. Its per-instance guard complements the runner's durable credit reservation.

The next operator step is to verify GIF preview eligibility on the dedicated API project, confirm the selected fixture and retention terms, and reserve **one** Flare edit from the verified existing credit allocation through the approved runtime. After approval, instantiate `createFlareGifTrial` inside that runtime with `enabled: true`, `reservedRequests: 1`, and the runner's `apiKey` and `fetchImpl`, then invoke the returned function once. Keep usage or an unknown outcome in the private reservation record. On success, independently decode the GIF, verify six frames and visible motion, and compare the drawing with the original. The adapter checks GIF structure and bounds. A mocked fixture does not establish model access, visual fidelity, or safety of real artwork.

## Tests

With Python Playwright and a browser installed, run:

```sh
python3 -m unittest discover -s prototypes/drawing-motion -v
node --test prototypes/drawing-motion/lab/*.test.mjs
```

Set `PENCIL_TEST_BROWSER=webkit` to use WebKit, or set `PENCIL_TEST_BROWSER_PATH` to an installed executable for the selected browser. The layout checks are simulations.
