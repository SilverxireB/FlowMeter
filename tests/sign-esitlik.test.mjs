/**
 * SIGN EŞİTLİK SINAVI — `node tests/sign-esitlik.test.mjs`
 *
 * Sign iki yerde yaşıyor: online (`src/`) ve müşteriye teslim edilen self-host
 * paketi (`flowsign-selfhost/`). Kural, ürün davranışı değişince İKİSİNİN de
 * güncellenmesi. Pratikte bu kural elle tutuluyordu ve tutmadı:
 *
 *  - "Ekran bağla" düğmesi self-host'a hiç eklenmemişti; seçici penceresi
 *    oradaydı ama onu AÇAN düğme yoktu — özellik ulaşılamaz durumdaydı.
 *  - Bağlı ekranın editör önizlemesi self-host'ta hiç yoktu (alan boş görünürdü).
 *  - İkon seti ayrışmıştı (biri SVG, diğeri emoji).
 *
 * Hiçbiri derlemeyi kırmıyor; yalnızca self-host müşterisi eksik ürün alıyor.
 * Bu sınav, ürünün ayırt edici izlerini iki ağaçta da arar.
 */
import fs from "node:fs";

const IZLER = [
  ["gömülü ekran çizimi", "src/components/videowall/PlayerStage.tsx", "flowsign-selfhost/src/components/PlayerStage.tsx", "function GomuluEkran"],
  ["döngü koruması", "src/components/videowall/PlayerStage.tsx", "flowsign-selfhost/src/components/PlayerStage.tsx", "zincirKey"],
  ["yalnız yayın çizilir", "src/components/videowall/PlayerStage.tsx", "flowsign-selfhost/src/components/PlayerStage.tsx", "vw?.live ?? null"],
  ["önden indirme disiplini", "src/components/videowall/PlayerStage.tsx", "flowsign-selfhost/src/components/PlayerStage.tsx", 'preload={designPx.w >= 900'],
  ["eski gömme linklerini tanıma", "src/components/videowall/PlayerStage.tsx", "flowsign-selfhost/src/components/PlayerStage.tsx", "gomuluHedef"],
  ["editör minyatürü", "src/components/videowall/LayoutEditor.tsx", "flowsign-selfhost/src/components/LayoutEditor.tsx", "GomuluOnizleme"],
  ["metin önizlemesi", "src/components/videowall/LayoutEditor.tsx", "flowsign-selfhost/src/components/LayoutEditor.tsx", "11cqw"],
  ["saat önizlemesi", "src/components/videowall/LayoutEditor.tsx", "flowsign-selfhost/src/components/LayoutEditor.tsx", "toLocaleTimeString"],
  ["Ekran bağla düğmesi", "src/components/videowall/ZonePanel.tsx", "flowsign-selfhost/src/components/ZonePanel.tsx", 'label: "Ekran"'],
  ["ekran seçici penceresi", "src/components/videowall/ZonePanel.tsx", "flowsign-selfhost/src/components/ZonePanel.tsx", "EKRAN SEÇİCİ"],
  ["içerik düğmeleri SVG ikon", "src/components/videowall/ZonePanel.tsx", "flowsign-selfhost/src/components/ZonePanel.tsx", "icon: IconName"],
  ["screen öğe tipi", "src/lib/types.ts", "flowsign-selfhost/src/lib/types.ts", 'clock" | "screen"'],
  ["screenId alanı", "src/lib/types.ts", "flowsign-selfhost/src/lib/types.ts", "screenId?: string"],
  ["adres tanıyıcı", "src/lib/videowalls.ts", "flowsign-selfhost/src/lib/zones.ts", "function signAdresi"],
  ["toplam yayın süresi", "src/lib/types.ts", "flowsign-selfhost/src/lib/types.ts", "totalMs"],
  ["ekran süre sütunu", "src/components/videowall/ScreensCard.tsx", "flowsign-selfhost/src/components/ScreensCard.tsx", "function sure"],
  ["rehber çekmecesi", "src/components/Rehber.tsx", "flowsign-selfhost/src/components/Rehber.tsx", "rehber-yazdir"],
  ["rehber yapı taşları", "src/components/RehberParcalari.tsx", "flowsign-selfhost/src/components/RehberParcalari.tsx", "export function Dugme"],
  ["rehberde Ekran türü", "src/components/videowall/signRehberIcerik.tsx", "flowsign-selfhost/src/components/signRehberIcerik.tsx", "başkasına yönettirmenin yolu"],
  ["yazdırma düzeni", "src/styles/globals.css", "flowsign-selfhost/src/styles/globals.css", "rehber-yazdir"],
  ["boş alanda logo (yazı değil)", "src/components/videowall/PlayerStage.tsx", "flowsign-selfhost/src/components/PlayerStage.tsx", "function BosAlan"],
  ["dikey duvar kartta doğru oranda", "src/components/videowall/WallThumb.tsx", "flowsign-selfhost/src/components/WallThumb.tsx", 'aspectRatio: "1.6"'],
  ["yayınlanmamış çipi", "src/app/videowall/page.tsx", "flowsign-selfhost/src/app/screens/page.tsx", "henüz yayınlanmamış"],
  ["yayın öncesi boş alan özeti", "src/app/videowall/[id]/edit/page.tsx", "flowsign-selfhost/src/app/screens/[id]/edit/page.tsx", "alan boş"],
  ["bağlı ekran kayıpsa uyarı", "src/components/videowall/ZonePanel.tsx", "flowsign-selfhost/src/components/ZonePanel.tsx", "bağlı ekran bulunamadı"],
  ["takvim durumu ayrımı", "src/lib/videowalls.ts", "flowsign-selfhost/src/lib/zones.ts", "itemTakvimDurumu"],
  ["süresi doldu rozeti", "src/components/videowall/ZonePanel.tsx", "flowsign-selfhost/src/components/ZonePanel.tsx", "süresi doldu"],
  ["mobilde rozet kırılmaz", "src/components/videowall/ZonePanel.tsx", "flowsign-selfhost/src/components/ZonePanel.tsx", "truncate max-w-full shrink-0"],
  ["mobilde ad kendi satırında", "src/components/videowall/ZonePanel.tsx", "flowsign-selfhost/src/components/ZonePanel.tsx", "order-last basis-full"],
  // ── Kütüphane = tek veri merkezi (yeniden kurulum 1. adım) ────────────────
  ["kütüphane içinden yükleme", "src/components/videowall/ZonePanel.tsx", "flowsign-selfhost/src/components/ZonePanel.tsx", "Cihazdan yükle (görsel / video)"],
  ["rehberde tek kapı", "src/components/videowall/signRehberIcerik.tsx", "flowsign-selfhost/src/components/signRehberIcerik.tsx", "TEK kapısı"],
  // 2. adım: ekranın kalıcı medya[] kaydı — alandan silinen dosya kütüphanede kalır.
  ["kütüphane kaydı tipi", "src/lib/types.ts", "flowsign-selfhost/src/lib/types.ts", "export interface MedyaKaydi"],
  ["kütüphane = medya[] ∪ alanlar", "src/components/videowall/ZonePanel.tsx", "flowsign-selfhost/src/components/ZonePanel.tsx", "[...(vw.medya ?? [])].reverse()"],
  ["pencereden yükleme kütüphaneye", "src/components/videowall/ZonePanel.tsx", "flowsign-selfhost/src/components/ZonePanel.tsx", ', "kutuphane")'],
  ["mobilde Saat/Tarih taşmaz", "src/components/videowall/ZonePanel.tsx", "flowsign-selfhost/src/components/ZonePanel.tsx", "basis-full sm:basis-auto min-w-0"],
  ["ters tarih aralığı uyarısı", "src/components/videowall/ZonePanel.tsx", "flowsign-selfhost/src/components/ZonePanel.tsx", "Başlangıç bitişten sonra"],
  ["geçmiş gün seçilemez", "src/components/videowall/ZonePanel.tsx", "flowsign-selfhost/src/components/ZonePanel.tsx", "const enErken ="],
  ["rehberde süzgeç kombinasyonu", "src/components/videowall/signRehberIcerik.tsx", "flowsign-selfhost/src/components/signRehberIcerik.tsx", "Üçü birden tutmalı"],
  // ── Kırk ekranlık kurulumda çalışabilmek için gerekenler ──────────────────
  ["Türkçe duyarlı arama", "src/lib/arama.ts", "flowsign-selfhost/src/lib/arama.ts", "export function eslesir"],
  ["ekran listesinde arama", "src/app/videowall/page.tsx", "flowsign-selfhost/src/app/screens/page.tsx", 'placeholder="Ekran ara…"'],
  ["arama sonuçsuzsa ayrı mesaj", "src/app/videowall/page.tsx", "flowsign-selfhost/src/app/screens/page.tsx", "Aramayı temizle"],
  ["yetki matrisinde ekran araması", "src/app/admin/sign/page.tsx", "flowsign-selfhost/src/app/users/page.tsx", 'aria-label="Bu tabloda ekran ara"'],
  ["yetki matrisinde toplu uygulama", "src/app/admin/sign/page.tsx", "flowsign-selfhost/src/app/users/page.tsx", "topluUygula"],
  ["yetki tablosunda yapışık başlık", "src/app/admin/sign/page.tsx", "flowsign-selfhost/src/app/users/page.tsx", 'thead className="sticky top-0'],
  ["yetki dışa aktarma (CSV)", "src/lib/yetkiCsv.ts", "flowsign-selfhost/src/lib/yetkiCsv.ts", "export function yetkiCsv"],
  ["dışa aktar düğmesi", "src/app/admin/sign/page.tsx", "flowsign-selfhost/src/app/users/page.tsx", "onClick={disaAktar}"],
  ["minyatürde bezel çizgileri", "src/components/videowall/WallThumb.tsx", "flowsign-selfhost/src/components/WallThumb.tsx", "function BezelCizgileri"],
];

