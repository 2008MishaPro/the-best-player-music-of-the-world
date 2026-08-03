import { action } from "@reatom/core";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { activePlaylistAtom, loadPlaylistAction, loadPlaylistsAction } from "@/entities/playlist";
import { libraryApi, loadTracksAction } from "@/entities/track";

const normalizeWindowsExtendedPath = (path: string) => {
  if (path.startsWith("\\\\?\\UNC\\")) return `\\\\${path.slice(8)}`;
  if (path.startsWith("\\\\?\\")) return path.slice(4);
  return path;
};

export const revealTrackAction = action(async (filePath: string) => {
  await revealItemInDir(normalizeWindowsExtendedPath(filePath));
}, "revealTrackAction");

export const removeTrackFromLibraryAction = action(async (trackId: string) => {
  await removeTracksFromLibraryAction([trackId]);
}, "removeTrackFromLibraryAction");

export const removeTracksFromLibraryAction = action(async (trackIds: string[]) => {
  const activePlaylistId = activePlaylistAtom()?.id;
  for (const trackId of [...new Set(trackIds)]) {
    await libraryApi.removeTrack(trackId);
  }
  await Promise.all([
    loadTracksAction(),
    loadPlaylistsAction(),
    activePlaylistId ? loadPlaylistAction(activePlaylistId) : Promise.resolve(),
  ]);
}, "removeTracksFromLibraryAction");
