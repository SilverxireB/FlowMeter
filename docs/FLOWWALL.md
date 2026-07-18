# FlowWall — P1 İSKELETİ YAPILDI (Cloudinary env'i bekliyor)

> **Durum (P1 kuruldu):** `walls/{id}` modeli + kod çözümü (walls.ts),
> Cloudinary imzasız yükleme (cloudinary.ts), hooks (useWall/useWallMedia),
> rules (walls + media), sayfalar: `/wall` (karşılama), `/wall/[id]` (perde),
> `/u/[id]` (yükleme), `/wall/[id]/manage` (moderasyon), dashboard "Duvarlar"
> sekmesi + "Yeni duvar". Logo `variant="wall"`.
> **ÇALIŞMASI için gereken:** Cloudinary hesabı + unsigned upload preset →
> `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` + `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET`
> Vercel'e eklenmeli. Firestore rules'un yeni hâli konsola yapıştırılmalı.
> **TODO (fast-follow):** Cloudinary dosya silme + "tümünü indir" (ZIP) için
> Vercel API route; FlowWall PWA ikonları; imzalı yükleme (opsiyonel sertleştirme).



> Kullanıcının fikri (2026-07-18 oturumunda anlatıldı). Yeni bir session bu
> dosyayı okuyarak projeyi baştan anlatmaya gerek kalmadan devam edebilmeli.
> **Karar: ayrı uygulama DEĞİL** — FlowMeter altyapısı üzerine ikinci marka
> (FlowWall). Logo kimliği korunur: "FLOW" + O = renkli halka, yanına "WALL".

## Konsept

**Bu bir SUNUM-ARASI özellik DEĞİL** — bağımsız bir **canlı etkinlik duvarı**
ürünü. Hedef senaryo: yılbaşı, düğün, parti, kurumsal organizasyon → "anında
çek, patlat, yayınla" + aynı anda tüm anıları topla. Etkinlik boyunca perdede
canlı akan bir foto/video duvarı döner, katılımcılar telefonlarından anında
katkı yapar; etkinlik sonunda sahibi tüm medyayı tek dosyada indirir.

Canlı **fotoğraf/video duvarı**: perdede bir paylaşım ekranı (arka plana
yazı/görsel eklenebilir) + QR. Katılımcı QR'ı okutunca yükleme sayfasına gelir,
fotoğraf ya da video yükler. Onay alan (veya moderasyon kapalıysa tüm) medya
**saniyeler içinde** duvar ekranına düşer (anında yayın hissi önemli).

### Yükleme deneyimi (izleyici)

1. Dosya seç → **anında yerel thumbnail önizleme**.
2. Yükleme sırasında **canlı ilerleme** (önce thumb yüklenir, sonra asıl dosya
   % dolum göstergesiyle).
3. Bitince "Gönder" → gider (moderasyon açıksa "onay bekliyor" bilgisi).

### Duvar ekranı (perde)

