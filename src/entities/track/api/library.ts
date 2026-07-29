import { command } from "@/shared/api";
import type { ImportSummary, Track, TrackTagColor } from "../model/types.ts";

export const libraryApi = {
  getTracks: () => command<Track[]>("library_get_tracks"),
  getTrack: (trackId: string) => command<Track>("library_get_track", { trackId }),
  importFiles: (paths: string[]) => command<ImportSummary>("library_import_files", { paths }),
  importDirectory: (path: string) => command<ImportSummary>("library_import_directory", { path }),
  checkMissing: () => command<Track[]>("library_check_missing"),
  setFavorite: (trackId: string, favorite: boolean) => command<Track>("library_set_favorite", { trackId, favorite }),
  removeTrack: (trackId: string) => command<void>("library_remove_track", { trackId }),
  createTag: (trackId: string, label: string, color: TrackTagColor) => command<Track>("track_tag_create", { trackId, label, color }),
  deleteTag: (trackId: string, tagId: string) => command<Track>("track_tag_delete", { trackId, tagId }),
};
