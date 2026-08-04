/**
 * FOTO SAHNE — bir alandaki fotoğrafları "duvar" gibi gösteren içerik türü.
 *
 * NE: `Görsel · Video · URL · Metin · Saat · Ekran` yanına yeni bir tür. Alana
 * eklenir, içine kütüphaneden fotoğraflar dizilir, bir SAHNE MODU ve bir TOPLAM
 * SÜRE verilir. Sıra ona gelince o süre boyunca döner, sonra alan bir sonraki
 * öğeye geçer. Tipik kullanım: `dashboard 30sn → dashboard 30sn → Foto sahne 5dk`.
 *
 * NEDEN YENİ BİR YÜKLEME YÜZEYİ YOK: fotoğraflar var olan yoldan (kokpit, yetkisi
 * olan ekip) giriyor. Yükleme sayfası, onay kuyruğu, saklama politikası — hiçbiri
 * gerekmiyor. `durationSec` ve takvim öğede ZATEN var, yani "bayram haftası
 * boyunca dönsün, sonra kendiliğinden düşsün" ek iş olmadan çalışıyor.
 *
 * "SON YÜKLENEN ÖNE ÇIKAR" YOK (kullanıcı kararı). FlowWall'da modlar canlı bir
 * akış üstüne kuruludur — "az önce gelen anı" kavramı vardır. Sign'da içerik
 * durağandır ve sıra kullanıcının dizdiği sıradır. Bu karar, modların buraya
 * taşınmasının önündeki asıl engeli kaldırıyor: geriye yalnız YERLEŞİM ve
 * HAREKET kalıyor.
 *
 * 7/24 DİSİPLİNİ: kareler ÖNCEDEN hesaplanır ve sayıları sabittir. Perde aylarca
 * açık kalıyor; her turda düğüm ekleyen/çıkaran bir çizim belleği şişirir.
 * Rastgelelik de yok — dağınıklık fotoğrafın SIRASINDAN türetilir, yani her
 * çizimde aynı yerde durur (yoksa her render'da kartlar zıplardı).
 *
 * Sınav: `node tests/foto-sahne.test.mjs`
 */

export type SahneModu = "mozaik" | "polaroid" | "sahne" | "spot" | "sinema";

export interface SahneModuBilgi {
  id: SahneModu;
  ad: string;
  ipucu: string;
}

/**
 * Modlar TEK KAYNAK: panel seçicisi, perde ve rehber tablosu hep buradan
 * türer — yeni mod eklenince rehber kendiliğinden güncellenir.
 *
 * "Zaman tüneli" BİLEREK YOK: FlowWall'daki karşılığı fotoğrafın zaman damgasını
 * ister, Sign'da fotoğrafın zamanı yok. Uydurma bir sıra göstermektense mod hiç
 * olmasın.
 */
export const SAHNE_MODLARI: SahneModuBilgi[] = [
  { id: "mozaik", ad: "Mozaik", ipucu: "Hepsi bir ızgarada; sırayla biri yenilenir" },
  { id: "polaroid", ad: "Polaroid", ipucu: "Hafif eğik kartlar, saçılmış duran bir pano" },
  { id: "sahne", ad: "Sahne", ipucu: "Ortada büyük bir kare, yanlarda küçükler" },
  { id: "spot", ad: "Spot", ipucu: "Biri öne çıkar, diğerleri soluk arkada" },
  { id: "sinema", ad: "Sinema", ipucu: "Tam alanda tek kare, altta film şeridi" },
];

export const SAHNE_MODU_VARSAYILAN: SahneModu = "mozaik";

/** Perdede çizilecek tek bir kare (yüzde cinsinden, alana göre). */
export interface SahneKaresi {
  /** Bu karede kaçıncı fotoğraf duracak (liste sırasına göre). */
  indeks: number;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Polaroid eğimi (derece). Diğer modlarda 0. */
  aci: number;
  /** Üst üste binme sırası. */
  z: number;
  /** Öne çıkan kare mi (spot/sahne/sinema'da bir tane). */
  one: boolean;
}

/**
 * Kaç kare gösterilsin? Alanın oranına ve fotoğraf sayısına göre TÜRETİLİR —
 * kullanıcıya sorulmaz. 400px genişliğindeki bir alana dokuz fotoğraf sığmaz ve
 * bunu kullanıcının hesaplaması gerekmemeli.
 */
