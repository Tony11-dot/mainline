#!/usr/bin/env python3
"""Render the MainLine App Store screenshots.

    python3 tools/store-screenshots/render.py                 # every panel
    python3 tools/store-screenshots/render.py ipad-03 iphone-02
    python3 tools/store-screenshots/render.py --contact-sheet <file.png>

Each panel in panels.js is rendered by template.html in headless Chrome at the
exact App Store canvas (iPad 13-inch 2064 x 2752, iPhone 6.9-inch 1320 x 2868),
flattened to RGB with no alpha, and written to apps/mobile/store/screenshots/
(iphone/ and ipad/) under the panel's file name, which sorts in story order.
`fastlane ios metadata` uploads them; deliver tells the devices apart by size.

The raw simulator screenshots the panels frame live in raw/ (or --raw <dir>);
capture.sh retakes them. Needs Google Chrome and Python 3 with Pillow.
"""
import argparse
import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFont

HERE = Path(__file__).resolve().parent
REPO = HERE.parent.parent
OUT = REPO / "apps" / "mobile" / "store" / "screenshots"
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
SIZES = {"ipad": (2064, 2752), "iphone": (1320, 2868)}
BACKGROUND = (242, 244, 249)
RAW = HERE / "raw"
FONT = HERE / "fonts" / "Fraunces.ttf"


def read_panels():
    """(id, device, file, headline) for every panel, in story order (panels.js is run by Node)."""
    source = (HERE / "panels.js").read_text(encoding="utf-8")
    script = "global.window = {}; eval(process.argv[1]); console.log(JSON.stringify(window.PANELS))"
    out = subprocess.run(["node", "-e", script, source], check=True, capture_output=True, text=True).stdout
    panels = json.loads(out)
    for panel in panels:
        panel["headline"] = re.sub(r"<[^>]+>", " ", panel["headline"].replace("<br>", " "))
    return panels


def render(panel, profile):
    """Renders until two takes agree pixel for pixel, then writes the panel."""
    takes = []
    for _ in range(4):
        takes.append(take(panel, profile))
        if len(takes) > 1 and ImageChops.difference(takes[-1], takes[-2]).getbbox() is None:
            break
    else:
        sys.exit(f"{panel['id']}: Chrome gave a different picture every time; not writing it")
    target = OUT / panel["file"]
    target.parent.mkdir(parents=True, exist_ok=True)
    takes[-1].save(target, "PNG", optimize=True)
    return target


def take(panel, profile):
    """One headless Chrome screenshot of the panel, flattened to RGB."""
    width, height = SIZES[panel["device"]]
    with tempfile.TemporaryDirectory() as scratch:
        shot = Path(scratch) / "shot.png"
        url = (HERE / "template.html").as_uri() + "?id=" + panel["id"] + "&raw=" + RAW.as_uri() + "/"
        subprocess.run(
            [
                # Without the compositor flag, Chrome can take the picture
                # before every tile of a large 3D layer is drawn: a device
                # came out half grey. GPU off keeps rasterization in software,
                # which is slower but the same every time.
                CHROME, "--headless=new", "--hide-scrollbars", "--force-device-scale-factor=1",
                "--run-all-compositor-stages-before-draw", "--disable-gpu",
                f"--window-size={width},{height}", "--virtual-time-budget=8000",
                "--allow-file-access-from-files", f"--user-data-dir={profile}",
                "--no-first-run", "--no-default-browser-check",
                f"--screenshot={shot}", url,
            ],
            check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        )
        image = Image.open(shot)
        image.load()
    if image.size != (width, height):
        sys.exit(f"{panel['id']}: rendered {image.size}, expected {(width, height)}")
    flat = Image.new("RGB", image.size, BACKGROUND)
    flat.paste(image.convert("RGBA"), mask=image.convert("RGBA").getchannel("A"))
    return flat


def contact_sheet(paths, destination):
    """Every final image in one picture: iPad row, then iPhone row."""
    rows = [[p for p in paths if p.parent.name == "ipad"], [p for p in paths if p.parent.name == "iphone"]]
    thumb_height = 900
    gap, label = 36, 70
    font = ImageFont.truetype(str(FONT), 30) if FONT.exists() else ImageFont.load_default()
    widths = []
    for row in rows:
        widths.append(sum(int(Image.open(p).width * thumb_height / Image.open(p).height) for p in row) + gap * (len(row) + 1))
    sheet = Image.new("RGB", (max(widths), (thumb_height + label + gap) * len(rows) + gap), (240, 243, 248))
    draw = ImageDraw.Draw(sheet)
    y = gap
    for row in rows:
        x = gap
        for path in row:
            image = Image.open(path).convert("RGB")
            image = image.resize((int(image.width * thumb_height / image.height), thumb_height), Image.LANCZOS)
            sheet.paste(image, (x, y))
            draw.text((x, y + thumb_height + 14), f"{path.parent.name}/{path.stem}", fill=(30, 40, 55), font=font)
            x += image.width + gap
        y += thumb_height + label + gap
    sheet.save(destination)
    return destination


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("ids", nargs="*", help="panel ids to render (default: all)")
    parser.add_argument("--contact-sheet", type=Path, help="also write a contact sheet of every final image here")
    parser.add_argument("--raw", type=Path, default=HERE / "raw", help="folder of raw simulator screenshots")
    parser.add_argument("--out", type=Path, help="write the panels here instead of apps/mobile/store/screenshots")
    args = parser.parse_args()
    global RAW, OUT
    RAW = args.raw.resolve()
    if args.out:
        OUT = args.out.resolve()

    panels = read_panels()
    chosen = [p for p in panels if not args.ids or p["id"] in args.ids]
    if not chosen:
        sys.exit("No such panel. Known: " + ", ".join(p["id"] for p in panels))
    OUT.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as profile:
        for panel in chosen:
            target = render(panel, profile)
            print(f"{panel['id']:10} {target}  —  {panel['headline']}")
    if args.contact_sheet:
        finals = [OUT / p["file"] for p in panels if (OUT / p["file"]).exists()]
        print("contact sheet:", contact_sheet(finals, args.contact_sheet))


if __name__ == "__main__":
    main()
