import { action } from "@reatom/core";
import { libraryApi, tracksAtom, updateTrack } from "@/entities/track";

export const toggleFavoriteAction = action(async (trackId: string) => {
  const track = tracksAtom().find((item) => item.id === trackId);
  if (!track) return;
  updateTrack(await libraryApi.setFavorite(trackId, !track.isFavorite));
}, "toggleFavoriteAction");
