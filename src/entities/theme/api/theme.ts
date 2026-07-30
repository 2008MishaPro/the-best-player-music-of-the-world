import { command } from "@/shared/api";
import type { ThemePreferences } from "../model/types.ts";

const SETTINGS_KEY = "appearance_theme";

export const themeApi = {
  get: async () => {
    const settings = await command<Record<string, unknown>>("settings_get_all");
    return settings[SETTINGS_KEY];
  },
  save: (preferences: ThemePreferences) =>
    command<void>("settings_set", { key: SETTINGS_KEY, value: preferences }),
};
