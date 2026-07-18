"""
FlowWall logosu: mevcut FLOW logosunun O-halkasını BİREBİR koruyup, içindeki
bar-chart'ı fotoğraf makinesi glifiyle değiştirir. Halka pikselleri (renkli
arklar) hiç ellenmez — sadece halka İÇİ temizlenip kamera çizilir.
"""
from PIL import Image, ImageDraw

CX, CY = 500, 127          # halka merkezi (tespit edildi)
INNER = 74                 # halka iç yarıçapı (renkli pikseller r=74'ten başlıyor)
CLEAR_R = 71               # bar-chart bu yarıçap içinde; halkaya (r>=74) DOKUNMAZ
S = 4                      # supersample (keskin kenar)

def build(src, out, color):
    im = Image.open(src).convert("RGBA")
    px = im.load()
    # 1) Halka İÇİNİ temizle (bar-chart'ı kaldır) — halka arkları radius>INNER, dokunulmaz
    for y in range(CY - CLEAR_R, CY + CLEAR_R + 1):
        for x in range(CX - CLEAR_R, CX + CLEAR_R + 1):
            if (x - CX) ** 2 + (y - CY) ** 2 <= CLEAR_R ** 2:
                px[x, y] = (0, 0, 0, 0)

    # 2) Kamera glifini maske olarak çiz (supersample), sonra renklendir
    W, H = im.size
    mask = Image.new("L", (W * S, H * S), 0)
    d = ImageDraw.Draw(mask)

    def sc(v):  # 1x koordinatı S katına
        return v * S

    # Kamera halka DELİĞİNE (iç yarıçap ~74) sığar; hiçbir parça r>66'yı geçmez.
    # gövde (yuvarlak dikdörtgen)
    d.rounded_rectangle([sc(454), sc(103), sc(546), sc(157)], radius=sc(12), fill=255)
    # üst vizör/flaş çıkıntısı (hafif sola)
    d.rounded_rectangle([sc(472), sc(93), sc(512), sc(105)], radius=sc(5), fill=255)
    # objektif dış disk
    d.ellipse([sc(500 - 22), sc(133 - 22), sc(500 + 22), sc(133 + 22)], fill=255)
    # objektif deliği (boşalt → arka plan görünsün)
    d.ellipse([sc(500 - 13), sc(133 - 13), sc(500 + 13), sc(133 + 13)], fill=0)
    # merkez nokta
    d.ellipse([sc(500 - 5), sc(133 - 5), sc(500 + 5), sc(133 + 5)], fill=255)

    mask = mask.resize((W, H), Image.LANCZOS)
    cam = Image.new("RGBA", (W, H), color + (0,))
    cam.putalpha(mask)

    im = Image.alpha_composite(im, cam)
    im.save(out)
    print("yazıldı:", out)

build("public/logo-flow.png", "public/logo-flowwall.png", (0, 30, 100))       # lacivert
build("public/logo-flow-white.png", "public/logo-flowwall-white.png", (255, 255, 255))  # beyaz
