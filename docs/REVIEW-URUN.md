# FlowMeter & FlowWall — Ürün / Pazarlama / İş İncelemesi

> Bu rapor koddan ve dokümandan (CLAUDE.md, FLOWWALL.md, ROADMAP.md, SITEMAP.md +
> gerçek UI dosyaları) doğrulanarak yazıldı. Uydurma özellik yok; her tespit
> ilgili akışa dayanır. Değerlendirme dört persona gözünden yapıldı:
> **kullanıcı testçisi, iş analisti, pazarlamacı, etkinlik organizatörü.**
> Tarih: 2026-07-22.

---

## 1. Özet — Ürün Olgunluğu

FlowMeter, Mentimeter'ın şaşırtıcı derecede tam bir klonu: 15+ slayt tipi (MC,
kelime bulutu, quiz seçmeli/yazarak, pin-on-image, 100 puan, 2x2 grid, sayı
tahmini, sıralama, Q&A, leaderboard), canlı `onSnapshot` senkronu, Menti
formülüyle quiz puanı + seri bonusu, podyumlu skor tablosu, canlı sohbet, emoji
tepkileri, oturum arşivi, şablon galerisi, CSV export ve PWA. Teknik olgunluk
yüksek; **çekirdek deneyim gerçek bir etkinlikte kullanılabilir durumda.**
FlowWall ise aynı altyapı üzerine kurulmuş, kendi giriş kapısı/markası olan
**ayrı bir ürün** — canlı foto/video duvarı: 6 perde modu + otomatik karışım,
8 tema, 8 ambient efekt, moderasyon, dilekler, canlı anons, foto yarışması,
milestone kutlamaları, hatıra kitabı (PDF), kolaj ve ZIP indirme ile
**özellik açısından fazlasıyla zengin, hatta bazı yerlerde aşırı-donanımlı.**

Ana boşluk teknik değil **ürünleşme** tarafında: fiyatlandırma/paket yok,
güvenlik-moderasyon-rate limit park edilmiş, i18n yok (yalnız TR), pazarlama
yüzeyi (landing değer önerisi, onboarding, dönüşüm) neredeyse hiç yok. Yani
"iyi çalışan bir uygulama" var; "satılabilir bir ürün" için son %20 eksik.

---

## 2. Güçlü / Beğenilen Yönler

**Ürün & teknik**
- **Çift ürün, tek altyapı** stratejisi zekice: `walls/{id}` ayrı koleksiyon,
  `joinCodes` tek havuz + `kind` alanı ile deck/wall aynı 6 haneli uzayı
  çakışmadan paylaşıyor (`resolveCode`). Bakım maliyeti düşük, ürün ayrımı net.
- **Menti paritesi gerçekten yüksek.** Sunum tarafında "X/Y yanıtladı" sayacı,
  bağlamsal "sonraki slayt adı" butonu, kalıcı katıl-pili, mini QR, atlanan
  slaytları geçen gezinme, sonuç gizle/göster — hepsi Menti detaylarını
  yakalamış (`present/[id]/page.tsx`).
- **Realtime disiplini** CLAUDE.md kuralına sadık: polling yok, her yer
  `onSnapshot`. Ölçek bilinci var — misafir telefonu tüm koleksiyonu dinlemiyor
  (`watchWallMediaByVoter` / `watchWallMediaRecent(150)`), yalnız perde tümünü dinler.
- **Sunucu tarafı oy kapıları rules'ta** (ended/votingClosed reddi, aktif oturum
  eşleşmesi, quiz süre penceresi) — istemci kurcalaması aşamaz. Ciddi bir güvenlik olgunluğu.
- **Kota kök-sorunu belgelenmiş** (ROADMAP: Spark yazma kotası dolunca yazmaların
  askıya alınması → "buton donuyor"). Bu tür kurumsal hafıza değerli.

**FlowWall etkinlik deneyimi**
- **Duygusal kancalar iyi tasarlanmış:** "Duvarda göründün!" kutlama overlay'i
  (`/u` sayfası, sadece kendi medyanı dinleyerek), milestone konfetisi, "En
  Sevilenler" turu, baskın renk ambiyansı. Bunlar Menti/Slido'da olmayan,
  düğün/parti hissini büyüten dokunuşlar.
- **Hatıra çıktıları farklılaştırıcı:** hatıra kitabı PDF (foto + dilekler),
  kolaj, ZIP toplu indirme — etkinlik sonrası "değer teslimi" net.
- **Kokpit organizatör için düşünülmüş:** özet kartı (anı/katılımcı/toplam ❤/
  dilek/en aktif/en sevilen), canlı anons süreli banner, foto yarışması,
  moderasyon sekmesi rozetli.
