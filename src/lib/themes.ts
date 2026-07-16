/** Sunum başına görsel kimlik: hazır tema + opsiyonel arka plan görseli + logo. */
export interface PresentationTheme {
  preset?: string;
  /** Sıkıştırılmış data-URI (Firestore'da saklanır — dış servis yok) */
  bgImage?: string;
  /** Sıkıştırılmış data-URI logo */
  logo?: string;
}

export interface ThemePreset {
  id: string;
  name: string;
  /** CSS background değeri (degrade) */
  bg: string;
  /** Koyu zemin mi? (üstündeki serbest metinler beyaza döner) */
  dark: boolean;
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: "kagit",
    name: "Kâğıt",
    bg: "radial-gradient(56rem 30rem at 12% -8%, rgba(225,29,72,0.07), transparent 60%), radial-gradient(48rem 28rem at 96% 4%, rgba(37,99,235,0.07), transparent 55%), #fff7f6",
    dark: false,
  },
  {
    id: "gece",
    name: "Gece",
    bg: "radial-gradient(60rem 36rem at 80% -10%, rgba(37,99,235,0.25), transparent 55%), linear-gradient(160deg, #0f172a 0%, #1e2a4a 100%)",
    dark: true,
  },
  {
    id: "gul",
    name: "Gül",
    bg: "linear-gradient(150deg, #ffe4e6 0%, #fff7f6 45%, #ffd7dc 100%)",
    dark: false,
  },
  {
    id: "okyanus",
    name: "Okyanus",
    bg: "linear-gradient(160deg, #0e7490 0%, #155e9e 60%, #1e3a8a 100%)",
    dark: true,
  },
  {
    id: "gunbatimi",
    name: "Günbatımı",
    bg: "linear-gradient(150deg, #7c2d5e 0%, #c2410c 70%, #f59e0b 120%)",
    dark: true,
  },
  {
    id: "orman",
    name: "Orman",
    bg: "linear-gradient(160deg, #14532d 0%, #166534 55%, #3f6212 100%)",
    dark: true,
  },
  {
    id: "morsis",
    name: "Mor Sis",
    bg: "linear-gradient(150deg, #ede9fe 0%, #fdf4ff 50%, #e0e7ff 100%)",
    dark: false,
  },
  {
    id: "graf",
    name: "Grafit",
    bg: "radial-gradient(50rem 30rem at 15% -10%, rgba(255,255,255,0.06), transparent 60%), linear-gradient(160deg, #18181b 0%, #27272a 100%)",
    dark: true,
  },
];

export function getPreset(id?: string): ThemePreset {
  return THEME_PRESETS.find((t) => t.id === id) ?? THEME_PRESETS[0];
}

/** Tema + özel arka plan görselinden sayfa stilini ve koyu/açık bilgisini üretir. */
export function themeStyle(theme?: PresentationTheme): {
  style: React.CSSProperties;
  dark: boolean;
} {
  if (theme?.bgImage) {
    return {
      style: {
        backgroundImage: `linear-gradient(rgba(12,12,18,0.5), rgba(12,12,18,0.5)), url(${theme.bgImage})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      },
      dark: true,
    };
  }
  const preset = getPreset(theme?.preset);
  return { style: { background: preset.bg }, dark: preset.dark };
}
