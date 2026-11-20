# Little Pencil Club

[Open Little Pencil Club](https://little-pencil-club.fort-rock.chatgpt.site/) to draw on paper, trace on screen, or use a blank canvas. Progress and Sketchbook drawings stay in your browser. Use PNG export to keep a separate copy.

## Run locally

From the checkout, start a static server with Python 3 and open [the local game](http://127.0.0.1:8473/).

```sh
python3 -m http.server 8473 --bind 127.0.0.1 --directory dist
```

- [Ranked roadmap](ROADMAP.md)
- [School QR and iPad verification](https://github.com/Shane-Neeley/little-pencil-club/issues/4)
- [Synthetic classroom preview and deployment notes](docs/DEPLOYMENT.md)
- [Project issues](https://github.com/Shane-Neeley/little-pencil-club/issues)

The lessons use original art, silent replays, and optional tips. Teaching references include [Simply Draw](https://draw-help.hellosimply.com/en/articles/10258428-how-soon-will-i-get-to-draw-something), [ShadowDraw](https://shadowdrawapp.com/features), and [Art for Kids Hub](https://artforkidshub.com/).

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
