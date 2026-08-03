/**
 * FlowSign self-host — SAF yerleşim/takvim fonksiyonları (ağ/dosya erişimi yok).
 * Online sürümdeki `videowalls.ts` ile birebir aynı mantık; ürün davranışı
 * değişirse iki dosya BİRLİKTE güncellenir.
 */
import { Zone, ZoneItem } from "./types";

/**
 * Öğe şu an takvimde mi? (gün + saat penceresi; boşsa hep). Gece yarısını aşan
 * pencere desteklenir (22:00–06:00). Perde OYNATIRKEN ve editör "takvim dışı"
 * rozetini gösterirken aynı fonksiyon kullanılır — asla ayrışmasınlar.
 */
export function itemInWindow(item: ZoneItem, now: Date): boolean {
  if (item.fromDate || item.toDate) {
    const ymd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    if (item.fromDate && ymd < item.fromDate) return false;
    if (item.toDate && ymd > item.toDate) return false;
  }
  if (item.days?.length && !item.days.includes(now.getDay())) return false;
  if (!item.from && !item.to) return true;
  const hm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const from = item.from || "00:00";
  const to = item.to || "23:59";
  if (from > to) return hm >= from || hm <= to;
  return hm >= from && hm <= to;
}

/**
 * Öğe takvimde değilse NEDEN değil? Üçü de "şu an görünmüyor" ama üçü de
 * farklı iş demek:
 *  - `doldu`      → bitiş tarihi geçmiş. ÖLÜ içerik; temizlenmeli.
 *  - `baslamadi`  → başlangıç tarihi gelmemiş. Bekleyen kampanya; dokunma.
 *  - `disinda`    → gün/saat penceresi dışında. Yarın sabah yine dönecek.
 *
 * Eskiden üçü de aynı "şu an takvim dışı" rozetini alıyordu; yıllar boyu
 * birikmiş afişleri ayıklarken hangisinin ölü olduğu belli olmuyordu.
 *
 * Tarih karşılaştırması `itemInWindow` ile AYNI kuralı kullanır — bitiş günü
 * DAHİLDİR (toDate === bugün ise içerik hâlâ döner).
 */
export type TakvimDurumu = "icinde" | "doldu" | "baslamadi" | "disinda";

export function itemTakvimDurumu(item: ZoneItem, now: Date): TakvimDurumu {
  if (itemInWindow(item, now)) return "icinde";
  const ymd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  if (item.toDate && ymd > item.toDate) return "doldu";
  if (item.fromDate && ymd < item.fromDate) return "baslamadi";
  return "disinda";
}

const zid = () => `z-${Math.random().toString(36).slice(2, 8)}`;

