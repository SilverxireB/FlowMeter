# FlowMeter — CLAUDE.md

FlowMeter, Mentimeter'ın birebir klonu olan interaktif sunum/oylama uygulamasıdır.
Sunucu (presenter) slaytlar oluşturur, izleyiciler (audience) telefonlarından
**6 haneli kod veya QR** ile katılıp oy verir, sonuçlar **canlı** güncellenir.

## Teknoloji Yığını (Stack)

| Katman | Teknoloji | Not |
|---|---|---|
| Framework | Next.js 14 (App Router, TypeScript) | Vercel'e deploy |
| UI | Tailwind CSS | Tasarım sistemi aşağıda |
| Grafikler | Saf CSS/HTML | Kütüphane YOK (recharts kullanılmıyor) |
| Avatar | @dicebear/core + collection (adventurer) | Client-side SVG, dış servis yok |
| QR | qrcode | Client-side data-URI |
| Veritabanı | Firebase Firestore | `onSnapshot` realtime; asla polling yapma |
| Auth | Firebase Auth | Presenter: sadece Google; audience: auth YOK |
| Hosting | Vercel | Production branch: `claude/practical-lamport-ls9miq` |
| State | React hooks | Redux vs. YOK |

## Altın Kurallar

1. **Audience auth istemez.** Kod gir → avatar+ad seç (bir kez, localStorage) → oy ver.
2. **Realtime her şeydir.** `onSnapshot` (bkz. `src/lib/hooks.ts`); asla polling.
3. **Mobile-first audience, desktop-first presenter.**
4. **DIŞ SERVİS YOK.** Kurumsal ağlar 3. parti CDN'leri engelliyor (Cloudinary
   elendi). Görseller: repo içi `public/` veya sıkıştırılıp Firestore'a base64
   (`src/lib/images.ts`). Yalnızca kendi domain + firestore.googleapis.com.
5. **Firestore güvenliği:** `firestore.rules` her koleksiyon değişikliğinde
   güncellenir ve KULLANICIYA TAM HALİ verilir (konsola elle yapıştırıyor).
   Oylar create-only; silme sadece sahibi ("sıfırla" için).
6. **Türkçe UI, İngilizce kod.**
7. Dosya haritası `docs/SITEMAP.md`, fazlar `docs/ROADMAP.md` — değişince güncelle.
8. Push öncesi MUTLAKA `npm run build`.

## Tasarım Sistemi (ui-ux-pro-max skill önerisi — .claude/skills/ altında kurulu)

- **Renkler** (tailwind.config.ts): `brand` gül #e11d48, `accent` mavi #2563eb,
  `ink` #1c1917, `paper` #fff7f6, `line`, `muted`. Logo lacisi: **#001e64** (Beko).
- **Font**: Fredoka (`font-display`, başlıklar) + Nunito (`--font-sans`, metin).
- **Bileşen sınıfları** (globals.css): `.card` (tombul köşe + çift gölge),
  `.btn-primary` (gül), `.btn-accent` (mavi), `.btn-ghost`, `.input-base`,
  `.eyebrow`, `.chip`, `.bg-wash`. Animasyonlar: `.animate-pop`, `.animate-float-up`,
  `.animate-confetti`. `prefers-reduced-motion` destekli.
- **Grafik paleti**: `--series-1..8` CSS değişkenleri (dataviz doğrulanmış sıra).
- **Logo**: `src/components/Logo.tsx` — `public/logo-flow.png` (FLOW, harfler
  lacivert, O = renkli halka) + yanında "METER" yazısı. `logo-flow-white.png`
  koyu zemin sürümü. **Logo asla deforme edilmez** (h sabit, w auto).

## Domain Modeli

- **Presentation**: joinCode (6 hane), currentSlideIndex (**-1 = QR katılım
  ekranı**), isLive, ended, votingClosed, theme{preset,bgImage,logo}, mode.
- **Slide** `type`: multiple-choice, word-cloud, open-ended, scales, ranking,
  **quiz** (correctIndex, timeLimit, quizStartedAt), **qna**, content.
  Settings: allowMultiple, maxEntries, description.
- **Response.value**: MC=number|number[]; WC/open-ended=string;
  scales/ranking=number[]; **quiz=[optionIndex, geçenMs]**.
- **Participant**: doc id = voterId (localStorage UUID); nickname + avatarSeed.
- **Quiz puanı (Menti formülü)**: `1000 × (1 − (t/T)/2)` → 500–1000 arası.
  Seri bonusu (Kahoot usulü): üst üste 2. doğrudan itibaren +50/soru, max +250.
  Hesap: `src/components/present/Leaderboard.tsx`.

## Firestore Şeması

```
presentations/{id}: ownerId, title, joinCode, mode, currentSlideIndex,
                    isLive, ended, votingClosed, theme{}, createdAt
  ├─ participants/{voterId}: nickname, avatarSeed, (eski: emoji), joinedAt
  ├─ reactions/{autoId}: emoji (❤️👍🎉), createdAt   [create-only]
  ├─ questions/{autoId}: text, voterId, upvotes, hidden?, createdAt
  │                      [upvote sadece +1; moderasyon owner]
  └─ slides/{slideId}: type, question, options[], order, settings{}, quizStartedAt?
       └─ responses/{autoId}: voterId, value, createdAt
                              [create-only; delete sadece owner]
joinCodes/{code}: presentationId
```

## Komutlar & Deploy

```bash
npm run dev / build / lint     # build push öncesi zorunlu
```
Branch `claude/practical-lamport-ls9miq` → Vercel production (kullanıcı böyle
ayarladı). Firebase env: `NEXT_PUBLIC_FIREBASE_*` (.env.example) Vercel'de tanımlı.
Firebase projesi: `flowmeter-938a3`. Rules değişince tam halini kullanıcıya ver.

## Durum & Sonraki Adımlar

Tamamlanan/kalan her şey: `docs/ROADMAP.md`. Kısaca kalanlar: Guess the Number,
audience-pace anket modu, şablon galerisi, profanity filtresi, slayta görsel
ekleme, editör canlı önizleme/otomatik kayıt, Cloud Function temizlik, i18n.
