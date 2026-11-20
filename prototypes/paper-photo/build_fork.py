"""Build an opt-in local Sketchbook fork with the paper-photo prototype."""

import argparse
from pathlib import Path
import shutil

PROTOTYPE = Path(__file__).resolve().parent
DIST = PROTOTYPE.parents[1] / "dist"

BOOK_ANCHOR = (
    '    <p class="book-description">${completed} of ${lessons.length} lessons finished. '
    'Your on-screen drawings stay in this browser.</p>'
)
BOOK_ENTRY = """
    <section class="book-paper" aria-label="Paper photos">
      <a class="secondary" href="./paper-photo/">Keep a paper drawing</a>
      <p>Crop and save a photo in this browser.</p>
    </section>"""
BOOK_STYLE = """
.book-paper { display: flex; align-items: center; flex-wrap: wrap; gap: 10px 14px; margin: 0 0 22px; }
.book-paper p { margin: 0; }
"""
EDITOR_BRAND = '      <p class="brand">Little Pencil Club</p>'
EDITOR_HEADER = """      <div class="header-meta">
        <p class="brand">Little Pencil Club</p>
        <a class="button" href="../#sketchbook" aria-label="Back to Sketchbook">← Sketchbook</a>
      </div>"""
EDITOR_STYLE = """
.header-meta { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: .65rem; margin-block-end: .65rem; }
.header-meta .brand { margin-block-end: 0; }
"""


def replace_once(source, old, new):
    if source.count(old) != 1:
        raise ValueError("The fork overlay no longer matches its source. Review the template before rebuilding.")
    return source.replace(old, new, 1)


def build_fork(destination):
    destination = Path(destination).expanduser().resolve()
    if destination == DIST or DIST in destination.parents:
        raise ValueError("Choose an output location outside the normal dist directory.")
    if destination.exists():
        raise FileExistsError(f"Choose a new output directory. {destination} already exists.")
    if (DIST / "paper-photo").exists():
        raise ValueError("Expected a normal static package without a paper-photo directory.")

    app = replace_once((DIST / "app.js").read_text(encoding="utf-8"), BOOK_ANCHOR, BOOK_ANCHOR + BOOK_ENTRY)
    page = replace_once((PROTOTYPE / "index.html").read_text(encoding="utf-8"), EDITOR_BRAND, EDITOR_HEADER)
    game_style = (DIST / "style.css").read_text(encoding="utf-8") + BOOK_STYLE
    photo_style = (PROTOTYPE / "style.css").read_text(encoding="utf-8") + EDITOR_STYLE

    shutil.copytree(DIST, destination)
    (destination / "app.js").write_text(app, encoding="utf-8")
    (destination / "style.css").write_text(game_style, encoding="utf-8")
    editor = destination / "paper-photo"
    editor.mkdir()
    (editor / "index.html").write_text(page, encoding="utf-8")
    (editor / "style.css").write_text(photo_style, encoding="utf-8")
    shutil.copyfile(PROTOTYPE / "paper-photo.js", editor / "paper-photo.js")
    return destination


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("destination", type=Path, help="new output directory outside dist")
    args = parser.parse_args()
    try:
        result = build_fork(args.destination)
    except (OSError, ValueError) as error:
        parser.error(str(error))
    print(f"Built the local paper-photo fork in {result}")


if __name__ == "__main__":
    main()
