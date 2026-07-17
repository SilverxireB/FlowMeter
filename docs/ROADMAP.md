# FlowMeter — Yol Haritası

Mentimeter'ın en çok kullanılan özelliklerinden başlayarak adım adım klonluyoruz.
Referans: Menti'de slayt tipleri (Multiple Choice, Word Cloud, Open Ended, Scales,
Ranking, Q&A, Quiz Select/Type Answer, Guess the Number, 100 Points, 2x2 Grid,
Pin on Image), tema/marka sistemi, emoji reactions, şablon galerisi, sonuç exportu.

## Faz 1 — MVP ✅ TAMAMLANDI

- [x] Next.js + Tailwind + Firebase iskeleti, Vercel'e deploy
- [x] Landing: 6 haneli kod girişi (yalnızca katılım; sunucu girişi /dashboard)
- [x] Google auth + dashboard CRUD + slayt editörü
- [x] /present: canlı sonuçlar, katılım (QR) ekranı, klavye gezinme
- [x] /p/[id]: auth'suz oylama, mükerrer oy engeli, nickname+emoji kimliği
- [x] Slayt tipleri: multiple-choice, word-cloud, open-ended, scales, ranking, content
- [x] Canlı senkron (editörden ve present'ten), canlı katılımcı sayacı/rozetleri
- [x] Her slaytta mini QR; firestore.rules v2
- [x] Tasarım sistemi: rose+blue, Fredoka/Nunito, claymorphism (ui-ux-pro-max önerisi)

## Faz 2 — Kişiselleştirme & Görsellik ✅ (küçük kalanlar aşağıda)

### 2a. Avatar sistemi ✅
- [x] @dicebear adventurer stiliyle client-side SVG avatarlar (dış servis yok)
- [x] Katılım ekranında 24'lü galeri + 🎲 karıştır butonu
- [x] Rozetler, karşılama ekranı ve izleyici başlığında avatar
- [x] Eski emoji kayıtları geriye uyumlu

### 2b. Tema & marka (sunum başına görsel kimlik)
- [x] `presentations.theme{}` alanı: preset + arka plan + logo
- [x] Hazır tema galerisi (8 tema, koyu/açık uyumlu)
- [x] Arka plan görseli: sıkıştır + Firestore, otomatik karartma; present + audience
- [ ] Görsel altyapısı — **dış servis YOK** (kurumsal ağlar 3. parti CDN'leri
      engelliyor; Cloudinary denendi, elendi). Kural: yalnızca uygulamanın
      zaten kullandığı domain'ler (kendi Vercel domain'imiz + firestore.googleapis.com).
      - Hazır arka planlar: `public/backgrounds/` (repo içi, 8-10 WebP + degradeler)
      - Logo / slayt görseli / özel arka plan: tarayıcıda canvas ile sıkıştır
        (logo ~64KB, görsel max 1600px/~400KB) → base64 → Firestore alanı
        (1MB doküman limitine otomatik sığdırma + boyut hatası mesajı)
- [x] Marka logosu: present başlığı, katılım ekranı ve audience başlığında
- [x] Editörde 🎨 Tema paneli

### 2c. Editör güçlendirme (sunum hazırlama)
- [x] Slayt ayarları: çoklu seçim (MC), kişi başı N cevap (WC/open-ended)
- [x] Sonuçları gizle/göster (present 🙈/👁)
- [x] Slayt sıralama (↑/↓) ve çoğaltma
- [x] Slayta görsel ekleme (soru yanında sıkıştırılmış görsel — tüm soru tipleri)
- [x] Canlı önizleme: editörde temalı slayt önizlemesi + film şeridi mini kartları
- [x] Otomatik kaydetme (600ms debounce — Kaydet butonu kalktı)

