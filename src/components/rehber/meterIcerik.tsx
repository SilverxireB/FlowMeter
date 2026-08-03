"use client";

/**
 * FlowMeter kullanım rehberi — İÇERİK.
 *
 * Slayt tipi tablosu `SLIDE_TYPE_LABELS` + `INTERACTIVE/CONTENT_SLIDE_TYPES`
 * sabitlerinden TÜRETİLİR: yeni bir tip eklendiğinde rehberde kendiliğinden
 * belirir (açıklaması yazılmamışsa "—" ile, yani eksik olduğu görünür). Örnek
 * slayt da gerçek `SlidePreview` ile çizilir — ekran görüntüsü yok.
 */
import { RehberBolum } from "@/components/Rehber";
import { Adimlar, Baslik, Dugme, Kutu, Tablo, Tus } from "@/components/RehberParcalari";
import SlidePreview from "@/components/editor/SlidePreview";
import { CONTENT_SLIDE_TYPES, INTERACTIVE_SLIDE_TYPES, Slide, SLIDE_TYPE_LABELS, SlideType } from "@/lib/types";

/** Her tip ne işe yarar — tabloya elle yazılan tek sütun. */
const NE_ICIN: Partial<Record<SlideType, string>> = {
  "multiple-choice": "Hazır seçenekler arasından oy. En sık kullanılan.",
  "word-cloud": "Tek kelimelik cevaplar; çok yazılan büyür.",
  "open-ended": "Serbest cümle. Kart olarak akar.",
  scales: "Birkaç ifadeyi 1–5 arası puanlatır.",
  ranking: "Seçenekleri sıraya dizdirir.",
  qna: "İzleyici soru sorar, birbirininkini oylar.",
  quiz: "Doğru cevaplı yarışma; hızlı cevap daha çok puan.",
  "quiz-type": "Yarışma ama cevabı yazarak — şık yok.",
  "pin-on-image": "Görsel üzerinde nokta koydurur (harita, plan, ürün).",
  "guess-number": "Sayı tahmini; en yakın kazanır.",
  "hundred-points": "100 puanı seçenekler arasında paylaştırır — öncelik ölçer.",
  "grid-2x2": "İki eksenli ızgaraya yerleştirir (acil/önemli gibi).",
  content: "Düz başlık + metin.",
  image: "Tam ekran görsel.",
  video: "Video (mp4/webm adresi).",
  instructions: "Katılım yönergesi — QR ve kodu büyük gösterir.",
  leaderboard: "O ana kadarki yarışma sıralaması.",
};

const ORNEK_SLAYT: Slide = {
  id: "rehber-ornek",
  type: "multiple-choice",
  order: 0,
  question: "Bu ay neye odaklanalım?",
  options: ["Hız", "Kalite", "Maliyet"],
  settings: {},
};

function tipSatirlari(tipler: SlideType[]) {
  return tipler.map((t) => [SLIDE_TYPE_LABELS[t], NE_ICIN[t] ?? "—"]);
}

