export type EqualizerState = {
  enabled: boolean;
  bands: number[];
  preampDb: number;
  activePresetId: string | null;
};

export type EqualizerPreset = {
  id: string;
  name: string;
  isBuiltin: boolean;
  bands: number[];
  preampDb: number;
  createdAt: number;
  updatedAt: number;
};

export type EqualizerBundle = {
  frequencies: number[];
  state: EqualizerState;
  presets: EqualizerPreset[];
};

export const EMPTY_EQUALIZER: EqualizerBundle = {
  frequencies: [31, 62, 125, 250, 500, 1_000, 2_000, 4_000, 8_000, 16_000],
  state: {
    enabled: false,
    bands: Array.from({ length: 10 }, () => 0),
    preampDb: 0,
    activePresetId: "builtin-flat",
  },
  presets: [],
};