- **Sağdan/soldan akan film şeritleri** (onaylı thumbnail'ler, CSS animasyon).
- **Ortada büyük sahne**: görseller 5–10 sn'de bir değişir; videolar kendi
  süresi kadar oynar; yeni onaylananlar kuyruğa girer.
- Arka plan: tema (yazı/görsel) — FlowMeter theme{} deseni yeniden kullanılır.

### Moderasyon

- Oturum başında seçilmişse (toggle) medya önce moderasyon ekranına düşer:
  **✓ Onayla / ✕ Reddet**. Q&A moderasyonundaki `/moderate/[code]` sayfası
  **sekmeli** hale getirilir (Sorular | Medya) — aynı yetki modeli (sadece sahip).
- Moderasyon kapalıysa medya doğrudan duvara gider.

### Oturum sonu

- **"Tümünü indir"**: oturumun tüm medyası tek dosya (ZIP) olarak sahibi
  tarafından indirilebilir (client-side JSZip; büyürse Cloud Function).
- Sahibi medyayı topluca **silebilir** (Storage + Firestore temizliği).
- Oturum arşivi (sessions/) FlowMeter'daki gibi çalışır.

## Mimari karar: tek yer, ayrı ürün

**Net karar (kullanıcı onayı):** Aynı repo/deployment/Firebase projesi, AMA
FlowWall kullanıcının gözünde **ayrı bir uygulama gibi** durur — FlowMeter'ın
bir "sunum tipi" ya da slayt seçeneği DEĞİL.

**Ortak (perde arkası) — aynen kullanılır:**
- QR + 6 haneli kod (`joinCodes`), katılım akışı
- `sessions/` oturum arşivi deseni, `onSnapshot` canlı altyapı
- Firebase Auth, rules desenleri
- `/moderate` sayfası (Medya sekmesi eklenir)
- Tasarım sistemi (Tailwind bileşen sınıfları), Vercel deploy hattı

**Ayrı (kullanıcı yüzü) — kendi ürünü gibi:**
- Kendi giriş kapısı / landing, kendi marka (FlowWall logosu)
- Kendi oluşturma akışı: **"Yeni duvar"** (asla "yeni sunum → tip: wall" değil)
- FlowMeter slayt editörüne / deck mantığına hiç dokunmaz
- **Ayrı Firestore koleksiyonu `walls/{id}`** (presentations'a `mode=wall`
  GÖMÜLMEZ) → deck sorguları temiz kalır, FlowWall kendi domain'i olur.

Uzak gelecek (opsiyonel, düşük öncelik): FlowMeter sunumu içine "wall slaytı"
köprüsü — ama bu FlowWall'ın kimliğini değiştirmez, sadece bir entegrasyon.

## Medya depolama: KESİN KARAR — Cloudinary (yalnız dosya), gerisi Firebase

**Net karar (kullanıcı):** Fotoğraf/video **byte'ları Cloudinary'de** durur ve
oradan servis edilir (çekim/yükleme, thumbnail, transform, CDN). **Geri kalan
HER ŞEY Firebase'de kalır:** metadata dokümanları (Firestore), moderasyon,
auth, oturumlar, joinCodes, realtime `onSnapshot`, rules. Cloudinary sadece
"dosya deposu + görüntü boru hattı"dır; iş mantığı Firestore'da. (Önceki
projede çok iyi çalıştı; ücretsiz alan geniş — kullanıcı notu: ~25 GB.)

### Neden kural 4 burada esner
CLAUDE.md kural 4 (**dış servis yok**) *kurumsal ağların* CDN engeli yüzündendi;
FlowMeter (kurumsal sunum) için geçerli kalır. FlowWall etkinlik ağında
(ev/mekan Wi-Fi + mobil data) çalışır → kısıt yok. **Cloudinary yalnız FlowWall'a
özel; FlowMeter'a asla sıçramaz.**

### Cloudinary tarafı
- **Yükleme + canlı % ilerleme:** doğrudan Cloudinary upload API'sine XHR
  (progress event) ya da upload widget. Önce thumb, sonra asıl dosya hissi
  transform'la bedava (eager/named transformation).
- **Görsel:** otomatik webp/avif, boyutlandırma, `c_fill` thumbnail — client
  canvas'ına gerek yok.
