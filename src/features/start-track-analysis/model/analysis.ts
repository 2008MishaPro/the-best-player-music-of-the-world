import { action, atom } from "@reatom/core";
import { analysisApi, type PeakFrame, type TrackAnalysis, type WaveformPoint } from "@/entities/track-analysis";
import { subscribe } from "@/shared/api";

export const analysisByTrackIdAtom = atom<Record<string, TrackAnalysis>>({}, "analysisByTrackIdAtom");
export const activeAnalysisTrackIdAtom = atom<string | null>(null, "activeAnalysisTrackIdAtom");
export const waveformAtom = atom<WaveformPoint[]>([], "waveformAtom");
export const peakMapAtom = atom<PeakFrame[]>([], "peakMapAtom");
export const analysisErrorAtom = atom<string | null>(null, "analysisErrorAtom");

const updateStatus = (status: TrackAnalysis) =>
  analysisByTrackIdAtom.set((all) => ({ ...all, [status.trackId]: status }));

const loadReadyData = async (trackId: string) => {
  const [waveform, peaks] = await Promise.all([
    analysisApi.getWaveform(trackId),
    analysisApi.getPeakMap(trackId),
  ]);
  if (activeAnalysisTrackIdAtom() === trackId) {
    waveformAtom.set(waveform);
    peakMapAtom.set(peaks);
  }
};

export const startAnalysisAction = action(async (trackId: string) => {
  activeAnalysisTrackIdAtom.set(trackId);
  updateStatus(await analysisApi.start(trackId));
}, "startAnalysisAction");
export const loadAnalysisAction = action(async (trackId: string) => {
  if (activeAnalysisTrackIdAtom() !== trackId) {
    waveformAtom.set([]);
    peakMapAtom.set([]);
  }
  activeAnalysisTrackIdAtom.set(trackId);
  try {
    const status = await analysisApi.getStatus(trackId);
    updateStatus(status);
    if (status.status === "ready") {
      await loadReadyData(trackId);
    }
  } catch (error) {
    analysisErrorAtom.set(error instanceof Error ? error.message : String(error));
  }
}, "loadAnalysisAction");

export const ensureAnalysisAction = action(async (trackId: string) => {
  if (activeAnalysisTrackIdAtom() !== trackId) {
    waveformAtom.set([]);
    peakMapAtom.set([]);
  }
  activeAnalysisTrackIdAtom.set(trackId);
  analysisErrorAtom.set(null);
  try {
    const status = await analysisApi.getStatus(trackId);
    updateStatus(status);
    if (status.status === "ready") await loadReadyData(trackId);
    else if (status.status !== "running") updateStatus(await analysisApi.start(trackId));
  } catch {
    updateStatus(await analysisApi.start(trackId));
  }
}, "ensureAnalysisAction");

export const initializeAnalysisEventsAction = action(async () =>
  subscribe<TrackAnalysis>("analysis://progress", (status) => {
    updateStatus(status);
    if (status.status === "ready" && activeAnalysisTrackIdAtom() === status.trackId) {
      void loadReadyData(status.trackId).catch((error) => {
        analysisErrorAtom.set(error instanceof Error ? error.message : String(error));
      });
    }
  }), "initializeAnalysisEventsAction");
