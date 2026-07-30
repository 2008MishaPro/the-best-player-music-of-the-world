import { command } from "@/shared/api";
import type { EqualizerBundle, EqualizerPreset, EqualizerState } from "../model/types.ts";

export const equalizerApi = {
  get: () => command<EqualizerBundle>("equalizer_get"),
  preview: (enabled: boolean, bands: number[], preampDb: number) =>
    command<EqualizerState>("equalizer_preview", { enabled, bands, preampDb }),
  set: (state: EqualizerState) =>
    command<EqualizerState>("equalizer_set", {
      enabled: state.enabled,
      bands: state.bands,
      preampDb: state.preampDb,
      activePresetId: state.activePresetId,
    }),
  savePreset: (name: string, bands: number[], preampDb: number) =>
    command<EqualizerPreset>("equalizer_save_preset", { name, bands, preampDb }),
  deletePreset: (presetId: string) =>
    command<void>("equalizer_delete_preset", { presetId }),
};
