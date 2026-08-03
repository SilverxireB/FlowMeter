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
import { Icon, IconName } from "@/components/icons";
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
                  <Dugme icon="upload">Görsel / Video</Dugme> <Dugme icon="folder">Kütüphane</Dugme>{" "}
                  <Dugme icon="link">URL</Dugme> <Dugme icon="pencil">Metin</Dugme> <Dugme icon="clock">Saat</Dugme>.
                  Dosyayı panelin üzerine sürükleyip bırakmak da olur.
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
            ["Görsel / Video", "Cihazından yükle ya da panelin üzerine bırak. Video için MP4 (H.264) en güvenlisi."],
            ["Kütüphane", "Bu ekrana daha önce yüklediklerin — aynı afişi ikinci alana koyarken yeniden yükleme."],
            [
              "URL",
              <>
                Web sayfası ya da pano. Bazı siteler gömülmeye izin vermez; eklerken uyarır. Şirket panoları sığmıyorsa{" "}
                <b>yakınlaştırmayı</b> %25–150 arasında ayarla.
              </>,
            ],
            ["Metin", "Başlık + mesaj; zemin ve yazı rengi senin."],
            ["Saat", "Canlı saat."],
          ]}
        />

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
        <p>
          Sırası gelmeyen öğe <Dugme>şu an takvim dışı</Dugme> rozeti alır. Kaybolmadı — bugün, bu saatte dönmüyor.
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