const oku = (p) => (fs.existsSync(p) ? fs.readFileSync(p, "utf8") : null);

let hata = 0;
for (const [ad, onlineYol, selfYol, iz] of IZLER) {
  const o = oku(onlineYol);
  const s = oku(selfYol);
  const durum = o === null ? "online dosya YOK" : s === null ? "self-host dosya YOK" : !o.includes(iz) ? "online'da iz yok" : !s.includes(iz) ? "SELF-HOST'ta eksik" : null;
  if (durum) hata++;
  console.log(`${durum ? "✗" : "✓"} ${ad}${durum ? ` — ${durum}` : ""}`);
}

// ── TEK BİLİNÇLİ AYRIM: NABIZ ARALIĞI ───────────────────────────────────────
// Bu sınavın geri kalanı "ikisi AYNI olmalı" der; burada tersi geçerli.
// Online'da her nabız bir Firestore yazımıdır ve günlük kota vardır: 7/24
// çalışan bir ekran 2 dk'da günde 720 yazım harcar (20 ekran = ücretsiz
// kotanın ~%72'si, başka hiçbir şey çalışmadan). Self-host'ta Firestore yok,
// nabız sunucunun kendi diskine yazılır, kota diye bir kısıt yoktur — orada
// kısa nabız bedava ve daha iyisidir.
//
// Sınav üç şeyi birden tutuyor, çünkü üçü de sessizce bozulabilir:
//  1. Değerler FARKLI kalmalı (biri diğerine eşitlenirse ya kota geri gelir ya
//     self-host boşuna körleşir),
//  2. İkisi de gerekçeyi taşımalı (yorumsuz sabit, bir sonraki kişiye "burada
//     bir tutarsızlık var" gibi görünür ve düzeltilir),
//  3. Eşik TÜRETİLMİŞ olmalı — ayrı sabit yazılırsa nabız uzatıldığında
//     sapasağlam ekranlar "çevrimdışı" görünür.
const nabiz = [
  ["online", "src/lib/videowalls.ts", "export const BEAT_MS = 5 * 60_000;"],
  ["self-host", "flowsign-selfhost/src/lib/zones.ts", "export const BEAT_MS = 2 * 60_000;"],
];
for (const [ad, yol, bekle] of nabiz) {
  const k = oku(yol) ?? "";
  const dogru = k.includes(bekle);
  const gerekce = k.includes("TEK BİLİNÇLİ AYRIM");
  const turetilmis = k.includes("export const ONLINE_MS = BEAT_MS *");
  if (!dogru || !gerekce || !turetilmis) hata++;
  console.log(
    `${dogru && gerekce && turetilmis ? "✓" : "✗"} nabız ${ad}: ${bekle.match(/= (.+);/)[1]}` +
      `${dogru ? "" : " — DEĞER DEĞİŞMİŞ"}${gerekce ? "" : " — gerekçe yorumu yok"}${turetilmis ? "" : " — ONLINE_MS türetilmemiş"}`
  );
}
// Aralık HİÇBİR yerde ikinci kez sabit yazılmasın (perdedeki `120_000` tam da
// böyle ayrışmıştı: BEAT_MS'i değiştirmek yazma sıklığını değiştirmiyordu).
// (Perdedeki 15dk'lık tek-URL tazelemesi BAŞKA bir zamanlayıcıdır — nabız
// zamanlayıcısı `sendScreenBeat` çağıran satırdan tanınır, süreye göre değil.)
const kopyaSabit = [
  "src/components/videowall/PlayerStage.tsx",
  "src/components/videowall/ScreensCard.tsx",
  "flowsign-selfhost/src/components/PlayerStage.tsx",
  "flowsign-selfhost/src/components/ScreensCard.tsx",
].filter((f) => {
  const k = oku(f) ?? "";
  if (/^\s*const ONLINE_MS\s*=/m.test(k)) return true;             // eşik yeniden tanımlanmış
  const beatIv = k.match(/setInterval\([^\n]*sendScreenBeat[^\n]*\)/);
  return Boolean(beatIv) && !/,\s*BEAT_MS\)/.test(beatIv[0]);      // aralık sabit yazılmış
});
if (kopyaSabit.length) hata++;
console.log(`${kopyaSabit.length ? "✗" : "✓"} nabız aralığı tek kaynakta${kopyaSabit.length ? ` — kopya sabit: ${kopyaSabit.join(", ")}` : ""}`);

