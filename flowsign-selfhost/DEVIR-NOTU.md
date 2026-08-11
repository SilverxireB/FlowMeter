# FlowSign — kurum içi sürüm için devir notu

> Bu belge, FlowSign'ı **.NET + React + SQL** yığınına taşıyacak yazılımcı için
> yazıldı. Depodaki `flowsign-selfhost/` klasörü çalışan bir referans uygulama:
> Firestore'suz, Cloudinary'siz, internetsiz çalışır. Aşağıdaki her madde o
> koda işaret eder.
>
> Kısa cevap: **arayüzü yeniden yazma, arkasını değiştir.** Neden, aşağıda.
>
> **Yalnız sunucuya kuracaksanız bu belge gerekmez** — veritabanı kurulmaz,
> veri diskte JSON'dur: [`KURULUM-HARITASI.md`](./KURULUM-HARITASI.md) yeter.

---

## 1. Ürün ne yapıyor

Bir **ekran** = duvara asılan bir yayın. Bir veya birden çok TV'yi kapsar.
Ekran **alanlara** bölünür; her alanda sırayla dönen **öğeler** vardır: görsel,
video, web sayfası (iframe), metin, canlı saat, ya da **başka bir ekran**.

İki hâl vardır ve ürünün tamamı bunun üzerine kurulu:

| Hâl | Nerede | Ne zaman değişir |
|---|---|---|
| **Taslak** (`zones`) | Editörde | Kullanıcı her dokunduğunda |
| **Yayın** (`live`) | TV'de | Yalnız "Kaydet & Yayınla" denince |

TV asla taslağı oynatmaz. Bu ayrım hem güvenlik hem itibar meselesi: yarım iş
fabrika duvarına düşmez.

**Gömülü ekran** özelliği de buradan doğar: bir alana başka bir ekran
bağlanır ve o ekranı **başkası yönetir**. Yetki sınırı ekranın sınırıdır —
delege edilen kişi ana ekrana dokunamaz. Alan bazlı yetki yerine bu tasarım
seçildi; çok daha basit ve çok daha az kırılgan.

---

## 2. En önemli tavsiye: oynatıcıyı yeniden yazmayın

`PlayerStage.tsx` (679 satır) küçük görünür, değildir. İçinde sahada
öğrenilmiş şunlar var:

- **Donma bekçisi** — ağ koparsa video buffer bitiminde donar; `ended` de
  `error` da gelmez. Alan sonsuza dek donuk karede kalırdı. `currentTime`
  ~12 sn ilerlemezse zorla sıradakine geçilir.
- **Video kaynağını bırakma** — element sökülürken `pause + removeAttribute +
  load`. Yapılmazsa 7/24 açık ekranda bellek şişer.
- **Geçiş zamanlaması** — eski katman, yeni katman görünene kadar durur; video
  ilk karesini beklediği için pencere daha uzun (`loadeddata` + 1.2 sn emniyet).
  Yoksa her geçişte siyah flaş olur.
- **Takvim tiki dakika sınırına hizalı** — "08:00'de başlar" gerçekten 08:00'de
  başlar, 08:00:37'de değil.
- **Saat penceresi öğe düşürünce akış başa sarmaz** — gösterilen öğe hâlâ
  listedeyse kaldığı yerden sürer.
- **Gece tazeleme, tek URL 15 dk yenileme, Wake Lock, oynatma hata sınırı.**
- **Gömülü ekran döngü koruması** — A→B→A tarayıcıyı kilitler.
- **Önden indirme disiplini** — küçük alanda sıradaki video tam indirilmez.

Bunların hepsi üretimde bir kez patladıktan sonra yazıldı. Sıfırdan yazarsanız
aynı sırayla yeniden yaşarsınız. **Öneri: `src/components/` ve `src/lib/zones.ts`
olduğu gibi alınsın.**

---

## 3. Mimarî: tek dikiş yeri

Bu paket zaten Firebase'den ayrıldı. Veri katmanı **tek dosyada** toplu:

```
src/lib/client.ts   ← 265 satır. TEK DEĞİŞTİRİLECEK DOSYA.
```

Bütün ekranlar yalnız bu dosyanın dışa açtığı işlevleri çağırır:

