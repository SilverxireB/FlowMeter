# Kantin — iç kullanım sipariş uygulaması

> **Flow Studio'ya ait DEĞİL.** Kenarda duran, tek hamlede kaldırılabilen bir
> uygulama. Studio koduna dokunmaz, Studio da buna bağ kurmaz; hub'da,
> landing'de, hiçbir yerde linki yoktur. Adres: `/kantin`.

## Ne işe yarıyor

Fabrikada mola **10 dakika** ve kantin uzakta. Sıra beklemek molanın yarısını
yiyor. Bu uygulama şunu yapar: kişi telefondan siparişini verir, işine devam
eder, "hazır" bildirimi gelince gidip alır. **Ödeme yok** — para bu modelde hiç
geçmez, fiyat sadece bilgidir, ödeme tezgâhta yapılır.

## Kaldırma (tek hamle)

1. `src/app/kantin/` klasörünü sil
2. `src/lib/kantin/` klasörünü sil
3. `src/components/kantin/` klasörünü sil
4. `firestore.rules` içindeki **KANTİN** bloğunu sil
5. `src/app/api/wall/destroy/route.ts` içindeki `kantinMode` dallarını sil

Studio'nun tek satırı etkilenmez. (Tersi de doğru: Studio kodunda `kantin`
geçen tek bir satır yok.)

## Roller

| Rol | Ne görür |
|---|---|
| **yönetici** | her şey + Kişiler (rol atama, geçici yasak) + kantin açma/silme |
| **kantinci** | YALNIZ kendi kantini: Tezgâh, Pano, Rapor, Ayarlar |
| **personel** | Menü + kendi siparişi |

