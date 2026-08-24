#!/usr/bin/env python3
"""Genera assets/icon.png e assets/icon.ico (icono de la Calculadora HL-4A)."""
import os, struct
from PIL import Image, ImageDraw

BODY   = (71, 75, 83, 255)
BEZEL  = (59, 53, 66, 255)
LCD    = (216, 226, 214, 255)
SEG    = (20, 20, 20, 255)
KEY    = (46, 43, 40, 255)
RED    = (160, 91, 110, 255)
WHITE  = (240, 240, 240, 255)

SEGS = {'8': 0x7F}

def seg_polygons(x, y, w, h):
    t = max(2, h // 7); t2 = t // 2; ym = y + h // 2
    return {
        0x01: [(x+t2,y),(x+w-t2,y),(x+w-t,y+t2),(x+w-t2,y+t),(x+t2,y+t),(x+t,y+t2)],
        0x02: [(x+w-t,y+t2),(x+w,y+t2),(x+w,ym-t2),(x+w-t,ym-t),(x+w-t2,ym-t2),(x+w-t2,y+t)],
        0x04: [(x+w-t,ym+t2),(x+w,ym+t2),(x+w,y+h-t2),(x+w-t,y+h-t2),(x+w-t2,y+h-t),(x+w-t2,ym+t)],
        0x08: [(x+t2,y+h),(x+w-t2,y+h),(x+w-t,y+h-t2),(x+w-t2,y+h-t),(x+t2,y+h-t),(x+t,y+h-t2)],
        0x10: [(x+t,ym+t2),(x+t2,ym+t),(x+t2,y+h-t),(x+t,y+h-t2),(x,y+h-t2),(x,ym+t2)],
        0x20: [(x+t,y+t2),(x+t2,y+t),(x+t2,ym-t2),(x+t,ym-t),(x,ym-t2),(x,y+t2)],
        0x40: [(x+t,ym-t2),(x+t2,ym),(x+t,ym+t2),(x+w-t,ym+t2),(x+w-t2,ym),(x+w-t,ym-t2)],
    }

def draw_digit(d, x, y, w, h):
    polys = seg_polygons(x, y, w, h)
    for bit, pts in polys.items():
        if SEGS['8'] & bit:
            d.polygon(pts, fill=SEG)

def render(size):
    s = size
    img = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    m = int(s * 0.10)
    r = int(s * 0.16)
    d.rounded_rectangle([m, m*0.4, s-m, s-m*0.4], radius=r, fill=BODY)
    # LCD
    lx0, ly0 = int(s*0.20), int(s*0.14)
    lx1, ly1 = int(s*0.80), int(s*0.38)
    d.rounded_rectangle([lx0-int(s*0.03), ly0-int(s*0.03), lx1+int(s*0.03), ly1+int(s*0.03)],
                        radius=int(s*0.05), fill=BEZEL)
    d.rounded_rectangle([lx0, ly0, lx1, ly1], radius=int(s*0.03), fill=LCD)
    # digitos 8.8
    dw = int(s*0.16); dh = int(s*0.17)
    draw_digit(d, lx1 - dw*2 - int(s*0.10), ly0 + int(s*0.025), dw, dh)
    draw_digit(d, lx1 - dw - int(s*0.04), ly0 + int(s*0.025), dw, dh)
    d.rectangle([lx1 - dw*2 - int(s*0.13), ly1 - int(s*0.05), lx1 - dw*2 - int(s*0.10), ly1 - int(s*0.02)], fill=SEG)
    # teclas 4x4
    kx0, ky0 = int(s*0.18), int(s*0.48)
    kx1, ky1 = int(s*0.82), int(s*0.88)
    cols, rows = 4, 4
    gap = int(s*0.035)
    kw = (kx1 - kx0 - gap*(cols-1)) // cols
    kh = (ky1 - ky0 - gap*(rows-1)) // rows
    for rr in range(rows):
        for cc in range(cols):
            x = kx0 + cc*(kw+gap); y = ky0 + rr*(kh+gap)
            col = RED if (rr == 0 and cc < 2) else KEY
            d.rounded_rectangle([x, y, x+kw, y+kh], radius=max(2, int(s*0.04)), fill=col)
    return img

def main():
    here = os.path.dirname(os.path.abspath(__file__))
    root = os.path.dirname(here)
    assets = os.path.join(root, 'assets'); os.makedirs(assets, exist_ok=True)
    sizes = [256, 48, 32]
    imgs = {sz: render(sz) for sz in sizes}
    imgs[256].save(os.path.join(assets, 'icon.png'))
    # ICO con entradas PNG
    pngs = {sz: _png_bytes(im) for sz, im in imgs.items()}
    n = len(sizes)
    hdr = struct.pack('<HHH', 0, 1, n)
    entries = b''; data = b''
    off = 6 + 16*n
    for sz in sizes:
        w = 0 if sz == 256 else sz
        entries += struct.pack('<BBBBHHII', w, w, 0, 0, 1, 32, len(pngs[sz]), off)
        data += pngs[sz]
        off += len(pngs[sz])
    with open(os.path.join(assets, 'icon.ico'), 'wb') as f:
        f.write(hdr + entries + data)
    print('iconos generados en', assets)

def _png_bytes(im):
    import io
    b = io.BytesIO(); im.save(b, 'PNG'); return b.getvalue()

if __name__ == '__main__':
    main()
