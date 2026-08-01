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

/** Bir alanı hücrelere böl. İçerik/ayarlar İLK (sol-üst) hücrede kalır — kaybolmaz. */
export function splitZone(zones: Zone[], cols: number, rows: number, zoneId: string): Zone[] {
  const out: Zone[] = [];
  for (const z of zones) {
    if (z.id !== zoneId) {
      out.push(z);
      continue;
    }
    const cb = zoneCells(z, cols, rows);
    let first = true;
    for (let r = cb.r0; r <= cb.r1; r++)
      for (let c = cb.c0; c <= cb.c1; c++) {
        const u = unitZone(c, r, cols, rows);
        if (first) {
          u.items = z.items ?? [];
          if (z.name) u.name = z.name;
          if (z.transition) u.transition = z.transition;
          if (z.bg) u.bg = z.bg;
          first = false;
        }
        out.push(u);
      }
  }
  return out;
}

/** JSON'a `undefined` sızmasın — opsiyonel alan temizlerken düşür. */
export const stripUndefined = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
