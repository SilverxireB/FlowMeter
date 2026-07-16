# FlowMeter — Yol Haritası

Mentimeter'ın en çok kullanılan özelliklerinden başlayarak adım adım klonluyoruz.
Kaynak araştırma: Mentimeter'da en popüler slayt tipleri **multiple choice** ve
**word cloud**; onları quiz (leaderboard'lu), anonim Q&A ve scales izliyor.
Katılım akışı: menti.com'a 6 haneli kod / QR / link ile giriş → oy → canlı sonuç.

## Faz 1 — MVP: "Kod gir, oy ver, canlı gör" ✅ hedef ilk deploy

- [ ] Next.js + Tailwind + Firebase iskeleti, Vercel'e deploy edilebilir durumda
- [ ] Landing (`/`): 6 haneli kod girişi
- [ ] Presenter auth (Google + email) ve `/dashboard` sunum CRUD
- [ ] Editör (basit): slayt ekle/sil/sırala, **multiple-choice** ve **word-cloud** tipleri
- [ ] `/present`: tam ekran soru + join kodu banner'ı + canlı sonuçlar (onSnapshot)
- [ ] `/p/[id]`: audience oylama (auth yok), mükerrer oy engeli (localStorage voterId)
- [ ] Canlı sonuçlar: bar chart (multiple-choice), büyüyen kelime bulutu (word-cloud)
- [ ] firestore.rules v1

## Faz 2 — Çekirdek Mentimeter deneyimi

- [ ] Slayt tipleri: **open-ended**, **scales (1–5)**, **ranking**, **content** (oysuz slayt)
- [ ] Presenter-pace canlı senkron: presenter slayt değiştirince audience ekranı otomatik geçer
- [ ] Audience-pace (anket/survey modu): izleyici kendi hızında ilerler
- [ ] QR kod ile katılım (present ekranında)
- [ ] Editörde ayar paneli: çoklu seçim izni, kişi başı N kelime, sonuçları gizle/göster
- [ ] Oylamayı aç/kapat (close voting), cevapları sıfırla
- [ ] Katılımcı sayacı (kaç kişi katıldı)

## Faz 3 — Etkileşim & rekabet

- [ ] **Quiz**: doğru cevap + süre bazlı puan + slaytlar arası **leaderboard**
- [ ] **Q&A**: izleyici soru gönderir, upvote eder; presenter moderasyonu (göster/gizle)
- [ ] Emoji reaksiyonları (audience → present ekranında uçuşur)
- [ ] Temalar (renk paletleri, koyu/açık)
- [ ] Sonuç export (CSV) ve sunum kopyalama/şablonlar

## Faz 4 — Cila

- [ ] i18n (TR/EN)
- [ ] Sunum paylaşım linkleri, geçici kodların süresinin dolması (48 saat kuralı)
- [ ] Profanity filtresi (word cloud / open-ended için)
- [ ] Performans: 100+ eşzamanlı oy için Firestore yazma stratejisi gözden geçirme
