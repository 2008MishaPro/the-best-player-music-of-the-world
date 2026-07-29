import { command } from "@/shared/api";
import type { PeakFrame, TrackAnalysis, WaveformPoint } from "../model/types.ts";

export const analysisApi = {
  start: (trackId: string) => command<TrackAnalysis>("analysis_start", { trackId }),
  cancel: (trackId: string) => command<void>("analysis_cancel", { trackId }),
  getStatus: (trackId: string) => command<TrackAnalysis>("analysis_get_status", { trackId }),
  getWaveform: (trackId: string, startMs = 0, endMs?: number, level = 2) => command<WaveformPoint[]>("analysis_get_waveform", { trackId, startMs, endMs, level }),
  getPeakMap: (trackId: string) => command<PeakFrame[]>("analysis_get_peak_map", { trackId }),
};
