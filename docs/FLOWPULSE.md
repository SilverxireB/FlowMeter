# FlowPulse — Sürekli Nabız/Geri Bildirim (4. ürün)

> Meter "an"ı ölçer, Pulse "her gün"ü: duvara asılan kiosk (eski tablet) + poster
> QR'ı ile anonim mikro-geri bildirim; kokpit trend/ısı gösterir; pano FlowSign'a
> gömülür (Pulse ölçer → Sign yayınlar). DIŞ SERVİS SIFIR (Cloudinary bile yok)
> → Kural 4'e tam uyum, self-host'a en kolay ürün.

## İlkeler
- **Anonimlik özelliktir:** sicil/kimlik bilerek YOK (dürüst oy). QR'da günde 1
  oy (localStorage), kioskta cooldown — mükemmel değil, yeterli.
- **Kota bilinci:** oylar günlük özete increment'lenir (`days/{yyyy-mm-dd}`):
  total/sum/counts/hours. 30 günlük trend = 30 doküman okuma.
- Kiosk = Sign player disiplini: wake lock, tam ekran, offline kuyruk
  (persistentLocalCache), köşeye 5 dokunuş + PIN ile çıkış.

## Veri modeli
```
pulses/{id}: ownerId, title, question{type: smiley|nps|yesno|choice, text,
             options?}, cooldownSec, pin, commentsEnabled, moderation,
             threshold(%), createdAt, updatedAt
  ├─ votes/{autoId}: value(0..10), channel(kiosk|qr), createdAt  [create-only]
  ├─ days/{yyyy-mm-dd}: total, sum, counts{deger:n}, hours{saat:{t,s}}
  │    [rules: tek yazımda total tam +1, sum ≤ +10 → şişirme yok]
  └─ comments/{autoId}: text(≤200), status, createdAt  [moderasyon sahibinde]
```
Skor: %0–100 normalize — smiley (avg-1)/4, nps avg/10, yesno avg. choice →
skor yok, dağılım grafiği.

## Rotalar
| Rota | İş |
|---|---|
| `/pulse` | Nokta listesi (bugünkü skorlar yan yana = karşılaştırma) + oluştur |
| `/pulse/[id]/manage` | Kokpit: bugün+düne fark, 30g trend, gün×saat ısı, dağılım, yorum moderasyonu, ayarlar (eşik/fren/PIN), PDF rapor, QR |
| `/pulse/[id]/kiosk` | Kiosk yüzü (public): dev butonlar, teşekkür, cooldown, wake lock |
| `/pulse/[id]/vote` | Telefon oyu (poster QR): günde 1 oy + opsiyonel anonim yorum |
| `/pulse/[id]/board` | Sonuç panosu (public): büyük skor + 7g trend + oy QR — FlowSign'a URL öğesi olarak gömülür |

## Fazlar — HEPSİ v1'de geldi
✅ Nokta CRUD + 4 soru tipi (smiley/NPS/evet-hayır/çoktan seçmeli)
✅ Kiosk + QR kanalları · günlük rollup · canlı bugün skoru
✅ Trend + gün×saat ısı matrisi + dağılım (saf CSS)
✅ Yorum + moderasyon · eşik uyarısı · PDF rapor (jspdf)
✅ Pano (Sign köprüsü) · noktalar arası karşılaştırma (liste)
⬜ Sonraki: profanity filtresi (yorumlar), e-posta eşik uyarısı, kiosk çoklu
   soru rotasyonu, alan-seviyesi haftalık hedefler.

## Marka
Logo: FLOW O-halkası içinde **EKG nabız çizgisi** + "PULSE"
(logo-flowpulse.png/-white.png; dönüşümlü logoda 4. adım). Kokpit AYDINLIK ürün
(Meter ailesi, accent indigo); kiosk/pano nötr koyu (#101014). Skor semantiği:
yeşil ≥70 · amber ≥40 · gül <40 (dataviz — marka gülü uyarı kuralıyla uyumlu).
