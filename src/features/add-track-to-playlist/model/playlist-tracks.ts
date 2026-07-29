import { action } from "@reatom/core";
import { loadPlaylistAction, loadPlaylistsAction, playlistApi } from "@/entities/playlist";

export const addTracksToPlaylistAction = action(async (playlistId: string, trackIds: string[]) => {
  const insertedCount = await playlistApi.addTracks(playlistId, trackIds);
  await Promise.all([loadPlaylistAction(playlistId), loadPlaylistsAction()]);
  return insertedCount;
}, "addTracksToPlaylistAction");

export const addTrackToPlaylistsAction = action(async (playlistIds: string[], trackId: string) => {
  const insertedCounts = await Promise.all(playlistIds.map((playlistId) => playlistApi.addTracks(playlistId, [trackId])));
  await loadPlaylistsAction();
  return insertedCounts.reduce((total, count) => total + count, 0);
}, "addTrackToPlaylistsAction");

export const removePlaylistItemsAction = action(async (playlistId: string, itemIds: string[]) => {
  await playlistApi.removeItems(playlistId, itemIds);
  await loadPlaylistAction(playlistId);
}, "removePlaylistItemsAction");

export const reorderPlaylistItemsAction = action(async (playlistId: string, itemIds: string[]) => {
  await playlistApi.reorderItems(playlistId, itemIds);
  await loadPlaylistAction(playlistId);
}, "reorderPlaylistItemsAction");
