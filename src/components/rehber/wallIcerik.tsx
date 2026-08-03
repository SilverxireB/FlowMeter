"use client";

/**
 * FlowWall kullanım rehberi — İÇERİK.
 *
 * Perde modu ve efekt tabloları `WALL_SCREEN_MODES` / `WALL_EFFECTS`
 * sabitlerinden TÜRETİLİR — yeni mod eklenince rehberde kendiliğinden belirir,
 * açıklaması da kokpitteki ipucunun aynısı olur (iki yerde ayrışamaz).
 */
import { RehberBolum } from "@/components/Rehber";
import { Adimlar, Baslik, Dugme, Kutu, Tablo } from "@/components/RehberParcalari";
import { WALL_EFFECTS, WALL_SCREEN_MODES } from "@/lib/types";

/** Modu ne zaman seçmeli — kokpit ipucunun anlatmadığı sütun. */
const MOD_NE_ZAMAN: Record<string, string> = {
  stage: "Varsayılan. Kalabalık akarken hem tek anıyı büyük gösterir hem hareketi korur.",
  mosaic: "Çok fotoğraf varken; kimse kendi fotoğrafını beklemeden görür.",
  spotlight: "Yemek arası gibi sakin anlarda — tek tek bakılır.",
  polaroid: "Düğün, nişan, kutlama. Sıcak durur.",
  cinema: "Video ağırlıklı duvarda; tek anı tam ekran.",
  timeline: "Gün sonunda “neler oldu” anlatısı.",
  auto: "Uzun etkinlikte. Ekran tek düze kalmaz, kimse ayar değiştirmek zorunda kalmaz.",
};