### 2d. Sunum kontrolü
- [x] Oylamayı kapat/aç düğmesi (present altbilgisi)
- [x] Cevapları sıfırla (slayt başına, onaylı; rules'da owner-delete)
- [x] Sunumu bitir (isLive=false → izleyici bekleme ekranına döner)
- [x] Tam ekran (⛶); koyu temalar tema galerisinde

## Faz 3 — Etkileşim & Rekabet

- [x] **Emoji reactions**: ❤️👍🎉 sağ alt köşeden uçuşur + canlı sayaç
- [x] **Quiz**: doğru cevap işaretleme (editör), süre bazlı puan (500 taban +
      hız bonusu), 🏆 skor tablosu (avatar + nickname, madalyalar)
- [x] Kazanan konfetisi (skor tablosu açılınca)
- [x] **Q&A**: izleyici soru gönderir + upvote (tek oy); moderasyon (gizle/göster/sil)
- [x] **Guess the Number** (Sayı Tahmini) slayt tipi (histogram + doğru sayı + ortalama)
- [ ] Audience-pace (anket modu): izleyici kendi ilerler, bitiş ekranı
- [x] Quiz kişisel sonucu: izleyici kendi doğru/yanlış + puanını telefonunda görür

## Faz 3.5 — Menti Eşitleme Turu ✅ (2026-07, referans ekran görüntüleri)

- [x] **Podyumlu skor tablosu**: ilk 3 avatarlarıyla kürsüde (2-1-3), geri kalan
      arkada kompakt liste; puan count-up + son sorudan "+delta" rozeti; hem 🏆
      modalı hem **leaderboard slayt tipi** (sona eklenir) aynı Podium'u kullanır
- [x] Yeni slayt tipleri: **quiz-type** (yazarak cevap, normalize eşleştirme),
      **pin-on-image** (görselde işaretle, [x,y] normalize), **image**, **video**
      (URL), **instructions** (adımlar)
- [x] Menti tarzı mobil editör: ortada canlı önizleme, yüzen araç çubuğu
      (✏️ ➕ 🎨 ⋯), yatay film şeridi, bottom-sheet paneller
- [x] Slayt ayarları: 🚫 atla (skip), başlık etiketi (label), katılımcıya
      açıklama (description tüm tiplerde audience'ta görünür)
- [x] Present cilası: kalıcı "katıl" pili, "X/Y yanıtladı" sayacı, quiz
      sonuçlarında ✓/✗ rozetleri, atlanan slaytları geçen gezinme
- [x] **Canlı sohbet** 💬: messages koleksiyonu (create-only), izleyici bottom
      sheet + sunucu moderasyonu (sil); editör ⚙ menüsünden aç/kapat
- [x] **Quiz müziği** 🎵: WebAudio sentez (dosya/dış servis yok), slayt başına
- [x] Dashboard: arama, 📁 klasörler, grid/liste, temalı kart önizlemesi,
      yeniden adlandırma, son düzenlenene göre sıralama (updatedAt)

## Faz 3.6 — Kademe 2-3 (Menti derinleştirme) ✅

- [x] Editör "Edit" sheet: slayt tipini **yerinde değiştirme** dropdown'u
      (changeSlideType), katlanır "More settings" accordion'ları
- [x] Quiz **Score allocation**: Zamana göre / Sabit puan seçimi
- [x] **Pin on Image "Doğru alanı seç"**: editörde daire seçici, puanlı (isPinInArea),
      present'te doğru/yanlış renkli pin + alan dairesi; leaderboard'a katılır
- [x] **Leaderboard bar-race + spotlight**: açılışta en çok kazananı büyük gösterir,
      Podyum/Sıralama görünüm geçişi, önceki puandan büyüyen animasyonlu barlar
- [x] Yeni slayt tipleri: **Sayı Tahmini** (histogram), **100 Puan** (dağıtım),
      **2x2 Izgara** (nokta bulutu)
- [x] **Şablon galerisi** (Buz Kırıcı / Quiz Paketi / Geri Bildirim) + **sunum kopyalama**
- [x] Editör **👆 Etkileşim paneli**: canlı sohbet toggle + Q&A yönlendirmesi

Kalanlar: Audience-pace anket modu, slayt kopyala/yapıştır (Mentiler arası),
profanity filtresi, i18n, Cloud Function temizlik, 100+ izleyici perf.

## Faz 3.8 — Mobil düzeltmeler + PWA ✅

- [x] Mobil üst bar çakışmaları: sonuçlar (logo↔başlık), dashboard (logo↔e-posta) —
      shrink/truncate/min-w-0 ile düzeltildi
- [x] Dashboard kart ⋯ menüsü kırpılması: `overflow-hidden` karttan alınıp
      thumbnail'e taşındı (köşe yuvarlaması rounded-t/l-2xl ile) → menü tam görünür
- [x] **PWA**: `public/manifest.webmanifest` (display: standalone → tam ekran),
      marka ikonları (icon-192/512, apple-touch-icon; "Fo" + renkli halka, lacivert
      zemin — HTML→PNG üretildi), layout metadata (manifest/icons/appleWebApp) +
      viewport themeColor. "Ana ekrana ekle" → FlowMeter ikonu + tarayıcı çubuğu yok

## Faz 3.7 — Geri bildirim turu ✅

- [x] **Yeni oturum**: aynı deck'i birden fazla grupla baştan çalıştırma
      (resetSession — cevap/katılımcı/sohbet temizler, quiz sıfırlar; present altbilgi).
      Sunum `sessionId` taşır; her yeni oturumda yenilenir → izleyici telefonu
      farkı görünce yerel oylarını (ve gerçek oturum değişiminde avatar/ad kimliğini)
      sıfırlar. Böylece "Cevabınız alındı" takılması biter, yeni grup taze oy verir.
- [x] Film şeridinde **sürükle-bırak** slayt sıralama (reorderSlides)
- [x] Leaderboard slaytı **konuma göre otomatik**: sunum arası → Sıralama (bar-race),
      son quiz'den sonra → spotlight + Podyum (heyecanlı final)
- [x] **Tasarım tazeleme (sade & modern)**: tek uyumlu font (Plus Jakarta Sans),
      nötr/dingin palet (pembe tonlu nötrler kalktı), indigo vurgu, düz(daha az clay)
      kartlar + yumuşak tek gölge, sade çizgi ikonlar (emoji yerine — Icon.tsx),
      present/editör kontrollerinde net metin etiketleri

## Faz 4 — Yayınlama & Cila

- [x] Sonuç sayfası `/results/[id]`: slayt slayt inceleme + CSV export
- [ ] Sunum kopyalama + hazır şablon galerisi (buz kırıcı, retro, quiz paketi)
- [ ] Profanity filtresi (word cloud / open-ended)
- [ ] i18n (TR/EN), kod süresi/temizliği, Cloud Function ile yetim veri temizliği
- [ ] Performans: 100+ eşzamanlı izleyici için yazma/okuma gözden geçirme

## YENİ SOHBET İÇİN BAŞLANGIÇ NOTU

Proje durumu: Faz 1-2-3 büyük ölçüde tamam ve canlıda. Marka logosu entegre
(public/logo-flow.png — FLOW yazısı, O harfi renkli halka; "METER" yazısı
bileşende #001e64). Quiz puanı = Menti formülü 1000×(1−(t/T)/2) + seri bonusu
(Leaderboard.tsx). Kurallar: her rules değişikliğinde kullanıcıya TAM metin ver.

Öncelikli kalanlar (önerilen sıra):
1. Guess the Number slayt tipi
2. Audience-pace (anket) modu + bitiş ekranı
3. Şablon galerisi + sunum kopyalama
4. Profanity filtresi, Cloud Function temizlik, i18n, 100+ izleyici perf