```
watchWall  watchWallByKey  watchScreens  listWalls  createWall  updateWall
updateZones  setPlayMode  renameWall  publishWall  resetGrid  setScreenGrid
saveLayout  duplicateWall  deleteWall  sendScreenBeat  deleteScreenBeat
getScreenId  whoAmI  listUsers  createUser  updateUser  deleteUser
setWallGrant  wallPerm
```

Bunların gövdesini kendi .NET uçlarınıza çeviren yazarsanız **arayüzün geri
kalanına hiç dokunmazsınız.**

### React iskeleti

Kod React + Tailwind. Next'e bağımlılık şu kadar:

| Ne | Kaç yerde | Karşılığı |
|---|---|---|
| `next/server` | 18 | Yalnız API rotalarında — zaten .NET'e taşınıyor, silinecek |
| `next/navigation` | 5 | `react-router` (`useParams`, `useNavigate`) |
| `next/link` | 3 | `<Link>` (react-router) |
| `next/image` | 3 | Düz `<img>` |
| `next/dynamic` | 2 | `React.lazy` |

Yani **14 bileşen + 6 sayfa**, toplam ~7000 satır React'in Next'e bağı 13
satır. Next.js'i olduğu gibi de kullanabilirsiniz (IIS arkasında Node ile),
ya da Vite + react-router'a alırsınız; ikisi de kısa iş.

---

## 4. Veritabanı (SQL)

Bugün JSON dosyalarında tutulan üç şey var. SQL karşılığı:

```sql
CREATE TABLE Screens (
  Id            NVARCHAR(40)  PRIMARY KEY,   -- uygulama üretir (kısa, url-güvenli)
  Name          NVARCHAR(200) NOT NULL,
  Slug          NVARCHAR(80)  NULL UNIQUE,   -- yayın linki: /play/{slug}
  Width         INT NOT NULL,                -- duvarın toplam piksel ölçüsü
  Height        INT NOT NULL,
  Cols          INT NOT NULL,                -- FİZİKSEL TV sayısı (çerçeve çizgisi)
  Rows          INT NOT NULL,
  LayoutCols    INT NULL,                    -- YERLEŞİM ızgarası (fizikselden bağımsız)
  LayoutRows    INT NULL,
  PlayMode      NVARCHAR(10) NOT NULL DEFAULT 'auto',  -- auto | manual
  ZonesJson     NVARCHAR(MAX) NOT NULL,      -- TASLAK
  LiveJson      NVARCHAR(MAX) NULL,          -- YAYIN (publish anında kopyalanır)
  OwnerId       NVARCHAR(100) NULL,
  CreatedAt     DATETIME2 NOT NULL,
  UpdatedAt     DATETIME2 NULL
);

CREATE TABLE ScreenSlugHistory (               -- ad değişince eski link ölmesin
  Slug     NVARCHAR(80) PRIMARY KEY,
  ScreenId NVARCHAR(40) NOT NULL REFERENCES Screens(Id) ON DELETE CASCADE
);

CREATE TABLE ScreenGrants (                    -- kişi × ekran yetki matrisi
  ScreenId  NVARCHAR(40)  NOT NULL REFERENCES Screens(Id) ON DELETE CASCADE,
  UserId    NVARCHAR(100) NOT NULL,            -- LDAP kimliği
  CanView   BIT NOT NULL DEFAULT 0,
  CanEdit   BIT NOT NULL DEFAULT 0,
  CanCopy   BIT NOT NULL DEFAULT 0,
  CanDelete BIT NOT NULL DEFAULT 0,
  PRIMARY KEY (ScreenId, UserId)
);

CREATE TABLE ScreenBeats (                     -- "bu TV açık" nabzı
  ScreenId   NVARCHAR(40)  NOT NULL REFERENCES Screens(Id) ON DELETE CASCADE,
  DeviceId   NVARCHAR(64)  NOT NULL,           -- cihazın localStorage kimliği
  UserAgent  NVARCHAR(200) NULL,
  ViewportW  INT NULL,
  ViewportH  INT NULL,
  StartedAt  DATETIME2 NULL,
  LastSeenAt DATETIME2 NOT NULL,
  TotalMs    BIGINT NOT NULL DEFAULT 0,        -- toplam yayın süresi
  PRIMARY KEY (ScreenId, DeviceId)
);
```

### `ZonesJson` neden JSON kalıyor

