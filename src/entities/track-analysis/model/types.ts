export type WaveformPoint = { min: number; max: number };
export type PeakFrame = {
  timeMs: number;
  peakDb: number;
  rmsDb: number;
  crestFactorDb: number;
  clippingSamples: number;
};
export type DiagnosticMarker = {
  type: string;
  startMs: number;
  endMs: number;
  severity: "info" | "warning" | "critical";
  value: number;
  threshold: number;
  explanation: string;
};
export type TrackAnalysis = {
  trackId: string;
  status: "pending" | "running" | "ready" | "failed";
  progress: number;
  integratedLufs: number | null;
  truePeakDb: number | null;
  dynamicRangeDb: number | null;
  analyzedAt: number | null;
  error: string | null;
};
