"use client";

/**
 * FlowSign ikon seti (self-host) — ONLINE ÜRÜNLE BİREBİR AYNI çizimler.
 * Buradaki set eskiden ayrı çizilmişti ve daha ince/karışıktı; aynı ürünün iki
 * dağıtımı farklı görünmesin diye `src/components/Icon.tsx` glifleri buraya
 * taşındı. Optik kalınlık kuralı da geldi: küçük boyda daha KALIN çizgi
 * (aşağıdaki strokeFor) — 13-16px'te ince çizgi bulanıklaşıyordu.
 * Dolu (silüet) çizilenler FILLED içinde; dekoratif emojiler içerikte kalabilir.
 */
import { JSX } from "react";

export type IconName =
  | "eye"
  | "save"
  | "trash"
  | "copy"
  | "grip"
  | "expand"
  | "grid"
  | "close"
  | "split"
  | "up"
  | "down"
  | "swap"
  | "help"
  | "undo"
  | "play"
  | "link"
  | "settings"
  | "remote"
  | "shield"
  | "pencil"
  | "refresh"
  | "users"
  | "plus";



/**
 * Optik kalınlık: küçük ikon daha KALIN çizgi ister — 13-16px'te 1.8-2px çizgi
 * bulanıklaşıp "ince ve anlaşılmaz" görünüyordu (kullanıcı geri bildirimi).
 */
function strokeFor(size: number): number {
  if (size <= 13) return 2.6;
  if (size <= 16) return 2.4;
  if (size <= 20) return 2.2;
  if (size <= 28) return 2;
  return 1.8;
}

/** Dolu (silüet) çizilenler — küçük boyda kontur kaybolmasın. */
const FILLED: Partial<Record<IconName, true>> = { play: true, grip: true };

const PATHS: Record<IconName, JSX.Element> = {
  eye: (
    <>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="3.2" />
    </>
  ),
  save: (
    <>
      <path d="M5 4h11l4 4v12H5V4Z" />
      <path d="M9 4v5h6M8 20v-6h8v6" />
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
  expand: <path d="M9 3.5H5.5A2 2 0 0 0 3.5 5.5V9m17 0V5.5a2 2 0 0 0-2-2H15m0 17h3.5a2 2 0 0 0 2-2V15m-17 0v3.5a2 2 0 0 0 2 2H9" />,
  grid: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="2.5" />
      <path d="M3.5 12h17M12 3.5v17" />
    </>
  ),
  close: <path d="M18 6 6 18M6 6l12 12" />,
  split: (
    <>
      <rect x="3" y="4" width="7.5" height="16" rx="2" />
      <rect x="13.5" y="4" width="7.5" height="6.5" rx="2" />
      <rect x="13.5" y="13.5" width="7.5" height="6.5" rx="2" />
    </>
  ),
  up: <path d="m18.5 15.5-6.5-6.5-6.5 6.5" />,
  down: <path d="m5.5 8.5 6.5 6.5 6.5-6.5" />,
  swap: (
    <>
      <path d="M4 8.5h15M15.5 5l3.5 3.5-3.5 3.5" />
      <path d="M20 15.5H5M8.5 12 5 15.5 8.5 19" />
    </>
  ),
  help: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.2 9.3A3 3 0 0 1 15 10c0 2-3 2.6-3 4" />
      <path d="M12 17.5h.01" />
    </>
  ),
  undo: (
    <>
      <path d="M4 8v5.5h5.5" />
      <path d="M4.5 13a8 8 0 1 1 2.6 6" />
    </>
  ),
  play: <path d="M7 4.5 20 12 7 19.5V4.5Z" />,
  link: (
    <>
      <path d="M9.5 17H7.5a5 5 0 0 1 0-10h2" />
      <path d="M14.5 7h2a5 5 0 0 1 0 10h-2" />
      <path d="M8.5 12h7" />
    </>
  ),
  settings: (
    <>
      <path d="M4 7h6M14 7h6M4 17h10M18 17h2" />
      <circle cx="12" cy="7" r="2.5" />
      <circle cx="16" cy="17" r="2.5" />
    </>
  ),
  remote: (
    <>
      <rect x="7.5" y="2.5" width="9" height="19" rx="3" />
      <circle cx="12" cy="7" r="1.15" fill="currentColor" stroke="none" />
      <path d="M9.8 12h4.4M9.8 16h4.4" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3 20 6v6c0 4.4-3.2 8-8 9.5C7.2 20 4 16.4 4 12V6l8-3Z" />
      <path d="m8.8 12 2.4 2.4 4.4-4.6" />
    </>
  ),
  pencil: (
    <>
      <path d="M16 3.5 20.5 8 9 19.5l-5 1.5 1.5-5L16 3.5Z" />
      <path d="m14 5.5 4.5 4.5" />
    </>
  ),
  refresh: (
    <>
      <path d="M20 12a8 8 0 1 1-2.4-5.7" />
      <path d="M20 3.5V9h-5.5" />
    </>
  ),
  users: (
    <>
      <circle cx="9.5" cy="8" r="3.7" />
      <path d="M2.8 20a6.7 6.7 0 0 1 13.4 0" />
      <path d="M16.5 5.2a3.5 3.5 0 0 1 0 6.4M18 14.6A6 6 0 0 1 21.2 20" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
};

export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const filled = FILLED[name];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={filled ? 0 : strokeFor(size)}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="shrink-0"
    >
      {PATHS[name]}
    </svg>
  );
}