Alanlar ve öğeler **serbest biçimli bir ağaç**: bir ekranda 1 alan da olur 30
alan da, her alanda 0–50 öğe olur, öğe tipine göre alanlar değişir. Bunları
tabloya açmak (Zones, ZoneItems, ItemSchedules…) üç ek tablo, üç ek JOIN ve her
kaydetmede tam senkronizasyon demek — kazancı yok, çünkü **hiçbir zaman
öğe bazında sorgu atmıyoruz**. Ekran ya bütün olarak okunur ya bütün olarak
yazılır.

SQL Server 2016+ `JSON_VALUE` ile gerekirse içine bakabilirsiniz. Şema
`src/lib/types.ts` içinde tam olarak yazılı (`Zone`, `ZoneItem`). Ekran
kaydında ayrıca `medya[]` var (kütüphane: ekrana yüklenmiş dosyaların kalıcı
listesi) — o da aynı JSON'un içinde kalır, ayrı tablo istemez.

**2026-08 eki — foto sahne:** ekrandan AYRI, kendi linki olan fotoğraf
döngüsü kaydı (`data/sahneler/{id}.json`). SQL karşılığı tek tablo:

```sql
CREATE TABLE Scenes (
  Id            NVARCHAR(40)  PRIMARY KEY,
  Name          NVARCHAR(200) NOT NULL,
  OwnerId       NVARCHAR(100) NULL,
  SceneJson     NVARCHAR(MAX) NOT NULL,  -- mod/otomatik/efekt/zemin/duzenleyenler/fotolar (types.ts › FotoSahneKaydi)
  CreatedAt     DATETIME2 NOT NULL,
  UpdatedAt     DATETIME2 NULL
);
```

Ekrana "eklenmesi" yalnız bir URL öğesidir (`/sahne/{id}`); oynatıcı bu
adresi tanıyıp sahneyi iframe'siz, aynı ağaçta çizer (`sahneAdresi` +
`GomuluSahne`). Sahne içeriği değişince yayın beklenmez — sahne kendi SSE
kanalından canlı akar.

> **Uyarı:** `LiveJson`, `ZonesJson`'ın *anlık görüntüsüdür*, referansı değil.
> Publish = kopyala. Bu bilerek böyle; yayın, editördeki değişikliklerden
> etkilenmemeli.

---

## 5. API sözleşmesi

`client.ts` bugün bu uçları çağırıyor. Aynı sözleşmeyi .NET'te karşılarsanız
arayüz hiç değişmez.