Bootstrap yönetici e-posta ile tanımlı (kurallarda ve `api.ts`'te aynı adres).
Rol ve yasak yalnız yöneticide — kurallar da öyle diyor, kişi kendi rolünü
yükseltemez.

## Mimarî kararlar (ve sebepleri)

**AYRI Firebase örneği** (`lib/kantin/firebase.ts`, app adı `kantin`).
Kantin e-posta+şifre ile girer, Studio Google ile. Aynı `auth` paylaşılsaydı
kantine giren kişi Studio'da da "giriş yapmış" sayılırdı. Kalıcı önbellek
bilerek kapalı: aynı projede iki kalıcı önbellek çakışır, kantin zaten bina
içinde ve çevrimiçi.

**E-posta havuzu proje geneli.** Studio'ya Google ile girmiş bir e-posta
kantinde "zaten kayıtlı" der ama şifresi yoktur → giriş ekranındaki
"Şifremi unuttum" o hesaba şifre EKLER. Kayıt akışından geçmediği için ad/sicil
de yoktur → `ProfilTamamla` ekranı bunu tek adımda toplar.

**Sipariş kimliği deterministik: `{uid}_{yyyy-mm-dd}_{1..5}`.** Tek kural üç iş
yapar: sahibi kimlikten belli, çift dokunuş ikinci kayıt açamıyor, kişi başı
**günlük tavan** (5) sunucuda uygulanıyor. İstemci kilidi yarışı kaybedebilir,
belge kimliği kaybetmez.

**Kuyruk sayacı ayrı belgede** (`kantin/{id}/gunler/{yyyy-mm-dd}` → `toplam`,
`acik`). Menü ekranı eskiden bekleme tahmini için günün TÜM siparişlerini
dinliyordu: herkes herkesin adını, sicilini ve ne yediğini okuyabiliyordu; üstüne
her durum değişimi her açık telefona bir okuma faturalıyordu. Artık tek belge.
Siparişleri yalnız **sahibi ve görevli** okur.

**Stok otoritesi tezgâhta.** "Bugünlük bitti" işaretini (`tukendiGun`), günün
siparişlerini zaten okuyan tezgâh ekranı menü ürününe yazar. Herkesin
yazabildiği bir satış sayacı, tek satırla menüyü kilitleyen bir saldırı yüzeyi
olurdu. İşaret yalnız o gün geçerlidir — ertesi sabah kendiliğinden kalkar.

**Gece yarısı.** Fabrika vardiyalı; tezgâh tableti sabahtan beri açık kalır.
`izleBugunSiparisleri` / `izleBugunOzet` gün değişince aboneliği yeniler.
Yenilenmeseydi 00:00'dan sonraki siparişler o ekranda **hiç** görünmezdi ve
ekran hata da vermezdi. (Aynı ders FlowPulse `watchToday`de alınmıştı.)

**Bekleme tahmini iyimser değil** (`beklemeDk`): hâlihazırda hazırlananlar da
kuyruğa sayılır. Tutmayan süre bu ürünü ilk günde bitirir.

## Uyarı ("hazır" anı)

Sunucu push'u **bilerek yok**: gerçek web push iki şey ister — Console'dan
alınan VAPID anahtarı ve mesajı gönderen sunucu kimliği. İkisi de yokken yazılan
push kodu hiç denenemez, denenmemiş bildirim yolu ise güven vermez. Bunun yerine
molanın gerçekten kapsadığı 5-10 dakikada **çalışan** yol kuruldu
(`lib/kantin/bildirim.ts`):

1. Açık sipariş varken **ekran uyanık tutulur** (Wake Lock) → sayfa
   dondurulmadığı için canlı dinleyici ayakta kalır,
2. **Sistem bildirimi** (Notification API) — başka sekmedeyken de görünür,
3. **Ses + titreşim** — cepteyken hissedilir,
4. Hazır sipariş alınmazsa 3 dakikada bir, en fazla 3 kez hatırlatılır.

Uyarı **kabuk düzeyinde** (`lib/kantin/oturum.tsx`): kişi Menü sekmesine
geçince susmaz. Her sayfada yeşil "Siparişin hazır" şeridi + alt çubukta rozet.

**Sunucu push'u eklenecekse** gereken iki şey: `NEXT_PUBLIC_FIREBASE_VAPID_KEY`
(Console → Project settings → Cloud Messaging → Web Push certificates) ve
mesajı gönderecek servis hesabı (Vercel ortam değişkeni). O gün geldiğinde
token'lar `kantinUsers` kaydına yazılır, durum değişimi bir API rotasından
gönderilir.

## Ekranlar

- **`/kantin/giris`** — e-posta+şifre, kayıt, şifre belirleme. Üstte canlı sahne
  (`KantinHero`): sipariş → hazırlanıyor → hazır.
- **`/kantin/menu`** — fotoğraflı menü, kategori şeridi (1'den fazla kategori
  varsa), 10+ üründe arama, **"Yine aynısı"** tek dokunuşluk tekrar sipariş,
  altta sabit sepet + Gönder.
- **`/kantin/siparisim`** — üç adımlı ilerleme, geri sayım, bildirim izni,
  geçmiş.
- **`/kantin/tezgah`** — Yeni → Hazırlanıyor → Teslim bekliyor kolonları
  (masaüstünde yan yana), **hazırlanacaklar ürün bazında** şerit, stok şeridi
  (tek dokunuşla "bugünlük bitti"), bekleme süresi renkli (6 dk amber / 10 dk
  gül), 20 saniyelik **Geri al**, "Gelinmedi" onaylı, ses susturma.
- **`/kantin/pano`** — kantindeki TV. `?kantin=<id>` ile sabitlenebilir; ekran
  uyanık, yeni "hazır"da tek ton (ilk yüklemede çalmaz).
- **`/kantin/rapor`** — 1/7/30 gün, ürün dağılımı, saat grafiği, gelmeyenler +
  oradan yasak. İlke: **yaptırımdan önce ölçüm**.
- **`/kantin/ayarlar`** — kantin bilgisi, kapasite, hazırlık süresi, kişi başı
  limit, **çalışma saatleri**, menü (görsel/fiyat/kategori/stok), kantin aç/sil.
- **`/kantin/kisiler`** — rol atama, kantin ataması, geçici yasak.

## Kota bilinci

- Menü/sipariş ekranları: **tek özet belgesi** + kendi siparişleri (son 7 gün,
  en fazla 30 kayıt).
- Tezgâh/pano: günün siparişleri (tek alan filtresi `gun`, bileşik index yok).
- Rapor: **canlı dinleme yok**, tek seferlik aralık okuması.
- Ürün görselleri Cloudinary `kantin/{kantinId}` klasöründe; kantin silinince
  `/api/wall/destroy` `mode:"kantin"` ön ek temizliğini yapar.

## Kurulum

1. Firebase Console → Firestore → Rules: **KANTİN** bloğunu mevcut kuralların
   sonuna, kapanış süslülerinin ÜSTÜNE yapıştır.
2. Firebase Console → Authentication → Sign-in method → **E-posta/Şifre**'yi aç.
3. `/kantin` → yönetici e-postasıyla hesap aç → Ayarlar'dan kantinleri ve
   menüleri kur → Kişiler'den kantincileri ata.

## Sırada (yapılmadı)

- Sunucu push'u (yukarıdaki iki anahtar geldiğinde).
- Ön sipariş / mola saatine zamanlama (`hazirSaat`) — tepe saatleri düzleştirir.
- Satır bazlı not ve ürün seçenekleri ("şekersiz").
- İç ağ paketi (FlowSign self-host deseni).
