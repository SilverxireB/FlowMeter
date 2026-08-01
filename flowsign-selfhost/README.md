# FlowSign — Yerel Sunucu (Self-Host) Sürümü

Video-wall / dijital tabela sistemi. **Tamamen yerel çalışır:** internet,
Firebase, Cloudinary veya başka hiçbir dış servis GEREKMEZ. Veriler diskte
JSON dosyası, medya diskte dosya olarak durur; ekranlar iç ağdaki sunucuya
bağlanır ve içerik anında güncellenir.

## Ne yapar?

- **Kokpit** (`/screens`): ekran tanımla (çözünürlük + kaç TV yan yana/üst üste),
  alanlara böl/birleştir, içerik yükle (görsel/video), URL/metin/saat ekle,
  öğe başına süre + saat aralığı + gün + tarih aralığı takvimi.
- **Taslak → Yayın**: değişiklikler önce taslakta; "Kaydet & Yayınla" ile
  ekranlara gider. "Önizle" taslağı gösterir, canlı ekran bozulmaz.
- **Perde** (`/play/<ekran-adı>`): tabela cihazında Chrome ile açılır, tam
  ekran 7/24 oynar. Ekran uyumaz (Wake Lock), gece ~04:00 kendini tazeler,
  bozuk öğeyi atlar, donmaya karşı bekçilidir. Giriş İSTEMEZ.
- **Ekran sağlığı**: hangi cihazın çevrimiçi olduğu kokpitte görünür.
- **Sunum modu**: bir ekranı kumandayla ilerleyen sunum ekranına çevirir.

## Gereksinimler

- **Node.js 18.17+** (20 LTS önerilir)
- Herhangi bir Linux/Windows sunucu (fabrika içi bir PC de olur)
- Veritabanı **GEREKMEZ** (veriler `data/` klasöründe dosya olarak tutulur)

## Kurulum

```bash
# 1) Bağımlılıklar (bu adım internet ister — internetli bir makinede yapılabilir)
npm install

# 2) Ortam dosyası
cp .env.example .env
#    .env içinde SIGN_ADMIN_PASSWORD'ü GÜÇLÜ bir parolayla değiştir.

# 3) Derle
npm run build

# 4) Çalıştır (varsayılan port 3090)
npm run start
```