| Metot | Uç | İş |
|---|---|---|
| GET | `/api/auth/me` | Oturumdaki kişi + rol (bkz. §7) |
| GET | `/api/walls` | Ekran listesi + nabız özeti + kullanıcılar |
| POST | `/api/walls` | Yeni ekran |
| GET | `/api/walls/{id}` | Tek ekran |
| PATCH | `/api/walls/{id}` | Taslak alanları / ızgara / mod güncelle |
| DELETE | `/api/walls/{id}` | Ekranı ve medyasını sil |
| POST | `/api/walls/{id}/publish` | Taslağı yayına kopyala |
| POST | `/api/walls/{id}/rename` | Ad + slug (+ eski slug'ı geçmişe yaz) |
| POST | `/api/walls/{id}/duplicate` | Kopyala |
| POST | `/api/walls/{id}/access` | Yetki matrisi güncelle |
| POST/DELETE | `/api/walls/{id}/beat` | Nabız yaz / bayat kaydı sil |
| GET | `/api/walls/{id}/events` | **SSE** — ekran değişince it (bkz. §8) |
| GET | `/api/resolve/{slug}/events` | Aynısı, slug ile (TV bunu açar) |
| GET/POST/PATCH/DELETE | `/api/users…` | Kişi defteri (LDAP'a bağlanınca sadeleşir) |
| POST | `/api/upload` | Dosya yükle (bkz. §6) |
| GET | `/api/embed-check` | Bir URL iframe'e izin veriyor mu (uyarı için) |
| GET/POST/PATCH/DELETE | `/api/sahne` | Foto sahne listele / aç / güncelle / sil |
| POST | `/api/sahne/upload` | Sahneye fotoğraf yükle (yalnız görsel) |
| GET | `/api/sahne/{id}/events` | **SSE** — sahne değişince it (oturumsuz; perde açar) |
| GET/POST/PUT/DELETE | `/api/ortak-raf` | Ortak medya rafı: listele / yükle / ekrandan kopyala / sil (silme yalnız yönetici) |

Gövde şekilleri `src/app/api/**/route.ts` dosyalarında birebir görünüyor —
kopyalarken oradan okuyun, tahmin etmeyin.

---

## 6. Dosya deposu (Cloudinary yok)

Bugünkü davranış, aynen korunmalı:

- Yükleme `POST /api/upload` → sunucuda `data/media/{ekranId}/` altına yazılır,
  geriye **`/media/{ekranId}/{dosya}` yolu** döner ve öğenin `src`'si bu olur.
- **Dosya adı güvenli hâle getirilir:** boşluk ve Türkçe karakterler alt
  çizgiye çevrilir. Bu kozmetik değil — aksi hâlde bazı TV tarayıcılarında
  URL bozuluyor.
- Ekran silinince o klasör komple silinir.
- Foto sahne fotoğrafları `data/media/sahne/{sahneId}/`, ortak raf
  `data/media/ortak/` altındadır — aynı kurallar: güvenli ad, sahne/raf
  silinince klasör temizliği.
- Servis ederken `Cache-Control` uzun verin; içerik değişince dosya adı da
  değişiyor (yeni yükleme = yeni ad), bu yüzden önbellek zehirlenmesi yok.

**.NET tarafında:** `wwwroot/media/…` altında statik servis en basiti. IIS
kullanıyorsanız video için **byte-range** desteğinin açık olduğundan emin olun
(`Accept-Ranges: bytes`) — yoksa uzun videolarda arama çalışmaz ve bazı
tarayıcılar oynatmayı hiç başlatmaz.

**Boyut:** yükleme sınırını en az 200 MB yapın; yoksa kullanıcı 4K bir videoyu
atamaz ve sebebini anlamaz.

---

## 7. Kimlik: LDAP / üst uygulamadan devralma

### Seçenek A — HAZIR KAPI (önerilen ilk adım, sıfır FlowSign kodu)

Pakette dış kimlik kapısı hazır: `.env`'e **`DIS_KIMLIK_URL`** yazılırsa giriş
ekranındaki kullanıcı adı + parola **sizin servisinize** sorulur. LDAP'a bu
paket hiç dokunmaz — LDAP'ı zaten bilen .NET uygulamanız tek küçük uç açar:

```
POST {DIS_KIMLIK_URL}
İstek : { "kullanici": "ahmet.yilmaz", "parola": "..." }
Cevap : { "ok": true, "ad": "Ahmet Yılmaz", "rol": "user" }   // rol: "admin" | "user" (isteğe bağlı)
        { "ok": false }                                        // ya da HTTP 401/403
```

Davranış (`src/app/api/auth/login/route.ts` + `users.ts › ensureDisKullanici`):

- `ok:true` → yerel hesap **otomatik açılır** (ilk girişte): rol dıştan
  `"admin"` denmedikçe `user`; **ekran ve sahne açma kapalı** doğar; yerel
  parolası yoktur (`dis:true`). Sonraki girişlerde yalnız görünen ad tazelenir.
- Kurum kararı: **giriş yapan herkes tüm ekranları GÖRÜNTÜLEYEREK doğar,
  başka yetkisi yoktur** — yönetici sonradan kişi × ekran tik verir
  (bkz. §9). Yönetici zaten her şeyi görür.
- `ok:false` ya da servise ulaşılamadı (4 sn zaman aşımı) → yerel
  `users.json` denenir. `.env`'li `yonetici` hesabı böylece **her koşulda
  girer** (LDAP servisi çökse bile kurtarma kapısı açık kalır).

Bu seçenekle giriş ekranı, oturum çerezi, yetki sayfası olduğu gibi kalır;
tek işiniz o POST ucunu yazmak.

### Seçenek B — tam devralma (SSO/çerez isterseniz)

Kişinin FlowSign'da parola YAZMASINI bile istemiyorsanız (oturum üst
uygulamadan devralınacaksa) kullanıcı defterini tümden atarsınız. Yerine:

1. Kişi zaten üst uygulamanızda giriş yapmış oluyor. FlowSign kendi giriş
   ekranını **göstermez**; oturumu üst uygulamadan devralır (paylaşılan çerez,
   ya da imzalı bir JWT, ya da Windows Authentication — sizde hangisi varsa).
2. `GET /api/auth/me` şunu döndürmeli:

```json
{
  "id": "ldap:cn=ahmet.yilmaz,ou=users,dc=firma,dc=local",
  "name": "Ahmet Yılmaz",
  "label": "Üretim Planlama",
  "role": "admin",        // admin | user
  "canCreate": true       // yeni ekran açabilir mi
}
```

3. `id` **kararlı** olmalı. LDAP'ta kişinin adı/departmanı değişebilir; yetki
   matrisi bu kimliğe bağlı. `objectGUID` veya `sAMAccountName` kullanın,
   DN kullanmayın (DN taşınınca değişir).
4. Rol eşlemesi: bir LDAP grubu (ör. `FlowSign-Admins`) → `role: "admin"`.
   Yönetici her ekranda tam yetkilidir.

**Değiştirilecek dosyalar:** `src/lib/useSession.ts`, `src/app/login/`,
`src/lib/users.ts`, `src/app/users/page.tsx`. Bunları serbestçe yeniden
yazabilirsiniz — ürünün geri kalanı kişiyi yalnız `whoAmI()` üstünden tanır.

---

## 8. Gerçek zamanlı

Ekran içeriği değişince TV'nin **yenilenmeden** güncellenmesi gerekiyor.
Bugün bu **SSE** ile: TV `/api/walls/{id}/events` bağlantısını açık tutar,
sunucu değişiklikte tek satır iter.

.NET'te üç seçenek, tercih sırasıyla:

1. **SSE** (`text/event-stream`) — en yakın karşılık, en az iş. Reverse proxy
   kullanıyorsanız **tampon kapatılmalı** (`X-Accel-Buffering: no` benzeri),
   yoksa mesajlar birikir.
2. **SignalR** — zaten kullanıyorsanız doğal seçim.
3. **Yoklama (polling)** — 10–15 sn'de bir `GET /api/walls/{id}`. Son çare ama
   çalışır; içerik saatte bir değişen bir üründe kabul edilebilir.

Hangisini seçerseniz seçin `watchWall` sözleşmesi aynı kalır: bir geri çağırma,
her değişiklikte tam ekran nesnesi.

> **Bağlantı koparsa TV son hâlini oynatmaya devam etmeli.** Bu, ürünün
> en kritik davranışı — fabrikada ağ kesintisi olur, ekran kararmaz.

---

## 9. Yetkiler

Model kişi × ekran, dört tik: **görüntüle / düzenle / kopyala / sil**.

Kurallar:
- Açık kayıt yoksa **oluşturan** kişi tam yetkilidir; **diğer herkes yalnız
  GÖRÜNTÜLER** (kurum kararı: giriş yapan herkes tüm ekranları görerek doğar,
  dokunamaz).
- Açık kayıt varsa varsayılanı **ezer** — yönetici kişi × ekran bazında
  görüntülemeyi de kesebilir (ayrılan personel).
- Yönetici her ekranda tam yetkilidir.
- **Kararlar SUNUCUDA verilir** (`src/lib/serverAuth.ts › permOf`). İstemci
  yalnız düğmeleri gizler. Bunu böyle bırakın; aksi hâlde adres çubuğuna id
  yazan herkes düzenler.
- `canCreate` kişi bazlı: yeni ekran açma hakkı kapatılabilir.
  `canCreateSahne` aynı şeyin foto sahne ikizi. Dış kimlikle (LDAP) açılan
  hesaplarda ikisi de **kapalı** doğar.
- Foto sahnede ekran matrisi yok; sahne kaydındaki `duzenleyenler` listesi
  (giriş adları) kimin besleyebileceğini söyler, yönetici Kullanıcılar
  sayfasından işaretler. Sahibi + yönetici her zaman düzenler.

Yetki sayfasını (`src/app/users/page.tsx`) baştan yazabilirsiniz — LDAP'tan
kişi arama gelince zaten değişmesi gerekir.

---

## 10. Dokunmayın listesi

Şunlar üründe **bilerek** öyle; değiştirmeden önce sorun:

- **Yayın linki giriş istemez.** TV giriş yapamaz. Gizlilik gereken içerik
  ekrana konmaz — çözüm kimlik doğrulama değil, içerik seçimi.
- **İçerik alana gerilir** (`object-fit: fill`), kırpılmaz. Kullanıcı alana
  uygun ölçüde içerik hazırlar; alan paneli gerçek piksel ölçüsünü yazar.
- **Alan koordinatları 0–1 oranlıdır**, piksel değil. Duvar çözünürlüğü
  değişince yerleşim bozulmaz.
- **`cols/rows` fiziksel TV, `layoutCols/layoutRows` yerleşim.** İkisi ayrı;
  kesik çizgiler yalnız fizikselden çizilir (gerçek çerçeve nerede onu söyler).
  Bir kez birleştirilmişti ve alanlar kendiliğinden kayıyordu.
- **Gömülü ekran yalnız `live` çizer**, taslağa düşmez.
- **Nabız ve Wake Lock yalnız en dıştaki oynatıcıda** çalışır.

---

## 11. Ne kadar iş

Tek yazılımcı, **arayüz yeniden kullanılırsa**:

| İş | Süre |
|---|---|
| SQL şeması + EF migration | 0.5 gün |
| 16 uç: CRUD + doğrulama + hata sözleşmesi | 3–4 gün |
| Dosya yükleme/servis, güvenli ad, silme, byte-range | 1 gün |
| SSE (ya da SignalR) | 1 gün |
| LDAP / üst uygulamadan oturum devri | 1–2 gün |
| Yetki kararları (sunucu tarafı) + yetki sayfası | 1.5 gün |
| `client.ts`'in .NET uçlarına bağlanması | 1–2 gün |
| Next → kendi React iskeleti (isterseniz) | +2–3 gün |
| Kurulum, IIS/servis, saha testi | 1–2 gün |
| **Toplam** | **10–14 iş günü** (Next kalırsa 8–11) |

**Arayüz sıfırdan yazılırsa** buna en az **3–4 hafta** eklenir ve §2'deki
oynatma hatalarını yeniden yaşarsınız. Tavsiye edilmez.

### Süreyi değiştirenler

- Üst uygulamada zaten paylaşılabilir bir oturum varsa LDAP kalemi **0.5 güne**
  düşer; sıfırdan LDAP bağlanacaksa 3 güne çıkabilir.
- SignalR altyapınız varsa gerçek zamanlı kalemi yarıya iner.
- Yoklamayla başlayıp sonra SSE'ye geçmek meşru bir kısayoldur (sözleşme aynı).

---

## 12. Kabul kriterleri

Teslimde bunlar çalışıyorsa iş bitmiştir:

1. Ekran oluştur → alan böl → görsel, video, URL, metin, saat ekle → yayınla.
2. TV'de yayın linki açık; **editörde yayınlamadan** yapılan değişiklik TV'ye
   **gitmiyor**; yayınlayınca birkaç saniyede gidiyor.
3. Ağ kablosu çekilince TV son hâlini oynatmaya devam ediyor; takılınca geri
   geliyor.
4. 48 saat kesintisiz açık bir TV'de bellek büyümüyor, video duraksamıyor.
5. Saat aralığı / gün / tarih verilen bir öğe tam o pencerede giriyor ve
   çıkıyor.
6. Yetkisiz kişi başkasının ekranını **adres çubuğuna id yazarak da**
   düzenleyemiyor.
7. Bir alana başka bir ekran bağlanıyor; o ekranı ikinci bir kullanıcı
   yönetebiliyor ve ana ekrana dokunamıyor.
8. Ekranlar kartı: hangi TV çevrimiçi, ne kadardır yayında.

---

## 13. Nereden başlanır

1. `flowsign-selfhost/` klasörünü çalıştırın (`npm install && npm run dev`).
   Ürünü **önce kullanın** — bir ekran kurun, bölün, yayınlayın, ikinci bir
   sekmede TV'yi açın. Neyi taşıyacağınızı böyle anlarsınız.
2. `src/lib/types.ts` — 122 satır, veri modelinin tamamı.
3. `src/lib/client.ts` — 265 satır, değiştireceğiniz tek dosya.
4. `src/app/api/**/route.ts` — karşılayacağınız uçların gövdeleri.
5. `src/lib/zones.ts` — yerleşim geometrisi (bölme/birleştirme/kenar çekme).
   **Buna dokunmayın**, olduğu gibi taşıyın; `tests/sign-layout.test.mjs`
   içinde 17 sınavı var.
