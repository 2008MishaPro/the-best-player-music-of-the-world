import { action, atom, computed } from "@reatom/core";
import { libraryApi } from "../api/library.ts";
import type { Track } from "./types.ts";

export const tracksAtom = atom<Track[]>([], "tracksAtom");
export const tracksQueryAtom = atom("", "tracksQueryAtom");
export const selectedTrackIdsAtom = atom<string[]>([], "selectedTrackIdsAtom");
export const libraryLoadingAtom = atom(false, "libraryLoadingAtom");
export const libraryErrorAtom = atom<string | null>(null, "libraryErrorAtom");

export const filteredTracksAtom = computed(() => {
  const query = tracksQueryAtom().trim().toLocaleLowerCase("ru");
  if (!query) return tracksAtom();
  return tracksAtom().filter((track) =>
    [track.title, track.artist, track.album, track.fileName].some((value) =>
      value?.toLocaleLowerCase("ru").includes(query),
    ) || track.tags.some((tag) => tag.label.toLocaleLowerCase("ru").includes(query)),
  );
}, "filteredTracksAtom");

export const favoritesAtom = computed(
  () => tracksAtom().filter((track) => track.isFavorite),
  "favoritesAtom",
);
export const recentTracksAtom = computed(
  () => [...tracksAtom()].filter((track) => track.lastPlayedAt).sort((a, b) => (b.lastPlayedAt ?? 0) - (a.lastPlayedAt ?? 0)),
  "recentTracksAtom",
);
export const recentlyAddedAtom = computed(
  () => [...tracksAtom()].sort((a, b) => b.addedAt - a.addedAt).slice(0, 12),
  "recentlyAddedAtom",
);
export const missingTracksCountAtom = computed(
  () => tracksAtom().filter((track) => track.isMissing).length,
  "missingTracksCountAtom",
);

export const loadTracksAction = action(async () => {
  libraryLoadingAtom.set(true);
  libraryErrorAtom.set(null);
  try {
    tracksAtom.set(await libraryApi.getTracks());
  } catch (error) {
    libraryErrorAtom.set(error instanceof Error ? error.message : String(error));
  } finally {
    libraryLoadingAtom.set(false);
  }
}, "loadTracksAction");

export const checkMissingAction = action(async () => {
  try {
    tracksAtom.set(await libraryApi.checkMissing());
  } catch (error) {
    libraryErrorAtom.set(error instanceof Error ? error.message : String(error));
  }
}, "checkMissingAction");

export const updateTrack = action((track: Track) => {
  tracksAtom.set((tracks) => tracks.map((item) => (item.id === track.id ? track : item)));
}, "updateTrack");
