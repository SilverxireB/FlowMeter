# FlowMeter — Site & Dosya Haritası

> Güncel gerçek durum. Yeni route/dosya eklerken burayı güncelle.

## 1. Site Haritası (Routes)

### Halka açık (audience — auth yok, mobile-first)
| Route | Amaç |
|---|---|
| `/` | Landing: yalnızca 6 haneli kod girişi + "kaldığın sunuma dön"; altta silik sunucu girişi linki |
| `/join/[code]` | Kodu çözer → `/p/[id]` |
| `/p/[id]` | İzleyici: avatar+ad seçimi (ilk girişte bir kez) → bekleme → oylama → tepki çubuğu (❤️👍🎉) → quiz kişisel sonucu → "sunum bitti" ekranı |

### Presenter (Google auth)
| Route | Amaç |
|---|---|
| `/login` | Sadece Google girişi |
| `/dashboard` | Sunum CRUD; kartlarda Sun / Düzenle / Sonuçlar / Sil |
| `/edit/[id]` | Editör: slayt listesi (canlıyken seçim = izleyici senkronu), slayt ayarları, ↑/↓/çoğalt, 🎨 Tema paneli |
| `/present/[id]` | Sunum: -1 = büyük QR katılım ekranı; slaytlarda mini QR; tepki uçuşları+sayaç; kontroller (oylama aç/kapat, sıfırla, 🙈 gizle, ⛶, 🏆 skor, Bitir) |
| `/results/[id]` | Sonuç inceleme + ⬇ CSV export |

## 2. Dosya Haritası

```
FlowMeter/
├─ CLAUDE.md / README.md / docs/{SITEMAP,ROADMAP}.md
├─ .env.example                # NEXT_PUBLIC_FIREBASE_* şablonu
├─ firestore.rules             # TAM hali kullanıcıya verilir (konsola yapıştırıyor)
├─ .claude/skills/ui-ux-pro-max/   # Tasarım bilgi bankası (search.py + CSV'ler)
├─ public/
│  ├─ logo-flow.png            # FLOW logosu (lacivert harfler, renkli O halkası)
│  └─ logo-flow-white.png      # Koyu zemin sürümü
│
├─ src/
│  ├─ app/
│  │  ├─ layout.tsx            # Fredoka + Nunito (next/font)
│  │  ├─ page.tsx              # Landing (PIN)
│  │  ├─ join/[code]/page.tsx
│  │  ├─ p/[id]/page.tsx       # İzleyici (kimlik kapısı + oylama + tepkiler)
│  │  ├─ login/page.tsx
│  │  ├─ dashboard/page.tsx
│  │  ├─ edit/[id]/page.tsx    # + SlideEditor (quiz doğru cevap/süre dahil)
│  │  ├─ present/[id]/page.tsx # + katılım ekranı, mini QR, kontroller
│  │  └─ results/[id]/page.tsx # Sonuçlar + CSV
│  │
│  ├─ components/
│  │  ├─ Logo.tsx              # FLOW görseli + METER yazısı (#001e64)
│  │  ├─ Avatar.tsx            # DiceBear SVG (seed → data-URI)
│  │  ├─ editor/ThemePanel.tsx # Tema/arka plan/logo yönetimi
│  │  ├─ present/QrCode.tsx
│  │  ├─ present/ReactionOverlay.tsx  # Sağ alttan uçan tepkiler + sayaç
│  │  ├─ present/Leaderboard.tsx      # 🏆 skor + konfeti (puan formülü BURADA)
│  │  ├─ vote/                 # MultipleChoice, WordCloud, OpenEnded, Scales,
│  │  │                        # Ranking, Quiz, QuizPersonalResult, Qna
│  │  └─ results/              # BarChart, WordCloud, OpenEnded, Scales,
│  │                           # Ranking, Quiz, Qna
│  │
│  ├─ lib/
│  │  ├─ firebase.ts           # Lazy init (env yokken build kırılmaz)
│  │  ├─ types.ts              # Tüm tipler + SLIDE_TYPE_{LABELS,ICONS}
│  │  ├─ presentations.ts      # CRUD, joinCode, slayt CRUD, startQuiz,
│  │  │                        # votingClosed, endPresentation, resetResponses,
│  │  │                        # swapSlideOrder, duplicateSlide, updateTheme
│  │  ├─ participants.ts       # nickname+avatarSeed (localStorage), son sunum
│  │  ├─ responses.ts          # voterId, oy gönderme, mükerrer oy sayacı
│  │  ├─ reactions.ts          # ❤️👍🎉 gönderme (rate limit)
│  │  ├─ questions.ts          # Q&A: gönder/upvote(+1)/gizle/sil
│  │  ├─ themes.ts             # 8 preset + themeStyle() (koyu/açık)
│  │  ├─ images.ts             # canvas sıkıştırma → base64 (Firestore'a)
│  │  └─ hooks.ts              # useAuthUser, usePresentation, useSlides,
│  │                           # useLiveResponses, useParticipants, useQuestions
│  └─ styles/globals.css       # Tasarım sistemi sınıfları + animasyonlar
```

## 3. Veri Akışı Özeti

```
Presenter                          Firestore                       Audience
/edit, /present ──────────▶ currentSlideIndex ──onSnapshot──▶ /p/[id] aktif slayt
/present ◀──onSnapshot── responses / participants / reactions ◀── izleyici yazar
quiz: /present startQuiz ──▶ slide.quizStartedAt ──▶ iki tarafta geri sayım
```