export const WALL_REHBER: RehberBolum[] = [
  {
    id: "baslarken",
    kicker: "Başlarken",
    baslik: "Üç ekran, tek duvar",
    icerik: (
      <>
        <Tablo
          basliklar={["Ekran", "Nerede", "Ne yapar"]}
          satirlar={[
            ["Kokpit", "Sende", "Duvarı kurar, onaylar, çekilişi çeker."],
            ["Perde", "Projeksiyon / TV", "Anıların aktığı ekran. Girişsiz açılır."],
            ["Misafir", "Telefonda", "Kare kodu okutur, fotoğrafını yükler, dilek yazar."],
          ]}
        />
        <Adimlar
          items={[
            { baslik: "Duvarı oluştur", metin: "Panelde ada etkinliği yaz (Yılbaşı 2027 gibi)." },
            {
              baslik: "Perdeyi aç",
              metin: (
                <>
                  <b>Perde linki</b>ni etkinlik bilgisayarında aç, tam ekran yap. Kare kod perdenin köşesinde durur —
                  misafir oradan bağlanır.
                </>
              ),
            },
            {
              baslik: "Başlığı yaz",
              metin: "Perde başlığı (“Ayşe & Mehmet · 2026”) ve tema. Beş dakikalık iş, ekranı etkinliğe ait yapar.",
            },
          ]}
        />
        <Kutu tur="ekran" baslik="Misafir ne görüyor">
          <p>
            Kodu okutunca <b>kamera doğrudan sayfada açılır</b> — uygulama indirmek, hesap açmak yok. Adını yazması bile
            zorunlu değil.
          </p>
        </Kutu>
      </>
    ),
  },

  {
    id: "perde",
    kicker: "Perde",
    baslik: "Ekranın görünüşü",
    icerik: (
      <>
        <p>Mod canlı değişir — perdeyi yenilemene gerek yok.</p>
        <Tablo
          basliklar={["Mod", "Ne yapar", "Ne zaman"]}
          satirlar={WALL_SCREEN_MODES.map((m) => [
            `${m.icon} ${m.name}`,
            m.hint,
            MOD_NE_ZAMAN[m.id] ?? "—",
          ])}
        />
        <p>
          <b>Otomatik</b>u seçersen hangi modların döneceğini ve geçiş aralığını sen belirlersin.
        </p>

        <Baslik>Efekt</Baslik>
        <p>Temadan bağımsız, perdenin üstüne biner: {WALL_EFFECTS.map((e) => `${e.icon} ${e.name}`).join(" · ")}</p>

        <Kutu baslik="Tek anıyı öne almak">
          <p>
            Kokpitte bir anıyı sabitlersen perde her şeyi bırakıp onu gösterir — “şu fotoğrafa bakın” anı için. Sabiti
            kaldırınca akış kaldığı yerden devam eder.
          </p>
        </Kutu>
      </>
    ),
  },

  {
    id: "kontrol",
    kicker: "Kontrol",
    baslik: "Neyin perdeye çıkacağı",
    icerik: (
      <>
        <Baslik>Moderasyon</Baslik>
        <p>
          Açıkken her yükleme önce <b>Onay bekleyen</b> listesine düşer, perdeye çıkmaz. Kurumsal etkinlikte aç;
          arkadaş ortamında kapalı bırak, akış canlı kalsın.
        </p>

        <Baslik>İzinler ve sınırlar</Baslik>
        <Tablo
          basliklar={["Ayar", "Niye var"]}
          satirlar={[
            ["Video süre limiti", "Uzun videolar hem perdeyi tıkar hem depolamayı yer."],
            ["Kişi başı en fazla foto", "Bir kişi duvarı tek başına doldurmasın."],
            ["Dilekler", "Kapatırsan misafirin telefonunda dilek sekmesi hiç görünmez."],
            ["Orijinali sakla", "Sonradan tam çözünürlüklü indirmek için — yer kaplar."],
          ]}
        />

        <Baslik>Kaldırmak</Baslik>
        <p>
          Kaldırılan anı perdeden düşer ama <b>Kaldırılanlar</b> listesinde durur — yanlışlıkla kaldırdıysan geri
          alırsın. Kalıcı silme ayrı bir işlemdir ve geri dönüşü yoktur.
        </p>

        <Baslik>Sık karşılaşılanlar</Baslik>
        <Tablo
          basliklar={["Ne oluyor", "Sebebi", "Ne yapacaksın"]}
          satirlar={[
            ["Fotoğraf perdede yok", "Moderasyon açık", "Onay bekleyen listesine bak"],
            ["Misafir yükleyemiyor", "Duvar kapalı ya da kişi başı sınıra takıldı", "Yaşam döngüsünden aç, sınırı yükselt"],
            ["Video yüklenmiyor", "Süre limitini aşıyor", "Limiti artır ya da misafirden kısaltmasını iste"],
          ]}
        />

        <Kutu baslik="Canlı anons">
          <p>
            Perdenin üstüne tek satır yazı düşürür (“Yemek servisi başladı 🍽”). Anı akışı durmaz. Mikrofona
            uzanmadan duyuru yapmanın yolu.
          </p>
        </Kutu>
      </>
    ),
  },

  {
    id: "anlar",
    kicker: "Etkinlik",
    baslik: "Yarışma, çekiliş, film",
    icerik: (
      <>
        <Baslik>Foto yarışması</Baslik>
        <p>
          Başlık ve ödül yaz, başlat. Misafirler telefonundan favorisine oy verir, oyunu değiştirebilir. Süre dolunca{" "}
          <Dugme>Bitir &amp; ilan et</Dugme> kazananı perdede duyurur.
        </p>

        <Baslik>Çekiliş</Baslik>
        <Tablo
          basliklar={["Tür", "Nasıl"]}
          satirlar={[
            ["İsim + sicil", "Misafir telefonundan kaydolur; ya da listeyi Excel'den yapıştırırsın."],
            ["Numara aralığı", "Kayıt yok — 1–250 gibi bir aralıktan çekilir."],
          ]}
        />
        <p>
          Her çekim kayıt altına alınır (kim, ne zaman, havuzda kaç kişi vardı). “Hile mi var?” sorusunun cevabı
          ekranda durur.
        </p>

        <Baslik>En Sevilenler turu</Baslik>
        <p>En çok kalp alan anılar arka arkaya döner — etkinliğin sonunda kapanış gösterisi.</p>

        <Baslik>Anı Filmi</Baslik>
        <p>
          Duvardaki anıları müzikli bir videoya dönüştürür ve indirir. <b>Cihazında</b> üretilir — bekleme kuyruğu ya
          da yükleme yok.
        </p>

        <Kutu baslik="Herkes görsün diye">
          <p>
            Galeri linkini açarsan misafirler etkinlikten sonra da fotoğraflara bakar; ZIP ile hepsini tek dosyada
            indirebilirsin.
          </p>
        </Kutu>
      </>
    ),
  },

  {
    id: "bitirirken",
    kicker: "Sonrası",
    baslik: "Etkinlik biterken",
    icerik: (
      <>
        <Tablo
          basliklar={["Ne yaparsın", "Ne olur"]}
          satirlar={[
            ["Duvarı kapat", "Yükleme durur, perdede teşekkür ekranı çıkar. İstersen yeniden açarsın."],
            ["Yeni oturum", "Anılar perdeden ve kokpitten kalkar (SİLİNMEZ, arşivde durur); duvar ikinci grup için temizlenir."],
            ["ZIP indir", "Bütün medyayı tek dosyada indirir."],
          ]}
        />
        <Kutu tur="uyari" baslik="Aynı duvarı iki etkinlikte kullanma">
          <p>
            İki farklı etkinlik için <b>yeni oturum</b> başlat ya da yeni duvar aç. Aynı oturuma devam edersen iki
            grubun anıları birbirine karışır.
          </p>
        </Kutu>
        <Kutu baslik="Misafir kendi fotoğrafını silebilir">
          <p>Yanlış kare yüklendiğinde sana sormasına gerek yok; kendi yüklediğini telefonundan kaldırır.</p>
        </Kutu>
      </>
    ),
  },
];
