# FlowSign (VideoWall) — Plan & Mimari

> **3. ürün** (hub'da 4. kart): fiziksel video-wall / dijital tabela CMS'i.
> Duvar çözünürlüğü + ekran ızgarası tanımla → sürükle-bırak alan yerleşimi →
> her alana görsel/video/URL ata + sıra/süre/saat aralığı → kaydet → tam ekran
> oynatma linki (Chrome fullscreen → 1:1 doğru çözünürlük).
>
> **İki dağıtım (KRİTİK ilke):**
> 1. **Online (Vercel + Firestore + Cloudinary):** dene/paylaş/uzaktan kullan.
> 2. **Self-host (fabrika iç-network, dış bağlantısız):** AYNI kod, ayrı paket.
>    Medya = yerel klasör, veri = iç Firestore/offline, auth = fabrika uygulaması.
>
> Bu yüzden her şey **kopabilir katman** arkasında: online somut kurulur, self-host
> sonra bu katmanları takas eder — online HİÇ bozulmadan.

## Kopabilir katmanlar (self-host için tasarım kuralı)
| Katman | Online (v1) | Self-host (sonra) | Nerede |
|---|---|---|---|
| **Medya** | Cloudinary (upload+CDN) | Yerel klasör (app servis eder) | `src/lib/videowall/media.ts` |
| **Veri** | Firestore (`videowalls/`) | İç Firestore / offline JSON | `src/lib/videowalls.ts` |
| **Auth** | Firebase Auth (Google) | Fabrika uygulaması girişi | `useAuthUser` / provider |
| **Oynatıcı** | AYNI kod her iki yerde | AYNI kod | `/videowall/[id]/play` |

Kural: oynatma sayfası **dış bağlantı olmadan** da çalışabilmeli (yerel medya + yerel
config). Bulut-özel şeyler (Cloudinary URL üretimi vs) tek dosyada izole.

## Veri modeli (taslak)
```
videowalls/{id}: ownerId, name, width, height (toplam px),
                 cols, rows (fiziksel ekran ızgarası),
                 zones: Zone[], createdAt, updatedAt
Zone: { id, x, y, w, h (0–1 oran; duvar pikseline çarpılır),
        fit: "cover"|"contain", items: ZoneItem[] }
ZoneItem: { id, kind: "image"|"video"|"url", src, name?,
            durationSec? (image/url; video kendi süresi ya da cap),
            from?, to? ("HH:MM" saat aralığı; boşsa hep) }
Cloudinary: klasör videowalls/{id}/  (online medya)
```
Oynatma: her zone kendi `items`'ını sırayla döndürür (saat aralığına uyan);
image=süre, video=bitince, url=iframe+süre. Geçişte crossfade. 7/24 için ön-yükleme
+ bellek temizliği (video release) ŞART.

## Rotalar
| Rota | İş |
|---|---|
| `/videowall` | Duvar listesi (yetkili = parlak, diğer = sönük) + Yeni |
| `/videowall/[id]/edit` | Editör: çözünürlük/ızgara + sürükle-bırak layout + içerik + sıra/süre/saat + önizleme |
| `/videowall/[id]/play` | Tam ekran oynatma (id ile; PlayerStage'i sarar) |
| `/flowsign/[slug]` | **Kolay yayın linki** — insan-dostu ad (`/flowsign/giris-holu`); slug ile duvarı bulur. Tabela PC'sinde açması kolay. |

> Oynatma motoru tek yerde: `components/videowall/PlayerStage.tsx` (iki rota da kullanır).
> Slug: `uniqueSlug` (çakışırsa -2, -3…) create/rename/duplicate'te; eskilere edit'te `ensureSlug`.
> Görseller önceden **decode** edilip yüklenir + enter animasyonu reflow'lu → geçişte flaş yok.
> Silme: `deleteVideowall(v, idToken)` önce `/api/wall/destroy` `mode:"sign"` ile Cloudinary
> `flowsign/{id}/` klasörünü temizler (yetim dosya yok), sonra dokümanı siler.
> LayoutEditor etkileşimi pointer-capture + koordinat matematiği (dokunmatik de çalışır).

## Layout editörü (en zor UI)
Model: her zone = `{x,y,w,h}` (0–1 oran) + **grid snap** (cols×rows'a hizalar).
Böl (yatay/dikey) / birleştir (komşu seç) / sürükle-taşı / kenar-çek yeniden boyut.
Başlangıç: cols×rows tam ızgara; kullanıcı böler/birleştirir.

## Yetkilendirme / liste — YAPILDI
Liste `listAllVideowalls()`: senin duvarların **parlak** (düzenle/yayınla/kopyala/sil),
diğer kullanıcılarınki **sönük bilgi kartı** (👤 sahip adı + ▶ İzle; yayın zaten public).
Edit sayfası sahibi olmayana 🔒 "yetkin yok" ekranı gösterir (İzle + geri).
`ownerName` create/duplicate'te denormalize edilir. Self-host'ta fabrika rolleriyle eşlenecek.

## Fazlar
1. ✅ **v1 (online iskelet):** liste + oluştur + çözünürlük/ızgara config + grid önizleme + yayın rotası.
2. ✅ **v2 layout editörü:** hücre sürükle → **birleştir**, tıkla → seç, **böl** (`LayoutEditor`, `mergeCells`/`splitZone`).
3. ✅ **v3 içerik:** Cloudinary upload (görsel/video) + URL öğesi + süre/saat aralığı/sıra (`ZonePanel`, `updateZones`).
4. ✅ **v4 oynatma:** alan başına oynatma listesi + saat aralığı filtresi + crossfade + bozuk öğe atlama (7/24) (`play/page.tsx`).
5. ⬜ **v5 self-host paketi:** medya/veri/auth katmanlarını takas et (online bozulmadan).

> Not v2: yerleşim **hücre-birleştirme** modeli (video wall'a doğru olan bu — alanlar
> fiziksel ekran sınırına hizalı kalır). Serbest piksel sürükle-taşı gerekirse v5+.
> Not v3: FlowSign yüklemeleri `keepOriginal:true` (tabela tam çözünürlük ister).
> Not: içerik alana **STRETCH** (object-fit: fill) edilir — sığdır/doldur seçeneği YOK
> (kullanıcı kararı, 2026-07: standart bu; editör bunun yerine alanın **hedef
> çözünürlüğünü** söyler — panelde 📐 bandı). URL öğesinde **zoom** (%25–150):
> iframe büyük sanal pencerede render edilip ölçeklenir (şirket dashboard'ları
> için Chrome zoom derdi biter; `ZoneItem.zoom`).
> **Sunum Modu** (2026-07, `playMode: "auto"|"manual"` kök alanı — yayından
> bağımsız, perde anında uyar): ekran başına seçim; manual'da otomatik akış
> kapalı, kumanda/klavye gezinir (→/←/boşluk/PgUp-PgDn, 150ms debounce),
> uçlarda durur, sağ altta sönen sayaç (en büyük alan), B=siyah, F=tam ekran,
> F5 yenilemez. Normal tabela ekranları etkilenmez.
> Editör güvenlik ağları (2026-07): tek adım **Geri Al** (yerleşim/içerik),
> ızgara değişiminde içerik İLK ALANA taşınır (silinmez), yayın netliği
> (yeşil "✓ Yayında" şeridi + çevrimdışı publish mesajı), kütüphane kopyası
> takvim taşımaz. Perde: video ilk-kare bekler (kırpışma yok) + unmount'ta
> kaynak bırakır.

### Cila turları (online ürünü güçlendirme — hepsi CANLI)
- **Tier 1:** Wake Lock + tek-tık tam ekran · METİN & SAAT öğesi · editörde canlı
  içerik önizleme · alan adlandırma.
- **Tier 2:** sürükle-bırak dosya yükleme + çoklu kuyruk · medya kütüphanesi
  (tekrar kullan) · geçiş efekti (yumuşak/kesme/kaydır) + alan zemin rengi · yayın
  linki QR + kopyala · gün/hafta zamanlama (saat aralığı + günler) · duvar kopyala
  + ilk-kullanım rehberi.
- **Tier 3:** ekran tanıma (fiziksel ekranlara numara bas) · Firestore offline
  persistence (`persistentLocalCache`, ağ kesilse son içerik döner) · sıradaki
  medya ön-yükleme (siyah flaş yok).

## Marka
Ayrı kimlik (hub'da 3. kart). Ad: **FlowSign** (Flow + ekran/tabela). Logo: `Logo`
bileşeni `variant="sign"` (FLOW O-halkası + SIGN); özel `logo-flowsign.png` çizilince
o iki satır değişir. Teal kart (#062a2a→#0c3b3b), aksan #2dd4bf.
```

## Kaydet & Yayınla modeli (canlı ekran koruması)
Editör TASLAK (`zones`) üzerinde çalışır; perde YAYIN'ı (`live` anlık görüntüsü)
oynatır. "👁 Önizle" = `/videowall/{id}/play?draft=1` (taslak, rozetli); "💾 Kaydet
& Yayınla" = `publishVideowall` → `live{zones,cols,rows,width,height,publishedAt}`.
Eski duvarda `live` yoksa perde taslağa düşer. Create/duplicate `live`'ı da yazar
(link ilk andan çalışır). Birleştir/böl İÇERİK KORUR (en büyük içerikli alan
devralır / sol-üst hücrede kalır) + içerik etkileniyorsa confirm sorusu.

## Marka rengi (turkuaz → indigo → AYDINLIK kokpit, kullanıcı kararı)
Önce turkuaz (#2dd4bf) kaldırılıp indigo ailesine geçildi (zemin #0d102f, panel
#1e1b4b/#312e81, aksan #6366f1). 2026-08'de KOKPİT AYDINLIĞA alındı: diğer üç
ürün beyazken Sign tek başına mor kalıyordu (kullanıcı: "her yer beyazken sign
çok mor kaldı"). Artık liste/editör/panel suite'in ortak dilini kullanır
(`bg-wash` · `card` · `input-base` · `chip` · ink/paper/line/muted + accent
#4f46e5; hata = brand gül). KOYU KALAN yerler bilinçli: PERDE (yayın) ve
editördeki yerleşim tuvali + kart minyatürü — oralar ekranın kendi içeriğidir,
UI değil. Aynı değişiklik `flowsign-selfhost/` paketinde birebir yapıldı
(oraya ortak sınıflar globals.css + tailwind paletiyle taşındı; başlık logosu
beyaz sürümden renkli `logo-o-sign.png` + "SIGN" yazısına döndü).

## Güvenlik/dayanıklılık (inceleme ajanı bulguları — uygulandı)
- URL öğesi: yalnız http(s) kabul (editör) + perde `safeSrc` filtresi + iframe
  `sandbox="allow-scripts allow-same-origin allow-forms"` + no-referrer
  (javascript: XSS ve üst-pencere yönlendirme kapatıldı).
- Saat penceresi gece yarısını aşabilir (22:00–06:00 → wrap-around).
- Rename SLUG'I DA DEĞİŞTİRİR (kullanıcı kararı 2026-07: link ekran adını
  izler); eski sluglar `slugHistory`de tutulur → /flowsign/[slug] zinciri
  güncel slug → eski slug → id (7/24 ekran linki YİNE kararmaz).
- Ekran sayısı ekseni başına 24 ile sınırlı (1MB doküman/tarayıcı koruması).
- Saat penceresi öğe düşürünce akış başa sarmaz (gösterilen öğe korunur).

## Müşteri-hazırlık turu (kullanılabilirlik + UI ajan denetimleri — uygulandı)
- Terminoloji: FlowSign varlığı artık **"ekran"** (FlowWall "duvar" ile karışmaz).
- Landing'e "Giriş yap" (blocker: ürüne giden yol yoktu); footer ürün linkleri.
- Preset düzeltildi: 3 dikey TV yan yana = **3240×1920**; eksen etiketleri
  "Yan yana / Üst üste kaç ekran?". Liste "Yayınla" → "Ekranı aç" (fiil çakışması).
- "↩ Yayındaki hâle dön" (taslağı live'dan geri sarma — tek geri-alma yolu).
- Taslak yazım hataları görünür (banner); yayın sonrası toast + "Son yayın: …".
- Yükleme: boyut ön-kontrolü (görsel ~10MB / video ~100MB) + dosya bazlı hata
  listesi; ⇄ Değiştir (yerinde, sıra/takvim korur); ▲▼ dokunmatik sıralama.
- Kütüphane taslak+yayından beslenir (ızgara sıfırlansa da medya erişilebilir).
- URL ekleme inline form (prompt kalktı) + iframe-engelleme notu; merge/split/
  grid-reset onayları markalı ConfirmDialog (native confirm kalktı).
- "Takvim dışı" rozeti + alan-boş uyarısı; video "Maks süre" (döngü kilidi yok).
- Çoklu-ekran kurulum notu (Surround/Eyefinity) rehber + link kartında.
- Rehber ❓ ile her zaman açılır; çözünürlük editörde düzenlenebilir.
- UI: turkuaz yerine sistem accent (#4f46e5 bg-accent); hatalar rose ailesi;
  işlevsel glifler inline SVG (icons.tsx); [color-scheme:dark]; odak reçetesi;
  44px dokunma hedefleri; mobil başlık sarması; kontrast tabanı white/50.
- Kalan (bilinçli park): ekran sağlık heartbeat'i, ses aç/kapa, 90° döndürme,
  alan-seviyesi takvim varsayılanı, ~~FlowSign özel O-glif PNG~~ → YAPILDI: logo-flowsign(.png/-white.png), 2×2 video-wall ızgaralı monitör glifi.

## Yetki modeli (2026-08) — "ekranı hazırla, ilgilisine teslim et"

FlowSign'ın satılabilirliğinin şartı: bir ekranı kurup **başkasına verebilmek**
("İK'ya bir ekran hazırla → al bu senin olsun, bundan sonra sen yönet").
İki rol var, izleyici rolü YOK (yayın linki zaten public):

| Yetki | Düzenle & yayınla | Sil | Devret | Yetki dağıt |
|---|---|---|---|---|
| **Sahip** | ✅ | ✅ | ✅ | ✅ |
| **Yetkili** | ✅ | ❌ | ❌ | ❌ |

**Devir yayın linkini/slug'ı DEĞİŞTİRMEZ** — sahadaki 7/24 ekranlar el
değiştirmeden etkilenmez. Eski sahip isteğe bağlı olarak "yetkili" kalır.

### Online (Firestore) — kimlik E-POSTA ile taşınır
`videowalls/{id}`: `ownerEmail` (sahip) + `editorEmails[]` (yetkililer).
Neden uid değil: devrederken karşı tarafın uid'si bilinmiyor ve kullanıcı
dizinini okumak yalnız yöneticiye açık (`users` rules). Kimlik belirteci
e-postayı taşıdığından rules `request.auth.token.email` ile doğrudan doğrular —
davet edilen kişi **hiç giriş yapmamış olsa bile** yetki verilebilir.
Devirde `ownerId` boşaltılır; yeni sahip ekranı ilk açtığında
`claimSignOwnership` uid'yi sessizce doldurur. Rules'ta yetkili yazımı
`ownerId/ownerEmail/editorEmails` ÜÇÜNÜ DE değişmemiş olmaya zorlar (yetki
yükseltme yolu kapalı). `/api/wall/destroy` (Cloudinary temizliği) sunucu
tarafında AYNI kapıyı tekrarlar.
Arayüz: liste üç grup (sahibi olduklarım · bana yetki verilenler · diğerleri),
editörde **AccessCard** ("Kimler yönetebilir": sahip, yetkililer, e-posta ile
ekle, devret).

### Self-host — gerçek KULLANICI DEFTERİ
Tek ortak parola kalktı: `data/users.json` (scrypt + tuz), roller
**yönetici / kullanıcı**. Oturum çerezi `userId.HMAC(gizli, id+parolaÖzeti)` —
parola değişince o kullanıcının oturumları düşer; gizli anahtar
`data/session-secret`. Yetki kararları SUNUCUDA (`serverAuth.ts`:
`isOwner/isEditor/canEdit`) — her yazma ucu (`PATCH/DELETE/publish/rename/
duplicate/upload/beat-sil`) kontrol eder; `patchWall` `ownerId/editorIds`
alanlarını serbest patch'ten ayıklar (yetkili kendini sahip yapamaz).
`/api/walls/[id]/access` → ekle/çıkar/devret (yalnız sahip). Kullanıcı silinince
ekranları yöneticiye devrolur (`purgeUserFromWalls`). Yeni sayfa: `/users`.
İlk açılışta `.env` parolasıyla `yonetici` hesabı kurulur (eski kurulumlar
sorunsuz geçer).

Uçtan uca doğrulandı (yerel sunucu + curl): yetkisiz PATCH/DELETE 403 · devir
sonrası aynı kişi 200 · yetkili sil/devret/yetki-dağıt 403 · rol yükseltme ve
`PATCH` ile sahiplenme reddedildi · oturumsuz uçlar 401 ama perde 200 ·
parola değişince eski çerez 401.
