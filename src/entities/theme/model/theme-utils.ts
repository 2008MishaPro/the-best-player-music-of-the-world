import type { AppTheme, ThemeColors, ThemeSeed } from "./types.ts";

export const DEFAULT_THEME_ID = "builtin-resonance";
const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const BACKGROUND_IMAGE = /^data:image\/(?:png|jpeg|webp|avif|gif);base64,[a-z0-9+/=]+$/i;
const MAX_BACKGROUND_IMAGE_LENGTH = 14_000_000;

const normalizeHex = (value: string) =>
  HEX_COLOR.test(value) ? value.toLowerCase() : "#000000";

const channels = (color: string) => {
  const value = normalizeHex(color).slice(1);
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
  ];
};

const toHex = (values: number[]) =>
  `#${values.map((value) =>
    Math.min(255, Math.max(0, Math.round(value))).toString(16).padStart(2, "0")).join("")}`;

const mix = (first: string, second: string, secondWeight: number) => {
  const a = channels(first);
  const b = channels(second);
  return toHex(a.map((value, index) => value + (b[index] - value) * secondWeight));
};

const linearChannel = (value: number) => {
  const normalized = value / 255;
  return normalized <= 0.04045
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
};

const luminance = (color: string) => {
  const [red, green, blue] = channels(color).map(linearChannel);
  return red * 0.2126 + green * 0.7152 + blue * 0.0722;
};

const contrastRatio = (first: string, second: string) => {
  const light = Math.max(luminance(first), luminance(second));
  const dark = Math.min(luminance(first), luminance(second));
  return (light + 0.05) / (dark + 0.05);
};

const contrastText = (background: string) => {
  const dark = "#0a0c10";
  const light = "#ffffff";
  return contrastRatio(background, dark) >= contrastRatio(background, light) ? dark : light;
};

export const createTheme = (
  id: string,
  name: string,
  isBuiltin: boolean,
  source: ThemeSeed,
): AppTheme => {
  const seed: ThemeSeed = {
    mode: source.mode,
    background: normalizeHex(source.background),
    surface: normalizeHex(source.surface),
    accent: normalizeHex(source.accent),
    text: normalizeHex(source.text),
    backgroundImage: source.backgroundImage
      && source.backgroundImage.length <= MAX_BACKGROUND_IMAGE_LENGTH
      && BACKGROUND_IMAGE.test(source.backgroundImage)
      ? source.backgroundImage
      : null,
  };
  const colors: ThemeColors = {
    bg: seed.background,
    panel: seed.surface,
    panel2: mix(seed.surface, seed.text, seed.mode === "dark" ? 0.035 : 0.025),
    panel3: mix(seed.surface, seed.text, seed.mode === "dark" ? 0.085 : 0.07),
    border: mix(seed.surface, seed.text, seed.mode === "dark" ? 0.14 : 0.16),
    muted: mix(seed.text, seed.background, seed.mode === "dark" ? 0.42 : 0.48),
    text: seed.text,
    accent: seed.accent,
    accentDark: mix(seed.accent, seed.background, seed.mode === "dark" ? 0.76 : 0.86),
    accentHover: mix(seed.accent, seed.text, seed.mode === "dark" ? 0.16 : 0.1),
    accentContrast: contrastText(seed.accent),
    canvasGrid: mix(seed.surface, seed.text, seed.mode === "dark" ? 0.1 : 0.13),
    waveformIdle: mix(seed.surface, seed.text, seed.mode === "dark" ? 0.25 : 0.3),
    visualizerLow: mix(seed.accent, seed.background, seed.mode === "dark" ? 0.38 : 0.18),
    visualizerHigh: mix(seed.accent, seed.text, seed.mode === "dark" ? 0.5 : 0.28),
    danger: seed.mode === "dark" ? "#e76565" : "#c93d4d",
    green: seed.mode === "dark" ? "#58a78a" : "#287b61",
  };
  return { id, name, isBuiltin, seed, colors };
};

export const BUILTIN_THEMES: AppTheme[] = [
  createTheme(DEFAULT_THEME_ID, "Resonance", true, {
    mode: "dark",
    background: "#0c0e12",
    surface: "#11141a",
    accent: "#f3b33d",
    text: "#f5f2ea",
  }),
  createTheme("builtin-midnight", "Полночь", true, {
    mode: "dark",
    background: "#080d18",
    surface: "#101827",
    accent: "#5b9cff",
    text: "#f2f6ff",
  }),
  createTheme("builtin-forest", "Хвоя", true, {
    mode: "dark",
    background: "#08110d",
    surface: "#101b16",
    accent: "#5fd39a",
    text: "#edf8f2",
  }),
  createTheme("builtin-ultraviolet", "Ультрафиолет", true, {
    mode: "dark",
    background: "#0e0a18",
    surface: "#181126",
    accent: "#a880ff",
    text: "#f7f1ff",
  }),
  createTheme("builtin-rose", "Ночной неон", true, {
    mode: "dark",
    background: "#140a0f",
    surface: "#201219",
    accent: "#ff6f91",
    text: "#fff1f5",
  }),
  createTheme("builtin-frost", "Северный свет", true, {
    mode: "light",
    background: "#edf2f6",
    surface: "#ffffff",
    accent: "#3278c8",
    text: "#17202b",
  }),
];

const CSS_VARIABLES: Record<keyof ThemeColors, string> = {
  bg: "--bg",
  panel: "--panel",
  panel2: "--panel-2",
  panel3: "--panel-3",
  border: "--border",
  muted: "--muted",
  text: "--text",
  accent: "--accent",
  accentDark: "--accent-dark",
  accentHover: "--accent-hover",
  accentContrast: "--accent-contrast",
  canvasGrid: "--canvas-grid",
  waveformIdle: "--waveform-idle",
  visualizerLow: "--visualizer-low",
  visualizerHigh: "--visualizer-high",
  danger: "--danger",
  green: "--green",
};

export const applyThemeToDocument = (theme: AppTheme, animate = true) => {
  const root = document.documentElement;
  if (animate) root.classList.add("theme-changing");
  for (const [key, variable] of Object.entries(CSS_VARIABLES)) {
    root.style.setProperty(variable, theme.colors[key as keyof ThemeColors]);
  }
  root.style.colorScheme = theme.seed.mode;
  root.style.setProperty(
    "--theme-background-image",
    theme.seed.backgroundImage ? `url("${theme.seed.backgroundImage}")` : "none",
  );
  root.dataset.theme = theme.id;
  root.dataset.themeMode = theme.seed.mode;
  if (animate) window.setTimeout(() => root.classList.remove("theme-changing"), 220);
};

export const isThemeSeed = (value: ThemeSeed) =>
  ["dark", "light"].includes(value.mode)
  && [value.background, value.surface, value.accent, value.text].every((color) =>
    HEX_COLOR.test(color))
  && (value.backgroundImage == null
    || (value.backgroundImage.length <= MAX_BACKGROUND_IMAGE_LENGTH
      && BACKGROUND_IMAGE.test(value.backgroundImage)));
