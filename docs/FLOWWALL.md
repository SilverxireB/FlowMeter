# FlowWall — Plan (HENÜZ YAPILMADI — sadece plan)

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

## Medya depolama: takılabilir adaptör (Firebase Storage + Cloudinary)

**Karar:** Medya arka ucu tek bir **adaptör arayüzü** olarak yazılır
(`upload(file, onProgress) → {storagePath, thumbPath, url}`, `remove()`,
`getUrl()`). Sağlayıcı **config/env ile** seçilir — her duvar için UI seçeneği
DEĞİL (gereksiz karmaşıklık). İki adaptör:

### Neden kural 4 FlowWall'da esner
CLAUDE.md kural 4 (**dış servis yok**) *kurumsal ağların* 3. parti CDN'leri
engellemesi yüzündendi ve FlowMeter (kurumsal sunum) için geçerli. FlowWall
senaryosu etkinlik (ev/mekan Wi-Fi + mobil data) → bu kısıt YOK. Yani Cloudinary
FlowWall için meşru bir seçenek (ama FlowMeter tarafında hâlâ kullanılmaz).

### Firebase Storage — P1 varsayılanı (görsel MVP)
- `firebasestorage.googleapis.com`, Firestore ile aynı domain ailesi; tek çatı
  (auth/rules aynı), yeni hesap yok.
- `uploadBytesResumable` → **canlı % ilerleme + duraklat/devam**.
- Thumbnail client-side canvas ile üretilir (mevcut `src/lib/images.ts` deseni).
- ⚠️ Ücretsiz egress **1 GB/gün** dar → duvar ekranı bellek cache'i ZORUNLU.
- ⚠️ **Video'da zayıf: transcode YOK** — telefon `.mov`/HEVC'si oynamayabilir,
  dosya büyük gelir. Bu yüzden video P2'de Cloudinary tercih edilir.

### Cloudinary — P2 (video-ağırlıklı etkinlik) için önerilen
- **Otomatik video transcode** (web-uyumlu mp4 + poster kare) + görsel
  optimizasyon (webp/avif, sunucuda thumbnail) + global CDN.
- Ücretsiz katman ~25 kredi/ay (≈ depolama+bant paylaşımlı havuz; tek günlük
  etkinlik patlamasında Firebase'in 1 GB/gün egress'inden rahat). *Rakamlar
  yaklaşık — başlamadan doğrulanacak.*
- Maliyet: ayrı hesap/API key, imzalı yükleme (upload preset), vendor lock-in.
- Ağ riski etkinlik bağlamında kabul edilebilir; FlowMeter'a sıçramaz.

Özet: P1 Firebase Storage ile başla, adaptörü baştan soyutla, video (P2)
gelince Cloudinary'yi ikinci adaptör olarak ekle.

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
  └─ media/{autoId}: voterId, nickname?, type (image|video), storagePath,
                     thumbPath, status (pending|approved|rejected), w, h,
                     durationMs?, sessionId, createdAt   [create-only; moderasyon owner]
joinCodes/{code}: { wallId }   VEYA ortak lookup'a "kind" alanı
                  (kod çakışmasın diye FlowMeter ile tek havuz önerilir)
Storage: walls/{wallId}/{sessionId}/{mediaId}/original.<ext>
         walls/{wallId}/{sessionId}/{mediaId}/thumb.jpg
```

Not: `joinCodes` tek havuz kalırsa (FlowMeter + FlowWall aynı 6 haneli uzayı
paylaşır) kod çakışması olmaz; lookup dokümanına `kind: "wall"|"deck"` eklenir,
resolve eden taraf doğru koleksiyona gider.

Rules (taslak): media create herkese (alan whitelist + status='pending' veya
moderasyon kapalıysa 'approved' — wall dokümanından okunur), update (status)
sadece owner; Storage rules: boyut/content-type sınırı, silme sadece owner.

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

- Logo: FLOW (lacivert #001e64, O = renkli halka) + "WALL" — `Logo.tsx`'e
  `variant="wall"` eklenir; halka kimliği asla bozulmaz.
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
- Medya sağlayıcı: P1 Firebase Storage kesin; P2 video için Cloudinary'ye
  geçilsin mi yoksa Firebase'de mi kalınsın? (Cloudinary hesabı/kredi bütçesi.)
