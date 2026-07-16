# FlowMeter — Site & Dosya Haritası

> Bu dosya projenin **hedef** yapısıdır. Henüz yazılmamış dosyalar 🔜 ile işaretlidir.
> Yeni dosya/route eklerken burayı güncelle.

## 1. Site Haritası (Routes)

### Halka açık (audience — auth yok, mobile-first)
| Route | Amaç |
|---|---|
| `/` | Landing: logo + "Kod ile katıl" kutusu (Mentimeter'daki menti.com ana ekranı) + "Sunum oluştur" CTA |
| `/join/[code]` | Koda göre sunuma katıl → aktif slayta yönlendirir |
| `/p/[presentationId]` | Audience oylama ekranı (presenter-pace: aktif slaytı canlı takip eder; audience-pace: kendi ilerler) |

### Presenter (auth gerekli)
| Route | Amaç |
|---|---|
| `/login` | Google / email ile giriş |
| `/dashboard` | Sunum listesi: oluştur, yeniden adlandır, sil, kopyala |
| `/edit/[presentationId]` | Slayt editörü: sol slayt listesi, orta önizleme, sağ ayar paneli (Mentimeter editör düzeni) |
| `/present/[presentationId]` | Sunum modu (tam ekran): büyük soru + canlı sonuç grafiği + join talimatı (kod & QR) + slayt kontrolü |
| `/results/[presentationId]` | Sunum sonrası sonuçlar, slayt slayt inceleme, export |

## 2. Dosya Haritası

```
FlowMeter/
├─ CLAUDE.md                      ✅ Proje anayasası
├─ README.md                      ✅ Kısa tanıtım + kurulum
├─ docs/
│  ├─ SITEMAP.md                  ✅ Bu dosya
│  └─ ROADMAP.md                  ✅ Fazlar & özellik listesi
├─ .env.example                   ✅ NEXT_PUBLIC_FIREBASE_* şablonu
├─ firestore.rules                ✅ Güvenlik kuralları (v1)
├─ next.config.mjs                ✅
├─ tailwind.config.ts             ✅ brand renkleri (navy/blue/sky)
├─ postcss.config.mjs             ✅
├─ package.json                   ✅
│
├─ src/
│  ├─ app/
│  │  ├─ layout.tsx               ✅ Kök layout (tr, metadata)
│  │  ├─ page.tsx                 ✅ Landing + 6 haneli kod girişi
│  │  ├─ join/[code]/page.tsx     ✅ Kod çözümle → /p/[id]
│  │  ├─ p/[id]/page.tsx          ✅ Audience oylama ekranı (canlı slayt takibi)
│  │  ├─ login/page.tsx           ✅ Google + email/şifre
│  │  ├─ dashboard/page.tsx       ✅ Sunum listesi + CRUD
│  │  ├─ edit/[id]/page.tsx       ✅ Slayt editörü (SlideEditor bileşeni içinde)
│  │  ├─ present/[id]/page.tsx    ✅ Tam ekran sunum modu (klavye ←/→, canlı sonuç)
│  │  └─ results/[id]/page.tsx    🔜 Sonuç inceleme (Faz 2)
│  │
│  ├─ components/
│  │  ├─ present/
│  │  │  └─ QrCode.tsx             ✅ Katılım QR kodu (client-side üretim)
│  │  ├─ vote/
│  │  │  ├─ MultipleChoiceVote.tsx ✅
│  │  │  ├─ WordCloudVote.tsx      ✅ (kişi başı maxEntries hakkı)
│  │  │  └─ OpenEndedVote, ScalesVote, RankingVote, QnaVote, QuizVote 🔜 Faz 2-3
│  │  └─ results/
│  │     ├─ BarChartResult.tsx     ✅ saf CSS canlı bar chart
│  │     ├─ WordCloudResult.tsx    ✅ frekansla büyüyen kelime bulutu
│  │     └─ OpenEndedResult, ScalesResult, RankingResult, QnaResult, Leaderboard 🔜 Faz 2-3
│  │
│  ├─ lib/
│  │  ├─ firebase.ts              ✅ Lazy init (env yokken build kırılmaz)
│  │  ├─ types.ts                 ✅ Presentation, Slide, ResponseDoc, SlideType
│  │  ├─ presentations.ts         ✅ CRUD + joinCode üretimi + slayt CRUD
│  │  ├─ participants.ts          ✅ Nickname (localStorage) + katılımcı kaydı + son sunum
│  │  ├─ responses.ts             ✅ Oy gönderme + localStorage voterId/mükerrer oy
│  │  └─ hooks.ts                 ✅ useAuthUser, usePresentation, useSlides, useLiveResponses
│  │
│  └─ styles/globals.css          ✅ Tailwind + dataviz kategorik palet değişkenleri
```

## 3. Veri Akışı Özeti

```
Presenter                        Firestore                      Audience
─────────                        ─────────                      ────────
/edit → slayt CRUD  ──────────▶  presentations/slides
/present → slayt değiştir ────▶  currentSlideIndex ──onSnapshot──▶ /p/[id] aktif soru
/present ◀──onSnapshot── responses ◀────────────── oy gönder (create-only)
```
