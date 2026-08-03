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
- Ürün yüzeyleri: Meter+Pulse+**Sign** kokpitleri AYDINLIK (aynı bg-wash/card/
  input-base dili — Sign eskiden #0d102f koyuydu, tek başına mor kalıyordu:
  online + self-host birlikte aydınlığa alındı); Wall lacivert, Pulse kiosk/pano
  #101014, Sign PERDESİ siyah (yayın alanı içerik zeminidir, kokpit değil).
  Koyu ekranlara `[color-scheme:dark]`.
- **Logo (yeni dil):** başta yalnız **O-halkası ikonu** + devamında ad metni;
  "FLOW" yazısı YALNIZ çatıda (FLOW STUDIO), ürünler O + kısa ad (METER/WALL/
  SIGN/PULSE) (`Logo variant`; `public/logo-o-*.png` + `-white`).
  Glifler: Studio = 4 ürün karosu (yay renklerinde app-grid), Meter bar-chart,
  Wall kamera, Sign **dikey tabela totemi**, Pulse EKG. Kaynak FLOW wordmark'ları
  (`logo-flow*.png`) üretim tabanı olarak `public/`ta durur; `LogoRotating` silindi.
  Üretim: sharp ile O içi silinip yeni glif kompoze edilir + O bölgesi kırpılır
  (`--no-save sharp`).
- İşlevsel ikonlar SVG (`components/Icon.tsx` — TEK çekirdek set, optik kalınlık:
  küçük boy daha kalın çizgi); emoji yalnız içerik/dekor. Emoji BİLİNÇLİ olan
  yerler: şablon kartı simgesi (kimlik), Wall perde modu/efekt seçicileri
  (emoji efektin kendisini gösterir), Pulse yüz ölçeği, tepkiler/kutlamalar.
  İkon kontrol sayfası: `/dev/icons`.
  Onaylar `ConfirmDialog` (native confirm değil). Girdilere odak reçetesi.
- **KULLANIM REHBERLERİ (dört ürün):** `?` → sağdan çekmece. Kabuk
  `components/Rehber.tsx` + yapı taşları `components/RehberParcalari.tsx`
  (çekirdek, ürün bilmez); içerik ürün başına: `rehber/meterIcerik` ·
  `rehber/wallIcerik` · `rehber/pulseIcerik` · `videowall/signRehberIcerik`
  (Sign kendi klasöründe — ayrı paket olarak satılacak, self-host'ta da var ve
  metni HİÇBİR ürüne atıf yapmaz). Hepsi `next/dynamic` ile geciktirmeli.
  **EKRAN GÖRÜNTÜSÜ YOK — kural:** düğmeler ürünün gerçek sınıflarıyla (`Dugme`),
  ekranlar gerçek bileşenle (Sign `LayoutEditor`, Meter `SlidePreview`), referans
  tabloları ÜRÜNÜN KENDİ SABİTİNDEN türetilir (`SLIDE_TYPE_LABELS`,
  `WALL_SCREEN_MODES`, `WALL_EFFECTS`) → yeni slayt tipi/perde modu eklenince
  rehber kendiliğinden güncellenir. Yalnız bizim olmayan yüzeyler (Windows,
  ekran kartı) ekran görüntüsü ister. Giriş: her kokpit + liste + hub başlıkları.
  Derin link: hata şeridi ilgili bölümü açar (Sign `errBolum`/`onRehber`).
  Yazdırma `.rehber-yazdir` + `@media print`.
  Editoryal kural: tekrar yok (aynı bilgi iki bölümde geçmez), dolgu yok, her
  bölümde bir "sık karşılaşılanlar" tablosu, uyarı kutusu YALNIZ gerçek tuzak için.
- **Metin ekonomisi (kullanıcı kararı):** yardım paragrafları KISA — "demo sayfa"
  hissi veriyordu. Kural: bir cümle, gerekiyorsa kalın vurgu; tekrar eden bilgi
  (zaten ekranda görünen) yazılmaz. 2026-08'de Sign editörü/listesi, Wall perde
  linki ve Pulse kiosk ipuçları buna göre budandı.