/** İnsan-dostu URL parçası: "Giriş Holü" → "giris-holu" (Türkçe karakter map). */
export function slugify(s: string): string {
  const map: Record<string, string> = { ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u", İ: "i", Ç: "c", Ğ: "g", Ö: "o", Ş: "s", Ü: "u" };
  return (
    s
      .replace(/[çğıöşüİÇĞÖŞÜ]/g, (m) => map[m] || m)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "duvar"
  );
}

/** Bir alanın kapladığı hücre kutusu (ızgara koordinatı, dahil). */
export interface CellBox {
  c0: number;
  r0: number;
  c1: number;
  r1: number;
}

/** Oransal alandan hücre kutusunu geri çöz (alanlar hep hücreye hizalı). */
export function zoneCells(z: Zone, cols: number, rows: number): CellBox {
  return {
    c0: Math.round(z.x * cols),
    r0: Math.round(z.y * rows),
    c1: Math.round((z.x + z.w) * cols) - 1,
    r1: Math.round((z.y + z.h) * rows) - 1,
  };
}

/** Hücre kutusundan oransal (0–1) dikdörtgen. */
function rectFromCells(b: CellBox, cols: number, rows: number) {
  return {
    x: b.c0 / cols,
    y: b.r0 / rows,
    w: (b.c1 - b.c0 + 1) / cols,
    h: (b.r1 - b.r0 + 1) / rows,
  };
}

/** Tek hücrelik alan. */
function unitZone(c: number, r: number, cols: number, rows: number): Zone {
  return { id: zid(), ...rectFromCells({ c0: c, r0: r, c1: c, r1: r }, cols, rows), items: [] };
}

/** Alan zemini VARSAYILANI — Flow lacivert (siyah yerine marka rengi;
 *  kullanıcı kararı). Alanın kendi `bg`si varsa o kazanır. */
export const ZONE_BG_DEFAULT = "#001e64";

/** Ekran sayısı üst sınırı — devasa ızgara tarayıcıyı patlatır. */
export const MAX_SCREENS_PER_AXIS = 24;
export const clampScreens = (n: number) => Math.min(MAX_SCREENS_PER_AXIS, Math.max(1, Math.round(n) || 1));

/**
 * YERLEŞİM ızgarası — fiziksel ekran ızgarasından bağımsız (yoksa ona eşit).
 * Hücre matematiğinin tamamı BU sayıları kullanır; fiziksel cols/rows yalnız
 * editördeki çerçeve (bezel) çizgilerini ve perdedeki "Ekranları tanı"yı çizer.
 */
/**
 * YERLEŞİM ızgarası üst sınırı — fiziksel ekran sınırından AYRI ve daha yüksek.
 *
 * Neden ayrı: bölme ızgarayı KATLIYOR (3 ekranlık duvarda iki bölme 36'ya
 * çıkarabiliyor), oysa yerleşim ızgarası yalnızca iki tam sayı — tarayıcıyı
 * yoran şey alan sayısı, ızgaranın büyüklüğü değil.
 *
 * Eskiden okuma clampScreens (24) ile kırpılıyor, splitZoneInto 96'ya kadar
 * izin veriyor, yazan taraf da kırpmadan yazıyordu. Sonuç: 24'ü aşan yerleşim
 * diske DOĞRU yazılıyor ama geri okunurken küçülüyor; zoneCells alanları
 * yanlış ızgarada hücreye çeviriyor ve kullanıcının hiç dokunmadığı alanlar
 * kendiliğinden kayıyordu. Üç yer artık TEK sayıya bakıyor.
 */
export const MAX_LAYOUT_AXIS = 96;
export const clampLayout = (n: number) => Math.min(MAX_LAYOUT_AXIS, Math.max(1, Math.round(n) || 1));

export const layoutColsOf = (v: { cols: number; layoutCols?: number }) => clampLayout(v.layoutCols ?? v.cols);
export const layoutRowsOf = (v: { rows: number; layoutRows?: number }) => clampLayout(v.layoutRows ?? v.rows);
export const hasCustomLayout = (v: { layoutCols?: number; layoutRows?: number }) =>
  v.layoutCols != null || v.layoutRows != null;

/** cols×rows tam ızgara (başlangıç yerleşimi; kullanıcı böler/birleştirir). */
export function gridZones(cols: number, rows: number): Zone[] {
  const zones: Zone[] = [];
  const cc = clampScreens(cols);
  const rr = clampScreens(rows);
  for (let r = 0; r < rr; r++) for (let c = 0; c < cc; c++) zones.push(unitZone(c, r, cc, rr));
  return zones;
}

function overlaps(a: CellBox, b: CellBox): boolean {
  return a.c0 <= b.c1 && a.c1 >= b.c0 && a.r0 <= b.r1 && a.r1 >= b.r0;
}

/**
 * Sürükleme kutusunu TAM ALAN SINIRLARINA genişlet.
 *
 * Sürükle-birleştir, kutunun kestiği alanın dışında kalan kısmını tek tek
 * hücrelere parçalıyordu (mergeCells → leftovers): kullanıcı birleştirmek
 * isterken farkında olmadan BÖLME yapıyor, o alanların içeriği siliniyordu.
 * Kullanıcı kararı: "birleştirme sürükle-bırakla olsun, bölme yalnız alanın
 * kendi panelinden". Bu yüzden kutu, dokunduğu her alanı TAMAMEN içine alacak
 * şekilde büyütülür — kısmi kesişme kalmaz, dolayısıyla parçalanma da olmaz.
 *
 * Büyüme yeni alanlara değebileceği için sabit noktaya kadar tekrarlanır.
 */
export function snapBoxToZones(zones: Zone[], cols: number, rows: number, box: CellBox): CellBox {
  const b: CellBox = { ...box };
  for (let guard = 0; guard < 12; guard++) {
    let grew = false;
    for (const z of zones) {
      const cb = zoneCells(z, cols, rows);
      if (!overlaps(cb, b)) continue;
      if (cb.c0 < b.c0) { b.c0 = cb.c0; grew = true; }
      if (cb.c1 > b.c1) { b.c1 = cb.c1; grew = true; }
      if (cb.r0 < b.r0) { b.r0 = cb.r0; grew = true; }
      if (cb.r1 > b.r1) { b.r1 = cb.r1; grew = true; }
    }
    if (!grew) break;
  }
  return b;
}

/**
 * Kutuyla kesişen İÇERİKLİ alanlar, büyükten küçüğe. [0] = birleşmede içeriğini
 * devralacak "bağışçı" alan (LayoutEditor onay mesajı da aynı sırayı kullanır).
 */
export function contentZonesIn(zones: Zone[], cols: number, rows: number, box: CellBox): Zone[] {
  return zones
    .filter((z) => (z.items?.length ?? 0) > 0 && overlaps(zoneCells(z, cols, rows), box))
    .sort((a, b) => b.w * b.h - a.w * a.h);
}

/**
 * Hücre kutusunu tek alana birleştir. Kutuyla kesişen alanlar sökülür; kutunun
 * DIŞINDA kalan hücreleri tekrar tek-hücre alanlara döner. Yeni alan, kesişen
 * EN BÜYÜK içerikli alanın içeriğini/ayarlarını DEVRALIR (içerik kaybolmaz).
 */
export function mergeCells(zones: Zone[], cols: number, rows: number, box: CellBox): Zone[] {
  const kept: Zone[] = [];
  const leftovers: Zone[] = [];
  for (const z of zones) {
    const cb = zoneCells(z, cols, rows);
    if (!overlaps(cb, box)) {
      kept.push(z);
      continue;
    }
    for (let r = cb.r0; r <= cb.r1; r++)
      for (let c = cb.c0; c <= cb.c1; c++)
        if (c < box.c0 || c > box.c1 || r < box.r0 || r > box.r1) leftovers.push(unitZone(c, r, cols, rows));
  }
  const donor = contentZonesIn(zones, cols, rows, box)[0];
  const merged: Zone = { id: zid(), ...rectFromCells(box, cols, rows), items: donor?.items ?? [] };
  if (donor?.name) merged.name = donor.name;
  if (donor?.transition) merged.transition = donor.transition;
  if (donor?.bg) merged.bg = donor.bg;
  return [...kept, ...leftovers, merged];
}

/**
 * ALANI PARÇALARA BÖL — "bu alanı 3'e böl" (yatay ⇄ / dikey ⇅).
 * Bölme alanın KENDİ panelindedir; kokpitte genel "yerleşim ızgarası" satırı
 * YOKTUR (kullanıcı kararı: çok ekranlı duvarda kafa karıştırıyordu).
 * Altta ızgara sessizce `parts` katına çıkar, diğer alanların hücre kutuları
 * aynı oranda ölçeklenir (oransal dikdörtgenler değişmez), sonra ızgara EBOB
 * ile sadeleşir. İçerik/ayarlar İLK parçada kalır.
 */
export interface SplitResult {
  zones: Zone[];
  cols: number;
  rows: number;
}

const gcd2 = (a: number, b: number): number => (b === 0 ? Math.abs(a) : gcd2(b, a % b));

export function normalizeGrid(zones: Zone[], cols: number, rows: number): SplitResult {
  const boxes = zones.map((z) => zoneCells(z, cols, rows));
  let gx = cols;
  let gy = rows;
  for (const b of boxes) {
    gx = gcd2(gcd2(gx, b.c0), b.c1 + 1);
    gy = gcd2(gcd2(gy, b.r0), b.r1 + 1);
  }
  if (gx <= 1 && gy <= 1) return { zones, cols, rows };
  const nc = Math.max(1, cols / Math.max(1, gx));
  const nr = Math.max(1, rows / Math.max(1, gy));
  const nz = zones.map((z, i) => ({
    ...z,
    ...rectFromCells(
      { c0: boxes[i].c0 / gx, c1: (boxes[i].c1 + 1) / gx - 1, r0: boxes[i].r0 / gy, r1: (boxes[i].r1 + 1) / gy - 1 },
      nc,
      nr
    ),
  }));
  return { zones: nz, cols: nc, rows: nr };
}

/**
 * KENAR ÇEKME — iki komşu alanın PAYLAŞTIĞI sınırı kaydırır.
 *
 * Neden gerekiyordu: editörde alanlar yalnız EŞİT parçalara bölünebiliyordu
 * (2/3/4), sürükleme ise taşımıyor birleştiriyordu. 70/30 gibi bir yerleşim
 * doğrudan kurulamıyor, "4'e böl, 3'ünü birleştir" gibi dolambaçlı yol
 * gerekiyordu. (docs/VIDEOWALL.md bunu zaten vaat ediyordu; kod yapmıyordu.)
 *
 * ÇÖZÜNÜRLÜK: hücre ızgarası kaba olduğunda (3 sütun = %33'lük adımlar) çekme
 * işe yaramaz. Bu yüzden çekmeden önce ilgili eksen, en az ~24 adım verecek
 * kadar ÖLÇEKLENİR — bölmenin yaptığı işin aynısı. Sonda `normalizeGrid` EBOB
 * ile sadeleştirdiği için ızgara şişmiş kalmaz.
 *
 * GÜVENLİK: sınır "temiz" değilse (bir alan sınırın üstüne BİNİYORSA) işlem
 * yapılmaz, `null` döner. Yarısı kayan bir yerleşim üretmektense hiç
 * kıpırdamamak doğrusu — kullanıcı ne olduğunu anlamayacağı bir bozulmayla
 * baş başa kalmasın.
 */
export function resizeZoneEdge(
  zones: Zone[],
  cols: number,
  rows: number,
  zoneId: string,
  edge: "l" | "r" | "t" | "b",
  oran: number
): SplitResult | null {
  const dikey = edge === "l" || edge === "r"; // dikey sınır = sütun kaydırılır
  const eksen = dikey ? cols : rows;
  // En az ~24 adım: 3 sütunlu duvarda %33'lük sıçrama çekmeyi işe yaramaz kılar.
  const k = Math.max(1, Math.ceil(24 / eksen));
  const nc = dikey ? cols * k : cols;
  const nr = dikey ? rows : rows * k;
  if (nc > MAX_LAYOUT_AXIS || nr > MAX_LAYOUT_AXIS) return null;

  const kutular = new Map<string, CellBox>();
  for (const z of zones) {
    const b = zoneCells(z, cols, rows);
    kutular.set(
      z.id,
      dikey
        ? { c0: b.c0 * k, c1: (b.c1 + 1) * k - 1, r0: b.r0, r1: b.r1 }
        : { c0: b.c0, c1: b.c1, r0: b.r0 * k, r1: (b.r1 + 1) * k - 1 }
    );
  }
  const hedefKutu = kutular.get(zoneId);
  if (!hedefKutu) return null;

  // Sınır çizgisi: kaydırılacak hücre indeksi (sol/üst tarafın bittiği yer + 1)
  const sinir = dikey
    ? edge === "r" ? hedefKutu.c1 + 1 : hedefKutu.c0
    : edge === "b" ? hedefKutu.r1 + 1 : hedefKutu.r0;
  const uzunluk = dikey ? nc : nr;
  if (sinir <= 0 || sinir >= uzunluk) return null; // duvarın dış kenarı çekilemez

  const dilimBas = (b: CellBox) => (dikey ? b.c0 : b.r0);
  const dilimSon = (b: CellBox) => (dikey ? b.c1 : b.r1);
  const diklemeKesisir = (a: CellBox, b: CellBox) =>
    dikey ? a.r0 <= b.r1 && b.r0 <= a.r1 : a.c0 <= b.c1 && b.c0 <= a.c1;

  // Sınırın iki yakasındaki alan kümeleri — kapanış alınana kadar genişletilir.
  const once = new Set<string>();
  const sonra = new Set<string>();
  (dilimSon(hedefKutu) === sinir - 1 ? once : sonra).add(zoneId);
  for (let tur = 0; tur < zones.length + 2; tur++) {
    const oncekiBoy = once.size + sonra.size;
    for (const z of zones) {
      const b = kutular.get(z.id)!;
      const komsuVar = (kume: Set<string>) =>
        [...kume].some((id) => diklemeKesisir(b, kutular.get(id)!));
      if (dilimSon(b) === sinir - 1 && komsuVar(sonra)) once.add(z.id);
      if (dilimBas(b) === sinir && komsuVar(once)) sonra.add(z.id);
    }
    if (once.size + sonra.size === oncekiBoy) break;
  }
  if (!sonra.size || !once.size) return null; // tek yaka: kaydıracak sınır yok

  // TEMİZLİK: sınıra BİNEN bir alan varsa dokunma.
  for (const z of zones) {
    const b = kutular.get(z.id)!;
    const biniyor = dilimBas(b) < sinir && dilimSon(b) >= sinir;
    if (!biniyor) continue;
    const ilgili = [...once, ...sonra].some((id) => diklemeKesisir(b, kutular.get(id)!));
    if (ilgili) return null;
  }

  const yeniSinir = Math.max(1, Math.min(uzunluk - 1, Math.round(oran * uzunluk)));
  if (yeniSinir === sinir) return null;
  // Hiçbir alan sıfır/negatif genişliğe düşmesin.
  for (const id of once) if (yeniSinir - 1 < dilimBas(kutular.get(id)!)) return null;
  for (const id of sonra) if (yeniSinir > dilimSon(kutular.get(id)!)) return null;

  const cikti: Zone[] = zones.map((z) => {
    const b = { ...kutular.get(z.id)! };
    if (once.has(z.id)) dikey ? (b.c1 = yeniSinir - 1) : (b.r1 = yeniSinir - 1);
    if (sonra.has(z.id)) dikey ? (b.c0 = yeniSinir) : (b.r0 = yeniSinir);
    return { ...z, ...rectFromCells(b, nc, nr) };
  });
  return normalizeGrid(cikti, nc, nr);
}

/**
 * Adres İÇ AĞDA mı? (özel IP, .local, ya da noktasız makine adı)
 *
 * Neden gerekiyor: tabelaya iç ağdaki bir panoyu koymak bu üründe SIK bir
 * kullanım, ama tarayıcı tarafında sessiz bir tuzağı var. Sayfa herkese açık
 * HTTPS'te (vercel.app), gömülen adres ise özel ağda — Chrome bunu "yerel ağ
 * erişimi" izniyle kapatıyor ve İLK açılışta bir kez soruyor. Kullanıcı o
 * kutuyu kapatır/reddederse Chrome kararı hatırlıyor ve BİR DAHA SORMUYOR;
 * ekranda yalnız boş bir çerçeve kalıyor, hiçbir hata da görünmüyor.
 */
export function icAgAdresi(url: string): boolean {
  try {
    const h = new URL(url).hostname.toLowerCase();
    if (h === "localhost" || h.endsWith(".local") || !h.includes(".")) return true;
    if (/^127\./.test(h) || /^10\./.test(h) || /^192\.168\./.test(h) || /^169\.254\./.test(h)) return true;
    const m = /^172\.(\d+)\./.exec(h);
    return !!m && Number(m[1]) >= 16 && Number(m[1]) <= 31;
  } catch {
    return false;
  }
}

export function splitZoneInto(
  zones: Zone[],
  cols: number,
  rows: number,
  zoneId: string,
  parcaC: number,
  parcaR: number
): SplitResult | null {
  // İKİ EKSEN AYNI ANDA: eskiden imza (parts, axis) idi ve bölme tek yönde
  // yapılırdı. "3 yan yana + 2 alt alta" istendiğinde iki kez çağırmak işe
  // yaramıyordu: ilk bölmeden sonra içerik İLK parçada kalıyor, ikinci çağrı
  // da yalnız o ilk parçayı bölüyordu — ızgara değil, merdiven çıkıyordu.
  // Tek geçişte pc × pr parçaya bölmek doğru sonucu veriyor.
  const pc = Math.max(1, Math.min(8, Math.round(parcaC) || 1));
  const pr = Math.max(1, Math.min(8, Math.round(parcaR) || 1));
  if (pc === 1 && pr === 1) return null;
  const nc = cols * pc;
  const nr = rows * pr;
  if (nc > MAX_LAYOUT_AXIS || nr > MAX_LAYOUT_AXIS) return null;

  const scaled = (b: CellBox): CellBox => ({
    c0: b.c0 * pc,
    c1: (b.c1 + 1) * pc - 1,
    r0: b.r0 * pr,
    r1: (b.r1 + 1) * pr - 1,
  });

  const out: Zone[] = [];
  for (const z of zones) {
    const box = scaled(zoneCells(z, cols, rows));
    if (z.id !== zoneId) {
      out.push({ ...z, ...rectFromCells(box, nc, nr) });
      continue;
    }
    // Hedef alan: eşit parçalara ayrılır; içerik/ayarlar İLK parçada kalır.
    const spanC = (box.c1 - box.c0 + 1) / pc;
    const spanR = (box.r1 - box.r0 + 1) / pr;
    for (let j = 0; j < pr; j++) {
      for (let i = 0; i < pc; i++) {
        const piece: CellBox = {
          c0: box.c0 + i * spanC,
          c1: box.c0 + (i + 1) * spanC - 1,
          r0: box.r0 + j * spanR,
          r1: box.r0 + (j + 1) * spanR - 1,
        };
        const ilk = i === 0 && j === 0;
        const parca: Zone = { id: ilk ? z.id : zid(), ...rectFromCells(piece, nc, nr), items: [] };
        if (ilk) {
          parca.items = z.items ?? [];
          if (z.name) parca.name = z.name;
          if (z.transition) parca.transition = z.transition;
          if (z.bg) parca.bg = z.bg;
        }
        out.push(parca);
      }
    }
  }
  return normalizeGrid(out, nc, nr);
}

export const stripUndefined = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;


/**
 * Bu adres BİZİM bir ekranımıza mı işaret ediyor? (eski, URL olarak
 * yapıştırılmış gömme linkleri de yerel çizilsin diye — bkz. PlayerStage.)
 * Self-host yayın adresi: /play/<slug|id>.
 */
export function signAdresi(src?: string, origin?: string): { slug?: string; id?: string } | null {
  if (!src) return null;
  try {
    const u = new URL(src, origin ?? "http://yerel");
    if (origin && u.origin !== origin) return null;
    const m = u.pathname.match(/^\/play\/([^/]+)\/?$/);
    return m ? { slug: decodeURIComponent(m[1]) } : null;
  } catch {
    return null;
  }
}