export function izgaraOlcu(adet: number, oran: number, yogunluk = 1): { sutun: number; satir: number } {
  if (adet <= 0) return { sutun: 1, satir: 1 };
  // DUVAR HİSSİ: hedef, fotoğrafların HEPSİNİ göstermek (kullanıcı kararı —
  // "yapacağın şey fotoğraflarla bir wall oluşturmak, bu kadar"). Yalnız üst
  // sınır var: 16'dan sonra hücreler pul kadar kalıyor, fazlası sırayla döner.
  const hedef = Math.max(1, Math.min(adet, Math.round(16 * yogunluk)));
  // Oran geniş ise sütun, dar ise satır artar; hücreler kareye yakın kalsın.
  let sutun = Math.max(1, Math.round(Math.sqrt(hedef * oran)));
  let satir = Math.max(1, Math.ceil(hedef / sutun));
  // Fazla hücre üretme: 5 fotoğrafa 3×3 (9 hücre) verilirse dördü boş kalır.
  while (sutun > 1 && (sutun - 1) * satir >= hedef) sutun -= 1;
  while (satir > 1 && sutun * (satir - 1) >= hedef) satir -= 1;
  // HÜCRE SAYISI FOTOĞRAF SAYISINI AŞAMAZ. Aşarsa aynı fotoğraf aynı anda iki
  // hücrede belirir (liste başa sarar) — çirkin ve kafa karıştırıcı, üstelik
  // yalnız belli sayılarda ortaya çıktığı için gözle kolayca kaçırılır.
  while (sutun * satir > adet && satir > 1) satir -= 1;
  while (sutun * satir > adet && sutun > 1) sutun -= 1;
  return { sutun, satir };
}

