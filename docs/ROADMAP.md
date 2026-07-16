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
- [ ] Slayta görsel ekleme (soru yanında resim — URL/galeri)
- [ ] Canlı önizleme: editörde slaytın audience görünümü küçük önizlemesi
- [ ] Otomatik kaydetme (Kaydet butonu yerine debounce'lu kayıt)

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
- [ ] **Guess the Number** slayt tipi (tahmin + dağılım gösterimi)
- [ ] Audience-pace (anket modu): izleyici kendi ilerler, bitiş ekranı
- [x] Quiz kişisel sonucu: izleyici kendi doğru/yanlış + puanını telefonunda görür

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
1. Slayta görsel ekleme (images.ts hazır — soru yanına sıkıştırılmış görsel)
2. Guess the Number slayt tipi
3. Audience-pace (anket) modu + bitiş ekranı
4. Şablon galerisi + sunum kopyalama
5. Profanity filtresi, Cloud Function temizlik, i18n, 100+ izleyici perf
