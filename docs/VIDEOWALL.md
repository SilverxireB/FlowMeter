# FlowSign (VideoWall) — Plan & Mimari

> **3. ürün** (hub'da 4. kart): fiziksel video-wall / dijital tabela CMS'i.
> Duvar çözünürlüğü + ekran ızgarası tanımla → sürükle-bırak alan yerleşimi →
> her alana görsel/video/URL ata + sıra/süre/saat aralığı → kaydet → tam ekran
> oynatma linki (Chrome fullscreen → 1:1 doğru çözünürlük).
>
> **İki dağıtım (KRİTİK ilke):**
> 1. **Online (Vercel + Firestore + Cloudinary):** dene/paylaş/uzaktan kullan.
> 2. **Self-host (fabrika iç-network, dış bağlantısız):** AYNI kod, ayrı paket.
>    Medya = yerel klasör, veri = iç Firestore/offline, auth = fabrika uygulaması.
>
> Bu yüzden her şey **kopabilir katman** arkasında: online somut kurulur, self-host
> sonra bu katmanları takas eder — online HİÇ bozulmadan.

## Kopabilir katmanlar (self-host için tasarım kuralı)
| Katman | Online (v1) | Self-host (sonra) | Nerede |
|---|---|---|---|
| **Medya** | Cloudinary (upload+CDN) | Yerel klasör (app servis eder) | `src/lib/videowall/media.ts` |
| **Veri** | Firestore (`videowalls/`) | İç Firestore / offline JSON | `src/lib/videowalls.ts` |
| **Auth** | Firebase Auth (Google) | Fabrika uygulaması girişi | `useAuthUser` / provider |
| **Oynatıcı** | AYNI kod her iki yerde | AYNI kod | `/videowall/[id]/play` |

Kural: oynatma sayfası **dış bağlantı olmadan** da çalışabilmeli (yerel medya + yerel
config). Bulut-özel şeyler (Cloudinary URL üretimi vs) tek dosyada izole.

## Veri modeli (taslak)
```
videowalls/{id}: ownerId, name, width, height (toplam px),
                 cols, rows (fiziksel ekran ızgarası),
                 zones: Zone[], createdAt, updatedAt
Zone: { id, x, y, w, h (0–1 oran; duvar pikseline çarpılır),
        fit: "cover"|"contain", items: ZoneItem[] }
ZoneItem: { id, kind: "image"|"video"|"url", src, name?,
            durationSec? (image/url; video kendi süresi ya da cap),
            from?, to? ("HH:MM" saat aralığı; boşsa hep) }
Cloudinary: klasör videowalls/{id}/  (online medya)
```
Oynatma: her zone kendi `items`'ını sırayla döndürür (saat aralığına uyan);
image=süre, video=bitince, url=iframe+süre. Geçişte crossfade. 7/24 için ön-yükleme
+ bellek temizliği (video release) ŞART.

## Rotalar
| Rota | İş |
|---|---|
| `/videowall` | Duvar listesi (yetkili = parlak, diğer = sönük) + Yeni |
| `/videowall/[id]/edit` | Editör: çözünürlük/ızgara + sürükle-bırak layout + içerik + sıra/süre/saat + önizleme |
| `/videowall/[id]/play` | Tam ekran oynatma (duvar çözünürlüğünde tuval, zone'lar mutlak konumlu) |

## Layout editörü (en zor UI)
Model: her zone = `{x,y,w,h}` (0–1 oran) + **grid snap** (cols×rows'a hizalar).
Böl (yatay/dikey) / birleştir (komşu seç) / sürükle-taşı / kenar-çek yeniden boyut.
Başlangıç: cols×rows tam ızgara; kullanıcı böler/birleştirir.

## Yetkilendirme / liste
Videowall listesi: `ownerId == uid` (+ ileride paylaşılan/rol). Yetkin olan **parlak**,
yetkin olmayan **sönük + bilgi amaçlı** (self-host'ta fabrika rolleriyle eşlenecek).

## Fazlar
1. ✅ **v1 (online iskelet):** liste + oluştur + çözünürlük/ızgara config + grid önizleme + yayın rotası.
2. ✅ **v2 layout editörü:** hücre sürükle → **birleştir**, tıkla → seç, **böl** (`LayoutEditor`, `mergeCells`/`splitZone`).
3. ✅ **v3 içerik:** Cloudinary upload (görsel/video) + URL öğesi + süre/saat aralığı/sıra (`ZonePanel`, `updateZones`).
4. ✅ **v4 oynatma:** alan başına oynatma listesi + saat aralığı filtresi + crossfade + bozuk öğe atlama (7/24) (`play/page.tsx`).
5. ⬜ **v5 self-host paketi:** medya/veri/auth katmanlarını takas et (online bozulmadan).

> Not v2: yerleşim **hücre-birleştirme** modeli (video wall'a doğru olan bu — alanlar
> fiziksel ekran sınırına hizalı kalır). Serbest piksel sürükle-taşı gerekirse v5+.
> Not v3: FlowSign yüklemeleri `keepOriginal:true` (tabela tam çözünürlük ister).

## Marka
Ayrı kimlik (hub'da 3. kart). Ad: **FlowSign** (Flow + ekran/tabela). Logo: `Logo`
bileşeni `variant="sign"` (FLOW O-halkası + SIGN); özel `logo-flowsign.png` çizilince
o iki satır değişir. Teal kart (#062a2a→#0c3b3b), aksan #2dd4bf.
```
