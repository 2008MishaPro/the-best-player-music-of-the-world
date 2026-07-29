export type TrackTagColor = "amber" | "rose" | "violet" | "blue" | "cyan" | "emerald" | "slate";

export type TrackTag = {
  id: string;
  trackId: string;
  label: string;
  color: TrackTagColor;
  createdAt: number;
};

export type Track = {
  id: string;
  filePath: string;
  fileName: string;
  fileSize: number;
  modifiedAt: number;
  title: string | null;
  artist: string | null;
  album: string | null;
  albumArtist: string | null;
  genre: string | null;
  year: number | null;
  trackNumber: number | null;
  durationMs: number;
  sampleRate: number | null;
  channels: number | null;
  codec: string | null;
  addedAt: number;
  lastPlayedAt: number | null;
  playCount: number;
  isFavorite: boolean;
  isMissing: boolean;
  tags: TrackTag[];
};

export type ImportSummary = {
  imported: number;
  updated: number;
  skipped: number;
  unsupported: number;
  failed: number;
  errors: string[];
};

export const trackDisplayTitle = (track: Track) => track.title?.trim() || track.fileName;
export const trackDisplayArtist = (track: Track) => track.artist?.trim() || "Неизвестный исполнитель";
