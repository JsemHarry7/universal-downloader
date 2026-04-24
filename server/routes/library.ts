import { Hono } from "hono";
import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { getDb } from "../lib/db";
import {
  scanDir,
  deleteLibraryItem,
  updateLibraryItem,
} from "../lib/library";
import { DATA_DIR, DEFAULT_DOWNLOAD_DIR } from "../lib/paths";

const mimeForFormat: Record<string, string> = {
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  flac: "audio/flac",
  opus: "audio/ogg",
  ogg: "audio/ogg",
  webm: "audio/webm",
  wav: "audio/wav",
  aac: "audio/aac",
};

export function libraryRoutes() {
  const routes = new Hono();

  routes.get("/library", (c) => {
    const db = getDb();
    const rows = db
      .prepare(
        `
        SELECT l.id, l.path, l.title, l.artist, l.album, l.duration_s,
               l.file_size, l.format, l.has_artwork, l.added_at,
               l.source, l.source_url,
               GROUP_CONCAT(tt.tag_id) AS tag_ids_csv
        FROM library l
        LEFT JOIN track_tags tt ON tt.track_id = l.id
        GROUP BY l.id
        ORDER BY l.added_at DESC
      `,
      )
      .all() as Array<{ tag_ids_csv: string | null } & Record<string, unknown>>;
    const tracks = rows.map((r) => {
      const { tag_ids_csv, ...rest } = r;
      return {
        ...rest,
        tag_ids: tag_ids_csv ? tag_ids_csv.split(",") : [],
      };
    });
    return c.json({ tracks });
  });

  routes.get("/library/:id/artwork", (c) => {
    const id = c.req.param("id");
    const p = path.join(DATA_DIR, "artwork", `${id}.jpg`);
    if (!fs.existsSync(p)) return c.notFound();
    const buf = fs.readFileSync(p);
    return c.body(buf, 200, {
      "Content-Type": "image/jpeg",
      "Cache-Control": "max-age=3600",
    });
  });

  routes.get("/library/:id/audio", (c) => {
    const id = c.req.param("id");
    const row = getDb()
      .prepare("SELECT path, format FROM library WHERE id = ?")
      .get(id) as { path: string; format: string } | undefined;
    if (!row || !fs.existsSync(row.path)) return c.notFound();

    const stat = fs.statSync(row.path);
    const mime = mimeForFormat[row.format] ?? "application/octet-stream";
    const rangeHeader = c.req.header("range");

    if (rangeHeader) {
      const m = rangeHeader.match(/bytes=(\d*)-(\d*)/);
      if (m) {
        const start = m[1] ? parseInt(m[1], 10) : 0;
        const end = m[2] ? parseInt(m[2], 10) : stat.size - 1;
        const chunkSize = end - start + 1;
        const nodeStream = fs.createReadStream(row.path, { start, end });
        return new Response(Readable.toWeb(nodeStream) as any, {
          status: 206,
          headers: {
            "Content-Range": `bytes ${start}-${end}/${stat.size}`,
            "Accept-Ranges": "bytes",
            "Content-Length": String(chunkSize),
            "Content-Type": mime,
          },
        });
      }
    }

    const nodeStream = fs.createReadStream(row.path);
    return new Response(Readable.toWeb(nodeStream) as any, {
      headers: {
        "Content-Length": String(stat.size),
        "Content-Type": mime,
        "Accept-Ranges": "bytes",
      },
    });
  });

  routes.delete("/library/:id", async (c) => {
    const result = await deleteLibraryItem(getDb(), c.req.param("id"));
    if (!result.deleted) return c.json({ error: "not found" }, 404);
    return c.json({ ok: true });
  });

  routes.patch("/library/:id", async (c) => {
    const body = await c.req.json<{
      title?: string;
      artist?: string;
      album?: string;
    }>();
    try {
      const result = await updateLibraryItem(
        getDb(),
        c.req.param("id"),
        body,
      );
      if (!result.updated) return c.json({ error: "not found" }, 404);
      return c.json({ ok: true, path: result.path });
    } catch (err) {
      return c.json({ error: (err as Error).message }, 500);
    }
  });

  routes.post("/library/scan", async (c) => {
    const result = await scanDir(DEFAULT_DOWNLOAD_DIR, getDb());
    return c.json(result);
  });

  routes.get("/library/duplicates", (c) => {
    const db = getDb();
    const rows = db
      .prepare(
        `SELECT id, path, title, artist, album, duration_s, file_size,
                format, has_artwork, added_at, source, source_url
         FROM library`,
      )
      .all() as Array<{
      id: string;
      path: string;
      title: string;
      artist: string | null;
      album: string | null;
      duration_s: number;
      file_size: number;
      format: string;
      has_artwork: number;
      added_at: number;
      source: string | null;
      source_url: string | null;
    }>;

    const normalize = (s: string) =>
      s.toLowerCase().replace(/[^a-z0-9]/g, "");
    const groups = new Map<string, typeof rows>();
    for (const t of rows) {
      if (!t.title) continue;
      const key = `${normalize(t.title)}|${normalize(t.artist ?? "")}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(t);
    }

    const duplicates: Array<typeof rows> = [];
    for (const tracks of groups.values()) {
      if (tracks.length < 2) continue;
      const sorted = [...tracks].sort(
        (a, b) => a.duration_s - b.duration_s,
      );
      const median = sorted[Math.floor(sorted.length / 2)].duration_s;
      const cluster = sorted.filter(
        (t) => Math.abs(t.duration_s - median) <= 3,
      );
      if (cluster.length >= 2) {
        duplicates.push(cluster.map((t) => ({ ...t, tag_ids: [] })));
      }
    }

    return c.json({ groups: duplicates });
  });

  return routes;
}
