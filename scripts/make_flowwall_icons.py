"""
FlowWall PWA ikonları: lacivert yuvarlak-köşe kare + 4 renkli arklı halka +
beyaz kamera glifi (logodaki geometriyle uyumlu). Renkler logo-flow.png'den
örneklenir → marka birebir tutarlı.
Üretir: public/wall-icon-192.png, wall-icon-512.png, wall-apple-touch.png (180)
"""
from PIL import Image, ImageDraw

NAVY = (0, 30, 100, 255)

# Orijinal logo halkasından taranmış GERÇEK ark renkleri (piksel analizi)
RING = {
    "top": (27, 141, 236, 255),     # mavi
    "right": (25, 112, 49, 255),    # yeşil
    "bottom": (211, 11, 20, 255),   # kırmızı
    "left": (241, 126, 43, 255),    # turuncu
}

def build(size, out, corner_ratio=0.24):
    S = 4
    W = size * S
    img = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # zemin
    d.rounded_rectangle([0, 0, W, W], radius=int(W * corner_ratio), fill=NAVY)

    # halka: 4 ark (orijinal PNG dizilimi — aralıklı, yuvarlak uç hissi arc+width ile)
    colors = RING
    cx = cy = W / 2
    R = W * 0.30          # ark orta yarıçapı
    sw = int(W * 0.115)   # ark kalınlığı
    box = [cx - R, cy - R, cx + R, cy + R]
    # her ark ~75°, aralar boş; başlangıçlar orijinal görünüme yakın
    arcs = [
        (colors["top"], 240, 315),
        (colors["right"], -30, 45),
        (colors["bottom"], 60, 135),
        (colors["left"], 150, 225),
    ]
    for color, a0, a1 in arcs:
        d.arc(box, start=a0, end=a1, fill=color, width=sw)

    # kamera (beyaz) — logodaki oranlarla, halka deliğine sığar
    g = W / 1000.0  # birim
    def rr(x0, y0, x1, y1, rad):
        d.rounded_rectangle([x0 * g, y0 * g, x1 * g, y1 * g], radius=rad * g, fill=(255, 255, 255, 255))
    # gövde
    rr(392, 452, 608, 578, 28)
    # vizör çıkıntısı
    rr(434, 428, 528, 458, 12)
    # objektif
    d.ellipse([(500 - 52) * g, (515 - 52) * g, (500 + 52) * g, (515 + 52) * g], fill=(255, 255, 255, 255))
    d.ellipse([(500 - 31) * g, (515 - 31) * g, (500 + 31) * g, (515 + 31) * g], fill=NAVY)
    d.ellipse([(500 - 12) * g, (515 - 12) * g, (500 + 12) * g, (515 + 12) * g], fill=(255, 255, 255, 255))

    img = img.resize((size, size), Image.LANCZOS)
    img.save(out)
    print("yazıldı:", out, size)

build(512, "public/wall-icon-512.png")
build(192, "public/wall-icon-192.png")
build(180, "public/wall-apple-touch.png", corner_ratio=0.0)  # iOS kendisi yuvarlar
