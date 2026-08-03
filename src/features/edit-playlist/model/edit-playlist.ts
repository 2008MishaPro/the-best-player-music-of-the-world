import { action } from "@reatom/core";
import { loadPlaylistAction, loadPlaylistsAction, playlistApi } from "@/entities/playlist";

export const renamePlaylistAction = action(async (playlistId: string, name: string) => {
  await playlistApi.update(playlistId, name.trim());
  await Promise.all([loadPlaylistsAction(), loadPlaylistAction(playlistId)]);
}, "renamePlaylistAction");

export const deletePlaylistAction = action(async (playlistId: string) => {
  await playlistApi.delete(playlistId);
  await loadPlaylistsAction();
}, "deletePlaylistAction");

export const pinPlaylistAction = action(async (playlistId: string, pinned: boolean) => {
  await playlistApi.setPinned(playlistId, pinned);
  await Promise.all([loadPlaylistsAction(), loadPlaylistAction(playlistId)]);
}, "pinPlaylistAction");

export const reorderPlaylistsAction = action(async (playlistIds: string[]) => {
  await playlistApi.reorder(playlistIds);
  await loadPlaylistsAction();
}, "reorderPlaylistsAction");
