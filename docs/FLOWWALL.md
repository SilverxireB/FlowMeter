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

## Mimari karar: neden aynı çatı?

FlowMeter'da hazır olan ve aynen kullanılacaklar:
- QR + 6 haneli kod (`joinCodes`), katılım akışı
- `/moderate` moderasyon sayfası (medya sekmesi eklenecek)
- `sessionId` + `sessions/` oturum arşivi deseni
- `onSnapshot` canlı altyapı, Firebase Auth, rules desenleri
- Tasarım sistemi (Tailwind bileşen sınıfları), Vercel deploy hattı

Gelecek sinerji: FlowMeter sunumu İÇİNE **"wall" slayt tipi** (sunum ortasında
"fotoğraf atın" ekranı) — ayrı uygulamada bu imkânsız olurdu.

## Medya depolama: Firebase Storage (Cloudinary DEĞİL — şimdilik)

CLAUDE.md kural 4: **dış servis yok** (kurumsal ağlar 3. parti CDN engeller;
Cloudinary daha önce bu yüzden elendi). `firebasestorage.googleapis.com`,
Firestore ile aynı domain ailesi → Firestore çalışan ağda Storage da çalışır.
Storage ayrıca isteneni doğrudan karşılar:
- `uploadBytesResumable` → **canlı % ilerleme + duraklat/devam** (istenen UX)
- Thumbnail ayrı dosya olarak yüklenir (client-side canvas ile üretim;
  görsel sıkıştırma için mevcut `src/lib/images.ts` deseni genişletilir)
- İndirme URL'leri, silme, lifecycle kuralları
Cloudinary yalnızca ağır video transcode ihtiyacı doğarsa yeniden değerlendirilir
(o durumda da kurumsal ağ riski KABUL edilerek).

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

## Veri modeli (taslak)

```
presentations/{id}: mode = "wall" (mevcut mode alanı; FlowMeter deck'lerinden ayrışır)
                    + wallModeration, theme{}, joinCode, sessionId … (mevcut alanlar)
  └─ media/{autoId}: voterId, type (image|video), storagePath, thumbPath,
                     status (pending|approved|rejected), w, h, durationMs?,
                     sessionId, createdAt        [create-only; moderasyon owner]
Storage: walls/{presentationId}/{sessionId}/{mediaId}/original.<ext>
         walls/{presentationId}/{sessionId}/{mediaId}/thumb.jpg
```

Rules (taslak): media create herkese (alan whitelist + status='pending' veya
moderasyon kapalıysa 'approved' — sunum dokümanından okunur), update (status)
sadece owner; Storage rules: boyut/content-type sınırı, silme sadece owner.

## Rotalar (taslak)

| Rota | İş |
|---|---|
| `/wall/[id]` | Perde ekranı (film şeritleri + orta sahne + QR köşede) |
| `/w/[code]` veya mevcut `/join/[code]` | kod → yükleme sayfasına yönlendirme |
| `/u/[id]` | İzleyici yükleme sayfası (thumb önizleme + % ilerleme + gönder) |
| `/moderate/[code]` | Mevcut sayfa, sekmeli: Sorular \| Medya |
| Dashboard | "Yeni FlowWall" kartı (mode="wall" sunum oluşturur) |

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
