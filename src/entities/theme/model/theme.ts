import { action, atom, computed } from "@reatom/core";
import { themeApi } from "../api/theme.ts";
import {
  applyThemeToDocument,
  BUILTIN_THEMES,
  createTheme,
  DEFAULT_THEME_ID,
  isThemeSeed,
} from "./theme-utils.ts";
import type { AppTheme, ThemePreferences, ThemeSeed } from "./types.ts";

const DEFAULT_PREFERENCES: ThemePreferences = {
  activeThemeId: DEFAULT_THEME_ID,
  customThemes: [],
};

const parsePreferences = (value: unknown): ThemePreferences => {
  if (!value || typeof value !== "object") return DEFAULT_PREFERENCES;
  const candidate = value as Partial<ThemePreferences>;
  const customThemes = Array.isArray(candidate.customThemes)
    ? candidate.customThemes.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const theme = item as Partial<AppTheme>;
      if (
        typeof theme.id !== "string"
        || !theme.id.startsWith("custom-")
        || typeof theme.name !== "string"
        || !theme.name.trim()
        || theme.name.length > 32
        || !theme.seed
        || !isThemeSeed(theme.seed)
      ) return [];
      return [createTheme(theme.id, theme.name.trim(), false, theme.seed)];
    }).slice(0, 20)
    : [];
  const allIds = new Set([...BUILTIN_THEMES.map((theme) => theme.id), ...customThemes.map((theme) => theme.id)]);
  const activeThemeId = typeof candidate.activeThemeId === "string"
    && allIds.has(candidate.activeThemeId)
    ? candidate.activeThemeId
    : DEFAULT_THEME_ID;
  return { activeThemeId, customThemes };
};

export const themePreferencesAtom = atom<ThemePreferences>(
  DEFAULT_PREFERENCES,
  "themePreferencesAtom",
);
export const themeLoadingAtom = atom(false, "themeLoadingAtom");
export const themeErrorAtom = atom<string | null>(null, "themeErrorAtom");
export const displayedThemeAtom = atom<AppTheme>(BUILTIN_THEMES[0], "displayedThemeAtom");
export const themesAtom = computed(
  () => [...BUILTIN_THEMES, ...themePreferencesAtom().customThemes],
  "themesAtom",
);
export const activeThemeAtom = computed(
  () => themesAtom().find((theme) => theme.id === themePreferencesAtom().activeThemeId)
    ?? BUILTIN_THEMES[0],
  "activeThemeAtom",
);

const applyDisplayedTheme = (theme: AppTheme, animate = true) => {
  displayedThemeAtom.set(theme);
  applyThemeToDocument(theme, animate);
};

const storeAndApply = async (preferences: ThemePreferences) => {
  const previousPreferences = themePreferencesAtom();
  const previousTheme = activeThemeAtom();
  const theme = [...BUILTIN_THEMES, ...preferences.customThemes]
    .find((item) => item.id === preferences.activeThemeId)
    ?? BUILTIN_THEMES[0];
  themePreferencesAtom.set(preferences);
  applyDisplayedTheme(theme);
  try {
    await themeApi.save(preferences);
    themeErrorAtom.set(null);
    return theme;
  } catch (error) {
    themePreferencesAtom.set(previousPreferences);
    applyDisplayedTheme(previousTheme);
    themeErrorAtom.set(error instanceof Error ? error.message : String(error));
    throw error;
  }
};

export const loadThemeAction = action(async () => {
  themeLoadingAtom.set(true);
  try {
    const preferences = parsePreferences(await themeApi.get());
    themePreferencesAtom.set(preferences);
    applyDisplayedTheme(
      [...BUILTIN_THEMES, ...preferences.customThemes]
        .find((theme) => theme.id === preferences.activeThemeId)
        ?? BUILTIN_THEMES[0],
      false,
    );
    themeErrorAtom.set(null);
    return preferences;
  } catch (error) {
    applyDisplayedTheme(BUILTIN_THEMES[0], false);
    themeErrorAtom.set(error instanceof Error ? error.message : String(error));
    throw error;
  } finally {
    themeLoadingAtom.set(false);
  }
}, "loadThemeAction");

export const selectThemeAction = action(async (themeId: string) => {
  const preferences = themePreferencesAtom();
  if (!themesAtom().some((theme) => theme.id === themeId)) {
    throw new Error("Тема не найдена");
  }
  return storeAndApply({ ...preferences, activeThemeId: themeId });
}, "selectThemeAction");

export const createCustomThemeAction = action(async (name: string, seed: ThemeSeed) => {
  const cleanName = name.trim();
  const preferences = themePreferencesAtom();
  const nameLength = Array.from(cleanName).length;
  if (nameLength < 1 || nameLength > 32) {
    throw new Error("Название темы должно содержать от 1 до 32 символов");
  }
  if (!isThemeSeed(seed)) throw new Error("Один из цветов темы некорректен");
  if (preferences.customThemes.length >= 20) {
    throw new Error("Можно сохранить не больше 20 пользовательских тем");
  }
  if (themesAtom().some((theme) =>
    theme.name.toLocaleLowerCase("ru") === cleanName.toLocaleLowerCase("ru"))) {
    throw new Error("Тема с таким названием уже существует");
  }
  const theme = createTheme(`custom-${crypto.randomUUID()}`, cleanName, false, seed);
  await storeAndApply({
    activeThemeId: theme.id,
    customThemes: [...preferences.customThemes, theme],
  });
  return theme;
}, "createCustomThemeAction");

export const updateCustomThemeAction = action(async (
  themeId: string,
  name: string,
  seed: ThemeSeed,
) => {
  const cleanName = name.trim();
  const preferences = themePreferencesAtom();
  const existingTheme = preferences.customThemes.find((theme) => theme.id === themeId);
  const nameLength = Array.from(cleanName).length;
  if (!existingTheme) throw new Error("Пользовательская тема не найдена");
  if (nameLength < 1 || nameLength > 32) {
    throw new Error("Название темы должно содержать от 1 до 32 символов");
  }
  if (!isThemeSeed(seed)) throw new Error("Один из цветов темы некорректен");
  if (themesAtom().some((theme) =>
    theme.id !== themeId
    && theme.name.toLocaleLowerCase("ru") === cleanName.toLocaleLowerCase("ru"))) {
    throw new Error("Тема с таким названием уже существует");
  }
  const updatedTheme = createTheme(themeId, cleanName, false, seed);
  await storeAndApply({
    activeThemeId: preferences.activeThemeId,
    customThemes: preferences.customThemes.map((theme) =>
      theme.id === themeId ? updatedTheme : theme),
  });
  return updatedTheme;
}, "updateCustomThemeAction");

export const deleteCustomThemeAction = action(async (themeId: string) => {
  const preferences = themePreferencesAtom();
  const customThemes = preferences.customThemes.filter((theme) => theme.id !== themeId);
  if (customThemes.length === preferences.customThemes.length) return;
  await storeAndApply({
    activeThemeId: preferences.activeThemeId === themeId
      ? DEFAULT_THEME_ID
      : preferences.activeThemeId,
    customThemes,
  });
}, "deleteCustomThemeAction");

export const previewTheme = (theme: AppTheme) => applyDisplayedTheme(theme);
export const restoreActiveTheme = () => applyDisplayedTheme(activeThemeAtom());
