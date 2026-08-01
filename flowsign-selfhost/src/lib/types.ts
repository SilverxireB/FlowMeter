/**
 * FlowSign self-host — veri tipleri. Online (Firestore) sürümden tek fark:
 * zaman damgaları düz milisaniye sayısıdır (Timestamp nesnesi yok) ve
 * kullanıcı/owner alanları yoktur (tek yönetici parolası modeli).
 */

/** Bir yerleşim alanının içeriği (playlist öğesi). */
export interface ZoneItem {
  id: string;
  kind: "image" | "video" | "url" | "text" | "clock";
  src?: string; // image/video: yerel /media/... yolu; url: http(s) — iç ağ adresleri dahil
  name?: string;
  durationSec?: number; // image/url/text/clock için gösterim süresi; video kendi süresi (ya da cap)
  from?: string; // "HH:MM" saat aralığı başı (boşsa hep)
  to?: string; // "HH:MM" saat aralığı sonu
  days?: number[]; // haftanın günleri (0=Paz..6=Cmt); boş/yoksa her gün
  fromDate?: string; // "YYYY-MM-DD" kampanya başlangıcı (boşsa hep) — yerel tarih
  toDate?: string; // "YYYY-MM-DD" kampanya bitişi (o gün DAHİL)
  zoom?: number; // url öğesi: iframe yakınlaştırma yüzdesi (25–150; boşsa 100)
  // text öğesi:
  title?: string;
  text?: string;
  bg?: string; // arka plan rengi (hex); text/clock
  color?: string; // metin rengi (hex); text/clock
}

/** Oynatma modu: "auto" = tabela (kendiliğinden döner); "manual" = sunum (kumanda). */
export type VideowallPlayMode = "auto" | "manual";

/** Duvar üzerinde bir yerleşim alanı (konum 0–1 oran; duvar pikseline çarpılır). */
export interface Zone {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  name?: string;
  transition?: "fade" | "cut" | "slide";
  bg?: string;
  items: ZoneItem[];
}

/** Perde cihazının "canlıyım" kaydı. Perde ~2dk'da bir yazar; kokpit 5dk eşiğiyle çevrimiçi der. */
export interface ScreenBeat {
  id: string;
  ua?: string;
  vwPx?: number;
  vhPx?: number;
  startedAt?: number | null; // ms
  lastSeenAt?: number | null; // ms
}

/** Yayındaki (kaydedilmiş) yerleşim anlık görüntüsü — perde BUNU oynatır. */
export interface VideowallLive {
  zones: Zone[];
  cols: number;
  rows: number;
  width: number;
  height: number;
  publishedAt?: number | null; // ms
}

/** Video-wall tanımı. zones = TASLAK (editör); live = YAYIN. */
export interface Videowall {
  id: string;
  name: string;
  slug?: string; // yayın linki: /play/{slug} — ad değişince yenilenir
  slugHistory?: string[]; // eski sluglar — eski linkler kararmasın
  width: number;
  height: number;
  cols: number;
  rows: number;
  zones: Zone[];
  live?: VideowallLive;
  playMode?: VideowallPlayMode;
  createdAt: number | null; // ms
  updatedAt?: number | null; // ms
}
