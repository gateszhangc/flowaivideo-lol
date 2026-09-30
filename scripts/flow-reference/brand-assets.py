#!/usr/bin/env python3
"""Derive the Flow AI Video brand asset set from the generated master mark.

The master art (`content/flow/brand/master.png`) is produced with the image
generation endpoint from the bundled ShipAny logo skill brief, then this script
expands it into every file the site and the app manifest reference:

    public/logo.png                 512x512 app/tile mark
    public/favicon.ico              multi-size ico (16/32/48)
    public/favicon-16x16.png        browser tab
    public/favicon-32x32.png        browser tab / taskbar
    public/apple-touch-icon.png     180x180 iOS home screen
    public/android-chrome-192x192.png
    public/android-chrome-512x512.png
    public/og-image.jpg             1200x630 social preview
    public/preview.png              1200x630 social preview (png)

Run: python3 scripts/flow-reference/brand-assets.py
"""

from __future__ import annotations

import pathlib

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = pathlib.Path(__file__).resolve().parents[2]
PUBLIC = ROOT / "public"
MASTER = ROOT / "content/flow/brand/master.png"

FONT_BOLD = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
FONT_REGULAR = "/System/Library/Fonts/Supplemental/Arial.ttf"


def square_master() -> Image.Image:
    image = Image.open(MASTER).convert("RGBA")
    width, height = image.size
    side = min(width, height)
    image = image.crop(
        ((width - side) // 2, (height - side) // 2, (width + side) // 2, (height + side) // 2)
    )
    return image


def write_icons(master: Image.Image) -> None:
    master.resize((512, 512), Image.LANCZOS).save(PUBLIC / "logo.png")
    master.resize((512, 512), Image.LANCZOS).save(PUBLIC / "android-chrome-512x512.png")
    master.resize((192, 192), Image.LANCZOS).save(PUBLIC / "android-chrome-192x192.png")
    master.resize((180, 180), Image.LANCZOS).save(PUBLIC / "apple-touch-icon.png")
    master.resize((32, 32), Image.LANCZOS).save(PUBLIC / "favicon-32x32.png")
    master.resize((16, 16), Image.LANCZOS).save(PUBLIC / "favicon-16x16.png")
    master.resize((512, 512), Image.LANCZOS).save(
        PUBLIC / "favicon.ico",
        sizes=[(16, 16), (32, 32), (48, 48)],
    )


def gradient_background(size: tuple[int, int]) -> Image.Image:
    """Dark studio background with indigo/violet/pink glow, like the reference."""
    width, height = size
    base = Image.new("RGBA", size, (8, 5, 20, 255))
    glow = Image.new("RGBA", size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(glow)
    draw.ellipse(
        (-260, -320, width * 0.62, height * 1.05),
        fill=(99, 102, 241, 120),
    )
    draw.ellipse(
        (width * 0.44, height * 0.15, width + 320, height + 340),
        fill=(236, 72, 153, 130),
    )
    draw.ellipse(
        (width * 0.18, -200, width * 0.86, height * 0.7),
        fill=(139, 92, 246, 110),
    )
    glow = glow.filter(ImageFilter.GaussianBlur(140))
    return Image.alpha_composite(base, glow)


def write_social(master: Image.Image) -> None:
    size = (1200, 630)
    canvas = gradient_background(size)
    mark = master.resize((252, 252), Image.LANCZOS)
    canvas.alpha_composite(mark, (110, 189))

    draw = ImageDraw.Draw(canvas)
    title_font = ImageFont.truetype(FONT_BOLD, 84)
    tagline_font = ImageFont.truetype(FONT_REGULAR, 34)
    badge_font = ImageFont.truetype(FONT_BOLD, 26)

    draw.text((432, 208), "Flow AI Video", font=title_font, fill=(255, 255, 255, 255))
    draw.text(
        (436, 316),
        "AI video generator — text to video,",
        font=tagline_font,
        fill=(214, 210, 235, 255),
    )
    draw.text(
        (436, 360),
        "image to video, 4K cinematic output",
        font=tagline_font,
        fill=(214, 210, 235, 255),
    )
    badge = Image.new("RGBA", size, (0, 0, 0, 0))
    ImageDraw.Draw(badge).rounded_rectangle(
        (436, 428, 700, 486), radius=29, fill=(255, 255, 255, 46)
    )
    canvas = Image.alpha_composite(canvas, badge)
    draw = ImageDraw.Draw(canvas)
    draw.text((466, 442), "flowaivideo.lol", font=badge_font, fill=(255, 255, 255, 235))

    canvas.convert("RGB").save(PUBLIC / "og-image.jpg", quality=92)
    canvas.save(PUBLIC / "preview.png")


def write_manifest() -> None:
    (PUBLIC / "site.webmanifest").write_text(
        """{
  "name": "Flow AI Video",
  "short_name": "Flow AI Video",
  "description": "AI video generator for text to video and image to video creation.",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#080514",
  "theme_color": "#8b5cf6",
  "icons": [
    { "src": "/android-chrome-192x192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/android-chrome-512x512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
"""
    )


def main() -> None:
    master = square_master()
    write_icons(master)
    write_social(master)
    write_manifest()
    for name in [
        "logo.png",
        "favicon.ico",
        "favicon-16x16.png",
        "favicon-32x32.png",
        "apple-touch-icon.png",
        "android-chrome-192x192.png",
        "android-chrome-512x512.png",
        "og-image.jpg",
        "preview.png",
        "site.webmanifest",
    ]:
        path = PUBLIC / name
        print(f"{name}: {path.stat().st_size} bytes")


if __name__ == "__main__":
    main()
