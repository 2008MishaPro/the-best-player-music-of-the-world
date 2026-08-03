import { action } from "@reatom/core";
import { activePlaylistAtom, loadPlaylistAction, loadPlaylistsAction, playlistApi } from "@/entities/playlist";

export const addTracksToPlaylistAction = action(async (playlistId: string, trackIds: string[]) => {
  const insertedCount = await playlistApi.addTracks(playlistId, trackIds);
  await Promise.all([
    activePlaylistAtom()?.id === playlistId ? loadPlaylistAction(playlistId) : Promise.resolve(),
    loadPlaylistsAction(),
  ]);
  return insertedCount;
}, "addTracksToPlaylistAction");

export const addTrackToPlaylistsAction = action(async (playlistIds: string[], trackId: string) => {
  return addTracksToPlaylistsAction(playlistIds, [trackId]);
}, "addTrackToPlaylistsAction");

export const addTracksToPlaylistsAction = action(async (playlistIds: string[], trackIds: string[]) => {
  const uniqueTrackIds = [...new Set(trackIds)];
  const insertedCounts = await Promise.all(
    [...new Set(playlistIds)].map((playlistId) => playlistApi.addTracks(playlistId, uniqueTrackIds)),
  );
  const activePlaylistId = activePlaylistAtom()?.id;
  await Promise.all([
    loadPlaylistsAction(),
    activePlaylistId && playlistIds.includes(activePlaylistId)
      ? loadPlaylistAction(activePlaylistId)
      : Promise.resolve(),
  ]);
  return insertedCounts.reduce((total, count) => total + count, 0);
}, "addTracksToPlaylistsAction");

export const removePlaylistItemsAction = action(async (playlistId: string, itemIds: string[]) => {
  await playlistApi.removeItems(playlistId, itemIds);
  await loadPlaylistAction(playlistId);
}, "removePlaylistItemsAction");

export const reorderPlaylistItemsAction = action(async (playlistId: string, itemIds: string[]) => {
  await playlistApi.reorderItems(playlistId, itemIds);
  await loadPlaylistAction(playlistId);
}, "reorderPlaylistItemsAction");
