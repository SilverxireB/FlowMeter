"use client";

/**
 * Flow Studio ÇEKİRDEK ikon seti — suite genelinde TEK kaynak (Meter, Wall,
 * Sign, Pulse aynı seti kullanır). `currentColor` (bulunduğu butonun rengini
 * alır), 24×24 kutu, `shrink-0` (dar başlıkta ezilmez).
 *
 * KURAL: işlevsel her glif buradan gelir — emoji YALNIZ içerik/dekor kalır
 * (kutlama 🎉, tepkiler ❤👑🔥, Pulse'ın yüz ölçeği 😀🙂😐 gibi anlamı emojinin
 * kendisi olan yerler). Emoji platformdan platforma farklı çizilir, renklidir
 * ve boyutu şaşar.
 *
 * ÇİZİM DİSİPLİNİ (küçük boyutta okunurluk):
 *  1. OPTİK KALINLIK — çizgi kalınlığı boyuta göre artar. Tek sabit kalınlıkla
 *     16px'lik ikon telefonda soluk/anlaşılmaz kalıyordu; küçük boy daha KALIN
 *     çizgi ister (aşağıdaki strokeFor).
 *  2. SADELİK — ikon başına en çok 3 parça; 24'lük ızgarada 3 birimden ince
 *     ayrıntı yok (dişli çarkın dişleri gibi şeyler 15px'te lekeye dönüşüyordu).
 *  3. TANIDIK SİLUET — ayrıntı yerine dış hat konuşur.
 */
export type IconName =
  // eylem
  | "plus"
  | "minus"
  | "pencil"
  | "trash"
  | "copy"
  | "save"
  | "download"
  | "upload"
  | "print"
  | "refresh"
  | "undo"
  | "swap"
  | "search"
  | "settings"
  | "remote"
  | "close"
  | "check"
  | "link"
  | "share"
  // medya / perde
  | "image"
  | "video"
  | "film"
  | "camera"
  | "gallery"
  | "play"
  | "stop"
  | "expand"
  | "grid"
  | "list"
  | "split"
  | "pin"
  | "palette"
  | "wand"
  | "ruler"
  | "clock"
  | "calendar"
  | "timer"
  | "folder"
  | "qr"
  // durum / iletişim
  | "chat"
  | "mail"
  | "megaphone"
  | "shield"
  | "lock"
  | "warning"
  | "help"
  | "eye"
  | "users"
  | "trophy"
  | "gift"
  | "chart"
  | "monitor"
  | "phone"
  | "book"
  | "receipt"
  | "sparkles"
  | "hourglass"
  | "hand"
  | "cloud"
  | "star"
  | "listOrdered"
  | "zap"
  | "hash"
  | "target"
  | "text"
  // yön
  | "up"
  | "down"
  | "chevronLeft"
  | "chevronRight"
  | "grip"
  | "dots";

/** Dolu (fill) çizilenler — siluetleri küçük boyutta en net okunanlar. */
const FILLED: Partial<Record<IconName, true>> = { play: true, stop: true, grip: true, dots: true, sparkles: true, star: true, zap: true };

