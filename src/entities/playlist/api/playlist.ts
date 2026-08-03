import { command } from "@/shared/api";
import type { Playlist, PlaylistDetails } from "../model/types.ts";

export const playlistApi = {
  getAll: () => command<Playlist[]>("playlist_get_all"),
  getById: (playlistId: string) => command<PlaylistDetails>("playlist_get_by_id", { playlistId }),
  create: (name: string) => command<Playlist>("playlist_create", { name }),
  update: (playlistId: string, name: string, description?: string) => command<Playlist>("playlist_update", { playlistId, name, description }),
  delete: (playlistId: string) => command<void>("playlist_delete", { playlistId }),
  addTracks: (playlistId: string, trackIds: string[]) => command<number>("playlist_add_tracks", { playlistId, trackIds }),
  removeItems: (playlistId: string, itemIds: string[]) => command<void>("playlist_remove_items", { playlistId, itemIds }),
  reorderItems: (playlistId: string, itemIds: string[]) => command<void>("playlist_reorder_items", { playlistId, itemIds }),
  reorder: (playlistIds: string[]) => command<void>("playlist_reorder", { playlistIds }),
  setPinned: (playlistId: string, pinned: boolean) => command<Playlist>("playlist_set_pinned", { playlistId, pinned }),
};
