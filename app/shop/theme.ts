export type ShopThemeKey = "midnight" | "luminous" | "neon" | "custom";

export type ThemeStyles = {
  name: string;
  heroBackground: string;
  heroOverlay?: string;
  cardBackground: string;
  cardBorder: string;
  accent: string;
  accentSoft: string;
};

export type ThemePaletteJson = Partial<Omit<ThemeStyles, "name">> & {
  name?: string;
};

export const SHOP_THEMES: Record<ShopThemeKey, ThemeStyles> = {
  midnight: {
    name: "Midnight",
    heroBackground:
      "linear-gradient(135deg, #04141a 0%, #02070a 55%, #051b24 100%)",
    heroOverlay:
      "radial-gradient(circle at top, rgba(0,194,203,0.45), transparent 60%)",
    cardBackground: "rgba(255,255,255,0.04)",
    cardBorder: "rgba(255,255,255,0.1)",
    accent: "#00C2CB",
    accentSoft: "#7ff5fb",
  },
  luminous: {
    name: "Luminous",
    heroBackground: "linear-gradient(135deg, #fdfbfb 0%, #ebedee 100%)",
    heroOverlay:
      "radial-gradient(circle at top, rgba(0,0,0,0.05), transparent 60%)",
    cardBackground: "rgba(255,255,255,0.9)",
    cardBorder: "rgba(0,0,0,0.08)",
    accent: "#111827",
    accentSoft: "#4b5563",
  },
  neon: {
    name: "Muted Neon",
    heroBackground:
      "linear-gradient(135deg, #120c1f 0%, #1f0f2b 40%, #041a21 100%)",
    heroOverlay:
      "radial-gradient(circle at top, rgba(255,0,153,0.25), transparent 55%)",
    cardBackground: "rgba(18,15,30,0.8)",
    cardBorder: "rgba(255,255,255,0.08)",
    accent: "#ff3fb4",
    accentSoft: "#ff9cdc",
  },
  custom: {
    name: "Custom",
    heroBackground: "linear-gradient(135deg, #f4f4f5 0%, #e2e8f0 100%)",
    heroOverlay:
      "radial-gradient(circle at top, rgba(0,0,0,0.05), transparent 60%)",
    cardBackground: "rgba(255,255,255,0.95)",
    cardBorder: "rgba(15,23,42,0.08)",
    accent: "#0f172a",
    accentSoft: "#334155",
  },
};

export const DEFAULT_SHOP_THEME: ShopThemeKey = "midnight";

export function resolveTheme(
  theme: ShopThemeKey,
  custom?: ThemePaletteJson | null,
): ThemeStyles {
  if (theme === "custom" && custom) {
    const base = SHOP_THEMES.midnight;
    return {
      ...base,
      ...custom,
      name: custom.name || "Custom",
      heroBackground: custom.heroBackground || base.heroBackground,
      cardBackground: custom.cardBackground || base.cardBackground,
      cardBorder: custom.cardBorder || base.cardBorder,
      accent: custom.accent || base.accent,
      accentSoft: custom.accentSoft || base.accentSoft,
    };
  }
  return SHOP_THEMES[theme] || SHOP_THEMES.midnight;
}
