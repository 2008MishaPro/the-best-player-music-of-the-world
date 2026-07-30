export type ThemeMode = "dark" | "light";

export type ThemeSeed = {
  mode: ThemeMode;
  background: string;
  surface: string;
  accent: string;
  text: string;
};

export type ThemeColors = {
  bg: string;
  panel: string;
  panel2: string;
  panel3: string;
  border: string;
  muted: string;
  text: string;
  accent: string;
  accentDark: string;
  accentHover: string;
  accentContrast: string;
  canvasGrid: string;
  waveformIdle: string;
  visualizerLow: string;
  visualizerHigh: string;
  danger: string;
  green: string;
};

export type AppTheme = {
  id: string;
  name: string;
  isBuiltin: boolean;
  seed: ThemeSeed;
  colors: ThemeColors;
};

export type ThemePreferences = {
  activeThemeId: string;
  customThemes: AppTheme[];
};
