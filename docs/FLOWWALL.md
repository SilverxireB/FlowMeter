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

---

## 🧺 FİKİR HAVUZU (harmanlanmış — okuyup çıkaracağız)

> **Nasıl kullanılır:** Burası ürün+özellik fikirlerinin tek toplandığı yer.
> `[x]` = yapıldı/canlıda · `[ ]` = havuzda (henüz seçilmedi). Okuyup birini
> seçince kurmaya geçeriz; istemediğimizi satırı silerek çıkarırız. **Yaşayan
> liste** — proje ilerledikçe yenileri eklenir. Öncelik: **önce ürün & özellik**;
> güvenlik / ürün satışı / pricing en sonda ("Sonraki planlar").

### ✅ Canlıda (tamam)
- [x] 5 perde modu (Sahne · Mozaik · Spot · Polaroid · Sinema) + 🔀 Otomatik geçiş
- [x] Tema presetleri + özel arka plan + Yılbaşı karı · yazdırılabilir QR kartı
- [x] Çoklu yükleme (karo ızgara, canlı %) · moderasyon · ZIP indir · kalıcı silme
- [x] Duvarı gez sekmesi + ❤ beğeni + "Benimkiler" + perdede 👑 En sevilen
- [x] Admin paneli (kullanıcı yönetimi)

### 🎬 Blok A — Perde şovu (görsel deneyimi büyüt)
- [ ] Canlı emoji/kalp yağmuru (misafir gönderir → perdeye düşer; FlowMeter reactions taşınır)
- [ ] Özel an / geri sayım (gece yarısı, düğün "kesim anı") → perdede konfeti + kutlama
- [ ] Anı/dilek mesajları (foto değil yazılı not; akan "dilek bandı")
- [ ] Perde müziği (WebAudio ambient, dış servis yok)
- [ ] Temaya özel efektler (düğün kalp, parti balon/konfeti — kar zaten var)

### 🎪 Blok B — Etkinliğe hazır ol (operasyonel şart)
- [ ] Yaşam döngüsü: duvarı kapat (perdede "teşekkürler") + yeni oturum (sessionId rotasyonu)
- [ ] Kokpit istatistik/özet: kaç anı, kaç katılımcı, en aktif kişi, en sevilenler
- [ ] Öne çıkar / gizle / sabitle (bir fotoyu perdede öne al ya da düşür)
- [ ] Cloudinary toplu temizlik (duvar silinince delete_by_prefix)

### 📱 Blok C — Katılım deneyimi (misafir tarafı)
- [ ] Anlık çekim (dosya seçmeden direkt kamera — capture)
- [ ] Foto çerçevesi / sticker (yüklerken etkinlik çerçevesi ekle)
- [ ] "Duvarda göründün!" (foton perdeye düşünce telefonda ışıldar)
- [ ] Masa/grup etiketi (hangi masadan — QR başına)

### 💝 Blok D — Etkinlik sonu / hatıra
- [ ] Otomatik kolaj/kapak (etkinlik özeti tek görsel, canvas)
- [ ] Paylaşılabilir galeri linki (sonrasında misafirlere read-only galeri)
- [ ] "En sevilenler" özeti / highlight turu

### ✨ Taze fikirler (2026-07 — eğlence / duygusal / yeni perde)
- [ ] **Foto yarışması + oylama** (en iyi kostüm/kare; misafir oylar, kazanan perdede — FlowMeter köprüsü)
- [ ] **Sesli/video tebrik kabini** (10 sn tebrik, moderasyonlu, perdede dalga formu)
- [ ] **Hatıra kitabı (PDF)** (tüm foto + dilek mesajları tek şık PDF, "anı defteri")
- [ ] Foto booth / boomerang (seri çekim → kısa döngü GIF, client-side)
- [ ] Canlı doodle/etiket (yüklemeden önce fotonun üstüne çizim/yazı/sticker)
- [ ] "Bu kim?" oyunu (çocukluk fotoğrafı tahmini — buz kırıcı, FlowMeter köprüsü)
- [ ] Milestone kutlamaları (100. foto → konfeti; "günün karesi" otomatik)
- [ ] **Zaman tüneli modu** (kronolojik akış, saat damgalı — 6. perde modu)
- [ ] Baskın renk ambiyansı (yüklenen fotonun renginden perde teması canlı değişir)
- [ ] Canlı anons/isim bandı (perde altı ticker: organizatör duyurusu + "X paylaştı")

### 🔗 Köprü — İki ürün birleşsin
- [ ] FlowMeter sunumuna canlı "wall" slayt tipi + video sesi aç/kapat + video süre limiti

### 🔒 Sonraki planlar (ŞİMDİLİK PARK — ürün oturunca)
- [ ] Güvenlik: anonim-auth (guest self-delete), imzalı yükleme, boyut/format/rate limit, AI moderasyon
- [ ] Ayrı domain / marka
- [ ] Ürün satışı / pricing / paketler

