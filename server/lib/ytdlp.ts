import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { writeFile } from "node:fs/promises";
import fs from "node:fs";
import path from "node:path";
import { BIN_DIR, ensureDir } from "./paths";

const execFileAsync = promisify(execFile);

const YTDLP_URL =
  "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe";
const LOCAL_PATH = path.join(BIN_DIR, "yt-dlp.exe");

export async function ensureYtdlp(): Promise<string> {
  if (fs.existsSync(LOCAL_PATH)) {
    return LOCAL_PATH;
  }

  try {
    const { stdout } = await execFileAsync("yt-dlp", ["--version"]);
    if (stdout.trim().length > 0) return "yt-dlp";
  } catch {
    // fall through to download
  }

  console.log(`  fetching yt-dlp → ${LOCAL_PATH}`);
  ensureDir(BIN_DIR);
  const res = await fetch(YTDLP_URL);
  if (!res.ok) {
    throw new Error(`yt-dlp download failed: HTTP ${res.status}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(LOCAL_PATH, buf);
  return LOCAL_PATH;
}

export async function ytdlpVersion(executable: string): Promise<string> {
  const { stdout } = await execFileAsync(executable, ["--version"]);
  return stdout.trim();
}
