# Kurulum haritası — veri nerede durur?

> **Bu dosyayı ilk okuyun.** Tek bir sorunun cevabı: *"Ne kuracağım, veri nereye
> yazılacak?"* Ayrıntılı mimari `DEVIR-NOTU.md`'de; kullanım `README.md`'de.

---

## 1. En önemli cümle: VERİTABANI KURMAYACAKSINIZ

Bu paket **hiçbir veritabanına bağlanmaz.** Firestore yok, MongoDB yok, SQL
Server yok. Kurulum sırasında açmanız gereken **sıfır** veritabanı vardır.

> Bulut sürümü Firestore kullanır ve orada bir sürü koleksiyon görürsünüz —
> **onlara bakmayın.** Bu paket o katmanı komple değiştirdi: veri, sunucudaki
> **düz JSON dosyalarında** durur. Firestore'daki koleksiyonların bu paketteki
> karşılığı §5'teki tabloda birebir yazılıdır.

Kurulumda yapacağınız tek "veri" işi: **uygulamanın yazma izni olan bir klasör
göstermek.** Klasörü uygulama kendisi oluşturur, içini kendisi doldurur.

---

## 2. Gün 1 — beş adım

```bash
# 1) Kaynağı aç
tar -xzf flowsign-selfhost-*.tar.gz && cd flowsign-selfhost

# 2) Bağımlılıklar (bu adım internet ister; internetli makinede yapılıp
#    klasör olduğu gibi taşınabilir)
npm ci

# 3) Ortam dosyası — SIGN_ADMIN_PASSWORD'ü GÜÇLÜ bir parolayla değiştirin
cp .env.example .env

# 4) Derle
npm run build

# 5) Çalıştır (varsayılan 3090)
npm run start
```

Tarayıcıda `http://SUNUCU-IP:3090` → kullanıcı adı **`yonetici`**, parola
`.env` içindeki `SIGN_ADMIN_PASSWORD`. İlk giriş anında `data/users.json`
kendiliğinden oluşur.

**Bitti.** Kurulumun veri tarafı bu kadardır.

### Veri klasörünü nereye koymalı?

Varsayılan `./data` (uygulama klasörünün içi) çalışır ama **önerilmez** —
uygulamayı güncellerken karışır. Ayrı bir yol verin:

```bash
# .env içinde
SIGN_DATA_DIR=/var/lib/flowsign/data      # Linux
# SIGN_DATA_DIR=D:\FlowSign\data          # Windows
```

Tek şart: uygulamayı çalıştıran kullanıcının o klasörde **okuma + yazma** izni
olmalı. Klasörü elle oluşturmanız gerekmez, yoksa açılır.

> **Klasörü web sunucusunun kök dizinine koymayın** (`wwwroot`, `htdocs`…).
> Medya dosyalarını uygulama zaten kendi servis eder; klasör dışarıdan doğrudan
> erişilebilir olursa `users.json` da erişilebilir olur.

---

## 3. Veri klasörünün haritası

Uygulama çalışmaya başlayınca `SIGN_DATA_DIR` şu ağacı üretir:

```
data/                                 ← YEDEK ALINACAK TEK YER
├── users.json                        Kullanıcı defteri (parola özetleri: scrypt + tuz)
├── session-secret                    Oturum çerezi imza anahtarı (ilk açılışta üretilir)
├── settings.json                     Uygulama ayarları (/settings ekranından yazılır)
│
├── walls/                            EKRANLAR — her ekran tek dosya
│   ├── w-mfk3a1b2c.json              taslak + yayın + yetkiler + kütüphane kaydı
│   └── w-mfk9x7d4e.json
│
├── sahneler/                         FOTO SAHNELER — her sahne tek dosya
│   └── s-mfk5p2q8r.json              mod/efekt/zemin + fotoğraf listesi + düzenleyenler
│
├── screens/                          CİHAZ NABZI — "bu TV açık mı?"
│   └── w-mfk3a1b2c.json              son görülme, toplam yayın süresi (2 dk'da bir yazılır)
│
└── media/                            YÜKLENEN DOSYALAR (görsel/video)
    ├── w-mfk3a1b2c/                  → o EKRANA yüklenenler
    │   ├── uretim-hatti.jpg
    │   └── tanitim-filmi.mp4
    ├── sahne/
    │   └── s-mfk5p2q8r/              → o SAHNEYE yüklenen fotoğraflar
    │       └── kutlama.jpg
    └── ortak/                         → ORTAK RAF (tüm ekranların havuzu)
        └── firma-logosu.png
```

Kural sade: **her kayıt bir JSON dosyası, her yüklenen dosya kendi klasöründe.**
Ekran silinince `walls/{id}.json` + `media/{id}/` birlikte silinir; sahne
silinince `sahneler/{id}.json` + `media/sahne/{id}/` birlikte silinir. Arkada
yetim dosya kalmaz.

### Dosya adları

Yüklenen dosyanın adı **güvenli hâle getirilir**: boşluk ve Türkçe karakterler
alt çizgiye çevrilir (`Üretim Hattı.jpg` → `Uretim_Hatti.jpg`). Bu kozmetik
değil — bazı TV tarayıcıları bozuk URL'de dosyayı hiç açmıyor. Aynı ada sahip
ikinci dosya üzerine yazmaz, sonuna sayı eklenir.

### Kimlikler

`w-…` ekran, `s-…` sahne. Uygulama üretir, dosya adı olur. Yalnız harf, rakam ve
tire kabul edilir (dizin dışına çıkma saldırısına karşı sunucuda doğrulanır) —
elle dosya oluşturacaksanız aynı kalıba uyun.

---

