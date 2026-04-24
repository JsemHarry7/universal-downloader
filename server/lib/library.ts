import fsp from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { parseFile } from "music-metadata";
import type { Database } from "better-sqlite3";
import { DATA_DIR, ensureDir } from "./paths";

const AUDIO_EXTS = new Set([
  ".mp3",
  ".m4a",
  ".flac",
  ".opus",
  ".webm",
  ".ogg",
  ".wav",
  ".aac",
]);

export interface ScanResult {
  indexed: number;
  removed: number;
  errors: number;
}

export async function scanDir(
  dir: string,
  db: Database,
): Promise<ScanResult> {
  const seenPaths = new Set<string>();
  let indexed = 0;
  let errors = 0;

  async function walk(current: string) {
    let entries;
    try {
      entries = await fsp.readdir(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (AUDIO_EXTS.has(ext)) {
          seenPaths.add(full);
          try {
            await indexTrack(full, db);
            indexed++;
          } catch (err) {
            console.warn(
              `scan: failed to index ${full}:`,
              (err as Error).message,
            );
            errors++;
          }
        }
      }
    }
  }

  ensureDir(dir);
  await walk(dir);

  const existing = db
    .prepare("SELECT id, path FROM library")
    .all() as Array<{ id: string; path: string }>;
  const del = db.prepare("DELETE FROM library WHERE id = ?");
  let removed = 0;
  for (const row of existing) {
    if (!seenPaths.has(row.path)) {
      await removeArtwork(row.id);
      del.run(row.id);
      removed++;
    }
  }

  return { indexed, removed, errors };
}

export async function indexTrack(
  filepath: string,
  db: Database,
): Promise<string> {
  const stat = await fsp.stat(filepath);
  const mtime = Math.floor(stat.mtimeMs);

  const existing = db
    .prepare("SELECT id, file_mtime FROM library WHERE path = ?")
    .get(filepath) as { id: string; file_mtime: number } | undefined;

  if (existing && existing.file_mtime === mtime) return existing.id;

  const id = existing?.id ?? crypto.randomUUID();
  const ext = path.extname(filepath).slice(1).toLowerCase();

  let title = "";
  let artist: string | null = null;
  let album: string | null = null;
  let duration_s = 0;
  let hasArtwork = 0;
  let artworkBuffer: Buffer | null = null;

  try {
    const meta = await parseFile(filepath, { duration: true });
    title = meta.common.title ?? "";
    artist = meta.common.artist ?? null;
    album = meta.common.album ?? null;
    duration_s = Math.round(meta.format.duration ?? 0);
    const pic = meta.common.picture?.[0];
    if (pic) {
      artworkBuffer = Buffer.from(pic.data);
      hasArtwork = 1;
    }
  } catch {
    // metadata parse failed; fall through to filename parsing
  }

  if (!title || !artist) {
    const base = path.parse(filepath).name;
    const m = base.match(/^(.+?)\s+-\s+(.+)$/);
    if (m) {
      if (!artist) artist = m[1];
      if (!title) title = m[2];
    } else if (!title) {
      title = base;
    }
  }

  db.prepare(
    `
    INSERT INTO library (id, path, title, artist, album, duration_s, file_size, format, has_artwork, added_at, file_mtime)
    VALUES (@id, @path, @title, @artist, @album, @duration_s, @file_size, @format, @has_artwork, @added_at, @file_mtime)
    ON CONFLICT(path) DO UPDATE SET
      title = excluded.title,
      artist = excluded.artist,
      album = excluded.album,
      duration_s = excluded.duration_s,
      file_size = excluded.file_size,
      format = excluded.format,
      has_artwork = excluded.has_artwork,
      file_mtime = excluded.file_mtime
  `,
  ).run({
    id,
    path: filepath,
    title,
    artist,
    album,
    duration_s,
    file_size: stat.size,
    format: ext,
    has_artwork: hasArtwork,
    added_at: Date.now(),
    file_mtime: mtime,
  });

  if (artworkBuffer) {
    const artDir = path.join(DATA_DIR, "artwork");
    ensureDir(artDir);
    await fsp.writeFile(path.join(artDir, `${id}.jpg`), artworkBuffer);
  }

  return id;
}

async function removeArtwork(id: string) {
  try {
    await fsp.unlink(path.join(DATA_DIR, "artwork", `${id}.jpg`));
  } catch {
    // ignore missing
  }
}

export async function deleteLibraryItem(
  db: Database,
  id: string,
): Promise<{ deleted: boolean }> {
  const row = db
    .prepare("SELECT path FROM library WHERE id = ?")
    .get(id) as { path: string } | undefined;
  if (!row) return { deleted: false };
  try {
    await fsp.unlink(row.path);
  } catch {
    // file already gone
  }
  await removeArtwork(id);
  db.prepare("DELETE FROM library WHERE id = ?").run(id);
  return { deleted: true };
}

export interface UpdateOptions {
  title?: string;
  artist?: string;
  album?: string;
}

function safeFilenameComponent(s: string): string {
  return s.replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, " ").trim();
}

export async function updateLibraryItem(
  db: Database,
  id: string,
  opts: UpdateOptions,
): Promise<{ updated: boolean; path: string }> {
  const row = db
    .prepare(
      "SELECT path, title, artist, album, format FROM library WHERE id = ?",
    )
    .get(id) as
    | {
        path: string;
        title: string | null;
        artist: string | null;
        album: string | null;
        format: string;
      }
    | undefined;
  if (!row) return { updated: false, path: "" };

  let newPath = row.path;
  const titleChanged = opts.title !== undefined && opts.title !== row.title;
  const artistChanged = opts.artist !== undefined && opts.artist !== row.artist;

  if (titleChanged || artistChanged) {
    const newTitle = opts.title ?? row.title ?? "";
    const newArtist = opts.artist ?? row.artist ?? "";
    const safeTitle = safeFilenameComponent(newTitle);
    const safeArtist = safeFilenameComponent(newArtist);
    const newBase = safeArtist ? `${safeArtist} - ${safeTitle}` : safeTitle;
    const dir = path.dirname(row.path);
    newPath = path.join(dir, `${newBase}.${row.format}`);
    if (newPath !== row.path) {
      await fsp.rename(row.path, newPath);
    }
  }

  const updates: string[] = [];
  const values: Record<string, unknown> = { id };
  if (opts.title !== undefined) {
    updates.push("title = @title");
    values.title = opts.title;
  }
  if (opts.artist !== undefined) {
    updates.push("artist = @artist");
    values.artist = opts.artist;
  }
  if (opts.album !== undefined) {
    updates.push("album = @album");
    values.album = opts.album;
  }
  if (newPath !== row.path) {
    updates.push("path = @path");
    values.path = newPath;
  }

  if (updates.length > 0) {
    db.prepare(`UPDATE library SET ${updates.join(", ")} WHERE id = @id`).run(
      values,
    );
  }

  return { updated: true, path: newPath };
}
