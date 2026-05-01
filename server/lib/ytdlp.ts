import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { chmod, rename, writeFile } from "node:fs/promises";
import fs from "node:fs";
import path from "node:path";
import { BIN_DIR, ensureDir } from "./paths";

const execFileAsync = promisify(execFile);

export const YTDLP_STALE_AFTER_DAYS = 60;

const YTDLP_BASE_URL =
  "https://github.com/yt-dlp/yt-dlp/releases/latest/download";
const LOCAL_FILENAME = process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp";
const LOCAL_PATH = path.join(BIN_DIR, LOCAL_FILENAME);

export interface ToolStatus {
  path: string;
  version: string;
  managed: boolean;
  stale: boolean;
  ageDays: number | null;
  staleAfterDays: number;
}

function ytdlpUrl(): string {
  return `${YTDLP_BASE_URL}/${LOCAL_FILENAME}`;
}

function versionAgeDays(version: string): number | null {
  const match = version.match(/^(\d{4})\.(\d{1,2})\.(\d{1,2})/);
  if (!match) return null;
  const releaseDate = Date.UTC(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
  );
  const now = Date.now();
  if (releaseDate > now) return 0;
  return Math.floor((now - releaseDate) / 86_400_000);
}

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
  return downloadManagedYtdlp();
}

export async function downloadManagedYtdlp(): Promise<string> {
  ensureDir(BIN_DIR);
  const res = await fetch(ytdlpUrl());
  if (!res.ok) {
    throw new Error(`yt-dlp download failed: HTTP ${res.status}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  const tmpPath = `${LOCAL_PATH}.download`;
  await writeFile(tmpPath, buf);
  if (process.platform !== "win32") {
    await chmod(tmpPath, 0o755);
  }
  await rename(tmpPath, LOCAL_PATH);
  return LOCAL_PATH;
}

export async function updateYtdlp(): Promise<ToolStatus> {
  const executable = await downloadManagedYtdlp();
  return ytdlpStatus(executable);
}

export async function ytdlpVersion(executable: string): Promise<string> {
  const { stdout } = await execFileAsync(executable, ["--version"]);
  return stdout.trim();
}

export async function ytdlpStatus(executable: string): Promise<ToolStatus> {
  const version = await ytdlpVersion(executable);
  const ageDays = versionAgeDays(version);
  return {
    path: executable,
    version,
    managed: path.resolve(executable) === path.resolve(LOCAL_PATH),
    stale: ageDays === null ? false : ageDays >= YTDLP_STALE_AFTER_DAYS,
    ageDays,
    staleAfterDays: YTDLP_STALE_AFTER_DAYS,
  };
}
