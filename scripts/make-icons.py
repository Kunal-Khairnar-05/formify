"""Draw the PNG icons from the logo's own numbers (the same ones as public/favicon.svg).

Phones and "install this app" want PNG files in fixed sizes; a browser tab uses the SVG.
Usage: python scripts/make-icons.py
"""
from PIL import Image, ImageDraw

INK = (14, 14, 16, 255)
PURPLE = (179, 164, 255, 255)
YELLOW = (246, 220, 124, 255)

# the logo on a 96 x 96 grid: four crop corners, then the tick
CORNERS = [
    [(22, 36), (22, 22), (36, 22)],
    [(60, 22), (74, 22), (74, 36)],
    [(74, 60), (74, 74), (60, 74)],
    [(36, 74), (22, 74), (22, 60)],
]
TICK = [(36, 49), (45, 58), (61, 40)]

# drawn this many times too large and then shrunk, which smooths the edges
OVERSAMPLE = 4


def stroke(draw, points, width, colour, scale, shift):
    """A line with round ends and round corners, as the SVG draws it."""
    placed = [(shift + x * scale, shift + y * scale) for x, y in points]
    draw.line(placed, fill=colour, width=round(width * scale), joint='curve')
    radius = width * scale / 2
    for x, y in placed:
        draw.ellipse([x - radius, y - radius, x + radius, y + radius], fill=colour)


def icon(size, corner_radius, mark_share=1.0):
    """The logo at `size` px. `mark_share` shrinks the mark inside its background."""
    big = size * OVERSAMPLE
    image = Image.new('RGBA', (big, big), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle([0, 0, big - 1, big - 1], radius=corner_radius * big / 96, fill=INK)
    scale = big / 96 * mark_share
    shift = big * (1 - mark_share) / 2
    for corner in CORNERS:
        stroke(draw, corner, 6, PURPLE, scale, shift)
    stroke(draw, TICK, 7, YELLOW, scale, shift)
    return image.resize((size, size), Image.LANCZOS)


# for an installed app: the same rounded square as the SVG
icon(192, 22).save('public/icon-192.png')
icon(512, 22).save('public/icon-512.png')
# "maskable": the phone cuts its own shape out of this one, so the background fills the
# square and the mark keeps to the middle, where no shape will cut it
icon(512, 0, mark_share=0.72).save('public/icon-maskable-512.png')
# iPhones round the corners themselves and show transparency as black
icon(180, 0, mark_share=0.86).save('public/apple-touch-icon.png')
print('wrote 4 icons')
