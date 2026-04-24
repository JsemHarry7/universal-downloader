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
        SELECT id, path, title, artist, album, duration_s, file_size, format, has_artwork, added_at, source, source_url
        FROM library
        ORDER BY added_at DESC
      `,
      )
      .all();
    return c.json({ tracks: rows });
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

  return routes;
}