Tarayıcıdan `http://SUNUCU-IP:3090` aç → yönetici parolasıyla gir → ilk ekranı
oluştur. Tabela cihazında `http://SUNUCU-IP:3090/play/<ekran-adı>` linkini aç
(kokpitte "Yayın linki" kartında hazır, QR'ı da var).

### İnternetsiz (kapalı ağ) sunucuya taşıma

`npm install` ve `npm run build` internetli bir makinede yapılır; sonra
`.next/standalone` klasörü kopyalanır:

```bash
npm run build
# .next/standalone içine statik dosyaları ve public'i koy:
cp -r .next/static .next/standalone/.next/static
cp -r public .next/standalone/public
# .next/standalone klasörünü USB ile sunucuya taşı, üzerinde:
SIGN_ADMIN_PASSWORD=parola PORT=3090 node server.js
```

`SIGN_DATA_DIR` ile veri klasörünü istediğin yere alabilirsin
(ör. `SIGN_DATA_DIR=/var/lib/flowsign/data`).

### Servis olarak çalıştırma (systemd örneği)

```ini
# /etc/systemd/system/flowsign.service
[Unit]
Description=FlowSign
After=network.target

[Service]
WorkingDirectory=/opt/flowsign
Environment=SIGN_ADMIN_PASSWORD=guclu-parola
Environment=SIGN_DATA_DIR=/var/lib/flowsign/data
Environment=PORT=3090
ExecStart=/usr/bin/node server.js
Restart=always

[Install]
WantedBy=multi-user.target
```

> **ÖNEMLİ:** Uygulama **tek kopya (tek süreç)** çalıştırılır. PM2 "cluster"
> modu veya birden çok kopya KULLANILMAZ — canlı güncelleme (SSE) ve dosya
> yazımları tek süreç varsayar.

## Veri & yedekleme

| Ne | Nerede |
|---|---|
| Ekran tanımları | `data/walls/*.json` |
| Ekran sağlığı kayıtları | `data/screens/*.json` |
| Yüklenen medya | `data/media/<ekran-id>/...` |

**Yedek almak = `data/` klasörünü kopyalamak.** Geri yükleme = klasörü geri
koymak (uygulama kapalıyken). Veritabanı kurulumu/migrasyonu yoktur.

## Medya kuralları (önemli)

- **Video:** MP4 (H.264 + AAC) yükleyin. Sunucu dönüştürme YAPMAZ; tarayıcının
  oynatamadığı biçim (ör. bazı .mov/.mkv) ekranda boş kalır.
- **Görsel:** JPG/PNG/WebP. Alanın "hedef çözünürlüğü" editörde yazar —
  görseli o boyutta hazırlayın; içerik alana tam yayılır (stretch).
- Dosya adları otomatik güvenli hale getirilir: boşluk ve Türkçe karakterler
  alt çizgiye çevrilir ("Yaz Kampanyası.PNG" → `..._yaz_kampanyasi.png`).
  Aynı adla ikinci yükleme öncekini EZMEZ (benzersiz ön ek eklenir).
- Sınırlar: görsel ~25 MB, video ~500 MB.
- URL öğesi iç ağ adreslerini de gösterir (`http://192.168...` gibi) —
  internetsiz ortamda da çalışır. Bazı siteler iframe'e gömülmeyi yasaklar;
  editör eklerken uyarır.

## Güvenlik modeli

- Kokpit + yazma uçları: `.env`'deki **tek yönetici parolası** (çerez oturumu,
  30 gün). Parola değişince tüm oturumlar düşer.
- Perde (`/play/...`) ve medya dosyaları: **giriş istemez** (tabela cihazı
  oturum açamaz). Bu sistem fabrika/kurum İÇ AĞI için tasarlandı — sunucuyu
  internete açacaksanız önüne reverse proxy + HTTPS koyun.

## Tabela cihazı kurulumu (öneri)

- Chrome/Chromium, kiosk modda:
  `chrome --kiosk --autoplay-policy=no-user-gesture-required http://SUNUCU-IP:3090/play/<ekran-adı>`
- Cihazın uyku/ekran koruyucusunu kapatın (uygulama da Wake Lock ister).
- Birden çok TV tek duvar olacaksa: ekran kartında TV'leri **tek birleşik
  görüntü** yapın (NVIDIA Surround / AMD Eyefinity / video-wall denetleyici);
  perdede ⊞ "Ekranları tanı" ile sırayı doğrulayın.
- Ağ kısa süre koparsa perde son içeriği oynatmaya devam eder ve bağlantı
  gelince kendiliğinden tazelenir. (Medya diskten değil sunucudan akar —
  sunucu kapalıyken YENİ açılan perde içerik gösteremez; sunucuyu 7/24 tutun.)

## Sık sorulanlar

- **Ekran "bulunamadı" diyor:** Linkteki ad, ekranın güncel yayın adı mı?
  Ad değişse bile ESKİ link çalışır; ama elle yanlış yazılmışsa bulunamaz.
  Kokpitteki "Yayın linki" kartından kopyalayın.
- **Video oynamıyor:** Biçim MP4/H.264 mü? Değilse dönüştürüp yeniden yükleyin.
- **İçerik güncellenmiyor:** "Kaydet & Yayınla"ya basıldı mı? Editör taslağı
  canlıya otomatik göndermez (bilerek).
- **Parolayı unuttum:** Sunucuda `.env` içindeki `SIGN_ADMIN_PASSWORD`'ü
  değiştirip servisi yeniden başlatın.
