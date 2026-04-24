import Database from "better-sqlite3";
import path from "node:path";
import { DATA_DIR, ensureDir } from "./paths";

let db: Database.Database | undefined;

export function getDb(): Database.Database {
  if (db) return db;
  ensureDir(DATA_DIR);
  const dbPath = path.join(DATA_DIR, "library.db");
  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  initSchema(db);
  return db;
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS library (
      id TEXT PRIMARY KEY,
      path TEXT UNIQUE NOT NULL,
      title TEXT,
      artist TEXT,
      album TEXT,
      duration_s INTEGER,
      file_size INTEGER,
      format TEXT,
      has_artwork INTEGER NOT NULL DEFAULT 0,
      added_at INTEGER NOT NULL,
      file_mtime INTEGER NOT NULL,
      source TEXT,
      source_id TEXT,
      source_url TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_library_artist ON library(artist);
    CREATE INDEX IF NOT EXISTS idx_library_added ON library(added_at DESC);
  `);
}
