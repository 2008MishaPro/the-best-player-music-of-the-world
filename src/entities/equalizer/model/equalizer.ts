import { action, atom } from "@reatom/core";
import { equalizerApi } from "../api/equalizer.ts";
import {
  EMPTY_EQUALIZER,
  type EqualizerBundle,
  type EqualizerPreset,
  type EqualizerState,
} from "./types.ts";

export const equalizerBundleAtom = atom<EqualizerBundle>(EMPTY_EQUALIZER, "equalizerBundleAtom");
export const equalizerLoadingAtom = atom(false, "equalizerLoadingAtom");
export const equalizerErrorAtom = atom<string | null>(null, "equalizerErrorAtom");

export const loadEqualizerAction = action(async () => {
  equalizerLoadingAtom.set(true);
  try {
    const bundle = await equalizerApi.get();
    equalizerBundleAtom.set(bundle);
    equalizerErrorAtom.set(null);
    return bundle;
  } catch (error) {
    equalizerErrorAtom.set(error instanceof Error ? error.message : String(error));
    throw error;
  } finally {
    equalizerLoadingAtom.set(false);
  }
}, "loadEqualizerAction");

export const previewEqualizerAction = action(
  (enabled: boolean, bands: number[], preampDb: number) =>
    equalizerApi.preview(enabled, bands, preampDb),
  "previewEqualizerAction",
);

export const setEqualizerAction = action(async (state: EqualizerState) => {
  const saved = await equalizerApi.set(state);
  equalizerBundleAtom.set({ ...equalizerBundleAtom(), state: saved });
  return saved;
}, "setEqualizerAction");

export const saveEqualizerPresetAction = action(
  async (name: string, bands: number[], preampDb: number) => {
    const preset = await equalizerApi.savePreset(name, bands, preampDb);
    const bundle = equalizerBundleAtom();
    equalizerBundleAtom.set({ ...bundle, presets: [...bundle.presets, preset] });
    await setEqualizerAction({
      enabled: true,
      bands: preset.bands,
      preampDb: preset.preampDb,
      activePresetId: preset.id,
    });
    return preset;
  },
  "saveEqualizerPresetAction",
);

export const deleteEqualizerPresetAction = action(async (preset: EqualizerPreset) => {
  if (preset.isBuiltin) return;
  await equalizerApi.deletePreset(preset.id);
  const bundle = equalizerBundleAtom();
  equalizerBundleAtom.set({
    ...bundle,
    state: bundle.state.activePresetId === preset.id
      ? { ...bundle.state, activePresetId: null }
      : bundle.state,
    presets: bundle.presets.filter((item) => item.id !== preset.id),
  });
}, "deleteEqualizerPresetAction");