const PATHS: Record<IconName, React.ReactNode> = {
  // ── eylem ──────────────────────────────────────────────────────────────
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  pencil: (
    <>
      <path d="M16 3.5 20.5 8 9 19.5l-5 1.5 1.5-5L16 3.5Z" />
      <path d="m14 5.5 4.5 4.5" />
    </>
  ),
  trash: (
    <>
      <path d="M4 7h16" />
      <path d="M9.5 7V4.5h5V7" />
      <path d="M6.5 7 7.5 20h9l1-13" />
    </>
  ),
  copy: (
    <>
      <rect x="9" y="9" width="11" height="11" rx="2.5" />
      <path d="M5 15H4.5A1.5 1.5 0 0 1 3 13.5V5.5A1.5 1.5 0 0 1 4.5 4h8A1.5 1.5 0 0 1 14 5.5V6" />
    </>
  ),
  save: (
    <>
      <path d="M5 4h11l4 4v12H5V4Z" />
      <path d="M9 4v5h6M8 20v-6h8v6" />
    </>
  ),
  download: (
    <>
      <path d="M12 4v10" />
      <path d="m7.5 10 4.5 4.5L16.5 10" />
      <path d="M5 19h14" />
    </>
  ),
  upload: (
    <>
      <path d="M12 20V10" />
      <path d="M7.5 14 12 9.5 16.5 14" />
      <path d="M5 5h14" />
    </>
  ),
  print: (
    <>
      <path d="M7.5 8V3.5h9V8" />
      <path d="M7.5 17.5H4.5A1.5 1.5 0 0 1 3 16V10a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6a1.5 1.5 0 0 1-1.5 1.5h-3" />
      <path d="M7.5 14h9v6.5h-9V14Z" />
    </>
  ),
  refresh: (
    <>
      <path d="M20 12a8 8 0 1 1-2.4-5.7" />
      <path d="M20 3.5V9h-5.5" />
    </>
  ),
  undo: (
    <>
      <path d="M4 8v5.5h5.5" />
      <path d="M4.5 13a8 8 0 1 1 2.6 6" />
    </>
  ),
  swap: (
    <>
      <path d="M4 8.5h15M15.5 5l3.5 3.5-3.5 3.5" />
      <path d="M20 15.5H5M8.5 12 5 15.5 8.5 19" />
    </>
  ),
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m20 20-4.7-4.7" />
    </>
  ),
  // Dişli çark 15px'te lekeye dönüşüyordu → "ayar sürgüleri" (net + tanıdık)
  // Sunum kumandası (presenter/klikır) — oyun kolu DEĞİL: ince dikey gövde,
  // üstte tek gösterge, altında ileri/geri tuşları.
  remote: (
    <>
      <rect x="7.5" y="2.5" width="9" height="19" rx="3" />
      <circle cx="12" cy="7" r="1.15" fill="currentColor" stroke="none" />
      <path d="M9.8 12h4.4M9.8 16h4.4" />
    </>
  ),
  settings: (
    <>
      <path d="M4 7h6M14 7h6M4 17h10M18 17h2" />
      <circle cx="12" cy="7" r="2.5" />
      <circle cx="16" cy="17" r="2.5" />
    </>
  ),
  close: <path d="M18 6 6 18M6 6l12 12" />,
  check: <path d="m4.5 12.5 5 5 10-11" />,
  link: (
    <>
      <path d="M9.5 17H7.5a5 5 0 0 1 0-10h2" />
      <path d="M14.5 7h2a5 5 0 0 1 0 10h-2" />
      <path d="M8.5 12h7" />
    </>
  ),
  share: (
    <>
      <circle cx="18" cy="5.5" r="2.8" />
      <circle cx="6" cy="12" r="2.8" />
      <circle cx="18" cy="18.5" r="2.8" />
      <path d="m8.6 13.4 6.8 3.7M15.4 6.9 8.6 10.6" />
    </>
  ),

  // ── medya / perde ──────────────────────────────────────────────────────
  image: (
    <>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
      <circle cx="9" cy="10" r="1.8" />
      <path d="m4.5 18 5-5 4.5 4.5L17 15l3.5 3.5" />
    </>
  ),
  video: (
    <>
      <rect x="2.5" y="6" width="13" height="12" rx="2.5" />
      <path d="m15.5 11 6-3.5v9l-6-3.5" />
    </>
  ),
  film: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2.5" />
      <path d="M8 4v16M16 4v16" />
    </>
  ),
  camera: (
    <>
      <path d="M3 9a2 2 0 0 1 2-2h2l1.5-2.5h7L17 7h2a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9Z" />
      <circle cx="12" cy="13" r="3.5" />
    </>
  ),
  gallery: (
    <>
      <rect x="8" y="3.5" width="12.5" height="12.5" rx="2.5" />
      <path d="M16 20.5H6A2.5 2.5 0 0 1 3.5 18V8" />
    </>
  ),
  play: <path d="M7 4.5 20 12 7 19.5V4.5Z" />,
  stop: <rect x="5.5" y="5.5" width="13" height="13" rx="2.5" />,
  expand: <path d="M9 3.5H5.5A2 2 0 0 0 3.5 5.5V9m17 0V5.5a2 2 0 0 0-2-2H15m0 17h3.5a2 2 0 0 0 2-2V15m-17 0v3.5a2 2 0 0 0 2 2H9" />,
  grid: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="2.5" />
      <path d="M3.5 12h17M12 3.5v17" />
    </>
  ),
  list: <path d="M4 6.5h16M4 12h16M4 17.5h16" />,
  split: (
    <>
      <rect x="3" y="4" width="7.5" height="16" rx="2" />
      <rect x="13.5" y="4" width="7.5" height="6.5" rx="2" />
      <rect x="13.5" y="13.5" width="7.5" height="6.5" rx="2" />
    </>
  ),
  pin: (
    <>
      <path d="M9 3.5h6l-1 6 3.5 3.5H6.5L10 9.5l-1-6Z" />
      <path d="M12 13v7.5" />
    </>
  ),
  palette: (
    <>
      <path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.2 0 2-.9 2-2 0-1.5-1-1.6-1-2.8 0-1 .8-1.7 1.8-1.7H16a4.5 4.5 0 0 0 4.5-4.5c0-3.5-3.8-6-8.5-6Z" />
      <circle cx="8" cy="11.5" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="11" cy="7.5" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="15.5" cy="8.5" r="1.3" fill="currentColor" stroke="none" />
    </>
  ),
  wand: (
    <>
      <path d="m4 20 9.5-9.5" />
      <path d="M17 3.5 18.4 7l3.6 1.4L18.4 9.8 17 13.5 15.6 9.8 12 8.4 15.6 7 17 3.5Z" />
    </>
  ),
  ruler: (
    <>
      <path d="M3.5 15.5 15.5 3.5l5 5-12 12-5-5Z" />
      <path d="m7.5 11.5 2 2M11 8l2 2" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7v5.2l3.2 2" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </>
  ),
  timer: (
    <>
      <circle cx="12" cy="13.5" r="7.5" />
      <path d="M12 9.5v4M9.5 2.5h5" />
    </>
  ),
  folder: <path d="M3.5 7.5a2 2 0 0 1 2-2h3.6l2.4 2.5h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2v-10.5Z" />,
  qr: (
    <>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
      <path d="M13.5 13.5h3v3h-3zM20.5 13.5v3M13.5 20.5h7" />
    </>
  ),

  // ── durum / iletişim ───────────────────────────────────────────────────
  chat: <path d="M20.5 11.8c0 4.3-3.8 7.7-8.5 7.7-1.1 0-2.2-.2-3.2-.6L3.5 20.5l1.6-4.4A7.4 7.4 0 0 1 3.5 11.8C3.5 7.5 7.3 4 12 4s8.5 3.5 8.5 7.8Z" />,
  mail: (
    <>
      <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
      <path d="m3.5 7.5 8.5 5.5 8.5-5.5" />
    </>
  ),
  megaphone: (
    <>
      <path d="M3.5 9.5H7L12 5v14l-5-4.5H3.5v-5Z" />
      <path d="M15.5 9.5a4 4 0 0 1 0 5M18.5 7a7.5 7.5 0 0 1 0 10" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3 20 6v6c0 4.4-3.2 8-8 9.5C7.2 20 4 16.4 4 12V6l8-3Z" />
      <path d="m8.8 12 2.4 2.4 4.4-4.6" />
    </>
  ),
  lock: (
    <>
      <rect x="4" y="10" width="16" height="10.5" rx="2.5" />
      <path d="M8 10V7.5a4 4 0 0 1 8 0V10" />
    </>
  ),
  warning: (
    <>
      <path d="M10.4 4.4 2.7 17.6a1.9 1.9 0 0 0 1.6 2.9h15.4a1.9 1.9 0 0 0 1.6-2.9L13.6 4.4a1.9 1.9 0 0 0-3.2 0Z" />
      <path d="M12 9.5v4.5M12 17.5h.01" />
    </>
  ),
  help: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.2 9.3A3 3 0 0 1 15 10c0 2-3 2.6-3 4" />
      <path d="M12 17.5h.01" />
    </>
  ),
  eye: (
    <>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="3.2" />
    </>
  ),
  users: (
    <>
      <circle cx="9.5" cy="8" r="3.7" />
      <path d="M2.8 20a6.7 6.7 0 0 1 13.4 0" />
      <path d="M16.5 5.2a3.5 3.5 0 0 1 0 6.4M18 14.6A6 6 0 0 1 21.2 20" />
    </>
  ),
  trophy: (
    <>
      <path d="M7 4h10v5.5a5 5 0 0 1-10 0V4Z" />
      <path d="M7 6.5H4.5v1A3 3 0 0 0 7 10.5M17 6.5h2.5v1a3 3 0 0 1-2.5 3" />
      <path d="M12 14.5V17M8 20.5h8l-.8-3.5H8.8L8 20.5Z" />
    </>
  ),
  gift: (
    <>
      <rect x="3.5" y="9" width="17" height="11.5" rx="2" />
      <path d="M3.5 13.5h17M12 9v11.5" />
      <path d="M12 9C10.6 5.8 9.2 4.5 7.8 4.5a2.2 2.2 0 0 0 0 4.5M12 9c1.4-3.2 2.8-4.5 4.2-4.5a2.2 2.2 0 0 1 0 4.5" />
    </>
  ),
  chart: (
    <>
      <path d="M4 3.5v15.5a1.5 1.5 0 0 0 1.5 1.5H20.5" />
      <path d="M8.5 16.5v-4.5M13 16.5v-9M17.5 16.5v-6" />
    </>
  ),
  monitor: (
    <>
      <rect x="2.5" y="4" width="19" height="12.5" rx="2.5" />
      <path d="M8.5 20.5h7M12 16.5v4" />
    </>
  ),
  phone: (
    <>
      <rect x="6" y="2.5" width="12" height="19" rx="3" />
      <path d="M10.5 18.5h3" />
    </>
  ),
  book: (
    <>
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5v-15Z" />
      <path d="M4 18a2.5 2.5 0 0 1 2.5-2.5H20" />
    </>
  ),
  receipt: (
    <>
      <path d="M5 3h14v18l-3-1.8-2.3 1.8-2.3-1.8L9 21l-2-1.8L5 21V3Z" />
      <path d="M9 8h6M9 12h6" />
    </>
  ),
  sparkles: (
    <>
      <path d="M11 3.5 12.8 8l4.5 1.8-4.5 1.7L11 16l-1.8-4.5L4.7 9.8 9.2 8 11 3.5Z" />
      <path d="m18 14.5 1 2.4 2.4 1-2.4 1-1 2.4-1-2.4-2.4-1 2.4-1 1-2.4Z" />
    </>
  ),
  hourglass: (
    <>
      <path d="M6 3h12M6 21h12" />
      <path d="M7.5 3v3.4c0 1 .5 2 1.3 2.6L12 12l3.2-3c.8-.6 1.3-1.6 1.3-2.6V3" />
      <path d="M7.5 21v-3.4c0-1 .5-2 1.3-2.6L12 12l3.2 3c.8.6 1.3 1.6 1.3 2.6V21" />
    </>
  ),
  hand: (
    <>
      <path d="M9 11V4.5a1.8 1.8 0 0 1 3.5 0V11" />
      <path d="M12.5 11V6a1.8 1.8 0 0 1 3.5 0v5" />
      <path d="M16 11V8a1.8 1.8 0 0 1 3.5 0v6.5a6.5 6.5 0 0 1-6.5 6.5h-1a6 6 0 0 1-4.6-2.2L4 14.2a1.8 1.8 0 0 1 2.7-2.3L9 14" />
    </>
  ),

  cloud: <path d="M7 18.5h10a4.2 4.2 0 0 0 .6-8.4A6 6 0 0 0 6.2 11 3.8 3.8 0 0 0 7 18.5Z" />,
  star: <path d="m12 3.5 2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 10l6.1-.9L12 3.5Z" />,
  listOrdered: (
    <>
      <path d="M9.5 6.5h11M9.5 12h11M9.5 17.5h11" />
      <path d="M4 5.5 5.5 5v4M3.5 14.5h3v3h-3v-3" />
    </>
  ),
  zap: <path d="M13.5 2.5 4.5 13.5h6l-1 8 9-11h-6l1-8Z" />,
  hash: <path d="M5.5 9h13M5 15h13M10.5 4l-1.5 16M16 4l-1.5 16" />,
  target: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  text: <path d="M5 5h14M5 5v2M19 5v2M12 5v14M9 19h6" />,

  // ── yön ────────────────────────────────────────────────────────────────
  up: <path d="m18.5 15.5-6.5-6.5-6.5 6.5" />,
  down: <path d="m5.5 8.5 6.5 6.5 6.5-6.5" />,
  chevronLeft: <path d="m15.5 5.5-6.5 6.5 6.5 6.5" />,
  chevronRight: <path d="m8.5 5.5 6.5 6.5-6.5 6.5" />,
  grip: (
    <>
      <circle cx="9" cy="6" r="1.7" />
      <circle cx="15" cy="6" r="1.7" />
      <circle cx="9" cy="12" r="1.7" />
      <circle cx="15" cy="12" r="1.7" />
      <circle cx="9" cy="18" r="1.7" />
      <circle cx="15" cy="18" r="1.7" />
    </>
  ),
  dots: (
    <>
      <circle cx="5" cy="12" r="1.7" />
      <circle cx="12" cy="12" r="1.7" />
      <circle cx="19" cy="12" r="1.7" />
    </>
  ),
};

/**
 * OPTİK KALINLIK: küçük ikon daha KALIN çizgi ister. 24'lük ızgara 16px'e
 * küçülünce 1.8'lik çizgi ekranda ~1.2px'e iner ve soluklaşır — telefonda
 * "ince ve anlaşılmaz" görünmesinin sebebi buydu.
 */
function strokeFor(size: number): number {
  if (size <= 13) return 2.6;
  if (size <= 16) return 2.4;
  if (size <= 20) return 2.2;
  if (size <= 28) return 2;
  return 1.8;
}

export function Icon({ name, size = 18, className = "" }: { name: IconName; size?: number; className?: string }) {
  const filled = FILLED[name];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke={filled ? "none" : "currentColor"}
      strokeWidth={strokeFor(size)}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={`shrink-0 ${className}`}
    >
      {PATHS[name]}
    </svg>
  );
}

export default Icon;
