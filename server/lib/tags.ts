import { randomUUID } from "node:crypto";
import type { Database } from "better-sqlite3";

export interface Tag {
  id: string;
  name: string;
  color: string;
  created_at: number;
  track_count: number;
}

const DEFAULT_COLORS = [
  "emerald",
  "orange",
  "sky",
  "violet",
  "amber",
  "rose",
  "cyan",
  "lime",
] as const;

export function listTags(db: Database): Tag[] {
  return db
    .prepare(
      `
      SELECT t.id, t.name, t.color, t.created_at, COUNT(tt.track_id) AS track_count
      FROM tags t
      LEFT JOIN track_tags tt ON tt.tag_id = t.id
      GROUP BY t.id
      ORDER BY t.name
      `,
    )
    .all() as Tag[];
}

export function createTag(
  db: Database,
  name: string,
  color?: string,
  id?: string,
): Tag {
  const finalId = id ?? randomUUID();
  const created_at = Date.now();
  const used = DEFAULT_COLORS[(countTags(db) % DEFAULT_COLORS.length)];
  const chosen = color ?? used;
  db.prepare(
    "INSERT OR IGNORE INTO tags (id, name, color, created_at) VALUES (?, ?, ?, ?)",
  ).run(finalId, name, chosen, created_at);
  const row = db
    .prepare("SELECT id, name, color, created_at FROM tags WHERE id = ?")
    .get(finalId) as {
    id: string;
    name: string;
    color: string;
    created_at: number;
  };
  return { ...row, track_count: 0 };
}

function countTags(db: Database): number {
  const row = db.prepare("SELECT COUNT(*) AS n FROM tags").get() as { n: number };
  return row.n;
}

export function updateTag(
  db: Database,
  id: string,
  fields: { name?: string; color?: string },
): boolean {
  const sets: string[] = [];
  const values: unknown[] = [];
  if (fields.name !== undefined) {
    sets.push("name = ?");
    values.push(fields.name);
  }
  if (fields.color !== undefined) {
    sets.push("color = ?");
    values.push(fields.color);
  }
  if (sets.length === 0) return false;
  values.push(id);
  const r = db
    .prepare(`UPDATE tags SET ${sets.join(", ")} WHERE id = ?`)
    .run(...values);
  return r.changes > 0;
}

export function deleteTag(db: Database, id: string): boolean {
  const r = db.prepare("DELETE FROM tags WHERE id = ?").run(id);
  return r.changes > 0;
}

export function attachTag(
  db: Database,
  tagId: string,
  trackId: string,
): boolean {
  try {
    db.prepare(
      "INSERT INTO track_tags (track_id, tag_id, added_at) VALUES (?, ?, ?)",
    ).run(trackId, tagId, Date.now());
    return true;
  } catch {
    return false;
  }
}

export function detachTag(
  db: Database,
  tagId: string,
  trackId: string,
): boolean {
  const r = db
    .prepare("DELETE FROM track_tags WHERE track_id = ? AND tag_id = ?")
    .run(trackId, tagId);
  return r.changes > 0;
}

export function tagIdsForTrack(db: Database, trackId: string): string[] {
  const rows = db
    .prepare("SELECT tag_id FROM track_tags WHERE track_id = ?")
    .all(trackId) as { tag_id: string }[];
  return rows.map((r) => r.tag_id);
}

export function trackIdsForTag(db: Database, tagId: string): string[] {
  const rows = db
    .prepare("SELECT track_id FROM track_tags WHERE tag_id = ?")
    .all(tagId) as { track_id: string }[];
  return rows.map((r) => r.track_id);
}
