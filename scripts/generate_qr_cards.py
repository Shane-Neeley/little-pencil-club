#!/usr/bin/env python3
"""Make nine Little Pencil Club QR cards and an optional offline exercise."""

import argparse
from pathlib import Path
from urllib.parse import urlsplit

import qrcode
from qrcode.exceptions import DataOverflowError
from reportlab.lib.colors import Color, black, white
from reportlab.lib.pagesizes import letter
from reportlab.pdfbase.pdfmetrics import registerFont, stringWidth
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen.canvas import Canvas
from svglib.svglib import svg2rlg


SITE_URL = "https://little-pencil-club.fort-rock.chatgpt.site/"
LOGO = Path(__file__).resolve().parent.parent / "dist" / "logo.svg"
QR_SIZE = 113
TRIM_MARGIN = 27
PRINT_NOTE_HEIGHT = 18
CARDS_PER_SIDE = 3
FONT = "Bitstream Vera Sans"
BOLD = "Bitstream Vera Sans Bold"


def site_address(value):
    if any(character.isspace() or ord(character) < 32 for character in value) or "\\" in value:
        raise argparse.ArgumentTypeError("use an HTTP or HTTPS URL without spaces")
    try:
        parts = urlsplit(value)
        port = parts.port
    except ValueError as error:
        raise argparse.ArgumentTypeError("enter a valid site URL") from error
    if (
        parts.scheme not in {"http", "https"}
        or not parts.hostname
        or parts.username is not None
        or parts.password is not None
        or port == 0
    ):
        raise argparse.ArgumentTypeError("enter an HTTP or HTTPS site URL without credentials")
    return value


def qr_matrix(url):
    code = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_M, border=4)
    code.add_data(url)
    code.make(fit=True)
    matrix = code.get_matrix()
    if QR_SIZE / len(matrix) < 1.6:
        raise ValueError("use a shorter URL so the QR codes stay large enough to print")
    return matrix


def draw_qr(pdf, matrix, x, y):
    module = QR_SIZE / len(matrix)
    pdf.setFillColor(white)
    pdf.rect(x, y, QR_SIZE, QR_SIZE, fill=1, stroke=0)
    pdf.setFillColor(black)
    squares = pdf.beginPath()
    for index, row in enumerate(reversed(matrix)):
        start = None
        for column, dark in enumerate([*row, False]):
            if dark and start is None:
                start = column
            elif not dark and start is not None:
                squares.rect(x + start * module, y + index * module, (column - start) * module, module)
                start = None
    pdf.drawPath(squares, fill=1, stroke=0)


def grayscale(color):
    level = 0.2126 * color.red + 0.7152 * color.green + 0.0722 * color.blue
    return Color(level, level, level, color.alpha)


def draw_logo(pdf, logo, x, y):
    size = 28
    pdf.saveState()
    pdf.translate(x, y)
    scale = size / max(logo.width, logo.height)
    pdf.scale(scale, scale)
    logo.drawOn(pdf, 0, 0)
    pdf.restoreState()


def draw_card(pdf, x, y, width, height, matrix, url, logo):
    center = x + width / 2
    brand = "Little Pencil Club"
    brand_width = stringWidth(brand, BOLD, 12)
    brand_x = center - (brand_width + 33) / 2
    draw_logo(pdf, logo, brand_x, y + height - 43)
    pdf.setFillColor(black)
    pdf.setFont(BOLD, 12)
    pdf.drawString(brand_x + 33, y + height - 34, brand)
    pdf.setFont(BOLD, 18)
    pdf.drawCentredString(center, y + 181, "Draw with me!")

    qr_x = center - QR_SIZE / 2
    qr_y = y + 54
    draw_qr(pdf, matrix, qr_x, qr_y)
    pdf.linkURL(url, (qr_x, qr_y, qr_x + QR_SIZE, qr_y + QR_SIZE))

    pdf.setFont(BOLD, 9)
    pdf.drawCentredString(center, y + 42, "Open Camera and tap the link")
    address_scale = 87
    address_width = stringWidth(url, FONT, 8.5) * address_scale / 100
    if address_width <= width - 16:
        pdf.setFont(BOLD, 8)
        pdf.drawCentredString(center, y + 27, "Or type in Safari")
        address = pdf.beginText(center - address_width / 2, y + 14)
        address.setFont(FONT, 8.5)
        address.setHorizScale(address_scale)
        address.textOut(url)
        pdf.drawText(address)
        pdf.linkURL(url, (center - address_width / 2, y + 11, center + address_width / 2, y + 23))


def draw_cut_lines(pdf, card_width, card_height):
    pdf.saveState()
    pdf.setStrokeGray(0.44)
    pdf.setLineWidth(0.8)
    pdf.setLineCap(1)
    pdf.setDash([0.35, 3.5])
    left = bottom = TRIM_MARGIN
    right = left + CARDS_PER_SIDE * card_width
    top = bottom + CARDS_PER_SIDE * card_height
    for index in range(CARDS_PER_SIDE + 1):
        x = left + index * card_width
        y = bottom + index * card_height
        pdf.line(x, bottom, x, top)
        pdf.line(left, y, right, y)
    pdf.restoreState()


