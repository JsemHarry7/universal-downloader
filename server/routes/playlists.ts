import { Hono } from "hono";
import { getDb } from "../lib/db";
import {
  listPlaylists,
  createPlaylist,
  renamePlaylist,
  deletePlaylist,
  addTrackToPlaylist,
  removeTrackFromPlaylist,
  getPlaylistTrackIds,
} from "../lib/playlists";

export function playlistRoutes() {
  const routes = new Hono();

  routes.get("/playlists", (c) => {
    return c.json({ playlists: listPlaylists(getDb()) });
  });

  routes.post("/playlists", async (c) => {
    const body = await c.req.json<{ name?: string }>();
    const name = body.name?.trim();
    if (!name) return c.json({ error: "name required" }, 400);
    return c.json(createPlaylist(getDb(), name));
  });

  routes.patch("/playlists/:id", async (c) => {
    const body = await c.req.json<{ name?: string }>();
    const name = body.name?.trim();
    if (!name) return c.json({ error: "name required" }, 400);
    const ok = renamePlaylist(getDb(), c.req.param("id"), name);
    if (!ok) return c.json({ error: "not found" }, 404);
    return c.json({ ok: true });
  });

  routes.delete("/playlists/:id", (c) => {
    const ok = deletePlaylist(getDb(), c.req.param("id"));
    if (!ok) return c.json({ error: "not found" }, 404);
    return c.json({ ok: true });
  });

  routes.get("/playlists/:id/tracks", (c) => {
    const id = c.req.param("id");
    const trackIds = getPlaylistTrackIds(getDb(), id);
    if (trackIds.length === 0) return c.json({ tracks: [] });

    const placeholders = trackIds.map(() => "?").join(",");
    const rows = getDb()
      .prepare(
        `
        SELECT id, path, title, artist, album, duration_s, file_size, format, has_artwork, added_at, source, source_url
        FROM library WHERE id IN (${placeholders})
        `,
      )
      .all(...trackIds) as Array<{ id: string }>;

    const byId = new Map(rows.map((r) => [r.id, r]));
    const ordered = trackIds.map((id) => byId.get(id)).filter(Boolean);
    return c.json({ tracks: ordered });
  });

  routes.post("/playlists/:id/tracks", async (c) => {
    const body = await c.req.json<{ trackId?: string }>();
    if (!body.trackId) return c.json({ error: "trackId required" }, 400);
    const ok = addTrackToPlaylist(getDb(), c.req.param("id"), body.trackId);
    return c.json({ ok });
  });

  routes.delete("/playlists/:id/tracks/:trackId", (c) => {
    const ok = removeTrackFromPlaylist(
      getDb(),
      c.req.param("id"),
      c.req.param("trackId"),
    );
    return c.json({ ok });
  });

  return routes;
}
