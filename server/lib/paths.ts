import path from "node:path";
import os from "node:os";
import fs from "node:fs";

export const PROJECT_ROOT = process.cwd();
export const BIN_DIR = path.join(PROJECT_ROOT, "bin");
export const DATA_DIR = path.join(PROJECT_ROOT, "data");
export const DEFAULT_DOWNLOAD_DIR = path.join(
  os.homedir(),
  "Music",
  "universal-downloader",
);

export function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}
