#!/usr/bin/env python3
"""Frames the raw captures from capture.mjs into the README images and GIFs.

    python3 scripts/readme-shots/compose.py <SHOTS_TMP>

Needs Pillow, ffmpeg and gifsicle; uses Inter when installed (falls back to DejaVu Sans).
"""
import os
import subprocess
import sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont

SRC = sys.argv[1] if len(sys.argv) > 1 else "/tmp/radar-readme-shots"
OUT = os.path.join(os.path.dirname(__file__), "..", "..", "docs", "assets", "readme")
os.makedirs(OUT, exist_ok=True)
T = {"bg1": (246, 248, 252), "bg2": (219, 232, 254), "glow": (37, 99, 235), "chrome": (255, 255, 255), "line": (226, 231, 240), "ink": (17, 24, 39), "muted": (100, 110, 130), "frame": (20, 22, 28)}


def font(size, weight="Regular"):
    for path in (f"/usr/share/fonts/opentype/inter/Inter-{weight}.otf", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if weight != "Regular" else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"):
        if os.path.exists(path):
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def background(w, h):
    """Soft diagonal blue gradient with a glow (matches the hero)."""
    base = Image.new("RGB", (w, h), T["bg1"])
    horizontal = Image.linear_gradient("L").rotate(90).transpose(Image.Transpose.FLIP_LEFT_RIGHT).resize((w, h))
    grad = Image.blend(horizontal, Image.linear_gradient("L").resize((w, h)), 0.5)
    base = Image.composite(Image.new("RGB", (w, h), T["bg2"]), base, grad.point(lambda v: int(v * 0.6)))
    glow = Image.new("L", (w, h), 0)
    ImageDraw.Draw(glow).ellipse((int(w * 0.55), int(-h * 0.35), int(w * 1.15), int(h * 0.55)), fill=70)
    return Image.composite(Image.new("RGB", (w, h), T["glow"]), base, glow.filter(ImageFilter.GaussianBlur(160)))


def rounded(img, radius):
    mask = Image.new("L", img.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, img.size[0] - 1, img.size[1] - 1), radius, fill=255)
    out = img.convert("RGBA")
    out.putalpha(mask)
    return out


def shadow(canvas, box, radius, blur=36, offset=18, alpha=60):
    x0, y0, x1, y1 = box
    sh = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    ImageDraw.Draw(sh).rounded_rectangle((x0, y0 + offset, x1, y1 + offset), radius, fill=(15, 23, 60, alpha))
    canvas.alpha_composite(sh.filter(ImageFilter.GaussianBlur(blur)))


def window(shot, width, max_h=None):
    """Browser window around a desktop screenshot."""
    img = Image.open(shot).convert("RGB")
    bar = 44
    img = img.resize((width, int(img.height * width / img.width)), Image.LANCZOS)
    if max_h:
        img = img.crop((0, 0, width, min(img.height, max_h - bar)))
    win = Image.new("RGB", (width, img.height + bar), T["chrome"])
    d = ImageDraw.Draw(win)
    for i, c in enumerate([(255, 95, 87), (254, 188, 46), (40, 200, 64)]):
        d.ellipse((20 + i * 22, 16, 32 + i * 22, 28), fill=c)
    ux = (width - 420) // 2
    d.rounded_rectangle((ux, 10, ux + 420, 34), 8, fill=T["bg1"])
    d.text((ux + 210, 22), "seu-radar.vercel.app", fill=T["muted"], font=font(14, "Medium"), anchor="mm")
    d.line((0, bar - 1, width, bar - 1), fill=T["line"])
    win.paste(img, (0, bar))
    return rounded(win, 14)