- **Görsel kimlik ayrımı doğru:** FlowMeter açık/kurumsal (indigo), FlowWall
  koyu/festival (lacivert zemin, yüzen renk karoları). Girer girmez "ayrı ürün" hissi.

---

## 3. Geliştirilmesi Gereken Yönler (persona bazlı, önem sıralı)

### KRİTİK

**[Organizatör / Güvenlik] Moderasyon varsayılanı KAPALI + yükleme koruması yok**
`createWall` `moderation: false` ile başlıyor (`src/lib/walls.ts:65`). Yani yeni
bir düğün duvarında organizatör bilinçli açmazsa, **kodu bilen herkes onaysız
istediği fotoğrafı/videoyu doğrudan büyük perdeye basar.** Cloudinary yüklemesi
imzasız (unsigned preset), rate limit yok, içerik/AI moderasyonu park edilmiş
(FLOWWALL "Dalga 3"). Gerçek bir etkinlikte tek bir kötü niyetli/uygunsuz
gönderi büyük ekranda görünür — düğünde felaket senaryosu. **En az:** düğün/parti
temasında moderasyon varsayılan AÇIK; kişi başı yükleme tavanı; dosya boyut/format
guard; opsiyonel profanity/AI görsel moderasyon. Bu, "gerçek etkinliğe hazır"
olmanın ön koşulu.

**[Testçi / Organizatör] Kalabalık & çevrimdışı senaryosu doğrulanmamış**
Perf maddesi hâlâ açık (ROADMAP Faz 4: "100+ eşzamanlı izleyici için gözden
geçirme"). FLOWWALL kapasite analizi 500 kişi/4 saat için **Cloudinary ücretsiz
tier'ın gerçek tavanı** olduğunu söylüyor (videolu 1 etkinlik ≈26 kredi, aylık
2 büyük etkinlik aşar). Düğün salonlarında Wi-Fi zayıf; yükleme hatası yalnızca
"⚠" karesiyle bildiriliyor, otomatik retry/kuyruk yok. Gerçek etkinlik öncesi
yük testi + zayıf ağ davranışı (retry, sıraya alma) şart.

**[İş analisti] Fiyatlandırma / paket / ticari model YOK**
Ne FlowMeter ne FlowWall'da paywall, kota, plan ya da "satın al" akışı var.
Landing'de organizatör CTA'sı bile gizli. Ürün teknik olarak hazır ama **gelir
üretemez.** Cloudinary maliyeti etkinlik başına gerçek para olduğundan, model
kurulmadan ölçeklenmek doğrudan zarar demek (bkz. §5).

### ÖNEMLİ

**[Testçi] FlowMeter landing = değer önerisi sıfır**
`/` yalnızca 6 haneli kod kutusu ("Sunuma katıl") + footer'da "FlowMeter" yazısı.
Ürünün ne olduğunu, kime yaradığını anlatan tek satır yok; organizatör girişi
bilinçli olarak gizli (`/dashboard`). Menti'de bile landing ürünü satar. İlk kez
gelen bir organizatör "bu nedir, ben nasıl sunum yaparım" sorusunun cevabını bulamaz.

**[Organizatör] FlowWall misafir kimliği zayıf**
`/u` sayfasında ad "opsiyonel" ve avatar yok (FlowMeter'daki zengin avatar
seçimi burada kullanılmıyor). "Kendi yüklediğini silme" güvenli değil (anonim
misafir sunucuda doğrulanamıyor — kod yorumunda açıkça belirtilmiş). Sonuç:
misafir yanlış foto atarsa yalnız organizatöre "sildir" diye ulaşabiliyor.
Anonim-auth (park edilmiş) bunu çözer; şu an gerçek etkinlikte sürtünme.

**[Testçi] Kağıda basılı QR kartında domain sabit**
`WallQrCard` metninde URL statik (`flowmetermanisa.vercel.app`), yalnız QR
dinamik origin taşıyor (FLOWWALL notu). Domain değişince basılı kartlar yanlış
adres gösterir. Marka/domain kararı verilmeden basılı materyal riskli.

**[İş analisti] i18n yok — pazar TR ile sınırlı**
UI tamamen Türkçe (kural gereği), i18n park (ROADMAP Faz 4). Kurumsal/eğitim
segmentinde ve ihracatta İngilizce şart. Mevcut haliyle yalnız TR pazarı.

**[Testçi] FlowMeter'da audience-pace (kendi hızında anket) modu yok**
ROADMAP'te açık kalan Menti "must-have"i. Sunucusuz async anket/geri bildirim
senaryosu (ör. eğitim sonrası form) desteklenmiyor — sadece canlı sunum var.

