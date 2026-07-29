export type PlaybackStatus = "idle" | "loading" | "playing" | "paused" | "stopped" | "error";
export type RepeatMode = "off" | "all" | "one";

export type PlaybackSnapshot = {
  trackId: string | null;
  status: PlaybackStatus;
  positionMs: number;
  durationMs: number;
  volume: number;
  bufferedMs: number;
  repeat: RepeatMode;
  shuffle: boolean;
  spectrum: number[];
  error: string | null;
};

export const EMPTY_PLAYBACK: PlaybackSnapshot = {
  trackId: null,
  status: "idle",
  positionMs: 0,
  durationMs: 0,
  volume: 0.8,
  bufferedMs: 0,
  repeat: "off",
  shuffle: false,
  spectrum: Array.from({ length: 48 }, () => 0),
  error: null,
};
