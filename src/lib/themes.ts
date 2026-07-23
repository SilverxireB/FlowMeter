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

// ── FlowWall tema presetleri ─────────────────────────────────────────────────
// Renk temelli hazır görünümler (güzel renk isimleri). Yapı `ThemePreset` ile
// aynı. NOT: id'ler sabit tutuldu (mevcut duvarlar bozulmasın); yalnız isim/renk.

export const WALL_THEME_PRESETS: ThemePreset[] = [
  {
    id: "gece",
    name: "Gece Mavisi",
    bg: "linear-gradient(160deg, #05091c 0%, #0f1535 50%, #0a0e24 100%)",
    dark: true,
  },
  {
    id: "yilbasi", // (eski) → Zümrüt
    name: "Zümrüt",
    bg: "radial-gradient(58rem 34rem at 78% -10%, rgba(16,185,129,0.28), transparent 55%), linear-gradient(160deg, #04140f 0%, #06231a 55%, #041711 100%)",
    dark: true,
  },
  {
    id: "parti", // (eski) → Ametist
    name: "Ametist",
    bg: "radial-gradient(50rem 30rem at 20% -10%, rgba(168,85,247,0.3), transparent 55%), radial-gradient(40rem 25rem at 85% 110%, rgba(236,72,153,0.25), transparent 55%), linear-gradient(160deg, #1a0533 0%, #240b36 50%, #0f0720 100%)",
    dark: true,
  },
  {
    id: "mercan",
    name: "Mercan",
    bg: "radial-gradient(55rem 32rem at 80% -10%, rgba(251,113,133,0.3), transparent 55%), radial-gradient(45rem 28rem at 10% 110%, rgba(251,146,60,0.22), transparent 55%), linear-gradient(160deg, #2a0a12 0%, #34101a 50%, #1e070d 100%)",
    dark: true,
  },
  {
    id: "okyanus",
    name: "Okyanus",
    bg: "radial-gradient(58rem 32rem at 75% -8%, rgba(34,211,238,0.22), transparent 55%), linear-gradient(160deg, #04141c 0%, #06232e 55%, #04161d 100%)",
    dark: true,
  },
  {
    id: "antrasit",
    name: "Antrasit",
    bg: "linear-gradient(160deg, #111114 0%, #1b1b20 50%, #0d0d10 100%)",
    dark: true,
  },
  {
    id: "dugun", // (eski) → Şampanya
    name: "Şampanya",
    bg: "radial-gradient(50rem 30rem at 50% 0%, rgba(244,220,195,0.35), transparent 60%), linear-gradient(170deg, #fdf8f4 0%, #f5ece3 50%, #fef6ee 100%)",
    dark: false,
  },
  {
    id: "kurumsal", // (eski) → Sedef
    name: "Sedef",
    bg: "radial-gradient(55rem 30rem at 80% -10%, rgba(79,70,229,0.08), transparent 55%), linear-gradient(170deg, #ffffff 0%, #f8f9fc 50%, #f1f3f8 100%)",
    dark: false,
  },
];

export function getWallPreset(id?: string): ThemePreset {
  return WALL_THEME_PRESETS.find((t) => t.id === id) ?? WALL_THEME_PRESETS[0];
}

/**
 * Perde "banner" gösterimleri (anons + yarışma çağrısı) için temaya UYGUN renk.
 * gradient = dolgu (beyaz yazı her tonda okunur), accent = tek renk (kenar/başlık).
 */
export function wallBannerColors(preset?: string): { gradient: string; accent: string } {
  switch (getWallPreset(preset).id) {
    case "yilbasi": return { gradient: "linear-gradient(135deg,#059669,#10b981)", accent: "#10b981" }; // Zümrüt
    case "parti": return { gradient: "linear-gradient(135deg,#a855f7,#ec4899)", accent: "#c084fc" }; // Ametist
    case "mercan": return { gradient: "linear-gradient(135deg,#fb7185,#f97316)", accent: "#fb7185" };
    case "okyanus": return { gradient: "linear-gradient(135deg,#0891b2,#22d3ee)", accent: "#22d3ee" };
    case "antrasit": return { gradient: "linear-gradient(135deg,#4338ca,#6366f1)", accent: "#a5b4fc" };
    case "dugun": return { gradient: "linear-gradient(135deg,#b0895f,#d9a566)", accent: "#b0895f" }; // Şampanya
    case "kurumsal": return { gradient: "linear-gradient(135deg,#4f46e5,#6366f1)", accent: "#4f46e5" }; // Sedef
    default: return { gradient: "linear-gradient(135deg,#4f46e5,#7c3aed)", accent: "#7c93ff" }; // Gece
  }
}

/**
 * Duvar temasından sayfa stilini ve koyu/açık bilgisini üretir.
 * bgImage varsa karartmalı overlay uygular (fotoğraflar üzerinde okunurluk).
 */
export function wallThemeStyle(theme?: PresentationTheme): {
  style: React.CSSProperties;
  dark: boolean;
} {
  if (theme?.bgImage) {
    return {
      style: {
        backgroundImage: `linear-gradient(rgba(5,9,28,0.55), rgba(5,9,28,0.55)), url(${theme.bgImage})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      },
      dark: true,
    };
  }
  const preset = getWallPreset(theme?.preset);
  return { style: { background: preset.bg }, dark: preset.dark };
}
