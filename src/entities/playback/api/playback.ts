import { command } from "@/shared/api";
import type { PlaybackSnapshot, RepeatMode } from "../model/types.ts";

export const playbackApi = {
  load: (trackId: string) => command<PlaybackSnapshot>("playback_load", { trackId }),
  play: () => command<PlaybackSnapshot>("playback_play"),
  pause: () => command<PlaybackSnapshot>("playback_pause"),
  stop: () => command<PlaybackSnapshot>("playback_stop"),
  seek: (positionMs: number) => command<PlaybackSnapshot>("playback_seek", { positionMs }),
  setVolume: (volume: number) => command<PlaybackSnapshot>("playback_set_volume", { volume }),
  setRepeat: (repeat: RepeatMode) => command<PlaybackSnapshot>("playback_set_repeat", { repeat }),
  setShuffle: (shuffle: boolean) => command<PlaybackSnapshot>("playback_set_shuffle", { shuffle }),
  getSnapshot: () => command<PlaybackSnapshot>("playback_get_snapshot"),
  next: () => command<PlaybackSnapshot>("playback_next"),
  previous: () => command<PlaybackSnapshot>("playback_previous"),
};
