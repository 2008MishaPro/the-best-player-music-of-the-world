import { action } from "@reatom/core";
import { libraryApi, tracksAtom, updateTrack } from "@/entities/track";

export const toggleFavoriteAction = action(async (trackId: string) => {
  const track = tracksAtom().find((item) => item.id === trackId);
  if (!track) return;
  updateTrack(await libraryApi.setFavorite(trackId, !track.isFavorite));
}, "toggleFavoriteAction");

export const setTracksFavoriteAction = action(async (trackIds: string[], favorite: boolean) => {
  const updatedTracks = await Promise.all(
    [...new Set(trackIds)].map((trackId) => libraryApi.setFavorite(trackId, favorite)),
  );
  updatedTracks.forEach((track) => updateTrack(track));
  return updatedTracks;
}, "setTracksFavoriteAction");