/** Sıradan türetilen, HER ÇİZİMDE AYNI olan sözde-rastgele sayı (0–1). */
function tohum(i: number): number {
  const x = Math.sin((i + 1) * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * Bir modun kare yerleşimi. SAF: aynı girdiye hep aynı çıktı.
 *
 * `kaydir`, hangi fotoğrafın hangi karede olduğunu döndürür — mozaikte tek tek
 * ilerler, öne çıkan modlarda öndeki kareyi değiştirir.
 */
export function sahneKareleri(
  mod: SahneModu,
  adet: number,
  oran: number,
  kaydir = 0
): SahneKaresi[] {
  if (adet <= 0) return [];
  // TEK FOTOĞRAF: hangi mod seçilirse seçilsin tek ve tam kare. Modların
  // "öne çıkan + yanındakiler" kurgusu tek fotoğrafta aynı kareyi birkaç kez
  // çizmeye çalışıyordu.
  if (adet === 1) return [{ indeks: 0, x: 0, y: 0, w: 100, h: 100, aci: 0, z: 1, one: true }];
  const don = (i: number) => ((i % adet) + adet) % adet;

  if (mod === "sinema") {
    // Tam alanda tek kare + altta şerit. Şerit alanın altıda birini alır.
    const seritYuksek = 18;
    const seritAdet = Math.max(1, Math.min(adet - 1, Math.round(4 * Math.max(1, oran))));
    const kareler: SahneKaresi[] = [
      { indeks: don(kaydir), x: 0, y: 0, w: 100, h: adet > 1 ? 100 - seritYuksek : 100, aci: 0, z: 1, one: true },
    ];
    for (let i = 0; i < (adet > 1 ? seritAdet : 0); i++) {
      const g = 100 / seritAdet;
      kareler.push({
        indeks: don(kaydir + 1 + i),
        x: i * g,
        y: 100 - seritYuksek,
        w: g,
        h: seritYuksek,
        aci: 0,
        z: 2,
        one: false,
      });
    }
    return kareler;
  }

  if (mod === "sahne") {
    // Ortada büyük, iki yanda birer sütun küçük.
    // Yan sütunlar ELDEKİ fotoğraftan türer: sabit sayı verilince iki fotoğraflı
    // sahnede aynı kare iki yerde çıkıyordu.
    const kalan = Math.min(4, adet - 1);
    const yanlar = [Math.ceil(kalan / 2), Math.floor(kalan / 2)];
    const yanGenis = 22;
    const kareler: SahneKaresi[] = [
      { indeks: don(kaydir), x: yanGenis, y: 0, w: 100 - yanGenis * 2, h: 100, aci: 0, z: 2, one: true },
    ];
    let sira = 1;
    for (let s = 0; s < 2; s++)
      for (let i = 0; i < yanlar[s]; i++) {
        const h = 100 / yanlar[s];
        kareler.push({
          indeks: don(kaydir + sira++),
          x: s === 0 ? 0 : 100 - yanGenis,
          y: i * h,
          w: yanGenis,
          h,
          aci: 0,
          z: 1,
          one: false,
        });
      }
    return kareler;
  }

  if (mod === "spot") {
    // Biri ortada büyük ve net; diğerleri arkada ızgarada (perde onları soluk çizer).
    const { sutun, satir } = izgaraOlcu(adet - 1, oran);
    const kareler: SahneKaresi[] = [];
    for (let r = 0; r < satir; r++)
      for (let c = 0; c < sutun; c++)
        kareler.push({
          indeks: don(kaydir + 1 + r * sutun + c),
          x: (c * 100) / sutun,
          y: (r * 100) / satir,
          w: 100 / sutun,
          h: 100 / satir,
          aci: 0,
          z: 1,
          one: false,
        });
    kareler.push({ indeks: don(kaydir), x: 15, y: 15, w: 70, h: 70, aci: 0, z: 3, one: true });
    return kareler;
  }

  if (mod === "polaroid") {
    // Saçılmış kartlar. Dağınıklık SIRADAN türetilir → her çizimde aynı yerde.
    const { sutun, satir } = izgaraOlcu(adet, oran, 1.2);
    const kareler: SahneKaresi[] = [];
    const hucreG = 100 / sutun;
    const hucreY = 100 / satir;
    for (let r = 0; r < satir; r++)
      for (let c = 0; c < sutun; c++) {
        const i = r * sutun + c;
        // Kayma, kartın hücre içindeki BOŞLUĞUYLA sınırlı (%6 kenar payı).
        // Sınırsız bırakılınca son sütun/satırdaki kartlar alanın dışına taşıyor
        // ve TV çerçevesinden kesiliyordu.
        const kaymaX = (tohum(i * 2) - 0.5) * hucreG * 0.11;
        const kaymaY = (tohum(i * 2 + 1) - 0.5) * hucreY * 0.11;
        kareler.push({
          indeks: don(kaydir + i),
          x: c * hucreG + hucreG * 0.06 + kaymaX,
          y: r * hucreY + hucreY * 0.06 + kaymaY,
          w: hucreG * 0.88,
          h: hucreY * 0.88,
          aci: (tohum(i * 3) - 0.5) * 9,
          z: 1 + (i % 3),
          one: false,
        });
      }
    return kareler;
  }

  // MOZAİK (varsayılan): boşluksuz ızgara, hücreler alanı tam kaplar.
  const { sutun, satir } = izgaraOlcu(adet, oran);
  const kareler: SahneKaresi[] = [];
  for (let r = 0; r < satir; r++)
    for (let c = 0; c < sutun; c++)
      kareler.push({
        indeks: don(kaydir + r * sutun + c),
        x: (c * 100) / sutun,
        y: (r * 100) / satir,
        w: 100 / sutun,
        h: 100 / satir,
        aci: 0,
        z: 1,
        one: false,
      });
  return kareler;
}

/**
 * Bir tur ne kadar sürsün? Sahne, öğenin TOPLAM süresini kaç adımda tüketeceğini
 * bilmeli: fotoğraflar hiç yenilenmezse pano donuk kalır, çok sık yenilenirse
 * göz yorulur. Adım süresi 4–12 sn arasına sıkıştırılır.
 */
export function adimMs(toplamSn: number, adet: number, kareAdedi: number): number {
  const gorunmeyen = Math.max(0, adet - kareAdedi);
  // Görünmeyen fotoğraf yoksa yenilenecek bir şey de yok → tek adım.
  if (gorunmeyen === 0) return Math.max(1, toplamSn) * 1000;
  const adim = (toplamSn * 1000) / (gorunmeyen + 1);
  return Math.min(12_000, Math.max(4_000, adim));
}
