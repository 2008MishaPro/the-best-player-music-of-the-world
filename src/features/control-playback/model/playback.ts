import { action, atom, computed } from "@reatom/core";
import { EMPTY_PLAYBACK, playbackApi, type PlaybackSnapshot, type RepeatMode } from "@/entities/playback";
import { applyQueue, queueApi, queueAtom } from "@/entities/playback-queue";
import { libraryApi, tracksAtom } from "@/entities/track";
import { subscribe } from "@/shared/api";

export const playbackSnapshotAtom = atom<PlaybackSnapshot>(EMPTY_PLAYBACK, "playbackSnapshotAtom");
export const playbackErrorAtom = atom<string | null>(null, "playbackErrorAtom");
let latestSeekRequest = 0;
export const isPlayingAtom = computed(() => playbackSnapshotAtom().status === "playing", "isPlayingAtom");
export const currentTrackAtom = computed(
  () => tracksAtom().find((track) => track.id === playbackSnapshotAtom().trackId) ?? null,
  "currentTrackAtom",
);

const applySnapshot = (snapshot: PlaybackSnapshot) => {
  const trackChanged = playbackSnapshotAtom().trackId !== snapshot.trackId;
  playbackSnapshotAtom.set(snapshot);
  playbackErrorAtom.set(snapshot.error);
  if (trackChanged && snapshot.trackId) {
    void Promise.all([
      queueApi.get().then(applyQueue),
      libraryApi.getTracks().then((tracks) => tracksAtom.set(tracks)),
    ]).catch((error) => {
      playbackErrorAtom.set(error instanceof Error ? error.message : String(error));
    });
  }
  return snapshot;
};

async function execute(run: () => Promise<PlaybackSnapshot>) {
  try {
    return applySnapshot(await run());
  } catch (error) {
    playbackErrorAtom.set(error instanceof Error ? error.message : String(error));
    throw error;
  }
}

export const loadTrackAction = action(async (trackId: string) => execute(() => playbackApi.load(trackId)), "loadTrackAction");
export const playAction = action(async () => execute(playbackApi.play), "playAction");
export const pauseAction = action(async () => execute(playbackApi.pause), "pauseAction");
export const stopAction = action(async () => execute(playbackApi.stop), "stopAction");
export const togglePlaybackAction = action(async () => {
  const snapshot = playbackSnapshotAtom();
  if (!snapshot.trackId) {
    const queue = queueAtom();
    const index = queue.currentIndex >= 0 ? queue.currentIndex : 0;
    const trackId = queue.itemIds[index];
    if (!trackId) return snapshot;
    applySnapshot(await playbackApi.load(trackId));
  }
  return execute(playbackSnapshotAtom().status === "playing" ? playbackApi.pause : playbackApi.play);
}, "togglePlaybackAction");
export const seekAction = action(async (positionMs: number) => {
  const requestId = ++latestSeekRequest;
  try {
    const snapshot = await playbackApi.seek(positionMs);
    if (requestId === latestSeekRequest) applySnapshot(snapshot);
    return snapshot;
  } catch (error) {
    if (requestId === latestSeekRequest) {
      playbackErrorAtom.set(error instanceof Error ? error.message : String(error));
    }
    throw error;
  }
}, "seekAction");
export const setVolumeAction = action(async (volume: number) => execute(() => playbackApi.setVolume(volume)), "setVolumeAction");
export const nextAction = action(async () => execute(playbackApi.next), "nextAction");
export const previousAction = action(async () => execute(playbackApi.previous), "previousAction");
export const setRepeatAction = action(async (repeat: RepeatMode) => execute(() => playbackApi.setRepeat(repeat)), "setRepeatAction");
export const setShuffleAction = action(async (shuffle: boolean) => {
  const snapshot = await execute(() => playbackApi.setShuffle(shuffle));
  applyQueue(await queueApi.get());
  return snapshot;
}, "setShuffleAction");

export const initializePlaybackAction = action(async () => {
  applySnapshot(await playbackApi.getSnapshot());
  return subscribe<PlaybackSnapshot>("playback://snapshot", applySnapshot);
}, "initializePlaybackAction");