export const METER_REHBER: RehberBolum[] = [
  {
    id: "baslarken",
    kicker: "Başlarken",
    baslik: "Üç ekran, tek sunum",
    icerik: (
      <>
        <p>Bir sunum aynı anda üç yerde açıktır. Karışıklığın çoğu bunu bilmemekten çıkıyor.</p>
        <Tablo
          basliklar={["Ekran", "Kimde", "Ne yapar"]}
          satirlar={[
            ["Editör", "Sende", "Slaytları hazırlarsın. Sunum canlıyken de açık kalabilir."],
            ["Perde", "Projeksiyonda", "Herkesin gördüğü ekran. Sonuçlar burada canlı çizilir."],
            ["Telefon", "İzleyicide", "Katılım kodunu girip cevap verir."],
          ]}
        />
        <p>
          Perdeyi editördeki <Dugme birincil>Sun</Dugme> ile açarsın. İlk ekran <b>katılım ekranıdır</b>: kocaman bir kare
          kod ve 6 haneli kod. İnsanlar bağlandıkça isimleri belirir — herkes girene kadar burada bekle.
        </p>
        <Kutu tur="ekran" baslik="Katılım kodu">
          <p>
            Sunum boyunca sabit kalır ve perdenin üstünde hep yazar. Geç gelen biri her an bağlanabilir.
          </p>
        </Kutu>
      </>
    ),
  },

  {
    id: "slaytlar",
    kicker: "Hazırlık",
    baslik: "Slayt tipleri",
    icerik: (
      <>
        <p>
          Editörde <Dugme icon="plus" birincil>+</Dugme> ile slayt eklersin. Aşağıdaki önizleme gerçek slayt
          bileşeniyle çiziliyor — editörde de, perdede de bunu görürsün.
        </p>
        <div className="rounded-2xl border border-line bg-paper p-3">
          <SlidePreview slide={ORNEK_SLAYT} />
        </div>

        <Baslik>Cevap toplayanlar</Baslik>
        <Tablo basliklar={["Tip", "Ne için"]} satirlar={tipSatirlari(INTERACTIVE_SLIDE_TYPES)} />

        <Baslik>Cevap toplamayanlar</Baslik>
        <Tablo basliklar={["Tip", "Ne için"]} satirlar={tipSatirlari(CONTENT_SLIDE_TYPES)} />

        <Kutu baslik="Yayına almadan dene">
          <p>
            Araç çubuğundaki <Dugme icon="play">Dene</Dugme> slaytı katılımcının telefonundaki hâliyle açar. Verdiğin
            cevap <b>kaydedilmez</b> — sonuçlar kirlenmez.
          </p>
        </Kutu>
        <p>
          Slaytları alttaki şeritten sürükleyerek sıralarsın. Bir slaytı geçici olarak devre dışı bırakmak için{" "}
          <Dugme icon="dots">Diğer işlemler</Dugme> → atla; şeritte <b>·atlanıyor</b> yazar ve sunumda hiç görünmez.
        </p>
      </>
    ),
  },

  {
    id: "sunmak",
    kicker: "Sahne",
    baslik: "Sunum sırasında",
    icerik: (
      <>
        <Adimlar
          items={[
            {
              baslik: "Sun'a bas, katılım ekranında bekle",
              metin: (
                <>
                  Kare kod perdede. İsimler geldikçe listede belirir; sağ üstte <Dugme>… kişi</Dugme> yazar.
                </>
              ),
            },
            {
              baslik: "İlerlet",
              metin: (
                <>
                  <Tus>→</Tus> <Tus>←</Tus> ya da alttaki oklar. Editörde bir slayta tıklamak da izleyicileri oraya
                  taşır — sunum canlıyken editör kumandaya dönüşür.
                </>
              ),
            },
            {
              baslik: "Cevapları kapat",
              metin: (
                <>
                  <Dugme>Oylama açık</Dugme> düğmesi. Kapatınca yeni cevap gelmez; tartışmaya geçmeden önce sonucu
                  dondurmak için.
                </>
              ),
            },
            {
              baslik: "Bitir",
              metin: "Cevaplar kaydedilir, izleyiciler bekleme ekranına döner. Sonuçlar kaybolmaz.",
            },
          ]}
        />

        <Baslik>Alt çubuktaki diğer düğmeler</Baslik>
        <Tablo
          basliklar={["Düğme", "Ne zaman"]}
          satirlar={[
            ["Sonuçlar gizli", "Herkes cevaplayana kadar sonucu saklamak için — sürü etkisini keser."],
            ["Sıfırla", "Bu slaytın cevaplarını siler. Prova sonrası ya da yanlış anlaşılan soruyu tekrarlarken."],
            ["Skor", "Yarışma slaytları varsa sıralamayı açar."],
            ["Sohbet", "Canlı sohbet açıksa mesajları gösterir; buradan silebilirsin."],
            ["Tam ekran", "Perdeyi tarayıcı çerçevesinden kurtarır."],
          ]}
        />

        <Baslik>Sahnede ters giderse</Baslik>
        <Tablo
          basliklar={["Ne oluyor", "Sebebi", "Ne yapacaksın"]}
          satirlar={[
            ["Kimse bağlanamıyor", "Yeni oturum başlatılmış, kod değişmiş", "Perdedeki kodu oku — doğrusu odur"],
            ["Cevap gelmiyor", "Oylama kapalı", "Alt çubuktaki düğme “Oylama kapalı” diyorsa aç"],
            ["Perde ilerlemiyor", "Odak başka pencerede", "Perdeye bir kez tıkla, sonra ok tuşları"],
            ["Sonuçlar eski", "Provada verilen cevaplar duruyor", "O slaytta Sıfırla"],
          ]}
        />

        <Kutu baslik="Telefonu kumanda yap">
          <p>
            Menüden <Dugme>📱 Kumanda</Dugme>: telefondan ilerletirsin, sıradaki slaytı ve konuşmacı notunu görürsün.
            Perdenin başında durmak zorunda kalmazsın.
          </p>
        </Kutu>
      </>
    ),
  },

  {
    id: "tempo",
    kicker: "Ayarlar",
    baslik: "Tempo, dil ve moderasyon",
    icerik: (
      <>
        <p>
          Araç çubuğundaki <Dugme icon="chat">Etkileşim</Dugme> panelinde.
        </p>

        <Baslik>Sunum temposu</Baslik>
        <Tablo
          basliklar={["Mod", "Nasıl çalışır"]}
          satirlar={[
            ["Sunucu yönetir", "Canlı sunum: herkes perdedeki slaytı görür, sen ilerletirsin."],
            [
              "Katılımcı kendi ilerler",
              "Anket modu: perde yok, linki gönderirsin, herkes kendi hızında doldurur. Yarışma slaytları bu modda atlanır.",
            ],
          ]}
        />
        <p>
          Anket modu, sunum yapmadan veri toplamanın yolu: aynı sunumu toplantıda canlı, sonra da katılamayanlara link
          olarak kullanabilirsin.
        </p>

        <Baslik>Katılımcı dili</Baslik>
        <p>Türkçe / İngilizce. Yalnız izleyicinin telefonundaki metinleri değiştirir; senin ekranların Türkçe kalır.</p>

        <Baslik>Canlı sohbet</Baslik>
        <p>
          Açıkken izleyiciler telefondan mesaj yazar; sen perdedeki <Dugme>Sohbet</Dugme> panelinden okur ve silersin.
        </p>

        <Baslik>Moderasyon</Baslik>
        <p>
          Soru &amp; Cevap ile açık uçlu cevaplar önce onaydan geçebilir. Moderasyon ekranının adresi{" "}
          <span className="font-mono text-[13px]">/moderate/</span> + katılım kodudur; açıkken sorular ve cevaplar
          perdeye düşmeden orada bekler. Onaylayan kişi sen olmak zorunda değilsin — adresi bir yardımcına verebilirsin
          (giriş yapması gerekir).
        </p>
      </>
    ),
  },

  {
    id: "sonrasi",
    kicker: "Sonrası",
    baslik: "Sonuçlar ve ikinci grup",
    icerik: (
      <>
        <p>
          Menüden <Dugme>Sonuçlar</Dugme>: her slaytın cevapları, üstte oturum seçici, sağda PDF indirme.
        </p>
        <Tablo
          basliklar={["Ne", "Nerede"]}
          satirlar={[
            ["Bu oturumun cevapları", "Sonuçlar → “Şu anki oturum”"],
            ["Eski oturumlar", "Sonuçlar → oturum seçici (her “Yeni oturum” bir kayıt bırakır)"],
            ["PDF", "Sonuçlar sayfasındaki indirme düğmesi"],
          ]}
        />

        <Baslik>Aynı sunumu ikinci gruba yapmak</Baslik>
        <p>
          Panelde sunum kartındaki <Dugme icon="refresh">Yeni oturum</Dugme>: <b>yeni katılım kodu</b> üretir, perde
          sıfırdan başlar, önceki grubun cevapları silinmez — arşive geçer.
        </p>
        <Kutu tur="uyari" baslik="Yeni oturum kodu değiştirir">
          <p>
            Eski kodu bilenler artık giremez ve açık telefonlar sıfırlanır. Grup değişmiyorsa yeni oturum başlatma;
            tek bir slaytı temizlemek için perdedeki <b>Sıfırla</b> yeter.
          </p>
        </Kutu>
      </>
    ),
  },
];
