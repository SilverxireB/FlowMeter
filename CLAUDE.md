# Flow Studio — CLAUDE.md

**Çatı marka: Flow Studio** — 4 ürün, tek hesap (Next.js 14 App Router + TS +
Tailwind + Firebase `flowmeter-938a3` + Vercel). Türkçe UI, İngilizce kod.
Hub: `/dashboard`. Landing/hub/login/PWA çatı kimliği taşır; ürün adları sabit.

| Ürün | Ne | Rotalar | Doküman |
|---|---|---|---|
| **FlowMeter** | İnteraktif sunum/oylama (Menti klonu) | `/edit /present /p /join /results` | `docs/ROADMAP.md` |
| **FlowWall** | Canlı foto/video etkinlik duvarı + çekiliş + Anı Filmi | `/wall/[id](/manage)` `/u/[id]` | `docs/FLOWWALL-DURUM.md` |
| **FlowSign** | Video-wall/dijital tabela CMS (taslak→Kaydet&Yayınla) | `/videowall(...)` `/flowsign/[slug]` | `docs/VIDEOWALL.md` |
| **FlowPulse** | Sürekli nabız/geri bildirim (kiosk+QR, anonim) | `/pulse(...)/manage|kiosk|vote|board` | `docs/FLOWPULSE.md` |

## Altın Kurallar
1. Push öncesi MUTLAKA `npm run build`.
2. **Branch'ler:** geliştirme `claude/flowmeter-paket-3-kota-w3er37`; production
   `claude/practical-lamport-ls9miq` (Vercel bunu yayınlar; kullanıcı onayıyla
   fast-forward push edilir — bugüne dek hep birlikte push edildi).
3. **firestore.rules** değişince TAM halini kullanıcıya ver (konsola elle yapıştırır).
4. DIŞ SERVİS YOK; tek istisna Cloudinary (yalnız FlowWall medyası + FlowSign
   içeriği; silmede `/api/wall/destroy` prefix temizliği). Pulse tamamen Firebase.
5. Realtime = `onSnapshot`; polling yasak. Kota bilinci: Pulse günlük rollup
   (`days/{yyyy-mm-dd}`), Sign `live` yayın anlık görüntüsü.
6. Audience/kiosk/perde auth istemez; sunucu Google ile girer. Pulse ANONİM (bilerek).
7. **ORTAM SIFIRLANABİLİYOR:** çalışma ağacı bazen eski commit'e döner; her oturum
   başında `git log --oneline -1` kontrol et, gerekirse
   `git fetch origin <dev-branch> && git checkout -B <dev-branch> origin/<dev-branch>`
   + `npm install`. Her şey remote'ta güvende tutulur (sık commit+push).

## Tasarım Sistemi
- Font Plus Jakarta Sans; renkler: accent indigo #4f46e5 (birincil aksiyon),
  brand gül #e11d48 (YALNIZ uyarı/danger), ink/paper/line/muted nötrler.
  Logo lacisi #001e64. Skor semantiği (Pulse): yeşil ≥70 / amber ≥40 / gül <40.
- Ürün yüzeyleri: Meter+Pulse kokpiti AYDINLIK; Wall lacivert, Sign #0d102f koyu,
  Pulse kiosk/pano #101014. Koyu ekranlara `[color-scheme:dark]`.
- **Logo (yeni dil):** başta yalnız **O-halkası ikonu** + devamında ad metni;
  "FLOW" yazısı YALNIZ çatıda (FLOW STUDIO), ürünler O + kısa ad (METER/WALL/
  SIGN/PULSE) (`Logo variant`; `public/logo-o-*.png` + `-white`).
  Glifler: Studio = 4 ürün karosu (yay renklerinde app-grid), Meter bar-chart,
  Wall kamera, Sign **dikey tabela totemi**, Pulse EKG. Kaynak FLOW wordmark'ları
  (`logo-flow*.png`) üretim tabanı olarak `public/`ta durur; `LogoRotating` silindi.
  Üretim: sharp ile O içi silinip yeni glif kompoze edilir + O bölgesi kırpılır
  (`--no-save sharp`).
- İşlevsel ikonlar SVG (`components/videowall/icons.tsx`); emoji yalnız içerik/dekor.
  Onaylar `ConfirmDialog` (native confirm değil). Girdilere odak reçetesi.

