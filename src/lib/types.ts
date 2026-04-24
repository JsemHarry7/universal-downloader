export type SourceKind = "spotify" | "soundcloud" | "youtube" | "other";
export type ItemKind = "track" | "playlist" | "album";

export interface TrackMeta {
  id: string;
  title: string;
  artist: string;
  duration_s: number;
  artwork_url?: string;
  source_url: string;
}

export interface ResolvedItem {
  kind: ItemKind;
  title: string;
  artist?: string;
  artwork_url?: string;
  track_count: number;
  tracks: TrackMeta[];
  source: SourceKind;
  source_url: string;
}

export interface LibraryTrack {
  id: string;
  path: string;
  title: string;
  artist: string | null;
  album: string | null;
  duration_s: number;
  file_size: number;
  format: string;
  has_artwork: 0 | 1;
  added_at: number;
  source: string | null;
  source_url: string | null;
}

export interface SavedTrack {
  id: string;
  title: string;
  artist: string | null;
  album: string | null;
  source: string | null;
  source_url: string | null;
  artwork_url: string | null;
  saved_at?: unknown;
}
