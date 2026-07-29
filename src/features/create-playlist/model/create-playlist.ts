import { action } from "@reatom/core";
import { loadPlaylistsAction, playlistApi } from "@/entities/playlist";

export const createPlaylistAction = action(async (name: string) => {
  const trimmedName = name.trim();
  if (!trimmedName) return null;
  const playlist = await playlistApi.create(trimmedName);
  await loadPlaylistsAction();
  return playlist;
}, "createPlaylistAction");