// ── İKİ TERS YÖNLÜ KURAL (kaynak koruması) ──────────────────────────────────
// Bunlar derlemeyi kırmaz, gözle de fark edilmez; ikisi de YANLIŞ SONUÇ üretir:
//
//  1. Toplu uygulama SÜZÜLMÜŞ listeye bakmalı. "montaj" aratıp "Düzenle → aç"
//     diyen kişi yalnız gördüğü ekranlara yetki verdiğini sanır; kod tam listeyi
//     dolaşırsa GÖRMEDİĞİ kırk ekrana da yetki verir ve bunu hiç öğrenmez.
//  2. Dışa aktarma TAM listeye bakmalı. Denetim belgesi ekranda ne göründüğüne
//     değil sistemde ne olduğuna bakar; süzgeçliyken indirilen dosya EKSİK olur
//     ve eksikliği dosyanın üstünde yazmaz.
const govde = (kaynak, ad) => {
  const bas = kaynak.indexOf(`const ${ad} =`);
  if (bas < 0) return null;
  return kaynak.slice(bas, bas + 1400);
};
for (const [etiket, yol] of [
  ["online", "src/app/admin/sign/page.tsx"],
  ["self-host", "flowsign-selfhost/src/app/users/page.tsx"],
]) {
  const k = oku(yol) ?? "";
  const toplu = govde(k, "topluUygula");
  const disa = govde(k, "disaAktar");
  const topluDogru = Boolean(toplu) && /for \(const w of wallsFiltered\)/.test(toplu);
  // Dışa aktarma süzülmüş listeyi HİÇ görmemeli.
  const disaDogru = Boolean(disa) && !/wallsFiltered/.test(disa);
  if (!topluDogru || !disaDogru) hata++;
  console.log(
    `${topluDogru && disaDogru ? "✓" : "✗"} ${etiket}: toplu uygulama SÜZÜLMÜŞ listeye, dışa aktarma TAM listeye bakıyor` +
      `${topluDogru ? "" : " — topluUygula süzgeci yok sayıyor"}${disaDogru ? "" : " — disaAktar süzgeçten etkileniyor"}`
  );
}

