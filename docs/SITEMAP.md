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
├─ README.md                      🔜 Kısa tanıtım + kurulum
├─ docs/
│  ├─ SITEMAP.md                  ✅ Bu dosya
│  └─ ROADMAP.md                  ✅ Fazlar & özellik listesi
├─ .env.example                   🔜 NEXT_PUBLIC_FIREBASE_* şablonu
├─ firestore.rules                🔜 Güvenlik kuralları
├─ next.config.mjs                🔜
├─ tailwind.config.ts             🔜
├─ package.json                   🔜
│
├─ src/
│  ├─ app/
│  │  ├─ layout.tsx               🔜 Kök layout (font, tema)
│  │  ├─ page.tsx                 🔜 Landing + kod girişi
│  │  ├─ join/[code]/page.tsx     🔜 Kod çözümle → /p/[id]
│  │  ├─ p/[id]/page.tsx          🔜 Audience oylama ekranı
│  │  ├─ login/page.tsx           🔜
│  │  ├─ dashboard/page.tsx       🔜 Sunum listesi
│  │  ├─ edit/[id]/page.tsx       🔜 Slayt editörü
│  │  ├─ present/[id]/page.tsx    🔜 Tam ekran sunum modu
│  │  └─ results/[id]/page.tsx    🔜 Sonuç inceleme
│  │
│  ├─ components/
│  │  ├─ ui/                      🔜 Button, Input, Modal, Card... (ortak parçalar)
│  │  ├─ editor/                  🔜 SlideList, SlidePreview, SettingsPanel, SlideTypeMenu
│  │  ├─ present/                 🔜 JoinBanner (kod+QR), SlideControls, LiveCounter
│  │  ├─ vote/                    🔜 Slayt tipi başına oylama formu:
│  │  │                              MultipleChoiceVote, WordCloudVote, OpenEndedVote,
│  │  │                              ScalesVote, RankingVote, QnaVote, QuizVote
│  │  └─ results/                 🔜 Slayt tipi başına canlı sonuç görseli:
│  │                                 BarChartResult, WordCloudResult, OpenEndedResult,
│  │                                 ScalesResult, RankingResult, QnaResult, Leaderboard
│  │
│  ├─ lib/
│  │  ├─ firebase.ts              🔜 Firebase app/db/auth lazy init
│  │  ├─ types.ts                 🔜 Presentation, Slide, Response, SlideType tipleri
│  │  ├─ presentations.ts         🔜 CRUD + joinCode üretimi
│  │  ├─ responses.ts             🔜 Oy gönderme + mükerrer oy kontrolü
│  │  └─ hooks/                   🔜 usePresentation, useSlides, useLiveResponses,
│  │                                 useCurrentSlide (onSnapshot tabanlı)
│  │
│  └─ styles/globals.css          🔜
```

## 3. Veri Akışı Özeti

```
Presenter                        Firestore                      Audience
─────────                        ─────────                      ────────
/edit → slayt CRUD  ──────────▶  presentations/slides
/present → slayt değiştir ────▶  currentSlideIndex ──onSnapshot──▶ /p/[id] aktif soru
/present ◀──onSnapshot── responses ◀────────────── oy gönder (create-only)
```
