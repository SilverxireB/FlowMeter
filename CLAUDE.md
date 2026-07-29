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
- **Logo (yeni dil):** başta yalnız **O-halkası ikonu** + devamında tam ad metni
  (`Logo variant`; `public/logo-o-{studio|meter|wall|sign|pulse}.png` + `-white`).
  Glifler: Studio = 4 ürün karosu (yay renklerinde app-grid), Meter bar-chart,
  Wall kamera, Sign **dikey tabela totemi**, Pulse EKG. Kaynak FLOW wordmark'ları
  (`logo-flow*.png`) üretim tabanı olarak `public/`ta durur; `LogoRotating` silindi.
  Üretim: sharp ile O içi silinip yeni glif kompoze edilir + O bölgesi kırpılır
  (`--no-save sharp`).
- İşlevsel ikonlar SVG (`components/videowall/icons.tsx`); emoji yalnız içerik/dekor.
  Onaylar `ConfirmDialog` (native confirm değil). Girdilere odak reçetesi.

## Kritik Mimari Notlar
- **FlowSign:** editör TASLAK (`zones`), perde YAYIN (`live`); birleştir/böl içerik
  korur + onay sorar; slug rename'de SABİT; iframe sandbox + http(s) doğrulama;
  Wake Lock + offline persistence (`firebase.ts` persistentLocalCache — tüm suite).
- **FlowPulse:** oy = votes create + days increment tek batch; rules oy değerini
  soru tipine bağlar, days total tam +1; watchToday gece yarısı yeniden abone olur;
  kiosk çıkışı sol üst 5 dokunuş + PIN → yönetici menüsü.
- **FlowWall çekiliş:** adalet+denetim (draws logu); nonce ile perde tetikleme.
- Silme akışları sayfalı (`limit(450)` batch) + Cloudinary prefix temizliği.

## Sıradaki (kullanıcı söyleyince)
- **v5 self-host:** FlowSign (+Pulse) fabrika iç ağı paketi — medya/veri/auth
  katman takası, online BOZULMADAN (plan: `docs/VIDEOWALL.md`).
- Park: Sign ekran-sağlık heartbeat/ses/90°; Pulse profanity+e-posta eşiği;
  Meter kalanları `docs/ROADMAP.md`.
