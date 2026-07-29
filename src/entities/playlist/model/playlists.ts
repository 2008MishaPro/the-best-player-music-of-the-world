import { action, atom, computed } from "@reatom/core";
import { playlistApi } from "../api/playlist.ts";
import type { Playlist, PlaylistDetails } from "./types.ts";

export const playlistsAtom = atom<Playlist[]>([], "playlistsAtom");
export const activePlaylistAtom = atom<PlaylistDetails | null>(null, "activePlaylistAtom");
export const playlistsLoadingAtom = atom(false, "playlistsLoadingAtom");
export const playlistsErrorAtom = atom<string | null>(null, "playlistsErrorAtom");
export const pinnedPlaylistsAtom = computed(
  () => playlistsAtom().filter((playlist) => playlist.isPinned),
  "pinnedPlaylistsAtom",
);

export const loadPlaylistsAction = action(async () => {
  playlistsLoadingAtom.set(true);
  try {
    playlistsAtom.set(await playlistApi.getAll());
    playlistsErrorAtom.set(null);
  } catch (error) {
    playlistsErrorAtom.set(error instanceof Error ? error.message : String(error));
  } finally {
    playlistsLoadingAtom.set(false);
  }
}, "loadPlaylistsAction");

export const loadPlaylistAction = action(async (playlistId: string) => {
  activePlaylistAtom.set(await playlistApi.getById(playlistId));
}, "loadPlaylistAction");
