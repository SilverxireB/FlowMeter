"use client";

/**
 * FlowSign kullanım rehberi — İÇERİK.
 *
 * Kabuk `components/Rehber.tsx`, yapı taşları `components/RehberParcalari.tsx`
 * (çekirdek, ürün bilmez); burası yalnız Sign'ın anlattıkları. Sign ayrı paket
 * olarak satılacağı için rehber de Sign'ın içinde durur — self-host kopyasında
 * aynı dosya vardır.
 *
 * KURAL: burada ekran görüntüsü YOK. Bir düğmeyi göstermek gerekiyorsa ürünün
 * gerçek sınıfıyla basılır, bir ekranı göstermek gerekiyorsa gerçek bileşen
 * çalıştırılır (`RehberDemo`). Tasarım değişince rehber kendiliğinden değişsin diye.
 */
import { RehberBolum } from "@/components/Rehber";
import { Adimlar, Baslik, Dugme, Kutu, Tablo, Tus } from "@/components/RehberParcalari";
import { SAHNE_MODLARI } from "@/lib/fotoSahne";
import RehberDemo from "./RehberDemo";

export const SIGN_REHBER: RehberBolum[] = [
  {
    id: "baslarken",
    kicker: "Başlarken",
    baslik: "Dört kelime",
    icerik: (
      <>
        <Tablo
          basliklar={["Kelime", "Ne demek"]}
          satirlar={[
            ["Ekran", "FlowSign'da tanımladığın yayın. Bir TV'yi de kapsar, yan yana altı TV'yi de."],
            ["Fiziksel ekran", "Duvardaki gerçek TV. Tuvaldeki kesik çizgiler bunların arasındaki çerçevedir."],
            ["Alan", "İçerik koyduğun bölge. Birkaç TV'ye yayılabilir; bir TV birkaç alana bölünebilir."],
            ["Öğe", "Alanda sırayla dönen tek bir şey: görsel, video, sayfa, metin ya da saat."],
          ]}
        />

        <Baslik>Taslak ve yayın</Baslik>
        <p>
          Bir kez oku, yeter: <b>editörde yaptığın hiçbir şey videowall'a anında gitmez.</b> Üstteki renkli şerit hangi
          hâlde olduğunu her zaman söyler.
        </p>
        <div className="grid sm:grid-cols-2 gap-2">
          <div className="rounded-xl border border-accent/25 bg-accent-soft/50 p-3">
            <p className="text-xs font-bold text-accent-dark mb-1">● Taslak</p>
            <p className="text-[14px] text-ink/80">Senin üzerinde çalıştığın kopya. Şerit mor.</p>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
            <p className="text-xs font-bold text-emerald-700 mb-1">✓ Yayın</p>
            <p className="text-[14px] text-ink/80">Videowall'un oynattığı kopya. Şerit yeşil.</p>
          </div>
        </div>
        <p>
          Bozduysan mor şeritteki <Dugme icon="undo">Yayındaki hâle dön</Dugme> taslağı ekranın oynattığı hâle geri sarar;
          tek adımlık hatalar için <Dugme icon="undo">Son değişikliği geri al</Dugme> yeter.
        </p>
        <Kutu baslik="Tek istisna">
          <p>
            <b>Oynatma modu</b> (Videowall / Sunum) yayından bağımsızdır — seçtiğin anda perdeye gider.
          </p>
        </Kutu>
      </>
    ),
  },

  {
    id: "kurulum",
    kicker: "Kurulum",
    baslik: "İlk ekranını yayına al",
    icerik: (
      <>
        <p>Altı adım; sonunda videowall bilgisayarında dönen bir yayının olur.</p>
        <Adimlar
          items={[
            {
              baslik: "Ekranı oluştur",
              metin: (
                <>
                  Ada duvarın yerini yaz (<i>Giriş Holü</i>) ve hazır şablonlardan birini seç. Şablon uymuyorsa:{" "}
                  <b>Genişlik/Yükseklik</b> duvarın toplam piksel ölçüsü, <b>yan yana / üst üste kaç ekran</b> kaç TV
                  olduğu.
                </>
              ),
            },
            {
              baslik: "Bir alan seç",
              metin: (
                <>
                  Tuvalde alana tıkla. Panel başlığında alanın gerçek piksel ölçüsü yazar — afişi o ölçüde hazırla.
                </>
              ),
            },
            {
              baslik: "İçerik ekle",
              metin: (
                <>
                  <Dugme icon="folder">Kütüphane</Dugme> <Dugme icon="link">URL</Dugme>{" "}
                  <Dugme icon="pencil">Metin</Dugme> <Dugme icon="clock">Saat</Dugme>. Görsel ve video
                  KÜTÜPHANEDEN gelir: seçmek de yüklemek de orada. Dosyayı panelin üzerine sürükleyip
                  bırakmak da olur.
                </>
              ),
            },
            {
              baslik: "Önizle",
              metin: (
                <>
                  <Dugme icon="eye">Önizle</Dugme> taslağı ayrı sekmede açar; videowall'daki yayın etkilenmez.
                </>
              ),
            },
            {
              baslik: "Kaydet & Yayınla",
              metin: (
                <>
                  Sağ üstteki <Dugme icon="save" birincil>Kaydet &amp; Yayınla</Dugme>. Düğme <Dugme>✓ Yayında</Dugme>{" "}
                  olunca ekranlar birkaç saniye içinde yeni hâli alır.
                </>
              ),
            },
            {
              baslik: "Videowall'da aç",
              metin: (
                <>
                  Alttaki <b>Yayın linki</b>ni kopyala ya da kareyi telefonla okut. Videowall bilgisayarında Chrome ile
                  aç, tam ekran yap.
                </>
              ),
            },
          ]}
        />
        <Kutu baslik="Adı değiştirirsen">
          <p>Yayın linki de yenilenir, ama eski link çalışmaya devam eder — videowall'a koşmana gerek yok.</p>
        </Kutu>
        <p>
          İkinci bir ekran için sıfırdan başlama: listedeki <Dugme icon="copy">Kopyala</Dugme> yerleşimi ve içeriği
          birlikte çoğaltır.
        </p>
      </>
    ),
  },

  {
    id: "yerlesim",
    kicker: "Yerleşim",
    baslik: "Alanları düzenlemek",
    icerik: (
      <>
        <p>Aşağıdaki tuval gerçek editörün kendisi — üstünde dene.</p>
        <RehberDemo />
        <Tablo
          basliklar={["Ne yapmak istersen", "Nasıl"]}
          satirlar={[
            ["Alan seçmek", "Alana tıkla."],
            ["Birleştirmek", "Bir alandan diğerine sürükle; kapsadığın dikdörtgen tek alan olur."],
            [
              "Bölmek",
              <>
                Panelin altındaki <b>Bu alanı böl</b>: yan yana ⇄ ve alt alta ⇅ için 2·3·4. İkisini birden seçip tek{" "}
                <b>Uygula</b> ile 3×2 yaparsın. İçerik ilk parçada kalır.
              </>,
            ],
            ["Oranı değiştirmek", "İki alanın paylaştığı çizgiyi tut ve sürükle."],
            ["Ad vermek", "Panelin başındaki ada tıkla. Altı alanlı bir ekranda “Alan 4” hiçbir şey söylemez."],
          ]}
        />
        <Kutu tur="ekran" baslik="Kesik çizgiler">
          <p>
            TV'lerin arasındaki <b>çerçeve</b>dir, taşınmaz. Bir yüzü ya da yazıyı tam o çizgiye denk getirme.
          </p>
        </Kutu>
        <Kutu tur="uyari" baslik="Bölünemiyor derse">
          <p>Yerleşimin en küçük parçasındasın: önce birkaç parçayı birleştir, sonra istediğin gibi böl.</p>
        </Kutu>
      </>
    ),
  },

  {
    id: "icerik",
    kicker: "İçerik",
    baslik: "Ne ekleyebilirsin, ne zaman döner",
    icerik: (
      <>
        <p>Bir alandaki öğeler listedeki sırayla, verdiğin süre ve takvime göre döner.</p>
        <Tablo
          basliklar={["Tür", "Bilmen gereken"]}
          satirlar={[
            [
              "Kütüphane",
              <>
                Görsel ve videonun TEK kapısı. <b>Cihazdan yükle</b> dosyayı kütüphaneye alır; alana
                yerleştirmek için öğeye tıkla. <b>kullanılmıyor</b> rozetli dosya hiçbir alanda değildir —
                çöp simgesiyle kalıcı silinir (kullanılan dosya silinemez). <b>Ortak raf</b> sekmesi tüm
                ekranların havuzudur: herkes ekler (yükleme ya da dosyanın yanındaki klasör simgesi —
                KOPYALAR, ekrandan silmez), yalnız yönetici siler; ekran silinse de raf etkilenmez.
                Çok dosyayı tek seferde eklemek için <b>Toplu seçim</b>. Video için MP4 (H.264) en güvenlisi.
              </>,
            ],
            [
              "URL",
              <>
                Web sayfası ya da pano. Bazı siteler gömülmeye izin vermez; eklerken uyarır. Şirket panoları sığmıyorsa{" "}
                <b>yakınlaştırmayı</b> %25–150 arasında ayarla.
              </>,
            ],
            ["Metin", "Başlık + mesaj; zemin ve yazı rengi senin."],
            ["Saat", "Canlı saat."],
            [
              "Foto sahne",
              <>
                Kendi linki olan hatıra köşesi: <b>Foto sahne oluştur</b> sahneyi açar, linkini alana ekler.
                Fotoğraflar, mod (<b>{SAHNE_MODLARI.map((m) => m.ad).join(" · ")}</b>), efekt, zemin rengi ve foto yazıları
                sahnenin KENDİ sayfasından yönetilir (🔀 Otomatik: seçtiğin modlar 30 sn'de bir sırayla döner). Tüm sahneler ekran
                listesinin altındaki <b>Foto sahneler</b> bölümünde durur — link alandan silinse de sahneye
                oradan ulaşılır; silme depodaki fotoğrafları da temizler — değişiklik linke anında düşer, aynı sahne birden çok
                ekranda oynar. Düzenleme yetkisini yönetici verir (Sign yetkileri → Foto sahneler); yetkili kişi ekranına dokunamaz, yalnız sahneyi besler.
              </>,
            ],
            [
              "Ekran",
              <>
                Başka bir ekranı bu alana bağlar. <b>Ekranın bir bölümünü başkasına yönettirmenin yolu budur</b>: o
                kişi kendi ekranını düzenler, sen onu buraya bağlarsın; seninkine dokunamaz.
              </>,
            ],
          ]}
        />

        <Kutu baslik="Bir alanı başkasına devretmek">
          <p>
            Alana <Dugme icon="monitor">Ekran</Dugme> ile o kişinin ekranını bağla. Perde onun <b>yayınını</b> gösterir
            — denemeleri senin duvarına düşmez, ancak <b>Kaydet &amp; Yayınla</b> dediğinde değişir. Tasarımı ezilmesin
            diye o ekranın ölçüsü alanın ölçüsü olmalı; seçici sana yazar.
          </p>
        </Kutu>

        <Baslik>Sıra</Baslik>
        <p>
          Öğeler listedeki sırayla döner. Tutamağından sürükle, ya da <b>▲▼</b> ile bir basamak oynat.
        </p>

        <Baslik>Süre ve takvim</Baslik>
        <p>
          Her öğenin kendi <Dugme icon="settings">ayar</Dugme> düğmesi var.
        </p>
        <Tablo
          basliklar={["Ayar", "Ne yapar", "Boş bırakırsan"]}
          satirlar={[
            ["Süre (sn)", "Ekranda kalma süresi", "Görsel ve metin 8 sn; video kendi sonuna kadar"],
            ["Saat", "Günün hangi saatleri", "Gün boyu. 22:00–06:00 gibi geceyi aşan aralık da olur"],
            ["Tarih", "Kampanya aralığı; bitiş günü dahil", "Süresiz"],
            ["Gün", "Haftanın hangi günleri", "Her gün"],
          ]}
        />
        <Baslik>Üçü birden tutmalı</Baslik>
        <p>
          <b>Tarih</b>, <b>gün</b> ve <b>saat</b> birbirinden bağımsız üç süzgeçtir ve öğenin dönmesi için{" "}
          <b>hepsi birden</b> tutmalıdır. Boş bıraktığın süzgeç hiç kısıtlamaz — yani hiçbirini doldurmazsan içerik
          her zaman döner.
        </p>
        <Tablo
          basliklar={["Ne yazdın", "Ne olur"]}
          satirlar={[
            ["Hiçbiri", "Her gün, gün boyu, süresiz döner."],
            ["Yalnız saat başlangıcı — 09:00", "09:00'dan gece yarısına kadar."],
            ["Yalnız saat bitişi — 17:00", "Gece yarısından 17:00'ye kadar."],
            ["22:00 – 06:00", "Gece yarısını aşar: akşam 22:00'de başlar, sabah 06:00'da biter."],
            ["Yalnız tarih başlangıcı", "O günden itibaren süresiz döner."],
            ["Yalnız tarih bitişi", "O güne kadar döner — bitiş günü dahil, ertesi gün düşer."],
            ["Gün seçmezsen", "Her gün. Seçersen yalnız işaretli günler."],
          ]}
        />
        <Kutu tur="uyari" baslik="Gece aşan saat + gün seçimi">
          <p>
            Gün süzgeci <b>o anki güne</b> bakar. &ldquo;Pazartesi + 22:00–06:00&rdquo; seçersen içerik pazartesi
            gecesi 22:00'de başlar ama <b>salı 02:00'de dönmez</b> — çünkü o saatte gün artık salıdır. Gecenin
            tamamını istiyorsan iki günü de işaretle.
          </p>
        </Kutu>
        <Kutu tur="uyari" baslik="Aynı saati iki yana yazma">
          <p>
            10:00 – 10:00 yazarsan içerik <b>yalnız o dakika</b> döner. Gün boyu istiyorsan saat alanlarını boş bırak.
          </p>
        </Kutu>

        <p>
          Sırası gelmeyen öğe neden dönmediğini söyleyen bir rozet alır: <Dugme>şu an takvim dışı</Dugme> gün/saat
          penceresi dışında (yarın yine döner), <Dugme>henüz başlamadı</Dugme> tarihi gelmemiş,
          <Dugme>süresi doldu</Dugme> ise <b>ölü içerik</b> — silinebilir.
        </p>

        <Baslik>Geçiş ve zemin</Baslik>
        <p>
          Panelin altında, <b>Alan ayarları</b>: <Dugme>Yumuşak</Dugme> <Dugme>Kesme</Dugme> <Dugme>Kaydır</Dugme> ve
          zemin rengi. Seçimler <Dugme birincil>Uygula</Dugme> ile devreye girer; geçişi görmek için alanda en az iki öğe
          olmalı.
        </p>

        <Baslik>Oynatma modu</Baslik>
        <Tablo
          basliklar={["Mod", "Nasıl ilerler", "Nerede"]}
          satirlar={[
            ["Videowall", "Süre ve takvime göre kendiliğinden döner", "Koridor, hol, üretim panosu"],
            [
              "Sunum",
              <>
                Kumanda veya klavye: <Tus>→</Tus> <Tus>←</Tus> <Tus>boşluk</Tus>, <Tus>B</Tus> siyah ekran. Süre ve
                otomatik geçiş çalışmaz
              </>,
              "Toplantı odası perdesi",
            ],
          ]}
        />
      </>
    ),
  },

  {
    id: "videowall",
    kicker: "İşletme",
    baslik: "Videowall bilgisayarı",
    icerik: (
      <>
        <p>Bir kez doğru kurulursa aylarca elleşmeden döner.</p>
        <Adimlar
          items={[
            { baslik: "Chrome ile yayın linkini aç", metin: "Başka tarayıcı da açar; uzun süreli çalışmada Chrome'u kullan." },
            {
              baslik: "Tam ekran yap",
              metin: (
                <>
                  <Tus>F11</Tus>, ya da fareyi oynatınca sağ altta beliren <Dugme icon="expand">Tam ekran</Dugme>.
                </>
              ),
            },
            {
              baslik: "Birden çok TV varsa: tek birleşik masaüstü",
              metin: (
                <>
                  TV'ler ekran kartında <b>tek bir geniş ekran</b> olmalı (NVIDIA Surround / AMD Eyefinity). Windows'un
                  &ldquo;ekranları genişlet&rdquo;i yetmez — yayın yalnız bir TV'de kalır.
                </>
              ),
            },
            {
              baslik: "Sırayı doğrula",
              metin: (
                <>
                  <Dugme icon="grid">Ekranları tanı</Dugme> her TV'ye kocaman bir numara basar. Soldan sağa 1-2-3
                  gitmiyorsa ekran kartı ayarından TV sırasını düzelt — içeriği değil.
                </>
              ),
            },
            {
              baslik: "Uykuyu kapat",
              metin:
                "Windows güç ayarlarında ekran ve uyku “hiçbir zaman” olsun. Sayfa uyanık tutmaya çalışır ama işletim sisteminin ayarını ezemez.",
            },
          ]}
        />

        <Kutu baslik="Kendi kendine">
          <p>
            İçeriği değiştirince kendi günceller, bağlantı koparsa son hâlini oynatmaya devam eder, gece bir kez kendini
            tazeler.
          </p>
        </Kutu>

        <Baslik>Ekranlar kartı</Baslik>
        <p>
          Editörün altındaki <b>Ekranlar</b>, bu yayını açık tutan cihazları gösterir: hangisi çevrimiçi, ne kadardır
          yayında, toplam ne kadar yayın yapmış. Bir TV'nin gerçekten açık olup olmadığını odaya gitmeden görürsün.
        </p>

        <Baslik>Sık karşılaşılanlar</Baslik>
        <Tablo
          basliklar={["Ne görüyorsun", "Sebebi", "Ne yapacaksın"]}
          satirlar={[
            ["Değişiklik gitmedi", "Yayınlanmadı", "Şerit mor ise Kaydet & Yayınla"],
            ["Sarı şerit: yanıt gecikti", "Hata değil, yazım sıraya alındı", "Bekle; bitince “✓ Yayınlandı” çıkar"],
            ["URL alanı boş", "Site gömülmeye izin vermiyor", "Panonun gömme adresini ya da görselini koy"],
            ["Video duraksıyor", "Dosya alana göre çok büyük", "Küçük alana küçük çözünürlüklü video"],
            ["Kumanda ilerletmiyor", "Mod Videowall", "Modu Sunum yap"],
            ["Ekran listede yok", "Link kapalı ya da 5 dk'dır haber yok", "Sayfa açık mı, ağ var mı bak"],
          ]}
        />

        <Kutu tur="uyari" baslik="Dikkat">
          <p>
            Yayın linkini bilen herkes ekranı <b>izleyebilir</b> — videowall bilgisayarı giriş yapamadığı için böyle
            olmak zorunda. Değiştirmek yetki ister. Gizli kalması gereken bir panoyu videowall'a koyma.
          </p>
        </Kutu>
      </>
    ),
  },
];