def write_cards(output, url, matrix, logo):
    pdf = Canvas(str(output), pagesize=letter, invariant=True, initialFontName=FONT)
    pdf.setTitle("Little Pencil Club - Print-and-cut QR cards")
    pdf.setAuthor("Little Pencil Club")
    page_width, page_height = letter
    card_width = (page_width - 2 * TRIM_MARGIN) / CARDS_PER_SIDE
    card_height = (page_height - 2 * TRIM_MARGIN - PRINT_NOTE_HEIGHT) / CARDS_PER_SIDE
    for index in range(CARDS_PER_SIDE ** 2):
        row, column = divmod(index, CARDS_PER_SIDE)
        x = TRIM_MARGIN + column * card_width
        y = page_height - TRIM_MARGIN - PRINT_NOTE_HEIGHT - (row + 1) * card_height
        draw_card(pdf, x, y, card_width, card_height, matrix, url, logo)
    draw_cut_lines(pdf, card_width, card_height)
    pdf.setFillColor(black)
    pdf.setFont(FONT, 10)
    pdf.drawCentredString(
        page_width / 2, page_height - TRIM_MARGIN - 4,
        "Print at actual size (100%). Cut along the dotted lines.",
    )
    pdf.showPage()
    pdf.save()


def draw_pencil_marks(pdf, x, y, gray, weight):
    pdf.setStrokeGray(gray)
    pdf.setLineWidth(weight)
    pdf.setLineCap(1)
    for offset in (0, 15, 30):
        pdf.line(x + offset, y, x + offset + 18, y + 24)


def write_exercise(output):
    pdf = Canvas(str(output), pagesize=letter, invariant=True, initialFontName=FONT)
    pdf.setTitle("Little Pencil Club - Light and dark pencil practice")
    pdf.setAuthor("Little Pencil Club")
    pdf.setFillColor(black)
    pdf.setFont(BOLD, 12)
    pdf.drawString(48, 738, "Little Pencil Club")
    pdf.setFont(BOLD, 36)
    pdf.drawString(48, 690, "Light and dark")
    pdf.setFont(FONT, 16)
    pdf.drawString(48, 650, "Press lightly for a pale mark. Press a bit harder for a dark mark.")
    pdf.drawString(48, 623, "Try both with your pencil.")

    for x, label, gray, weight in ((48, "Light", 0.48, 1.3), (318, "Dark", 0, 3)):
        pdf.setStrokeGray(0.5)
        pdf.setLineWidth(0.75)
        pdf.roundRect(x, 447, 246, 152, 9, fill=0)
        pdf.setFont(BOLD, 18)
        pdf.drawString(x + 18, 569, label)
        draw_pencil_marks(pdf, x + 20, 517, gray, weight)

    pdf.setFont(BOLD, 24)
    pdf.drawString(48, 391, "Draw a leaf")
    pdf.setFont(FONT, 16)
    pdf.drawString(48, 362, "Add light marks on one side and dark marks on the other.")

    pdf.setStrokeColor(black)
    pdf.setLineWidth(1.8)
    leaf = pdf.beginPath()
    leaf.moveTo(53, 122)
    leaf.curveTo(43, 238, 100, 272, 223, 291)
    leaf.curveTo(228, 198, 155, 119, 53, 122)
    leaf.close()
    pdf.drawPath(leaf)
    pdf.line(44, 109, 223, 291)
    draw_pencil_marks(pdf, 87, 207, 0.48, 1.3)
    draw_pencil_marks(pdf, 130, 162, 0, 3)

    pdf.setStrokeGray(0.5)
    pdf.setLineWidth(0.75)
    pdf.roundRect(258, 94, 306, 235, 9, fill=0)
    pdf.showPage()
    pdf.save()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--url", type=site_address, default=SITE_URL,
        help="published URL for a fork (omit for the school handout)",
    )
    parser.add_argument("--output", type=Path, default=Path("little-pencil-club-qr-cards.pdf"), help="output PDF path")
    parser.add_argument("--fallback-output", type=Path, help="optional one-page offline exercise PDF path")
    args = parser.parse_args()
    if args.output.suffix.lower() != ".pdf":
        parser.error("--output must end in .pdf")
    if args.fallback_output:
        if args.fallback_output.suffix.lower() != ".pdf":
            parser.error("--fallback-output must end in .pdf")
        if args.fallback_output.resolve() == args.output.resolve():
            parser.error("--fallback-output must differ from --output")
    if not LOGO.is_file():
        parser.error(f"missing logo asset: {LOGO}")

    try:
        registerFont(TTFont(FONT, "Vera.ttf"))
        registerFont(TTFont(BOLD, "VeraBd.ttf"))
        matrix = qr_matrix(args.url)
        logo = svg2rlg(str(LOGO), color_converter=grayscale)
        if logo is None or min(logo.width, logo.height) <= 0:
            parser.error("dist/logo.svg must contain a nonempty SVG logo")
        write_cards(args.output, args.url, matrix, logo)
        if args.fallback_output:
            write_exercise(args.fallback_output)
    except (DataOverflowError, ValueError, OSError) as error:
        parser.error(str(error) or "unable to write QR cards for this URL")
    print(f"Wrote nine printable QR cards to {args.output}")
    if args.fallback_output:
        print(f"Wrote a one-page pencil exercise to {args.fallback_output}")


if __name__ == "__main__":
    main()