## 4. Yedekleme, taşıma, geri yükleme

**Yedek = `data` klasörünü kopyalamak.** Başka hiçbir yerde veri yoktur.

```bash
# Gecelik yedek örneği (servisi durdurmaya gerek yok — yazmalar atomiktir)
tar -czf /yedek/flowsign-$(date +%F).tar.gz -C /var/lib/flowsign data

# Geri yükleme: servisi durdur, klasörü yerine aç, servisi başlat
```

Başka sunucuya taşımak da aynı: klasörü kopyalayın, yeni sunucuda
`SIGN_DATA_DIR` ile gösterin. Ekranlar, yetkiler, medya, yayın linkleri —
hepsi olduğu gibi gelir.

**Disk:** JSON tarafı ihmal edilebilir (kırk ekran ≈ birkaç MB). Yer kaplayan
tek şey medyadır; kaba ölçü: her ekran için 1–2 GB ayırın, video kullanılacaksa
daha fazla. Yükleme sınırını **en az 200 MB** yapın, yoksa kullanıcı 4K videoyu
atamaz ve sebebini anlamaz.

---

## 5. Firestore ↔ bu paket ↔ (isterseniz) SQL

Bulut sürümündeki koleksiyonların karşılığı. **Ortadaki sütun bugün geçerli
olandır**; sağdaki sütun ancak SQL'e taşımaya karar verirseniz gerekir.

| Bulut (Firestore) | Bu pakette (bugün) | SQL'e taşırsanız |
|---|---|---|
| `videowalls/{id}` | `data/walls/{id}.json` | `Screens` tablosu (+ `ZonesJson`) |
| `videowalls/{id}.slugHistory` | aynı dosyanın içinde | `ScreenSlugHistory` |
| `videowalls/{id}.grants` | aynı dosyanın içinde | `ScreenGrants` |
| `videowalls/{id}/beats/{cihaz}` | `data/screens/{id}.json` | `ScreenBeats` |
| `sahneler/{id}` | `data/sahneler/{id}.json` | `Scenes` |
| `users/{uid}` | `data/users.json` | `Users` (ya da LDAP — §6) |
| Cloudinary (medya) | `data/media/…` | **değişmez, dosya olarak kalır** |

Yani en fazla **6 tablo** — "bir sürü veritabanı" değil. Tam `CREATE TABLE`
metinleri `DEVIR-NOTU.md` §4'te.

> **Karar tavsiyesi:** SQL'e taşımak **birinci fazın işi değildir.** Paket
> dosya deposuyla bugün çalışır; kırk ekranlık bir kurulumda performans sorunu
> çıkarmaz (her ekran tek dosya, ekran başına saatte birkaç okuma). SQL'i
> yalnız kurumsal yedekleme/raporlama politikanız zorunlu kılıyorsa yapın.
>
> **Medya dosyalarını veritabanına koymayın** — hiçbir sürümde koymadık.
> Video BLOB olarak tutulursa TV'de arama (seek) çalışmaz.

---

## 6. Kimlik: LDAP bağlamak (opsiyonel ama kolay)

Kullanıcıların kendi kurumsal parolalarıyla girmesi için veritabanı ya da kod
değişikliği gerekmez. `.env`'e tek satır:

```
DIS_KIMLIK_URL=http://ic-sunucu/api/flowsign-login
```

Bu adrese giriş denemesi `POST {"kullanici":"...","parola":"..."}` olarak gelir;
sizin uygulamanız LDAP'a sorar ve şunu döner:

```json
{ "ok": true, "ad": "Ahmet Yılmaz", "rol": "user" }
```

Gerisi kendiliğinden olur: hesap ilk girişte açılır, kişi **tüm ekranları
görüntüler** ama düzenleyemez; yetkiyi yönetici dağıtır. Dış servis cevap
vermezse yerel `yonetici` hesabı çalışmaya devam eder (kurtarma kapısı).
Ayrıntı ve tam sözleşme: `DEVIR-NOTU.md` §7.

---

## 7. Kurulum kontrol listesi

- [ ] Node.js 18+ kurulu
- [ ] `SIGN_DATA_DIR` ayrı bir yolda ve uygulamanın yazma izni var
- [ ] `.env` içindeki `SIGN_ADMIN_PASSWORD` değiştirildi
- [ ] Uygulama **tek instance** çalışıyor (PM2 **cluster** modu kullanılmıyor —
      dosya deposu tek süreç varsayar)
- [ ] Servis olarak tanımlandı ve sunucu açılışında başlıyor (systemd örneği
      README'de)
- [ ] `data` klasörü gecelik yedeğe eklendi
- [ ] TV'lerin tarayıcısı `http://SUNUCU-IP:3090/play/<ekran-adı>` adresine
      erişebiliyor (perde giriş istemez — tabela cihazı oturum açamaz)
- [ ] Yükleme boyutu sınırı ≥ 200 MB (önde reverse proxy varsa orada da)

---

## 8. Yapmayın

| Yapmayın | Neden |
|---|---|
| PM2 cluster / birden çok instance | Dosya deposu tek süreç varsayar; iki süreç aynı JSON'a yazarsa değişiklik kaybolur |
| `data` klasörünü web köküne koymak | `users.json` dışarıdan okunabilir hâle gelir |
| Medyayı veritabanına taşımak | Video seek çalışmaz, disk zaten daha ucuz |
| JSON dosyalarını çalışırken elle düzenlemek | Uygulama üstüne yazar; değişiklik `/settings` ve arayüzden yapılır |
| Perdeye (`/play/...`) giriş zorunluluğu koymak | Tabela cihazı oturum açamaz, ekran kararır |
