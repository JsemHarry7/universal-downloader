import { randomUUID } from "node:crypto";
import type { Database } from "better-sqlite3";

export interface Playlist {
  id: string;
  name: string;
  created_at: number;
  track_count: number;
}

export function listPlaylists(db: Database): Playlist[] {
  return db
    .prepare(
      `
      SELECT p.id, p.name, p.created_at, COUNT(pt.track_id) AS track_count
      FROM playlists p
      LEFT JOIN playlist_tracks pt ON pt.playlist_id = p.id
      GROUP BY p.id
      ORDER BY p.created_at DESC
      `,
    )
    .all() as Playlist[];
}

export function createPlaylist(
  db: Database,
  name: string,
  id?: string,
): Playlist {
  const finalId = id ?? randomUUID();
  const created_at = Date.now();
  db.prepare(
    "INSERT OR IGNORE INTO playlists (id, name, created_at) VALUES (?, ?, ?)",
  ).run(finalId, name, created_at);
  const row = db
    .prepare("SELECT id, name, created_at FROM playlists WHERE id = ?")
    .get(finalId) as { id: string; name: string; created_at: number };
  return { ...row, track_count: 0 };
}

export function renamePlaylist(
  db: Database,
  id: string,
  name: string,
): boolean {
  const r = db
    .prepare("UPDATE playlists SET name = ? WHERE id = ?")
    .run(name, id);
  return r.changes > 0;
}

export function deletePlaylist(db: Database, id: string): boolean {
  const r = db.prepare("DELETE FROM playlists WHERE id = ?").run(id);
  return r.changes > 0;
}

export function addTrackToPlaylist(
  db: Database,
  playlistId: string,
  trackId: string,
): boolean {
  const row = db
    .prepare(
      "SELECT MAX(position) AS max FROM playlist_tracks WHERE playlist_id = ?",
    )
    .get(playlistId) as { max: number | null } | undefined;
  const position = (row?.max ?? -1) + 1;
  try {
    db.prepare(
      "INSERT INTO playlist_tracks (playlist_id, track_id, position, added_at) VALUES (?, ?, ?, ?)",
    ).run(playlistId, trackId, position, Date.now());
    return true;
  } catch {
    return false;
  }
}

export function removeTrackFromPlaylist(
  db: Database,
  playlistId: string,
  trackId: string,
): boolean {
  const r = db
    .prepare(
      "DELETE FROM playlist_tracks WHERE playlist_id = ? AND track_id = ?",
    )
    .run(playlistId, trackId);
  return r.changes > 0;
}

export function getPlaylistTrackIds(
  db: Database,
  playlistId: string,
): string[] {
  const rows = db
    .prepare(
      "SELECT track_id FROM playlist_tracks WHERE playlist_id = ? ORDER BY position",
    )
    .all(playlistId) as { track_id: string }[];
  return rows.map((r) => r.track_id);
}
