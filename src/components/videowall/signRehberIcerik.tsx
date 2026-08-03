"use client";

/**
 * FlowSign kullanım rehberi — İÇERİK.
 *
 * Kabuk `components/Rehber.tsx`te (çekirdek, ürün bilmez); burası yalnız Sign'ın
 * anlattıkları. Sign ayrı paket olarak satılacağı için rehber de Sign'ın içinde
 * durur — self-host kopyasında aynı dosya vardır.
 *
 * KURAL: burada ekran görüntüsü YOK. Bir düğmeyi göstermek gerekiyorsa ürünün
 * gerçek sınıfıyla (`btn-primary` vb.) örneği basılır, bir ekranı göstermek
 * gerekiyorsa gerçek bileşen çalıştırılır (`RehberDemo`). Tasarım değişince
 * rehber kendiliğinden değişsin diye.
 */
import { ReactNode } from "react";
import { Icon, IconName } from "@/components/Icon";
import { RehberBolum } from "@/components/Rehber";
import RehberDemo from "./RehberDemo";

/* ── Rehberin küçük yapı taşları ─────────────────────────────────────────── */

/** Ürünün gerçek düğmesi, metnin içinde. Tasarım değişirse bu da değişir. */
function Dugme({ children, icon, birincil }: { children: ReactNode; icon?: IconName; birincil?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-[13px] font-semibold align-middle ${
        birincil ? "bg-accent text-white" : "bg-white border border-line text-ink"
      }`}
    >
      {icon && <Icon name={icon} size={13} />}
      {children}
    </span>
  );
}

function Tus({ children }: { children: ReactNode }) {
  return <kbd className="rounded-md border border-line border-b-2 bg-white px-1.5 py-0.5 text-xs font-bold">{children}</kbd>;
}

function Kutu({ tur = "not", baslik, children }: { tur?: "not" | "uyari" | "ekran"; baslik: string; children: ReactNode }) {
  const stil =
    tur === "uyari"
      ? "bg-brand-soft border-brand/25"
      : tur === "ekran"
        ? "bg-white border-line border-l-[3px] border-l-accent"
        : "bg-paper border-line";
  const renk = tur === "uyari" ? "text-brand" : tur === "ekran" ? "text-accent-dark" : "text-muted";
  return (
    <div className={`rounded-xl border p-3.5 ${stil}`}>
      <p className={`eyebrow mb-1 ${renk}`}>{baslik}</p>
      <div className="text-[14.5px] leading-relaxed text-ink/85 flex flex-col gap-2">{children}</div>
    </div>
  );
}

function Adimlar({ items }: { items: { baslik: string; metin: ReactNode }[] }) {
  return (
    <ol className="flex flex-col gap-4">
      {items.map((a, i) => (
        <li key={i} className="flex gap-3">
          <span className="shrink-0 w-7 h-7 rounded-lg bg-accent text-white grid place-items-center text-[13px] font-bold tabular-nums">
            {i + 1}
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold mb-0.5">{a.baslik}</p>
            <p className="text-ink/80">{a.metin}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

function Tablo({ basliklar, satirlar }: { basliklar: string[]; satirlar: ReactNode[][] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-white">
      <table className="w-full text-[14px] border-collapse">
        <thead>
          <tr className="bg-accent-soft/60">
            {basliklar.map((b) => (
              <th key={b} className="text-left font-bold text-[11px] uppercase tracking-wider text-muted px-3 py-2 whitespace-nowrap">
                {b}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {satirlar.map((s, i) => (
            <tr key={i} className="border-t border-line align-top">
              {s.map((h, j) => (
                <td key={j} className={`px-3 py-2.5 ${j === 0 ? "font-semibold whitespace-nowrap" : "text-ink/80"}`}>
                  {h}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Baslik({ children }: { children: ReactNode }) {
  return <p className="font-semibold text-[15px] mt-2">{children}</p>;
}

/* ── Bölümler ────────────────────────────────────────────────────────────── */

export const SIGN_REHBER: RehberBolum[] = [
  {
    id: "baslarken",
    kicker: "Başlarken",
    baslik: "Dört kelime",
    icerik: (
      <>
        <p>Rehber boyunca hep aynı anlamda kullanılıyor.</p>
        <Tablo
          basliklar={["Kelime", "Ne demek"]}
          satirlar={[
            ["Ekran", "FlowSign'da tanımladığın yayın. Bir TV'yi de kapsayabilir, yan yana altı TV'yi de."],
            ["Fiziksel ekran", "Duvardaki gerçek TV. Editördeki kesik çizgiler bunların arasındaki çerçeveyi gösterir."],
            ["Alan", "İçerik koyduğun bölge. Bir alan birkaç TV'ye yayılabilir, bir TV birkaç alana bölünebilir."],
            ["Öğe", "Alanın içinde sırayla dönen tek bir şey: görsel, video, sayfa, metin ya da saat."],
          ]}
        />

        <Baslik>Taslak ve yayın</Baslik>
        <p>
          En çok karıştırılan şey bu, bir kez oku yeter: <b>editörde yaptığın hiçbir şey videowall'a anında gitmez.</b> İki ayrı
          hâl var ve üstteki renkli şerit hangisinde olduğunu her zaman söyler.
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
          Bir şeyi bozduysan mor şeritteki <Dugme icon="undo">Yayındaki hâle dön</Dugme> taslağı, ekranın şu an oynattığı hâle
          geri sarar. Tek adımlık hatalar için yerleşim kartındaki <Dugme icon="undo">Son değişikliği geri al</Dugme> yeter.
        </p>
        <Kutu baslik="Tek istisna">
          <p>
            <b>Oynatma modu</b> (Videowall / Sunum) yayından bağımsızdır — seçtiğin anda perdeye gider, yayınlaman gerekmez.
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
        <p>Altı adım. Sonunda videowall bilgisayarında dönen bir yayının olur.</p>
        <Adimlar
          items={[
            {
              baslik: "Ekranı oluştur",
              metin: (
                <>
                  Ekranlar sayfasında ada duvarın yerini yaz (<i>Giriş Holü</i> gibi) ve hazır şablonlardan birini seç. Duvarın
                  bunlardan biri değilse ölçüleri elle gir: <b>Genişlik/Yükseklik</b> duvarın toplam piksel ölçüsü,{" "}
                  <b>yan yana / üst üste kaç ekran</b> ise kaç TV olduğu.
                </>
              ),
            },
            {
              baslik: "Bir alan seç",
              metin: (
                <>
                  Yerleşim tuvalinde alana tıkla. O alanın paneli açılır; başlığında alanın gerçek piksel ölçüsü yazar — hangi
                  çözünürlükte afiş hazırlayacağını oradan öğrenirsin.
                </>
              ),
            },
            {
              baslik: "İçerik ekle",
              metin: (
                <>
                  Panelin üstündeki beş düğme: <Dugme icon="upload">Görsel / Video</Dugme> <Dugme icon="folder">Kütüphane</Dugme>{" "}
                  <Dugme icon="link">URL</Dugme> <Dugme icon="pencil">Metin</Dugme> <Dugme icon="clock">Saat</Dugme>. Dosyayı
                  doğrudan panelin üzerine sürükleyip bırakmak da olur.
                </>
              ),
            },
            {
              baslik: "Önizle",
              metin: (
                <>
                  <Dugme icon="eye">Önizle</Dugme> taslağını ayrı bir sekmede açar. Videowall'daki yayın bundan etkilenmez —
                  istediğin kadar dene.
                </>
              ),
            },
            {
              baslik: "Kaydet & Yayınla",
              metin: (
                <>
                  Sağ üstteki <Dugme icon="save" birincil>Kaydet &amp; Yayınla</Dugme> düğmesi. Düğme{" "}
                  <Dugme>✓ Yayında</Dugme> hâline dönünce ekranlar birkaç saniye içinde yeni hâli alır.
                </>
              ),
            },
            {
              baslik: "Videowall'da aç",
              metin: (
                <>
                  Sayfanın altındaki <b>Yayın linki</b>ni kopyala — ya da yanındaki kareyi telefonla okut. Videowall bilgisayarında
                  Chrome ile aç, tam ekran yap. Bundan sonrası kendiliğinden döner.
                </>
              ),
            },
          ]}
        />
      </>
    ),
  },

  {
    id: "yerlesim",
    kicker: "Yerleşim",
    baslik: "Alanları düzenlemek",
    icerik: (
      <>
        <p>
          Aşağıdaki tuval gerçek yerleşim editörünün kendisi — üstünde deneyebilirsin. Buradaki hiçbir değişiklik
          kaydedilmez.
        </p>
        <RehberDemo />

        <Baslik>Üç hareket</Baslik>
        <Tablo
          basliklar={["Ne yapmak istiyorsun", "Nasıl"]}
          satirlar={[
            ["Alan seçmek", "Alana tıkla. Ayarları ve içeriği panelde açılır."],
            ["Alanları birleştirmek", "Bir alandan diğerine sürükle. Kapsadığın dikdörtgen tek alan olur."],
            ["Alanı bölmek", <>Panelin altındaki <b>Bu alanı böl</b>: yan yana ⇄ ve alt alta ⇅ için 2·3·4. İkisini birden seçip tek <b>Uygula</b> ile 3×2 yapabilirsin.</>],
            ["Oranı değiştirmek", "Tuvalde iki alanın paylaştığı çizgiyi tut ve sürükle."],
          ]}
        />
        <Kutu tur="ekran" baslik="Kesik çizgiler">
          <p>
            Tuvaldeki kesik çizgiler TV'lerin arasındaki <b>çerçeve</b>dir — taşınmazlar, donanım gerçeğidir. Bir yüzü tam
            ortadan bölen çerçevenin üstüne yazı denk getirme.
          </p>
        </Kutu>
        <Kutu tur="uyari" baslik="Bölünemiyor derse">
          <p>
            &ldquo;Bu alan daha fazla bölünemez&rdquo; uyarısı, yerleşimin en küçük parçasına inildiği anlamına gelir. Önce
            birkaç parçayı birleştir, sonra istediğin gibi böl.
          </p>
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
          basliklar={["Tür", "Ne için"]}
          satirlar={[
            ["Görsel / Video", "Cihazından yükle. Panelin üzerine sürükleyip bırakmak da olur."],
            ["Kütüphane", "Bu ekrana daha önce yüklediklerin. Aynı afişi ikinci alana koyarken yeniden yükleme."],
            ["URL", "Bir web sayfası ya da pano. Bazı siteler gömülmeye izin vermez — eklerken uyarır, Önizle ile doğrula."],
            ["Metin", "Başlık + mesaj. Zemin ve yazı rengi senin."],
            ["Saat", "Canlı saat."],
          ]}
        />

        <Baslik>Sıra</Baslik>
        <p>
          Öğeler listedeki sırayla döner. Sürükleme tutamağından taşı, ya da <b>▲▼</b> ile bir basamak oynat.
        </p>

        <Baslik>Süre ve takvim</Baslik>
        <p>
          Her öğenin kendi <Dugme icon="settings">ayar</Dugme> düğmesi var. Dördü birlikte &ldquo;bu içerik ne zaman
          görünsün&rdquo; sorusunu cevaplar.
        </p>
        <Tablo
          basliklar={["Ayar", "Ne yapar", "Boş bırakırsan"]}
          satirlar={[
            ["Süre (sn)", "Öğenin ekranda kalma süresi", "Görsel ve metin 8 sn; video kendi sonuna kadar oynar"],
            ["Saat", "Günün hangi saatleri arasında dönsün", "Gün boyu. 22:00–06:00 gibi geceyi aşan aralık da çalışır"],
            ["Tarih", "Kampanya aralığı; bitiş günü dahil", "Süresiz"],
            ["Gün", "Haftanın hangi günleri", "Her gün"],
          ]}
        />
        <p>
          Sırası gelmeyen öğe listede <Dugme>şu an takvim dışı</Dugme> rozeti alır. Kaybolmadı — sadece bugün, bu saatte
          dönmüyor.
        </p>

        <Baslik>Geçiş ve zemin</Baslik>
        <p>
          Panelin altındaki <b>Alan ayarları</b> bölümünde: geçiş <Dugme>Yumuşak</Dugme> <Dugme>Kesme</Dugme>{" "}
          <Dugme>Kaydır</Dugme> ve alanın zemin rengi. Seçimler beklemede durur, <Dugme birincil>Uygula</Dugme> ile devreye
          girer. Geçişi görebilmek için alanda en az iki öğe olmalı.
        </p>

        <Baslik>Oynatma modu</Baslik>
        <Tablo
          basliklar={["Mod", "Nasıl ilerler", "Nerede"]}
          satirlar={[
            ["Videowall", "İçerik süre ve takvime göre kendiliğinden döner", "Normal kullanım — koridor, hol, üretim panosu"],
            [
              "Sunum",
              <>
                Kumanda veya klavye ile: <Tus>→</Tus> <Tus>←</Tus> <Tus>boşluk</Tus>. Süre ve otomatik geçiş çalışmaz
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
            { baslik: "Chrome ile yayın linkini aç", metin: "Başka tarayıcı da açar ama uzun süreli çalışmada Chrome'u kullan." },
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
                  TV'ler ekran kartında <b>tek bir geniş ekran</b> gibi tanımlanmalı (NVIDIA Surround / AMD Eyefinity).
                  Windows'un &ldquo;ekranları genişlet&rdquo; ayarı yetmez — o durumda yayın yalnız bir TV'de kalır.
                </>
              ),
            },
            {
              baslik: "Sırayı doğrula",
              metin: (
                <>
                  Sağ alttaki <Dugme icon="grid">Ekranları tanı</Dugme> her TV'ye kocaman bir numara basar. Soldan sağa 1-2-3
                  gitmiyorsa ekran kartı ayarından TV sırasını düzelt — içeriği değil.
                </>
              ),
            },
            {
              baslik: "Uykuyu kapat",
              metin:
                "Windows güç ayarlarında ekran ve uyku “hiçbir zaman” olsun. Sayfa ekranı uyanık tutmaya çalışır ama işletim sisteminin ayarını ezemez.",
            },
          ]}
        />

        <Kutu baslik="Kendi kendine">
          <p>
            Yayın 7/24 açık kalacak şekilde yazıldı: içeriği değiştirince kendi günceller, bağlantı koparsa son hâlini
            oynatmaya devam eder, gece bir kez kendini tazeler. Videowall'a her gün gitmen gerekmez.
          </p>
        </Kutu>

        <Baslik>Ekranlar kartı</Baslik>
        <p>
          Editörün altındaki <b>Ekranlar</b> kartı bu yayını açık tutan cihazları listeler: hangisi çevrimiçi, ne kadardır
          yayında, toplam ne kadar yayın yapmış. Bir TV'nin gerçekten açık olup olmadığını odaya gitmeden buradan görürsün.
        </p>

        <Baslik>Sık karşılaşılanlar</Baslik>
        <Tablo
          basliklar={["Ne görüyorsun", "Sebebi", "Ne yapacaksın"]}
          satirlar={[
            ["Değişiklik videowall'a gelmedi", "Yayınlanmadı", "Üstteki şeride bak; mor ise Kaydet & Yayınla"],
            ["Sarı şerit: sunucu yanıtı gecikti", "Hata değil — yazım sıraya alındı", "Bekle; tamamlanınca “✓ Yayınlandı” çıkar"],
            ["URL alanı boş kalıyor", "Site gömülmeye izin vermiyor", "Panonun gömme adresini kullan, ya da görselini koy"],
            ["Video duraksıyor", "Dosya, alanın boyutuna göre çok büyük", "Küçük alanlara küçük çözünürlüklü video koy"],
            ["Kumanda ilerletmiyor", "Oynatma modu Videowall", "Modu Sunum yap"],
            ["Ekran listede yok", "Link kapalı ya da 5 dakikadır haber vermiyor", "Videowall'da sayfa açık mı, ağ var mı bak"],
          ]}
        />

        <Kutu tur="uyari" baslik="Dikkat">
          <p>
            Yayın linkini bilen herkes ekranı <b>izleyebilir</b> — videowall bilgisayarı giriş yapamadığı için böyle olmak
            zorunda. Değiştirmek ise yetki ister. Gizli kalması gereken bir pano varsa onu videowall'a koyma.
          </p>
        </Kutu>
      </>
    ),
  },
];