### NICE-TO-HAVE

- **[Testçi] Boş durumlar iyi ama tutarsız:** dashboard/duvar boş ekranları güzel;
  ancak perde ekranı medya yokken misafire ne göstereceği (ilk foto gelene kadar)
  net değil — "ilk anıyı sen ekle" çağrısı perdede zayıf.
- **[Testçi] `prompt()`/`confirm()` ile yeniden adlandırma / klasör taşıma**
  (dashboard) — mobilde ve markalı üründe kaba durur; modal'a taşınmalı.
- **[İş analisti] FlowWall'da etkinlik-sonrası paylaşılabilir galeri linki yok**
  (fikir havuzunda var, yapılmadı). Misafirlere read-only galeri viral kanal olurdu.
- **[Genel] Doküman tutarsızlığı:** CLAUDE.md "kalanlar" arasında "Guess the
  Number"ı sayıyor ama ROADMAP'te tamamlanmış görünüyor — kalan-iş listeleri güncellenmeli.

---

## 4. Eksik / Ek Talep Edilebilecek Özellikler (gerekçeli fikir havuzu)

**Güven & operasyon (en yüksek getiri)**
- **Tema-duyarlı moderasyon varsayılanı + "güvenli mod":** düğün/parti seçilince
  moderasyon otomatik açık, ilk N gönderi hızlı onay. Gerekçe: §3 KRİTİK riski kapatır.
- **Kişi başı ve duvar başına yükleme tavanı + rate limit + boyut guard.**
  Gerekçe: hem kötüye kullanımı hem Cloudinary maliyet patlamasını sınırlar
  (FLOWWALL kapasite analizi bunu zaten "en büyük kaldıraç" sayıyor).
- **Yükleme kuyruğu + otomatik retry (zayıf ağ):** gerekçe: düğün salonu Wi-Fi'si.

**Değer teslimi / viral**
- **Etkinlik-sonrası read-only galeri linki + "hatıra e-postası":** misafir
  ertesi gün tüm anılara + kendi PDF hatıra kitabına ulaşsın. Gerekçe: düğünde en
  yüksek duygusal değer + organik büyüme (misafir = gelecekteki organizatör).
- **Sesli/video tebrik kabini** (fikir havuzunda var): 10 sn moderasyonlu tebrik,
  perdede dalga formu. Gerekçe: düğün segmentinde güçlü duygusal kanca.
- **Masa/grup etiketi (QR başına):** "hangi masadan" — kurumsal ve düğün oturma
  düzeni için hem eğlence hem veri.