- **Video:** otomatik web-uyumlu mp4 + poster kare (Firebase'in yapamadığı).
- **Güvenlik:** anonim katılımcı yüklemesi için **imzalı yükleme** tercih
  (Vercel API route `/api/cloudinary-sign` imza üretir; API secret env'de).
  Unsigned preset + klasör/format/boyut kısıtı da mümkün ama imzalı daha güvenli.
- **Silme + "tümünü indir":** silme API secret ister → Vercel API route
  (`/api/wall-delete`). Toplu indirme: Cloudinary **generate_archive** (ZIP)
  API'si tek dosya üretir. İkisi de sunucu tarafı (secret) fonksiyon.
- Env: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`,
  `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` (client upload için).

### Firestore tarafı (kaynak-doğruluk)
Medya dokümanı Cloudinary `public_id` + `secure_url`'i tutar; moderasyon
`status` alanı Firestore'da; duvar ekranı Firestore'u dinler, byte'ları
Cloudinary CDN'inden çeker (egress Cloudinary'de, Firebase kotasını yemez).

### Duvar ekranı egress notu
Cloudinary bandını korumak için duvar ekranı gösterdiği medyayı **bir kez
indirip bellekte tutar** (tekrar gösterimde yeniden çekmez); film şeritlerinde
küçük transform (thumbnail), orta sahnede daha büyük sürüm.

Limitler (öneri, kesinleşmedi): görsel ≤ 10 MB (client'ta ~1600px'e sıkıştır),
video ≤ 60 sn / ≤ 50 MB, formatlar: jpg/png/webp + mp4/webm.

### Depolama kotası (Firebase Storage ücretsiz/Spark katmanı)

| Kaynak | Ücretsiz limit | Not |
|---|---|---|
| Toplam depolama | **5 GB** | ~0.5–1 MB/foto (sıkıştırınca) → binlerce foto |
| **Günlük indirme (egress)** | **1 GB/gün** | ⚠️ ASIL DARBOĞAZ — depolama değil |
| Yükleme işlemi | 20.000/gün | foto = 2 işlem (thumb+asıl) |
| İndirme işlemi | 50.000/gün | rahat |

**Egress = en kritik kısıt.** Duvar ekranı bir görseli her gösterdiğinde
indirir; büyük perdede saatlerce dönen duvarda aynı fotoğrafı tekrar indirmek
1 GB/gün'ü hızla bitirir. **Zorunlu tasarım kuralları:**
- Duvar ekranı her medyayı **bir kez indirip bellekte tutar** (Object URL /
  blob cache); tekrar gösterimde yeniden indirmez → egress ~%95 düşer.
- Film şeritlerinde **thumbnail**, orta sahnede asıl dosya.
- Client sıkıştırma (mevcut `images.ts` deseni) hem depolama hem egress'i küçültür.

Bu kurallarla ücretsiz katman bir etkinliğe fazlasıyla yeter. Yoğun/çok günlü
kullanımda Blaze (kullandıkça öde) — aynı limitler ücretsiz, üstü kuruşla.
⚠️ Yeni projelerde Storage'ı ilk açış Blaze (kart) isteyebilir; kullanım yine
ücretsiz katmanda kalır. `flowmeter-938a3`'te açarken görülecek.

## Veri modeli (taslak) — AYRI koleksiyon

```
walls/{id}: ownerId, title, joinCode, moderation, theme{}, sessionId,
            sessionStartedAt, createdAt        [presentations'tan bağımsız]
  ├─ sessions/{sessionId}: startedAt, endedAt  [FlowMeter ile aynı desen]
  └─ media/{autoId}: voterId, nickname?, type (image|video),
                     cloudinaryId (public_id), url (secure_url), thumbUrl,
                     status (pending|approved|rejected), w, h, durationMs?,
                     sessionId, createdAt   [create-only; moderasyon owner]
joinCodes/{code}: { id, kind:"wall"|"deck" }   [FlowMeter ile tek havuz]
Cloudinary: klasör walls/{wallId}/{sessionId}/  (asıl dosyalar; thumb = transform)
```

Not: `joinCodes` tek havuz (FlowMeter + FlowWall aynı 6 haneli uzayı paylaşır) →
kod çakışması olmaz; lookup `kind` alanıyla doğru koleksiyona yönlendirir.

Rules (taslak): media create herkese (alan whitelist + status='pending' veya
moderasyon kapalıysa 'approved' — wall dokümanından okunur), update (status)
sadece owner. Dosya byte'ları Firestore'da değil Cloudinary'de → Storage rules
yerine imzalı yükleme + Vercel API route (silme/arşiv) güvenliği.

## Ana sayfa / giriş (karar taslağı)

Üç yüzey ayrı tutulur: **karşılama `/wall`**, **duvar ekranı `/wall/[id]`**,
**yükleme `/u/[id]`**.

**Görsel kimlik = asıl farklılaştırıcı.** FlowMeter temiz/açık/kurumsal (indigo);
FlowWall **etkinlik** ürünü (yılbaşı/düğün/gece) → ana sayfa **koyu, festival
havasında**: koyu lacivert-siyah zemin, renkli halka ışıltılı aksan, arka planda
akan foto-şerit kolajı (demo karolar). Girer girmez "ayrı ürün" hissi.

**Hero = ürünün kendisi.** Ortada perdede görülecek şeyin mini canlı önizlemesi
(akan şeritler + orta kare); üstüne "Duvara katıl · fotoğraf paylaş" + kod kutusu.
Menti mantığı ama gösterir: "etkinliğin böyle görünecek."

**Akıllı tek kod kutusu.** `joinCodes` tek havuz + `kind` → misafir kodu girer,
sistem doğru yere yollar (deck→`/p`, wall→`/u`). QR doğru URL'yi taşıdığı için
bağlam (düğün vs kurumsal) otomatik doğru markaya düşer.

**Organizatör tek yerden.** Paylaşılan `/dashboard`'a sekme **Sunumlar | Duvarlar**;
"+ Yeni duvar" → `walls/{id}`. Ayrı login yok (aynı Google hesabı). Mevcut `/`
landing değişmez (kod çözümü zaten `kind`e göre yönlendirir).

## Rotalar (taslak)

| Rota | İş |
|---|---|
| `/wall/[id]` | Perde ekranı (film şeritleri + orta sahne + QR köşede) |
| `/w/[code]` | kod → yükleme sayfasına yönlendirme (FlowWall kendi kısa yolu) |
| `/u/[id]` | Katılımcı yükleme sayfası (thumb önizleme + % ilerleme + gönder) |
| `/moderate/[code]` | Mevcut sayfa, sekmeli: Sorular \| Medya (kod kind'e göre) |
| Dashboard | Ayrı **"Yeni duvar"** akışı — `walls/{id}` oluşturur (deck değil) |

Not: FlowWall kendi giriş kapısına sahip olur (kendi landing / dashboard bölümü).
"Yeni sunum" akışına bir dropdown olarak GİRMEZ.

## Marka

- Logo: **YAPILDI.** FLOW (lacivert #001e64, O = renkli halka) + "WALL".
  Seçilen yön: **fotoğraf makinesi** (Deklanşör). O halkası orijinalden birebir
  korundu — sadece içindeki bar-chart kamerayla değiştirildi (piksel doğrulaması:
  0 halka pikseli değişti). Varlıklar: `public/logo-flowwall.png` (lacivert),
  `public/logo-flowwall-white.png` (koyu zemin). Üretici script:
  `scratchpad/make_flowwall_logo.py` (mevcut PNG üstüne halka-içi kompozit).
- `Logo.tsx`'e `variant="wall"` eklendi (FlowMeter varsayılanı değişmedi).
- TODO: FlowWall PWA ikonları (icon-192/512, apple-touch — şu an FlowMeter'ınki).
- Landing/dashboard'da iki ürün ayrımı (FlowMeter | FlowWall).

## Fazlar (yapılacağında)

1. **P1 — MVP (sadece görsel)**: mode="wall" + yükleme sayfası (thumb, %,
   gönder) + duvar ekranı (şeritler + orta sahne) + moderasyon sekmesi + rules.
2. **P2 — Video**: süre/boyut limitli video, orta sahnede süresince oynatma.
3. **P3 — Oturum sonu**: ZIP "tümünü indir" + toplu silme + oturum arşivi entegre.
4. **P4 — Cila**: FlowWall logo/landing, tema editörü, wall slayt tipi (FlowMeter
   sunumu içinde), Storage lifecycle temizliği.

## Açık sorular (kullanıcıyla netleşecek)

- Video limitleri (süre/boyut) ve formatlar?
- Moderasyon varsayılanı: açık mı kapalı mı başlasın?
- Medya saklama süresi (otomatik silme?) ve Storage kota bütçesi?
- Duvarda izleyici adı gösterilsin mi (yükleyen kişinin nickname'i)?
- ~~Medya sağlayıcı~~ → KARAR VERİLDİ: Cloudinary (dosya) + Firebase (gerisi).
- Cloudinary yükleme: imzalı (Vercel API route) mı, kısıtlı unsigned preset mi?
- Cloudinary hesabı/env anahtarları Vercel'de tanımlanacak (henüz yok).