## Kritik Mimari Notlar
- **FlowSign:** editör TASLAK (`zones`), perde YAYIN (`live`); birleştir/böl içerik
  korur + onay sorar; slug ad değişince YENİLENİR (slugHistory eski linkleri taşır);
  iframe sandbox + http(s) doğrulama; Wake Lock + offline persistence
  (`firebase.ts` persistentLocalCache — tüm suite).
  **Sign AYRI PAKET olarak ayrılacak** (satış/self-host) → Sign kodu diğer
  ürünlerle bağ KURMASIN; ortak yalnız çekirdek (firebase/cloudinary/withTimeout).
  **Self-host paketi VAR: `flowsign-selfhost/`** (bağımsız Next app; Firestore→
  `data/` JSON dosya deposu, Cloudinary→yerel disk + güvenli dosya adı
  [boşluk/TR→alt çizgi], realtime→SSE, tek yönetici parolası, internetsiz iç
  ağ; README ile yazılımcıya teslim edilir; ana repo tsconfig'inden dışlandı).
  KURAL: Sign ürün davranışı değişince İKİ yerde güncellenir — `src/` (online)
  + `flowsign-selfhost/` (kopya bileşenler: PlayerStage/ZonePanel/LayoutEditor/
  zones.ts birebir mantık taşır).
  7/24 bekçiler Sign dosyalarında: donma bekçisi + dayanıklı abonelik + gece
  04:0x reload + tek-URL 15dk tazeleme + play error boundary (PlayerStage,
  videowalls.ts, play rotaları). Liste kartları `WallThumb` (YAYIN minyatürü;
  URL alanı gerçek sayfa iframe'i, lazy). İçerik takvimi: saat+gün+`fromDate/
  toDate` — TEK kapı `itemInWindow`. URL eklemede `/api/sign/embed-check`
  (X-Frame-Options uyarısı); zoom %25-150; STRETCH standart (kullanıcı kararı).
- **FlowMeter:** `mode: audience-pace` → /p yerel gezinme (quiz slaytları atlanır —
  rules geri sayım kapısı); `textModeration` → open-ended/word-cloud cevapları
  pending (rules kapılı, /moderate "Cevaplar"); `/remote/[id]` telefon kumandası +
  `settings.notes` konuşmacı notu; editörde ▶ Dene = prova (`setResponseDryRun` —
  yazım YOK); Sonuçlar'da 📄 PDF (jspdf + Türkçe katlama); izleyici yüzeyi i18n:
  `lib/i18n.ts` `t(tr,en)` + `presentation.language` (kokpit HEP Türkçe).
- **FlowWall:** `/g/[id]` public galeri (`galleryOpen`, tek okuma); sayfa İÇİ
  kamera (getUserMedia — capture input Android'de RAM ölümüyle kare kaybediyordu,
  yedek yol duruyor); `pinnedMediaId` → perdede WallPinned takeover;
  misafir KENDİ medyasını siler: /u sessiz anonim auth (voterId=uid; **Firebase
  Anonymous provider AÇIK olmalı**), rules delete voterId==uid, destroy API
  `mode:"guest"` (public_id sunucudan okunur); `frameUrl` etkinlik çerçevesi
  (yükleme ÖNCESİ canvas compose — Cloudinary kredisi yemez); çekiliş:
  adalet+denetim (draws logu); nonce ile perde tetikleme.
- **FlowPulse:** oy = votes create + days increment tek batch; rules oy değerini
  soru tipine bağlar, days total tam +1; watchToday gece yarısı yeniden abone olur;
  kiosk çıkışı sol üst 5 dokunuş + PIN → yönetici menüsü (SON OY HATASI burada
  görünür — kiosk misafire hata göstermez ama teşhis kör kalmaz).
- Küfür süzgeci `lib/profanity.ts` TÜM açık uçlu girişlerde (Meter sohbet/Q&A/
  cevaplar, Wall dilek+takma ad, Pulse yorum) — engellemez, yıldızlar.
- Silme akışları sayfalı (`limit(450)` batch) + Cloudinary prefix temizliği.
- `Logo` bileşeni `shrink-0` (dar başlıkta ezilip yandaki adla binmesin).
- rules değişince kullanıcıya İKİ ~200 satırlık parça halinde CHAT'e yazılır
  (dosya eki mobilde kopyalanamıyor); parçaların birleşimi diff ile doğrulanır.

## Sıradaki (kullanıcı söyleyince)
- **Fikir havuzu:** `docs/FIKIR-RAPORLARI-2026-08.md` — 4 danışman raporu
  (yeni ürün adayları: FlowQueue 9/10, FlowCheck, FlowSpark; ürün derinleştirme;
  self-host 7 adımlı yol haritası; sinerjiler). Meter M1-M6 + Wall W1-W5 TAMAM.
- **Onay bekleyen:** W6 uygulama içi etiket/hashtag (dış servissiz varyant).
- **Adaylar:** vitrin paketi (Wall perdeye `?embed=1` sade mod → Sign'a gömme;
  Pulse board `?compact/?alert`; Meter public sonuç `/r/[id]`; dashboard "Bugün"
  şeridi) · FlowQueue MVP. ✅ Sign ▶ perde linki: telefon/PWA'da aynı pencerede
  açılır (`usePlayTarget`), perdede dokunmatik cihazlara özel "← Kapat".
- **v5 self-host:** ✅ v1 paketi HAZIR — `flowsign-selfhost/` (2026-08; rapor
  3'teki Adım 1-4'ün ürün karşılığı). Kalan: lisans/ekran limiti, Docker,
  markalama (A5-A8). Park: Sign ses/90°; Pulse e-posta eşiği;
  Meter kalanları `docs/ROADMAP.md`.