// AYRI "Görsel / Video" DÜĞMESİ GERİ GELMESİN (kullanıcı kararı, kütüphane
// yeniden kurulumunun 1. adımı): veri merkezi KÜTÜPHANE — almak isteyen oraya
// girer, yüklemek isteyen oradan yükler. İki kapı "yüklediğim nereye gitti?"
// karışıklığını doğuruyordu.
for (const yol of ["src/components/videowall/ZonePanel.tsx", "flowsign-selfhost/src/components/ZonePanel.tsx"]) {
  const k = oku(yol) ?? "";
  const geriGeldi = /label: "Görsel \/ Video"/.test(k);
  if (geriGeldi) hata++;
  console.log(`${geriGeldi ? "✗" : "✓"} ${yol.includes("selfhost") ? "self-host" : "online"}: ayrı Görsel/Video düğmesi YOK (tek kapı kütüphane)`);
}

// İkon seti: self-host, online'da kullanılan her ikonu tanımalı.
const online = oku("src/components/Icon.tsx") ?? "";
const self = oku("flowsign-selfhost/src/components/icons.tsx") ?? "";
const selfAdlar = new Set([...self.matchAll(/"([a-z0-9-]+)"/g)].map((m) => m[1]));
const signDosyalari = [
  "flowsign-selfhost/src/components/ZonePanel.tsx",
  "flowsign-selfhost/src/components/LayoutEditor.tsx",
  "flowsign-selfhost/src/components/ScreensCard.tsx",
  "flowsign-selfhost/src/components/Rehber.tsx",
  "flowsign-selfhost/src/components/RehberParcalari.tsx",
  "flowsign-selfhost/src/components/signRehberIcerik.tsx",
  "flowsign-selfhost/src/app/screens/page.tsx",
  "flowsign-selfhost/src/app/users/page.tsx",
  "flowsign-selfhost/src/app/settings/page.tsx",
];
const kullanilan = new Set();
for (const d of signDosyalari)
  for (const m of (oku(d) ?? "").matchAll(/(?:name|icon)=?[:{]?\s*"([a-z0-9-]+)"/g)) kullanilan.add(m[1]);
const eksikIkon = [...kullanilan].filter((i) => online.includes(`\n  ${i}: `) && !selfAdlar.has(i));
if (eksikIkon.length) hata++;
console.log(`${eksikIkon.length ? "✗" : "✓"} self-host ikon seti eksiksiz${eksikIkon.length ? ` — eksik: ${eksikIkon.join(", ")}` : ""}`);

console.log(hata ? `\n${hata} SINAV BAŞARISIZ — self-host paketi eksik ürün taşıyor` : "\nhepsi geçti");
process.exit(hata ? 1 : 0);
