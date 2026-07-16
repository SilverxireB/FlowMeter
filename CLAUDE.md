# FlowMeter — CLAUDE.md

FlowMeter, Mentimeter'ın birebir klonu olan interaktif sunum/oylama uygulamasıdır.
Sunucu (presenter) slaytlar oluşturur, izleyiciler (audience) telefonlarından bir
**join kodu** ile katılıp oy verir, sonuçlar **canlı** olarak ekranda güncellenir.

## Teknoloji Yığını (Stack)

| Katman | Teknoloji | Not |
|---|---|---|
| Framework | Next.js 14+ (App Router, TypeScript) | Vercel'e deploy edilir |
| UI | Tailwind CSS | Mentimeter tarzı temiz, renkli tasarım |
| Grafikler | Recharts | Bar chart, pie, scales görselleştirme |
| Veritabanı | Firebase Firestore | Canlı sonuçlar için `onSnapshot` realtime dinleme |
| Auth | Firebase Auth | Presenter için Google + email/şifre; audience için **anonim** (auth gerekmez) |
| Hosting | Vercel | Push direkt production'a gider (main branch) |
| State | React hooks + context | Ekstra state kütüphanesi YOK (Redux vs. kullanma) |

## Altın Kurallar

1. **Audience tarafı auth istemez.** İzleyici sadece kod girer ve oy verir. Sürtünme sıfır olmalı.
2. **Realtime her şeydir.** Sonuç ekranları Firestore `onSnapshot` ile canlı güncellenir; asla polling yapma.
3. **Mobile-first audience.** `/join` ve oylama ekranları önce telefon için tasarlanır. Presenter ekranları desktop-first.
4. **Firebase config `.env.local`'da.** `NEXT_PUBLIC_FIREBASE_*` değişkenleri; asla koda gömme, `.env.example` güncel tut.
5. **Firestore güvenliği:** `firestore.rules` her yeni koleksiyonla birlikte güncellenir. Oylar sadece create edilebilir, update/delete edilemez (mükerrer oy client'ta `localStorage` + kural tarafında kontrol).
6. **Türkçe UI, İngilizce kod.** Arayüz metinleri Türkçe (i18n'e hazır yapıda), değişken/dosya adları İngilizce.
7. Dosya haritası `docs/SITEMAP.md`'de — yeni route/dosya eklediğinde orayı da güncelle.

## Temel Kavramlar (Domain Modeli)

- **Presentation**: Bir sunum; slaytlardan oluşur, 6 haneli `joinCode`'u vardır, bir `ownerId`'ye aittir.
- **Slide**: Bir soru/içerik. `type` alanı slayt tipini belirler:
  - `multiple-choice` — çoktan seçmeli, canlı bar chart (en çok kullanılan)
  - `word-cloud` — kelime bulutu, tekrar edenler büyür
  - `open-ended` — serbest metin, kartlar halinde akar
  - `scales` — 1–5 kaydırmalı derecelendirme, ortalama gösterimi
  - `ranking` — seçenekleri sıralama
  - `qna` — izleyici soru sorar, upvote eder
  - `quiz` — doğru cevaplı yarışma + leaderboard (süre puanı)
  - `content` — oysuz başlık/metin slaytı
- **Response**: Bir izleyicinin bir slayta verdiği cevap. `voterId` = localStorage'daki anonim UUID.
- **Presentation modu**: `presenter-pace` (izleyici sunucunun açtığı slaytı görür — varsayılan) vs `audience-pace` (izleyici kendi ilerler, anket modu).

## Firestore Şeması

```
presentations/{presentationId}
  ├─ ownerId, title, joinCode (6 hane, unique), createdAt
  ├─ currentSlideIndex (presenter-pace canlı senkron için)
  ├─ mode: "presenter-pace" | "audience-pace"
  ├─ isLive: boolean
  └─ slides/{slideId}          # alt koleksiyon
       ├─ type, question, options[], order, settings{}
       └─ responses/{responseId}   # alt koleksiyon
            ├─ voterId, value, createdAt
```

Join kodu çözümü için ayrıca: `joinCodes/{code} → { presentationId }` (tek okuma ile lookup).

## Komutlar

```bash
npm run dev        # localhost:3000
npm run build      # production build (push öncesi MUTLAKA çalıştır)
npm run lint       # ESLint
```

## Deploy

- `main` branch'e push = Vercel production deploy (Vercel projesi kullanıcı tarafından bağlanır).
- Geliştirme bu repo içinde feature branch'lerde yapılır, kullanıcı onayıyla main'e gider.
- Firebase env değişkenleri Vercel dashboard'da tanımlıdır; build bunlarsız da kırılmamalı (lazy init).

## Yol Haritası

Fazlar ve ayrıntılı özellik listesi: `docs/ROADMAP.md`. Kısaca:
- **Faz 1 (MVP)**: Join akışı + multiple-choice + word cloud + canlı sonuçlar
- **Faz 2**: open-ended, scales, ranking, presenter senkron sunum modu, QR kod
- **Faz 3**: Quiz + leaderboard, Q&A, temalar, sonuç export
