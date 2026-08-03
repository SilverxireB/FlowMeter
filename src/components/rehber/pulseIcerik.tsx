"use client";

/**
 * FlowPulse kullanım rehberi — İÇERİK.
 *
 * Pulse'ın anlatılması gereken tek zor yeri SKOR: dört soru tipi de aynı
 * 0–100 ölçeğine indirgeniyor ve renk eşikleri (yeşil ≥70 / amber ≥40) tasarım
 * sisteminden geliyor. Rehberdeki renk örnekleri de o eşikleri kullanır.
 */
import { RehberBolum } from "@/components/Rehber";
import { Adimlar, Baslik, Dugme, Kutu, Tablo } from "@/components/RehberParcalari";

function SkorRozeti({ renk, children }: { renk: "yesil" | "amber" | "gul"; children: React.ReactNode }) {
  const cls =
    renk === "yesil"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : renk === "amber"
        ? "bg-[#eda100]/10 text-[#8a6100] border-[#eda100]/30"
        : "bg-brand-soft text-brand border-brand/25";
  return <span className={`inline-block rounded-lg border px-2 py-0.5 text-[13px] font-bold ${cls}`}>{children}</span>;
}

export const PULSE_REHBER: RehberBolum[] = [
  {
    id: "baslarken",
    kicker: "Başlarken",
    baslik: "Nokta, soru, üç kanal",
    icerik: (
      <>
        <p>
          Bir <b>nokta</b> = bir yer + bir soru. “Yemekhane çıkışı → Bugünkü yemek nasıldı?” gibi. Soru tek ve sabittir;
          gücü de bundan gelir — aynı soruyu her gün sorduğun için trend okunur.
        </p>
        <Tablo
          basliklar={["Kanal", "Cihaz", "Ne için"]}
          satirlar={[
            ["Oy linki", "Kişinin telefonu", "Postere kare kod bas; geçerken okutup oy verir."],
            ["Kiosk", "Duvardaki tablet", "Tek iş yapan ekran: soru + yüzler. Girişsiz açılır."],
            ["Pano", "Ekran / TV", "Sonucu gösterir. Tek başına ya da videowall içinde bir alan olarak."],
          ]}
        />
        <Kutu baslik="Anonim — bilerek">
          <p>
            Kim oy verdi bilinmez, saklanmaz. Sicil sorulsaydı dürüst cevap alamazdın; ölçmek istediğin şey de zaten
            kişi değil, gidişat.
          </p>
        </Kutu>
      </>
    ),
  },

  {
    id: "soru",
    kicker: "Kurulum",
    baslik: "Soru tipini seçmek",
    icerik: (
      <>
        <p>Tipi sonradan değiştirebilirsin ama eski oylar aynı ölçeğe göre kaydedildi — mümkünse baştan doğru seç.</p>
        <Tablo
          basliklar={["Tip", "Cevap", "Ne zaman"]}
          satirlar={[
            ["Yüz ölçeği", "😡 🙁 😐 🙂 😍 (1–5)", "Günlük memnuniyet. Okuması en kolayı, en çok oy toplayan."],
            ["NPS", "0–10", "“Tavsiye eder misin?” — klasik ölçüt, kıyaslanabilir."],
            ["Evet / Hayır", "👍 👎", "Tek net soru: “Temiz miydi?”"],
            ["Çoktan seçmeli", "Senin yazdığın şıklar", "Sebep sorarken: “Bugün ne aksadı?”"],
          ]}
        />
        <Kutu tur="uyari" baslik="Çoktan seçmelide skor yok">
          <p>
            Şıkların iyi–kötü sırası olmadığı için 0–100 skoru hesaplanmaz; dağılım ve sayı gösterilir. Trend takip
            etmek istiyorsan yüz ölçeği ya da NPS kullan.
          </p>
        </Kutu>
        <p>
          Seçenekleri virgülle yazarsın; yazım hatasını sonradan düzeltmek eski oyları bozmaz — sıra korunur.
        </p>
      </>
    ),
  },

  {
    id: "kiosk",
    kicker: "Saha",
    baslik: "Kiosk kurmak",
    icerik: (
      <>
        <Adimlar
          items={[
            { baslik: "Kiosk linkini tablette aç", metin: "Kokpitteki karekodu tabletin kamerasıyla okutmak en hızlısı." },
            { baslik: "Tam ekran yap ve uykuyu kapat", metin: "Ekran sürekli açık kalmalı; tablette güç ayarını da kapat." },
            {
              baslik: "PIN belirle",
              metin: (
                <>
                  Kokpitte <b>Kiosk çıkış PIN'i</b>. Boş bırakırsan kiosktan PIN'siz çıkılır — duvara asılacak tablette
                  mutlaka doldur.
                </>
              ),
            },
            {
              baslik: "Bekleme süresini ayarla",
              metin: "İki oy arasındaki bekleme. Aynı kişinin üst üste basmasını frenler; kalabalık geçişte 3–5 sn iyidir.",
            },
          ]}
        />
        <Kutu tur="ekran" baslik="Kiosktan çıkış">
          <p>
            Sol üst köşeye <b>3 saniye içinde 5 dokunuş</b> → PIN → yönetici menüsü. Menüde son oy hatası da yazar:
            misafire hata gösterilmez ama sen kör kalmazsın.
          </p>
        </Kutu>
        <Baslik>Sahada ters giderse</Baslik>
        <Tablo
          basliklar={["Ne oluyor", "Sebebi", "Ne yapacaksın"]}
          satirlar={[
            ["Kiosk oy almıyor", "Bekleme süresi henüz dolmadı", "Süreyi kısalt; gerçek hata varsa yönetici menüsünde yazar"],
            ["Tablet ekranı kararıyor", "Cihazın uyku ayarı", "Tablette ekranı “hiçbir zaman kapanmasın” yap"],
            ["Oy gelmiyor", "Kimse kiosku ya da posteri görmüyor", "Geçiş güzergâhına taşı; panoyu da görünür bir yere as"],
          ]}
        />

        <p>
          Poster asacaksan oy linkinin karekodunu bas. Kiosk yoksa da çalışır — insanlar kendi telefonundan oy verir.
        </p>
      </>
    ),
  },

  {
    id: "okumak",
    kicker: "Okuma",
    baslik: "Sonucu okumak",
    icerik: (
      <>
        <p>
          Dört soru tipi de <b>0–100 arası tek bir skora</b> indirgenir; böylece farklı noktaları ve farklı günleri
          yan yana koyabilirsin.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <SkorRozeti renk="yesil">70 ve üstü — iyi</SkorRozeti>
          <SkorRozeti renk="amber">40–69 — izle</SkorRozeti>
          <SkorRozeti renk="gul">40 altı — sorun var</SkorRozeti>
        </div>
        <Tablo
          basliklar={["Kart", "Ne söyler"]}
          satirlar={[
            ["Bugün", "Bugünün skoru ve oy sayısı. Az oyda skora fazla anlam yükleme."],
            ["Düne göre", "Dünle farkı. Ani düşüş bir olayın işaretidir — o günü sor."],
            ["Son 30 gün", "Gerçek seviye. Günlük dalgalanma buradan silinir."],
            ["30 günlük trend", "Yön. Yukarı mı gidiyor, aşağı mı?"],
            ["Gün × saat", "Hangi gün ve saatte kötüleşiyor — vardiya ya da yoğunluk sorununu buradan yakalarsın."],
          ]}
        />

        <Baslik>Yorumlar</Baslik>
        <p>
          Oy verenin isterse bıraktığı serbest yazı. Moderasyon açıkken önce onay bekler; sayı sana <b>neyin</b>
          değiştiğini söyler, yorum <b>niye</b> değiştiğini.
        </p>

        <Baslik>Uyarı eşiği</Baslik>
        <p>
          Bir yüzde gir; skor altına düşünce kokpit ve nokta listesinde kırmızı görünür. 0 yazarsan kapalıdır. Her gün
          kokpite bakmak zorunda kalmamanın yolu.
        </p>
      </>
    ),
  },

  {
    id: "pano",
    kicker: "Paylaşma",
    baslik: "Sonucu göstermek",
    icerik: (
      <>
        <p>
          Pano linki girişsiz açılır. İki yerde işe yarar: koridordaki bir ekranda tek başına, ya da{" "}
          <b>FlowSign ekranında bir alan</b> olarak — pano adresini URL öğesi diye eklersin, videowall'ın bir köşesinde
          canlı skor döner.
        </p>
        <Kutu baslik="Göstermek ölçmenin parçası">
          <p>
            Skoru gizlersen insanlar oy vermenin bir işe yaradığını görmez ve zamanla oy gelmez olur. Panoyu asmak
            katılımı ayakta tutar.
          </p>
        </Kutu>
        <Kutu tur="uyari" baslik="Link bilen görür">
          <p>
            Pano ve kiosk adresleri giriş istemez (tablet ve TV giriş yapamaz). Skor kuruma özel bir bilgiyse adresi
            dağıtma.
          </p>
        </Kutu>
      </>
    ),
  },
];
