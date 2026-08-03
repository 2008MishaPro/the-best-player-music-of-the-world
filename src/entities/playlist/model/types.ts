import type { Track } from "@/entities/track/@x/playlist.ts";

export type Playlist = {
  id: string;
  name: string;
  description: string | null;
  coverPath: string | null;
  isPinned: boolean;
  position: number;
  createdAt: number;
  updatedAt: number;
  trackCount: number;
};

export type PlaylistItem = {
  id: string;
  playlistId: string;
  trackId: string;
  position: number;
  addedAt: number;
  track: Track;
};

export type PlaylistDetails = Playlist & { items: PlaylistItem[] };
