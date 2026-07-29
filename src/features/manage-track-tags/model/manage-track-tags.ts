import { action } from "@reatom/core";
import { activePlaylistAtom, loadPlaylistAction } from "@/entities/playlist";
import { libraryApi, updateTrack, type Track, type TrackTagColor } from "@/entities/track";

const applyTrack = async (track: Track) => {
  updateTrack(track);
  const activePlaylistId = activePlaylistAtom()?.id;
  if (activePlaylistId) await loadPlaylistAction(activePlaylistId);
  return track;
};

export const createTrackTagAction = action(async (trackId: string, label: string, color: TrackTagColor) =>
  applyTrack(await libraryApi.createTag(trackId, label, color)), "createTrackTagAction");

export const deleteTrackTagAction = action(async (trackId: string, tagId: string) =>
  applyTrack(await libraryApi.deleteTag(trackId, tagId)), "deleteTrackTagAction");
