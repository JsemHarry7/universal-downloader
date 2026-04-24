import { Hono } from "hono";
import { getDb } from "../lib/db";

export interface LibraryStats {
  total_tracks: number;
  total_size_bytes: number;
  total_duration_s: number;
  by_source: Record<string, number>;
  by_format: Record<string, number>;
  top_artists: Array<{ artist: string; count: number }>;
}

export function statsRoutes() {
  const routes = new Hono();

  routes.get("/stats", (c) => {
    const db = getDb();

    const summary = db
      .prepare(
        `SELECT COUNT(*) AS n,
                COALESCE(SUM(file_size), 0) AS bytes,
                COALESCE(SUM(duration_s), 0) AS seconds
         FROM library`,
      )
      .get() as { n: number; bytes: number; seconds: number };

    const bySourceRows = db
      .prepare(
        `SELECT COALESCE(source, 'unknown') AS key, COUNT(*) AS count
         FROM library GROUP BY COALESCE(source, 'unknown')`,
      )
      .all() as { key: string; count: number }[];

    const byFormatRows = db
      .prepare(
        `SELECT COALESCE(format, 'unknown') AS key, COUNT(*) AS count
         FROM library GROUP BY COALESCE(format, 'unknown')`,
      )
      .all() as { key: string; count: number }[];

    const topArtists = db
      .prepare(
        `SELECT COALESCE(artist, 'Unknown') AS artist, COUNT(*) AS count
         FROM library
         WHERE artist IS NOT NULL AND TRIM(artist) != ''
         GROUP BY artist
         ORDER BY count DESC, artist
         LIMIT 5`,
      )
      .all() as { artist: string; count: number }[];

    const stats: LibraryStats = {
      total_tracks: summary.n,
      total_size_bytes: summary.bytes,
      total_duration_s: summary.seconds,
      by_source: Object.fromEntries(
        bySourceRows.map((r) => [r.key, r.count]),
      ),
      by_format: Object.fromEntries(
        byFormatRows.map((r) => [r.key, r.count]),
      ),
      top_artists: topArtists,
    };

    return c.json(stats);
  });

  return routes;
}
