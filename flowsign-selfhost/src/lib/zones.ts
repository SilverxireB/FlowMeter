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
export const layoutColsOf = (v: { cols: number; layoutCols?: number }) => clampScreens(v.layoutCols ?? v.cols);
export const layoutRowsOf = (v: { rows: number; layoutRows?: number }) => clampScreens(v.layoutRows ?? v.rows);
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

function normalizeGrid(zones: Zone[], cols: number, rows: number): SplitResult {
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
  if (nc > MAX_SCREENS_PER_AXIS * 4 || nr > MAX_SCREENS_PER_AXIS * 4) return null;

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
