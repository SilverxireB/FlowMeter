# FlowMeter — Site & Dosya Haritası

> Güncel gerçek durum. Yeni route/dosya eklerken burayı güncelle.

## 1. Site Haritası (Routes)

### Halka açık (audience — auth yok, mobile-first)
| Route | Amaç |
|---|---|
| `/` | Landing: yalnızca 6 haneli kod girişi + "kaldığın sunuma dön"; altta silik sunucu girişi linki |
| `/join/[code]` | Kodu çözer → `/p/[id]` |
| `/p/[id]` | İzleyici: avatar+ad seçimi (ilk girişte bir kez) → bekleme → oylama → tepki çubuğu (❤️👍🎉) + 💬 canlı sohbet → quiz kişisel sonucu → "sunum bitti" ekranı |

### Presenter (Google auth)
| Route | Amaç |
|---|---|
| `/login` | Sadece Google girişi |
| `/dashboard` | Sunum CRUD + arama + 📁 klasörler + grid/liste + temalı kart önizlemesi + ⋯ menü (adlandır/taşı/sil) |
| `/edit/[id]` | Menti tarzı editör: ortada canlı önizleme, yüzen araç çubuğu (✏️ ➕ 🎨 ⋯), altta yatay film şeridi, bottom-sheet paneller, otomatik kayıt. ⋯ menü: taşı/çoğalt/🚫 atla/cevapları temizle/sil. ⚙ menü: önizle, sonuçlar, 💬 sohbet aç/kapat |
| `/present/[id]` | Sunum: -1 = büyük QR katılım ekranı; slaytlarda mini QR + kalıcı "katıl" pili + "X/Y yanıtladı"; tepki uçuşları+sayaç; kontroller (oylama aç/kapat, sıfırla, 🙈 gizle, ⛶, 🏆 podyum, 💬 sohbet, Bitir); atlanan slaytları geçer; quiz müziği 🎵 |
| `/results/[id]` | Sonuç inceleme + ⬇ CSV export + oturum seçici (Tüm/Şu anki/geçmiş oturumlar) |
| `/moderate/[code]` | Q&A moderasyon ekranı (kod veya id; sadece sahip): bekleyenler ✓ Onayla / ✕ Reddet, onay geri alma, moderasyon aç/kapat |
| `/wall` | **FlowWall** karşılama (koyu/festival): akıllı kod kutusu (deck→/join, wall→/u), "kendi duvarını oluştur" |
| `/wall/[id]` | FlowWall perde ekranı: sağ/sol akan film şeritleri + orta sahne (foto ~7sn, video süresince) + QR/kod köşe |
| `/u/[id]` | FlowWall yükleme (misafir, auth yok): foto/video seç → önizleme → Cloudinary %ilerleme → duvara/onaya |
| `/wall/[id]/manage` | FlowWall yönetim (sahip): moderasyon toggle, bekleyen onayla/reddet, perde medyası kaldır/sil, başlık, QR/kod |

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
│  │  ├─ p/[id]/page.tsx       # İzleyici (kimlik kapısı + oylama + tepkiler + sohbet)
│  │  ├─ login/page.tsx
│  │  ├─ dashboard/page.tsx    # Arama + klasör + grid/liste + kart menüsü
│  │  ├─ edit/[id]/page.tsx    # Menti tarzı editör + SlideEditor (otomatik kayıt)
│  │  ├─ present/[id]/page.tsx # Katılım ekranı, mini QR, katıl pili, kontroller
│  │  └─ results/[id]/page.tsx # Sonuçlar + CSV
│  │
│  ├─ components/
│  │  ├─ Logo.tsx              # FLOW görseli + METER yazısı (#001e64)
│  │  ├─ Avatar.tsx            # DiceBear SVG (seed → data-URI)
│  │  ├─ editor/ThemePanel.tsx # Tema/arka plan/logo yönetimi
│  │  ├─ editor/SlidePreview.tsx  # Canlı slayt önizlemesi (büyük + film şeridi mini)
│  │  ├─ editor/AddSlideSheet.tsx # Kategorili slayt tipi galerisi
│  │  ├─ editor/Sheet.tsx      # Ortak bottom-sheet / sağ çekmece kabuğu
│  │  ├─ present/QrCode.tsx
│  │  ├─ present/ReactionOverlay.tsx  # Sağ alttan uçan tepkiler + sayaç
│  │  ├─ present/Podium.tsx    # 🏆 podyum: ilk 3 kürsüde (2-1-3) + geri kalan liste,
│  │  │                        #   puan count-up + "+delta" rozetleri
│  │  ├─ present/Leaderboard.tsx      # Skor modalı (Podium + konfeti)
│  │  ├─ present/LeaderboardSlide.tsx # "Skor Tablosu" slayt tipi görünümü
│  │  ├─ present/ChatPanel.tsx # 💬 canlı sohbet (izleyici + sunucu moderasyonu)
│  │  ├─ vote/                 # MultipleChoice, WordCloud, OpenEnded, Scales,
│  │  │                        # Ranking, Quiz, QuizType, PinOnImage,
│  │  │                        # QuizPersonalResult, Qna
│  │  └─ results/              # BarChart, WordCloud, OpenEnded, Scales, Ranking,
│  │                           # Quiz (✓/✗ rozetli), QuizType, PinOnImage, Qna
│  │
│  ├─ lib/
│  │  ├─ firebase.ts           # Lazy init (env yokken build kırılmaz)
│  │  ├─ types.ts              # Tüm tipler + SLIDE_TYPE_{LABELS,ICONS} + kategoriler
│  │  ├─ presentations.ts      # CRUD, joinCode, slayt CRUD, startQuiz, votingClosed,
│  │  │                        # endPresentation, resetResponses, swapSlideOrder,
│  │  │                        # duplicateSlide, updateTheme, setSlideSkipped,
│  │  │                        # setPresentationFolder, setChatEnabled, updatedAt
│  │  ├─ quizScores.ts         # Puan formülü + seri bonusu + delta (Podium/Leaderboard)
│  │  ├─ chat.ts               # Canlı sohbet gönder/sil (rate limit)
│  │  ├─ quizMusic.ts          # WebAudio gerilim müziği (dosya/dış servis yok)
│  │  ├─ participants.ts       # nickname+avatarSeed (localStorage), son sunum
│  │  ├─ responses.ts          # voterId, oy gönderme, mükerrer oy sayacı
│  │  ├─ reactions.ts          # ❤️👍🎉 gönderme (rate limit)
│  │  ├─ questions.ts          # Q&A: gönder/upvote(+1)/gizle/sil
│  │  ├─ themes.ts             # 8 preset + themeStyle() (koyu/açık)
│  │  ├─ images.ts             # canvas sıkıştırma → base64 (Firestore'a)
│  │  └─ hooks.ts              # useAuthUser, usePresentation, useSlides,
│  │                           # useLiveResponses, useParticipants, useQuestions,
│  │                           # useChatMessages
│  └─ styles/globals.css       # Tasarım sistemi sınıfları + animasyonlar (+ podyum)
```

## 3. Slayt Tipleri

Etkileşimli: multiple-choice, word-cloud, open-ended, scales, ranking,
quiz (seçmeli), **quiz-type (yazarak)**, **pin-on-image (görselde işaretle)**, qna.
İçerik: content (metin), **image**, **video (URL)**, **instructions (adımlar)**,
**leaderboard (podyum slaytı — genelde sona eklenir)**.

Ortak slayt ayarları: `label` (eyebrow), `description` (izleyici cihazında),
`image` (soru görseli), `skipped` (sunumda atla). Quiz'lerde: `timeLimit`,
`music`; quiz'de `correctIndex`; quiz-type'ta options = kabul edilen cevaplar.

## 4. Veri Akışı Özeti

```
Presenter                          Firestore                       Audience
/edit, /present ──────────▶ currentSlideIndex ──onSnapshot──▶ /p/[id] aktif slayt
/present ◀──onSnapshot── responses / participants / reactions / messages ◀── izleyici yazar
quiz: /present startQuiz ──▶ slide.quizStartedAt ──▶ iki tarafta geri sayım
```
