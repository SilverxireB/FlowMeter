# FlowWall — Durum & Yol Haritası (TEMİZ SAYFA)

> **Bu dosya tek doğruluk kaynağı:** son halimiz + yapacaklarımız.
> Dağınık fikir havuzu / kapasite analizi / eski faz notları → `docs/FLOWWALL.md`
> (arşiv). Yeni bir şey canlıya çıkınca buradaki "✅ Canlıda"ya taşı; fikirler
> "🔜 Yapacaklarımız"da öncelik sırasıyla durur.

FlowWall = FlowMeter altyapısı üstünde **ayrı ürün**: canlı etkinlik foto/video
duvarı. Byte'lar Cloudinary'de, gerisi Firebase (Firestore/Auth/rules/realtime).
Rotalar: `/wall` (karşılama) · `/wall/[id]` (perde) · `/u/[id]` (misafir) ·
`/wall/[id]/manage` (kokpit).

---

## ✅ Canlıda (son halimiz)

**Çekirdek**
- `walls/{id}` modeli, tek havuz 6 haneli kod (deck|wall), oturum deseni, realtime.
- Cloudinary imzasız yükleme; **yüklerken ~1920px küçültme + retry** (depolama/dayanıklılık).
- Moderasyon (varsayılan açık), rules (media/reactions/wishes/contestVotes).

**Misafir `/u/[id]`**
- Çoklu yükleme (karo ızgara, canlı %), "Orijinal kalite" duvar ayarına saygı.
- Gez (onaylı akış, ❤ beğeni, "Benimkiler"), 💌 Dilek, alt tepki çubuğu.
- "Duvarda göründün!" kutlaması (yalnız kendi medyasını dinler → ölçek).

**Perde `/wall/[id]`**
- 6 mod + 🔀 Otomatik (akıllı adil oynatma): Sahne · Mozaik · Spot · Polaroid · Sinema · Zaman tüneli.
- 8 tema + 7 temadan-bağımsız ambient efekt; baskın renk ambiyansı.
- Emoji/kalp yağmuru, dönen dilek bandı, canlı anons, En Sevilenler turu, milestone, 👑 en sevilen.
- Foto yarışması (oy → kazanan taçlanır).
- **🎬 Anı Filmi'ni perdede canlı oynatma** (kokpit tetikler).

**Kokpit `/wall/[id]/manage`**
- Moderasyon sekmeleri (medya/dilek), özet istatistik, medya ekle, Kaldırılanlar (geri al).
- Ayarlar: video/dilek/orijinal-kalite toggle, tema/efekt/mod seçici, anons, tur/milestone.
- **İlk-kullanım rehberi (onboarding)**: duvar tazeyken "3 adımda başla" kartı
  (perde aç · kod paylaş · test), canlı durum, kapatılabilir.
- **Yaşam döngüsü**: Duvarı kapat/aç (kapalıyken yükleme durur, perde "🎉 Teşekkürler")
  + Yeni oturum (sessionId rotasyonu → perde/misafir/kokpit yalnız aktif oturumu
  gösterir; eski anılar arşivde kalır). Aynı duvarı ikinci grupla baştan çalıştırma.

**Çıktılar (etkinlik değeri)**
- Tümünü indir (ZIP), kolaj PNG, hatıra kitabı PDF.
- **🎬 Anı Filmi**: highlight video (WebCodecs MP4 / WebM yedeği), akıllı seçim
  (👑 + adalet + beğeni×tazelik), Ken Burns + crossfade, yön/uzunluk, **5 telifsiz
  müzik** (Sıcak/Neşeli/Duygusal/Şık/Enerjik) + kendi müziğin. Tamamen lokal → Cloudinary kredisi yemez.

**Maliyet/kota (Paket 3)**
- Upload küçültme + retry, `deleteWall` tam temizlik (Cloudinary prefix + yetim
  reactions/wishes/contestVotes), `deleteAllDocs` sayfalama.

---

## 🔜 Yapacaklarımız (öncelik sırasıyla)

### 🔴 Kritik — ürünü ayakta tutan operasyon
1. **Kota guard'ları** — kişi başı foto tavanı (~15-20), video süre/boyut limiti,
   duvar başına toplam medya tavanı, tepki cooldown. *Bir etkinlik kotayı yakmasın.*

### 🎛️ Ürün girişi / dashboard mimarisi ✅ YAPILDI (2026-07)
- **Ürün hub'ı:** `/dashboard` iki **markalı karta** açılır (🎤 FlowMeter indigo /
  📷 FlowWall festival-koyu) + öğe sayısı + son 3 öğe + Aç/Yeni. Meter'a otomatik
  düşmez; `?p=decks|walls` ile odaklı alan (geri-tuşu dostu), "← Ürünler" geri dön.
- **Nötr `/` karşılaması:** "Etkinliğe katıl"; kod wall→/u, deck→/join(→/p) otomatik.
  Join/QR linkleri (perde /u, present /join) DEĞİŞMEDİ.
- Kalan (opsiyonel): çalışma alanı içi daha güçlü ayrı marka hero'su; gerçek
  route ayrımı (`/dashboard/decks|walls`).

### 🟡 Deneyim / değer
3. **Anlık kamera** (`capture`) — "anında çek, patlat" vaadini kapatır.
4. **Öne çıkar / sabitle / gizle** — moderatör bir kareyi perdede öne alır/düşürür.
5. **Paylaşılabilir galeri linki** — etkinlik sonrası misafire read-only galeri
   (film + tüm fotolar + kendi yükledikleri, indirilebilir).

### 🎬 Anı Filmi kardeşleri (aynı motor)
6. **Kişisel Anı Kartı ("Senin Gecen")** — kişiye özel kare/mini-film → 500 kişi = 500 paylaşım.
7. **Etkinlik Çerçevesi / Sticker** — her fotoya marka overlay (Cloudinary bedava).
8. **Video Tebrik Kabini** — 10 sn moderasyonlu tebrik → sesli anı defteri.

### 🧱 Mimari borç (token maliyeti düşürme)
9. ✅ Perde `page.tsx` bölündü (834→166 satır, `components/wall/screen/`). Sırada:
   `edit/[id]` (987) ve `manage` (900+) — ama state'li, daha dikkatli.

### 🔒 Park (şirket-içi araç için ertelendi; satışta şart)
- Güvenlik: anon-auth + misafir self-delete, imzalı yükleme, rate-limit, AI moderasyon.
- Ticari: landing satış/demo yüzeyi, pricing/paket, ayrı domain/marka.

---

*Güncelleme kuralı: iş bitince ✅'ya taşı, satırı "Yapacaklarımız"dan sil. Fikir
ham/seçilmemişse `docs/FLOWWALL.md` havuzunda kalsın; buraya sadece **seçilmiş**
işler girer.*