**FlowMeter derinleştirme**
- **Audience-pace anket modu** (§3): async geri bildirim/eğitim senaryosu.
- **PowerPoint/Google Slides/Zoom/Teams entegrasyonu (veya en azından "slaytı
  dışa aktar/embed"):** gerekçe: kurumsal segmentte Menti/Slido'nun en güçlü
  kozü bu; olmadan kurumsalda rekabet zor.
- **Sonuç PDF/PNG raporu** (şu an yalnız CSV): sunum sonrası paylaşılabilir özet.

**İki ürün köprüsü**
- **FlowMeter sunumuna "wall slaytı":** sunum ortasında canlı foto duvarı
  (ROADMAP Dalga 2 #7). Gerekçe: kurumsal etkinlikte iki ürünü tek üründe satar,
  çapraz-değer yaratır.

---

## 5. Pazarlama & Konumlandırma Önerileri (fiyatlandırma dahil)

### Konumlandırma — asıl kanca FlowWall, FlowMeter destekleyici

FlowMeter **tek başına** Mentimeter/Slido/Kahoot'a karşı farklılaşmıyor: onlar
yerleşik, ücretsiz katmanlı, entegrasyonlu. "Bir Menti klonu daha" olarak
konumlanmak kaybettirir. **Gerçek farklılaştırıcı FlowWall** — canlı etkileşimli
oylama + canlı foto/video duvarı + hatıra çıktıları **tek platformda**, Türkçe,
**etkinlik odaklı**. Slido'da foto duvarı yok; düğün duvarı uygulamalarında
oylama/quiz yok; ikisini + hatıra kitabı PDF'ini birleştiren yerli oyuncu az.

**Önerilen mesaj:** "Etkinliğinizi canlandırın: misafirler telefonundan anını
paylaşır, oy verir, perdede birlikte parlarsınız — ve tüm anılar sizde kalır."
FlowMeter'ı "kurumsal/eğitim etkileşimi", FlowWall'ı "kutlama/etkinlik anısı"
olarak ayır; ortak çatı marka + tek dashboard.

### Hedef segmentler (öncelik sırası)
1. **Düğün / nişan / kına** — en yüksek duygusal değer, hatıra kitabı PDF burada
   parlıyor, tek seferlik ama yüksek ödeme isteği. FlowWall'ın sweet spot'u.
2. **Kurumsal etkinlik / lansman / gala** — bütçe var, moderasyon şart, marka/
   sponsor bindirme (Cloudinary logo overlay fikri) burada satar.
3. **Parti / yılbaşı / mezuniyet** — düşük ödeme, yüksek hacim; viral/ücretsiz kanal.
4. **Eğitim / eğitmen** — FlowMeter quiz/leaderboard; freemium abonelik segmenti.

### Fiyatlandırma fikri (maliyet-hizalı)
- **FlowWall = etkinlik başına paket** (abonelik değil). Cloudinary maliyeti
  etkinlik başına gerçek para olduğundan bu model hem doğal hem kârlı:
  - *Ücretsiz/Demo:* 1 duvar, ~30 medya, filigranlı, video kapalı, hatıra kitabı yok.
  - *Etkinlik paketi:* tek etkinlik, yüksek medya tavanı, video açık, moderasyon +
    AI güvenlik, hatıra kitabı PDF + ZIP + galeri linki dahil. (Değer bazlı fiyat;
    düğün için tek seferlik ödeme kabul görür.)
  - *Kurumsal/Pro etkinlik:* marka/sponsor bindirme, ayrı domain, öncelikli destek.
- **FlowMeter = freemium abonelik** (Menti modeli): ücretsiz sınırlı soru/katılımcı;
  Pro aylık (sınırsız slayt, quiz, export, marka logosu, oturum arşivi).

### Viral / paylaşım kancaları (koddaki mevcut varlıkları kullan)
- **QR kartı + "Duvarda göründün"** zaten var → her paylaşımın altına küçük
  "FlowWall ile" imzası (ücretsiz katmanda) organik dağıtım sağlar.
- **Etkinlik-sonrası galeri/hatıra e-postası** (öneri) = misafir → gelecekteki
  organizatör dönüşüm hunisi.
- **Kolaj / hatıra kitabı** sosyal medyada paylaşılınca marka görünürlüğü.

### Onboarding & dönüşüm noktaları (şu an eksik)
- FlowMeter landing'e organizatör için net bir "ücretsiz dene" CTA + 20 saniyelik
  canlı demo (kod `123456` ile hazır demo sunumu).
- FlowWall landing'de "kendi duvarını oluştur" zaten var ama login'e düşüyor;
  önce **login'siz demo duvar** deneyimi + sonra kayıt = dönüşüm artışı.
- Dönüşüm ölçümü yok — en azından temel funnel analitiği (duvar oluşturuldu →
  ilk medya → etkinlik günü → çıktı indirildi) eklenmeli.

---

## 6. Öncelikli Yol Haritası Önerisi (sonraki 3-5 adım)

1. **"Gerçek etkinliğe hazır" güvenlik paketi (KRİTİK):** tema-duyarlı moderasyon
   varsayılanı (düğün/parti = açık), kişi başı/duvar başına yükleme tavanı,
   dosya boyut/format guard, yükleme rate limit. → §3 KRİTİK riskini kapatır,
   ilk ücretli etkinliğin ön koşulu.
2. **Kapasite & zayıf-ağ sağlamlaştırma:** Cloudinary upload preset'te gelen
   dönüşüm (max ~1920px + q_auto — FLOWWALL "en büyük etki" maddesi), yükleme
   retry/kuyruk, 500 kişilik yük testi. → maliyet + güvenilirlik.
3. **Ticari model iskeleti:** etkinlik-başı paket + ücretsiz demo katmanı,
   basit paywall/kota, temel funnel analitiği. Cloudinary maliyeti kontrol
   altına alındıktan sonra. → ürünü gelire bağlar.
4. **Değer teslimi & viral döngü:** etkinlik-sonrası read-only galeri linki +
   hatıra e-postası, ücretsiz katmanda hafif "FlowWall ile" imzası. → organik büyüme.
5. **Landing & onboarding cilası + i18n başlangıcı:** FlowMeter landing değer
   önerisi + login'siz demo, dashboard'daki `prompt/confirm`'leri modal'a taşı,
   TR/EN altyapısı. → dönüşüm + pazar genişlemesi.

> Sıralama mantığı: önce **gerçek bir etkinlikte güvenle çalışsın** (1-2), sonra
> **para kazandırsın** (3), sonra **kendi kendini büyütsün** (4-5). Özellik zaten
> bol; eksik olan olgunlaşma ve ürünleşme.