def phone(shot, width):
    """Phone frame (bezel + island) with a status bar above the page."""
    page = Image.open(shot).convert("RGB")
    sb = int(page.width * 0.12)
    img = Image.new("RGB", (page.width, page.height + sb), page.getpixel((page.width // 2, 2)))
    img.paste(page, (0, sb))
    s = page.width / 430
    ImageDraw.Draw(img).text((int(54 * s), sb // 2 + int(4 * s)), "9:41", fill=T["ink"], font=font(int(17 * s), "SemiBold"), anchor="mm")
    bezel = max(10, width // 28)
    inner = width - 2 * bezel
    img = img.resize((inner, int(img.height * inner / img.width)), Image.LANCZOS)
    h = img.height + 2 * bezel
    body = Image.new("RGBA", (width, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(body)
    r = int(width * 0.16)
    d.rounded_rectangle((0, 0, width - 1, h - 1), r, fill=T["frame"])
    body.alpha_composite(rounded(img, r - bezel), (bezel, bezel))
    iw, ih = int(width * 0.30), int(width * 0.085)
    ImageDraw.Draw(body).rounded_rectangle(((width - iw) // 2, bezel + int(width * 0.03), (width + iw) // 2, bezel + int(width * 0.03) + ih), ih // 2, fill=(0, 0, 0))
    return body


def save_png(img, name, max_w=None):
    if max_w and img.width > max_w:
        img = img.resize((max_w, int(img.height * max_w / img.width)), Image.LANCZOS)
    path = os.path.join(OUT, name)
    img.convert("RGB").save(path, optimize=True, compress_level=9)
    print(f"{name}: {img.width}x{img.height} {os.path.getsize(path) // 1024} KB")


def src(name):
    return os.path.join(SRC, name)


# Showcase: desktop map + phone with the location analysis.
W, H = 1600, 1000
canvas = background(W, H).convert("RGBA")
win = window(src("d-mapa.png"), 1180, max_h=800)
shadow(canvas, (90, 100, 90 + win.width, 100 + win.height), 14)
canvas.alpha_composite(win, (90, 100))
ph = phone(src("m-analise.png"), 350)
px, py = W - ph.width - 100, H - ph.height - 30
shadow(canvas, (px, py, px + ph.width, py + ph.height), 56, blur=40, alpha=100)
canvas.alpha_composite(ph, (px, py))
save_png(canvas, "showcase.png")

# Phones strip.
SCREENS = [("busca", "Alugar"), ("compra", "Comprar"), ("mapa", "Mapa e camadas"), ("analise", "Análise da localização"), ("simulacao", "Simulação de compra")]
W, H = 1600, 860
canvas = background(W, H).convert("RGBA")
pw, gap = 270, 36
x = (W - (len(SCREENS) * pw + (len(SCREENS) - 1) * gap)) // 2
for i, (key, label) in enumerate(SCREENS):
    ph = phone(src(f"m-{key}.png"), pw)
    ph = ph.crop((0, 0, ph.width, min(ph.height, 740)))
    y = 40 + (22 if i % 2 else 0)
    shadow(canvas, (x, y, x + ph.width, y + ph.height), 44, blur=28, alpha=80)
    canvas.alpha_composite(ph, (x, y))
    ImageDraw.Draw(canvas).text((x + pw // 2, y + ph.height + 28), label, fill=T["ink"], font=font(20, "SemiBold"), anchor="mm")
    x += pw + gap
save_png(canvas, "phones.png")

# Desktop screens for the README tables.
for key in ["busca", "mapa", "imovel", "analise", "comparar", "bairros", "oportunidades", "favoritos", "fontes", "camadas", "execucoes", "compra-busca", "compra-simulacao", "compra-rendimento", "compra-bairros"]:
    if not os.path.exists(src(f"d-{key}.png")):
        continue
    win = window(src(f"d-{key}.png"), 1200)
    pad = 36
    canvas = background(win.width + 2 * pad, win.height + 2 * pad).convert("RGBA")
    shadow(canvas, (pad, pad, pad + win.width, pad + win.height), 14, blur=22, offset=10, alpha=55)
    canvas.alpha_composite(win, (pad, pad))
    save_png(canvas, f"desktop-{key}.png", max_w=1200)


def gif(name, width, fps=10, lossy=30, colors=160):
    frames = os.path.join(SRC, f"frames-{name}", "list.txt")
    if not os.path.exists(frames):
        print(f"{name}.gif: no recording, skipped")
        return
    path = os.path.join(OUT, f"{name}.gif")
    filters = f"fps={fps},scale={width}:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors={colors}:stats_mode=diff[p];[b][p]paletteuse=dither=none:diff_mode=rectangle"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", frames, "-filter_complex", filters, "-loop", "0", path], check=True)
    subprocess.run(["gifsicle", "-O3", f"--lossy={lossy}", "-b", path], check=True)
    print(f"{name}.gif: {os.path.getsize(path) // 1024} KB")


gif("tour", 1100)
gif("camadas", 1100)
gif("mobile", 360, fps=12)
