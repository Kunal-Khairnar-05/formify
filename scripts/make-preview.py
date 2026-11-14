"""Draw the picture a shared link is shown with (public/preview.png, 1200 x 630).

WhatsApp, Telegram and the rest show this beside the page's title when a link is pasted.
The text is drawn with a font from the machine it is run on, so the result is committed
rather than made at build time.
Usage: python scripts/make-preview.py
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
INK = (14, 14, 16)
WHITE = (245, 244, 250)
SOFT = (170, 166, 190)
PURPLE = (179, 164, 255)
YELLOW = (246, 220, 124)

# the first of these that the machine has is used
BOLD = ['C:/Windows/Fonts/segoeuib.ttf', '/System/Library/Fonts/Supplemental/Arial Bold.ttf',
        '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf']
PLAIN = ['C:/Windows/Fonts/segoeui.ttf', '/System/Library/Fonts/Supplemental/Arial.ttf',
         '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf']


def font(paths, size):
    for path in paths:
        if Path(path).exists():
            return ImageFont.truetype(path, size)
    raise SystemExit('no font found: add one to the list in this script')


image = Image.new('RGB', (1200, 630), INK)
draw = ImageDraw.Draw(image)

# the logo, as drawn by make-icons.py
logo = Image.open(ROOT / 'public' / 'icon-512.png').convert('RGBA').resize((220, 220), Image.LANCZOS)
image.paste(logo, (80, 70), logo)

draw.text((330, 95), 'Formify', font=font(BOLD, 120), fill=WHITE)
draw.text((80, 330), 'Exam form photo and signature,', font=font(BOLD, 60), fill=WHITE)
draw.text((80, 405), 'resized to the exact KB.', font=font(BOLD, 60), fill=PURPLE)
draw.text((80, 520), 'Runs in your browser. Nothing is uploaded.', font=font(PLAIN, 36), fill=SOFT)
# a line of the logo's yellow along the foot
draw.rectangle((0, 618, 1200, 630), fill=YELLOW)

image.save(ROOT / 'public' / 'preview.png', optimize=True)
print('wrote public/preview.png')
