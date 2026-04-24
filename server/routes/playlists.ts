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
        SELECT l.id, l.path, l.title, l.artist, l.album, l.duration_s,
               l.file_size, l.format, l.has_artwork, l.added_at,
               l.source, l.source_url,
               GROUP_CONCAT(tt.tag_id) AS tag_ids_csv
        FROM library l
        LEFT JOIN track_tags tt ON tt.track_id = l.id
        WHERE l.id IN (${placeholders})
        GROUP BY l.id
        `,
      )
      .all(...trackIds) as Array<
      { id: string; tag_ids_csv: string | null } & Record<string, unknown>
    >;

    const byId = new Map(
      rows.map(({ tag_ids_csv, ...rest }) => [
        rest.id,
        { ...rest, tag_ids: tag_ids_csv ? tag_ids_csv.split(",") : [] },
      ]),
    );
    const ordered = trackIds.map((id) => byId.get(id)).filter(Boolean);
    return c.json({ tracks: ordered });
  });

  routes.post("/playlists/:id/tracks", async (c) => {
    const body = await c.req.json<{ trackId?: string }>();
    if (!body.trackId) return c.json({ error: "trackId required" }, 400);
    const ok = addTrackToPlaylist(getDb(), c.req.param("id"), body.trackId);
    return c.json({ ok });
  });

  routes.post("/playlists/:id/tracks/batch", async (c) => {
    const body = await c.req.json<{ trackIds?: string[] }>();
    if (!Array.isArray(body.trackIds) || body.trackIds.length === 0) {
      return c.json({ error: "trackIds array required" }, 400);
    }
    const db = getDb();
    let added = 0;
    let skipped = 0;
    const txn = db.transaction((ids: string[]) => {
      for (const id of ids) {
        if (addTrackToPlaylist(db, c.req.param("id"), id)) added++;
        else skipped++;
      }
    });
    txn(body.trackIds);
    return c.json({ added, skipped });
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
