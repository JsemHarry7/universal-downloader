import { Hono } from "hono";
import { getDb } from "../lib/db";

interface LibraryRow {
  title: string;
  artist: string | null;
  album: string | null;
  duration_s: number;
}

interface LrclibResponse {
  plainLyrics?: string | null;
  syncedLyrics?: string | null;
}

export function lyricsRoutes() {
  const routes = new Hono();

  routes.get("/lyrics/:trackId", async (c) => {
    const id = c.req.param("trackId");
    const row = getDb()
      .prepare(
        "SELECT title, artist, album, duration_s FROM library WHERE id = ?",
      )
      .get(id) as LibraryRow | undefined;
    if (!row) return c.json({ error: "not found" }, 404);
    if (!row.artist) {
      return c.json({ plainLyrics: null, syncedLyrics: null });
    }

    const params = new URLSearchParams({
      track_name: row.title,
      artist_name: row.artist,
    });
    if (row.album) params.set("album_name", row.album);
    if (row.duration_s > 0) params.set("duration", String(row.duration_s));

    try {
      const res = await fetch(`https://lrclib.net/api/get?${params}`, {
        headers: {
          "User-Agent":
            "universal-downloader/0.1 (https://github.com/JsemHarry7/universal-downloader)",
        },
      });
      if (!res.ok) {
        return c.json({ plainLyrics: null, syncedLyrics: null });
      }
      const data = (await res.json()) as LrclibResponse;
      return c.json({
        plainLyrics: data.plainLyrics ?? null,
        syncedLyrics: data.syncedLyrics ?? null,
      });
    } catch {
      return c.json({ plainLyrics: null, syncedLyrics: null });
    }
  });

  return routes;
}