## Kritik Mimari Notlar
- **Google girişi KENDİ alan adımızdan** (`NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN =
  flowstudiomanisa.vercel.app` + `next.config.mjs` `/__/auth/*` proxy'si).
  Fabrika iç ağı `*.firebaseapp.com`'u kapatıyordu: site açılıyor, Firestore
  çalışıyor, ama giriş penceresi zaman aşımına düşüyordu. İKİ parça birlikte:
  Google Cloud OAuth istemcisinde `…/__/auth/handler` kayıtlı OLMALI, yoksa
  `redirect_uri_mismatch`. Eski `.firebaseapp.com` kaydı geri dönüş için duruyor
  (ayrıntı `lib/firebase.ts`). İç ağ izin listesi: site + `*.googleapis.com` +
  `res/api.cloudinary.com`.
  **Jeton tuzağı:** kimlik jetonu ~1 saatte bir `securetoken.googleapis.com`
  üstünden yenilenir; o adres kapalıysa ilk saat her şey ÇALIŞIR, sonra tüm
  okumalar `permission-denied` verir (kural değil, kimlik sorunu). Teşhis:
  `/admin/prova` → "Oturum jetonu".
  **Geri çekilme tuzağı:** Firestore bağlantısı koptuğunda üstel geri
  çekilmeyle yeniden dener ve bekleme **60 sn'ye kadar** çıkar; ekran uzun
  süre açık kalınca "sunucu yanıtı bekleniyor" dakikalarca sürüyordu (sayfa
  yenilenince 1 sn). `lib/firebase.ts` → `baglantiyiTazele()`
  (disableNetwork→enableNetwork) sayacı sıfırlar: sekme 45 sn+ gizli kalıp
  dönünce, `online` olayında ve yazım gecikince otomatik çağrılır.
  **ÇOK-SEKME TUZAĞI (asıl suçlu buydu):** kalıcı önbellek **tek sekme**
  (`persistentSingleTabManager`) — GERİ ALMAYIN. Çok-sekmede sekmelerden biri
  "birincil" olur ve ağa çıkan tek bağlantı onundur; diğer sekmelerin sorguları
  onun KİMLİĞİYLE gider. Bizde sekmeler bilerek farklı kimlikte (kokpit Google,
  perde/sunum/oylama auth'suz — o sayfalar `auth()` çağırmadığı için istek
  kimliksiz, /u anonim): perde sekmesi birincil olunca kokpitin okumaları
  kimliksiz çıkıp `permission-denied` alıyordu (kişiler/yetkiler/tabelalar
  boşalır, teşhis satırı "doğru hesap · jeton taze" der). "Sunucu yanıtı
  bekleniyor 2 dk" da aynı sebep: birincil sekme arka planda kısılınca herkes
  onu bekler (düzelmesi için İKİ sekmeyi de yenilemek gerekiyordu).
- **FlowSign:** editör TASLAK (`zones`), perde YAYIN (`live`); birleştir/böl içerik
  korur + onay sorar; slug ad değişince YENİLENİR (slugHistory eski linkleri taşır);
  iframe sandbox + http(s) doğrulama; Wake Lock + offline persistence
  (`firebase.ts` persistentLocalCache — tüm suite).
  **Sign AYRI PAKET olarak ayrılacak** (satış/self-host) → Sign kodu diğer
  ürünlerle bağ KURMASIN; ortak yalnız çekirdek (firebase/cloudinary/withTimeout).
  **YETKİ (yalnız Sign) — TEK yerden:** ekran sayfalarında yetki yüzeyi YOK
  (kullanıcı kararı: "öyle her sayfada yetki değil"). Online `/admin` →
  **Sign yetkileri**, self-host Kullanıcılar → **Sign yetkileri**: KİŞİ bazlı
  açılır matris (kişi satırında "yeni ekran açabilir" tiki; altında tüm ekranlar
  × görüntüle/düzenle/kopyala/sil). Varsayılan: OLUŞTURAN tam yetkili; açık kayıt
  varsayılanı ezer (ayrılan personel kesilebilir). Online `videowalls.grants`
  (uid→tikler) + `users.canCreateSign`; self-host `data/users.json` (scrypt,
  rol+canCreate) + wall `grants`, kararlar SUNUCUDA (serverAuth.ts).
  **Izgara AYRIMI:** `cols/rows` = FİZİKSEL ekran (kesik çizgi = çerçeve/bezel),
  `layoutCols/layoutRows` = YERLEŞİM — ama yerleşim ızgarası KULLANICIYA
  GÖSTERİLMEZ (kokpitteki satır kaldırıldı, kafa karıştırıyordu). Bölme SEÇİLİ
  ALANIN panelinde: "Bu alanı böl ⇄/⇅ 2·3·4" → `splitZoneInto` ızgarayı sessizce
  katlar, diğer alanları ölçekler, sonra EBOB ile sadeleştirir; `saveLayout`
  ızgara+alanları tek yazımda gönderir. Editör sırası: tanım → yerleşim
  (+ oynatma modu) → içerik → yayın linki + ekranlar (EN ALTTA).
  Alan zemini varsayılanı `ZONE_BG_DEFAULT` = Flow lacivert #001e64 (siyah
  değil; editör tuvali de aynı renk).
  **GÖMÜLÜ EKRAN (yetki devri):** alana `Ekran` düğmesiyle BAŞKA bir ekran
  bağlanır (`ZoneItem.kind:"screen"` + `screenId` — ADRES değil KİMLİK, ad
  değişse de kopmaz). Amaç: ekranın bir bölümünü başkasına yönettirmek; sınır
  ekranın sınırıdır, o kişi seninkine dokunamaz. Perde bağlı ekranın YAYININI
  çizer. IFRAME DEĞİL — `GomuluEkran` hedefin alanlarını AYNI ağaçta çizer
  (`PlayerStage`): eskiden `/flowsign/...` URL öğesi olarak ekleniyor ve alanın
  içinde uygulamanın TAMAMI yeniden çalışıyordu (ikinci React + Firebase +
  Firestore + nabız + önden indirme), üstelik iframe gömülü ekranın TASARIM
  çözünürlüğünde çizilip küçültüldüğü için her karede dev yüzey ölçekleniyordu
  → video geç açılıp duraksıyordu. Üç kapı: `zincir` döngüyü keser, gömülü ekran
  HEP otomatik oynar, nabız/Wake Lock yalnız en dıştaki perdede. Eski
  yapıştırılmış linkler de tanınır (`signAdresi`, yalnız AYNI köken) → kimse
  elle düzeltmez. Önden indirme küçük alanda `metadata`ya düşer. Sınav:
  `node tests/gomulu-ekran.test.mjs`.
  **Self-host paketi VAR: `flowsign-selfhost/`** (bağımsız Next app; Firestore→
  `data/` JSON dosya deposu, Cloudinary→yerel disk + güvenli dosya adı
  [boşluk/TR→alt çizgi], realtime→SSE, kişi başına hesap (users.json),
  internetsiz iç ağ; README ile yazılımcıya teslim edilir; ana repo
  tsconfig'inden dışlandı).
  KURAL: Sign ürün davranışı değişince İKİ yerde güncellenir — `src/` (online)
  + `flowsign-selfhost/` (kopya bileşenler: PlayerStage/ZonePanel/LayoutEditor/
  zones.ts birebir mantık taşır). İKON SETİ de kopyadır: `icons.tsx` glifleri
  `components/Icon.tsx`ten alınır (2026-08'de 22 ikon ayrışmıştı — self-host
  eski ince seti taşıyordu; optik kalınlık `strokeFor` ile birlikte taşındı).
  7/24 bekçiler Sign dosyalarında: donma bekçisi + dayanıklı abonelik + gece
  04:0x reload + tek-URL 15dk tazeleme + play error boundary (PlayerStage,
  videowalls.ts, play rotaları). Liste kartları `WallThumb` (YAYIN minyatürü;
  URL alanı gerçek sayfa iframe'i, lazy). İçerik takvimi: saat+gün+`fromDate/
  toDate` — TEK kapı `itemInWindow`. URL eklemede `/api/sign/embed-check`
  (X-Frame-Options uyarısı); zoom %25-150; STRETCH standart (kullanıcı kararı).
  **REHBER (Sign):** `?` → sağdan çekmece (`components/Rehber.tsx` çekirdek kabuk
  + `videowall/signRehberIcerik.tsx` içerik + `SignRehber` sarmalayıcı; editör ve
  liste `next/dynamic` ile geciktirmeli çağırır). Ayrı sayfa DEĞİL: yardım aranan
  an iş yapılan andır. **EKRAN GÖRÜNTÜSÜ YOK** — düğmeler ürünün gerçek
  sınıflarıyla, yerleşim örneği GERÇEK `LayoutEditor` ile (`RehberDemo`, bellekte,
  hiçbir yere yazmaz) basılır; tasarım değişince rehber kendiliğinden değişir.
  Yalnız bizim olmayan yüzeyler (Windows/ekran kartı) ekran görüntüsü ister.
  Derin link: hata şeridi + URL uyarısı ilgili başlığı açar (`errBolum`,
  `onRehber`). Yazdırma: `.rehber-yazdir` + `@media print`.
  Sign'ın TÜRKÇESİ **videowall** (tabela DEĞİL — kullanıcı kararı); oynatma modu
  çipi de "Videowall / Sunum".
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
  Anonymous provider AÇIK olmalı**; oturum `browserSessionPersistence` ile
  SEKMEYE hapsedilir — varsayılan kalıcılıkta anonim oturum tüm sekmelere
  sızıp Studio'nun Google oturumunu eziyordu: panelde "kişiler/yetkiler
  gitti", her okuma `permission-denied`. Sign perdesi/Pulse kiosk/Meter
  izleyici HİÇ giriş yapmaz; anonim kimliğe ihtiyaç duyan TEK yer burası), rules delete voterId==uid, destroy API
  `mode:"guest"` (public_id sunucudan okunur); `frameUrl` etkinlik çerçevesi
  (yükleme ÖNCESİ canvas compose — Cloudinary kredisi yemez); çekiliş:
  adalet+denetim (draws logu); nonce ile perde tetikleme.
- **FlowPulse:** oy = votes create + days increment tek batch; rules oy değerini
  soru tipine bağlar, days total tam +1; watchToday gece yarısı yeniden abone olur;
  kiosk çıkışı sol üst 5 dokunuş + PIN → yönetici menüsü (SON OY HATASI burada
  görünür — kiosk misafire hata göstermez ama teşhis kör kalmaz).
- **Prova & sağlık `/admin/prova`:** dört ürünün test takımı (yönetici kapısı +
  rules `isAdmin()`; eski `/dev/sim` gizli anahtarı silindi). İLKE: prova GERÇEK
  yazma yolunu kullanır, kurallar gevşetilmez; yazım hataları yutulmaz, işlem
  akışına düşer. Duvar/Tabela örnek medyayı CİHAZDA üretip Cloudinary'ye yükler
  (rules dış link kabul etmez). Tabela provası kendi ekranını açar, var olan
  tabelalara dokunmaz. Ayrıntı: `docs/ROADMAP.md`.
- Küfür süzgeci `lib/profanity.ts` TÜM açık uçlu girişlerde (Meter sohbet/Q&A/
  cevaplar, Wall dilek+takma ad, Pulse yorum) — engellemez, yıldızlar.
- Silme akışları sayfalı (`limit(450)` batch) + Cloudinary prefix temizliği.
- `Logo` bileşeni `shrink-0` (dar başlıkta ezilip yandaki adla binmesin).
- **Geri tuşu disiplini (suite geneli):** perde/kiosk/pano linkleri `usePlayTarget`
  ile açılır (masaüstü yeni sekme; telefon/PWA aynı pencere — `_blank` PWA'da
  geçmişsiz pencere açıp geri tuşuyla uygulamayı kapatıyordu; "↗" da yalnız yeni
  sekmede gösterilir). Hub'da ürün alanına giriş `pushState` (eskiden
  `replaceState` → geri tuşu hub'ı atlayıp karşılamaya düşüyordu), `popstate`
  senkronlar. Tam ekran yüzeylerde `ScreenClose` (dokunmatik + geçmiş varsa +
  gömülü değilse); Pulse kiosk hariç (çıkış bilerek PIN'li).
- **Geri tuşu HEDEFİ (kural):** `←` sayfanın GELDİĞİ yere döner, hub'a değil.
  Ölçüt: sayfaya nereden giriliyorsa üstü orasıdır — `/moderate` ve `/remote`
  editörden açılır → `/edit/[id]`; `/results` iki yerden açılır → sunum listesi
  (`?p=decks`) + ayrıca "Editör" linki; kokpitler kendi listelerine; listeler
  hub'a; `/admin*` kardeştir (AdminTabs) → hepsi hub'a.
- **Giriş kapısı hedefi taşır:** oturumsuz açılan sayfa `/login?next=<yol>`e
  gider (`lib/girisYolu.ts` · `loginYolu()`), giriş sonrası oraya bırakılır
  (`girisSonrasi()`). Eskiden 17 sayfa düz `/login`e atıyor, giriş de HUB'a
  düşürüyordu: paylaşılan bağlantıyı açan kişi aradığı şeye hiç varamıyordu.
  `next` YALNIZ tek eğik çizgiyle başlayan iç yollar (protokole-göreli `//site`
  ve mutlak adres elenir — açık yönlendirme kapısı). Sınav:
  `node tests/giris-yolu.test.mjs`.
- **UI ortak bileşenleri:** `Icon` (tek ikon seti) · `ConfirmDialog`+`useConfirm`
  (native confirm YOK) · `CodeInput` (6 haneli kod, aydınlık/koyu) · `Skeleton`
  (kokpit yükleme iskeletleri; perde/kiosk'ta tek satır yazı doğru) ·
  `ScreenClose` · `usePlayTarget`. Koyu yüzey sınıfları: `card-dark`,
  `btn-dark`, `btn-dark-primary`, `btn-dark-icon`, `input-dark`.
- **Kayıt açan her aksiyonda ÇİFT TIKLAMA KİLİDİ `useRef` ile** (state kilidi
  yarışı kaybediyor: iki hızlı dokunuş aynı çizimi okuyup ikisi de geçiyordu).
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

## Kantin (Flow Studio'ya AİT DEĞİL — kenarda, kaldırılabilir) · `docs/KANTIN.md`

İç kullanım için sipariş uygulaması: `/kantin…` + `src/lib/kantin/` + kurallardaki
KANTİN bloğu. KURAL: Studio koduna DOKUNMAZ, Studio da buna bağ kurmaz; hub'da,
landing'de, hiçbir yerde linki yoktur. "Kaldır" denince iki klasör + bir kural
bloğu silinir, Studio'nun tek satırı etkilenmez.
- **AYRI Firebase örneği** (`lib/kantin/firebase.ts`, app adı `kantin`): kantin
  e-posta+şifre ile girer, Studio Google ile. Aynı `auth` paylaşılsaydı kantine
  giren Studio'da da girmiş sayılırdı. Kalıcı önbellek bilerek kapalı (aynı
  projede iki kalıcı önbellek çakışır; kantin zaten bina içi/çevrimiçi).
- Roller: yönetici (her şey) · kantinci (yalnız kendi kantini) · personel (menü +
  kendi siparişi). Rol/yasak yalnız yöneticide — kurallar da öyle diyor.
- **ÖDEME YOK** (kullanıcı kararı): para hiç geçmez, fiyat sadece bilgi.
  Sipariş NUMARASI da yok — kişi kimlikli, tezgâh ad+sicil görür.
- Çok kantinli baştan (`kantin/{id}`); bugün iki, yarın daha fazla.
- Bekleme tahmini iyimser DEĞİL (`beklemeDk`): mola 10 dk, tutmayan süre ürünü
  ilk günde bitirir.
- Sipariş kimliği DETERMİNİSTİK `{uid}_{gun}_{1..5}`: çift dokunuş ikinci kayıt
  açamaz, kişi başı GÜNLÜK tavan sunucuda (kurallar kimliği doğrular).
- Kuyruk sayacı AYRI belgede (`gunler/{gun}`); siparişleri yalnız sahibi+görevli
  okur (eskiden herkes herkesin ne yediğini görüyordu + kota felaketiydi).
- Stok otoritesi TEZGÂHTA (`tukendiGun`, yalnız o gün geçerli): herkesin yazdığı
  sayaç tek satırla menüyü kilitleyen saldırı yüzeyi olurdu.
- Gece yarısı gün döner (`izleBugunSiparisleri/izleBugunOzet`) — vardiyalı
  fabrikada tezgâh/pano 00:00'dan sonra SESSİZCE kör kalıyordu.
- Uyarı KABUKTA (`oturum.tsx`): sayfa değişince susmaz; Wake Lock + bildirim +
  ses/titreşim + 3 dk'da bir en fazla 3 hatırlatma. Sunucu push'u YOK (VAPID
  anahtarı + gönderen kimliği gelince eklenir — denenmemiş push yolu yazılmaz).
- Hedef: gerektiğinde İÇ AĞA kurulacak (Sign self-host deseni).
