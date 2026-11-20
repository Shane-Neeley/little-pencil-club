#!/usr/bin/env python3
"""Make a one-page sheet of nine Little Pencil Club QR cards."""

import argparse
from pathlib import Path
from urllib.parse import urlsplit

import qrcode
from qrcode.exceptions import DataOverflowError
from reportlab.lib.colors import HexColor, white
from reportlab.lib.pagesizes import letter
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen.canvas import Canvas
from svglib.svglib import svg2rlg


SITE_URL = "https://little-pencil-club.fort-rock.chatgpt.site/#draw/little-fox"
LOGO = Path(__file__).resolve().parent.parent / "dist" / "logo.svg"
INK = HexColor("#2b2a3a")
MUTED = HexColor("#565267")
QR_SIZE = 113
TRIM_MARGIN = 27
CARDS_PER_SIDE = 3
PALETTES = [
    ("#f0e3ff", "#7853aa"),
    ("#ffe0ed", "#b83c70"),
    ("#fff0bf", "#9a681f"),
    ("#ffe4cf", "#b86039"),
    ("#dff0ff", "#416ba4"),
    ("#e8f5dd", "#447c56"),
    ("#fff0bf", "#9a681f"),
    ("#f0e3ff", "#7853aa"),
    ("#ffe0ed", "#b83c70"),
]


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
    if parts.path.rstrip("/").lower() == "/classroom":
        raise argparse.ArgumentTypeError("use the public game URL for printable game cards")
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
    pdf.setFillColor(INK)
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


def sparkle(pdf, x, y, size, color):
    path = pdf.beginPath()
    path.moveTo(x, y + size)
    path.curveTo(x + 1, y + 2, x + 2, y + 1, x + size, y)
    path.curveTo(x + 2, y - 1, x + 1, y - 2, x, y - size)
    path.curveTo(x - 1, y - 2, x - 2, y - 1, x - size, y)
    path.curveTo(x - 2, y + 1, x - 1, y + 2, x, y + size)
    path.close()
    pdf.setFillColor(color)
    pdf.drawPath(path, fill=1, stroke=0)


def draw_logo(pdf, logo, x, y):
    size = 28
    pdf.saveState()
    pdf.translate(x, y)
    scale = size / max(logo.width, logo.height)
    pdf.scale(scale, scale)
    logo.drawOn(pdf, 0, 0)
    pdf.restoreState()


def display_address(url, width):
    full_address = url.split("://", 1)[1].rstrip("/")
    host = urlsplit(url).netloc
    for address in (full_address, host):
        if stringWidth(address, "Helvetica", 7) <= width:
            return address
    return ""


def draw_card(pdf, x, y, width, height, matrix, url, logo, palette):
    tint, accent = map(HexColor, palette)
    center = x + width / 2
    header_y = y + height - 55

    pdf.setFillColor(tint)
    pdf.roundRect(x + 12, header_y, width - 24, 43, 12, fill=1, stroke=0)
    draw_logo(pdf, logo, x + 20, header_y + 7.5)
    pdf.setFillColor(INK)
    pdf.setFont("Helvetica-Bold", 13)
    pdf.drawString(x + 54, header_y + 17, "little pencil club.")

    pdf.setFont("Helvetica-Bold", 17)
    pdf.drawCentredString(center, y + 162, "Draw with me!")
    sparkle(pdf, x + 24, y + 124, 6, accent)
    sparkle(pdf, x + width - 22, y + 79, 5, accent)
    pdf.setFillColor(accent)
    pdf.circle(x + 19, y + 110, 1.6, fill=1, stroke=0)
    pdf.circle(x + width - 17, y + 68, 1.4, fill=1, stroke=0)

    qr_x = center - QR_SIZE / 2
    qr_y = y + 41
    draw_qr(pdf, matrix, qr_x, qr_y)
    pdf.linkURL(url, (qr_x, qr_y, qr_x + QR_SIZE, qr_y + QR_SIZE))

    pdf.setFillColor(INK)
    pdf.setFont("Helvetica-Bold", 10)
    address = display_address(url, width - 22)
    pdf.drawCentredString(center, y + 28, "Scan to draw")
    if address:
        pdf.setFillColor(MUTED)
        pdf.setFont("Helvetica", 7)
        pdf.drawCentredString(center, y + 19, address)
        pdf.linkURL(url, (x + 10, y + 16, x + width - 10, y + 25))
    pdf.setFillColor(MUTED)
    pdf.setFont("Helvetica", 7)
    pdf.drawCentredString(center, y + 8, "Need help? Ask a grown-up to line up the QR.")


def draw_cut_lines(pdf, card_width, card_height):
    pdf.saveState()
    pdf.setStrokeColor(HexColor("#857e91"))
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
    pdf = Canvas(str(output), pagesize=letter, invariant=True)
    pdf.setTitle("Little Pencil Club - Print-and-cut QR cards")
    pdf.setAuthor("Little Pencil Club")
    page_width, page_height = letter
    card_width = (page_width - 2 * TRIM_MARGIN) / CARDS_PER_SIDE
    card_height = (page_height - 2 * TRIM_MARGIN) / CARDS_PER_SIDE
    for index, palette in enumerate(PALETTES):
        row, column = divmod(index, CARDS_PER_SIDE)
        x = TRIM_MARGIN + column * card_width
        y = page_height - TRIM_MARGIN - (row + 1) * card_height
        draw_card(pdf, x, y, card_width, card_height, matrix, url, logo, palette)
    draw_cut_lines(pdf, card_width, card_height)
    pdf.showPage()
    pdf.save()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", type=site_address, default=SITE_URL, help="URL encoded by all nine cards")
    parser.add_argument("--output", type=Path, default=Path("little-pencil-club-qr-cards.pdf"), help="output PDF path")
    args = parser.parse_args()
    if args.output.suffix.lower() != ".pdf":
        parser.error("--output must end in .pdf")
    if not LOGO.is_file():
        parser.error(f"missing logo asset: {LOGO}")

    try:
        matrix = qr_matrix(args.url)
        logo = svg2rlg(str(LOGO))
        if logo is None or min(logo.width, logo.height) <= 0:
            parser.error("dist/logo.svg must contain a nonempty SVG logo")
        write_cards(args.output, args.url, matrix, logo)
    except (DataOverflowError, ValueError, OSError) as error:
        parser.error(str(error) or "unable to write QR cards for this URL")
    print(f"Wrote nine printable QR cards to {args.output}")


if __name__ == "__main__":
    main()