---

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

## Gelecek planı (2026-07-19 tartışması — önceliklendirilmiş)

**Dalga 1 — Etkinliğe hazır olmak (ilk gerçek etkinlikten önce şart):**
1. ✅ **Duvar teması** (YAPILDI — Gemini): `WALL_THEME_PRESETS` (Varsayılan/
   Yılbaşı ❄️/Düğün 💍/Parti 🎉/Kurumsal) + `wallThemeStyle()`, özel arka plan
   görseli (base64), Yılbaşı kar efekti (`Snowflakes.tsx`), kokpitte tema seçici
   + canlı `WallPreview` önizleme. `wall.theme{}` owner-write (rules değişmedi).
2. ✅ **Yazdırılabilir QR kartı** (YAPILDI — Gemini): `WallQrCard.tsx` — temaya
   göre renklenen A6 Canvas PNG ("📸 Anını paylaş" + QR + kod), kokpitte
   "🖨 QR Kartı indir". *Not: kağıda basılan URL sabit (`flowmetermanisa.vercel.app`);
   QR'ın kendisi dinamik origin — domain değişirse yalnız yazı güncellenmeli.*
3. **Duvar yaşam döngüsü** (SIRADAKİ): kapat (yükleme durdur, perde "teşekkürler"),
   yeni oturum (sessionId rotasyonu; FlowMeter'daki desen aynen).
4. **Cloudinary toplu temizlik**: duvar/oturum silinince delete_by_prefix
   API route (şu an tek tek siliniyor).

**Dalga 2 — Deneyimi büyüten:**
5. ✅ **Perde modları** (YAPILDI): kokpitten `wall.screenMode` — **Sahne** (mevcut
   resital) · **Mozaik** (5 sütun kayan ızgara) · **Spot** (rastgele öne çıkan +
   soluk arka halka) · **Polaroid** (arkada saçılan kartlar + önde tek büyük
   polaroid döner) · **Sinema** (tam ekran Ken Burns + altta akan film şeridi) ·
   **Otomatik** (seçili modlar arasında `autoIntervalSec` aralıkla kendiliğinden
   geçer — `autoModes[]` ile hangi modlar döner seçilir). İkonlu seçici + canlı geçiş.
6. ✅ **Misafir galerisi + beğeni** (YAPILDI): `/u/[id]` sekmeli (Yükle | Duvarı
   gez); gez'de onaylı medya masonry, ❤ beğen (`media.likes` +1, localStorage
   dedup, rules herkese-açık +1), "Benimkiler" filtresi + "senin" rozeti. Perdede
   tüm modlarda ❤ rozeti + 👑 **En sevilen** (en çok beğenilen anı öne çıkar).
   *Açık: "kendi yüklediğini silme" — anonim misafirin kimliği sunucuda
   doğrulanamaz (Altın Kural 1 + Firestore delete gövde taşımaz), güvenli değil;
   çözüm anonim-auth (Dalga 3 #10) ya da sahibe "kaldırılmasını iste" akışı.*
7. **Slayt köprüsü**: FlowMeter sunumuna "wall" slayt tipi (sunum ortasında
   canlı duvar) — iki ürünün kesişim vuruşu.
8. **Video sesi** opsiyonu (perdede aç/kapat) + video süre limiti ayarı.

**Dalga 3 — Güvenlik/ölçek/ticarileştirme:**
9. **İçerik güvenliği**: Cloudinary AI moderation add-on (müstehcen/şiddet
   otomatik reddi) — moderasyonsuz düğünlerde sigorta.
10. **İmzalı yükleme + limitler**: unsigned preset yerine /api/wall/sign,
    dosya boyutu/format/rate limit.
11. **Ayrı domain/marka**: flowwall.app benzeri ayrı domain (o zaman ayrı PWA
    kimliği de anlamlı olur — not: aynı origin'de ikinci manifest ÇALIŞMAZ,
    denendi ve geri alındı).
12. **Fiyatlandırma taslağı**: ücretsiz N medya/duvar; etkinlik başı paket.

## Açık sorular (kullanıcıyla netleşecek)

- Video limitleri (süre/boyut) ve formatlar?
- Moderasyon varsayılanı: açık mı kapalı mı başlasın?
- Medya saklama süresi (otomatik silme?) ve Storage kota bütçesi?
- Duvarda izleyici adı gösterilsin mi (yükleyen kişinin nickname'i)?
- ~~Medya sağlayıcı~~ → KARAR VERİLDİ: Cloudinary (dosya) + Firebase (gerisi).
- Cloudinary yükleme: imzalı (Vercel API route) mı, kısıtlı unsigned preset mi?
- Cloudinary hesabı/env anahtarları Vercel'de tanımlanacak (henüz yok).
