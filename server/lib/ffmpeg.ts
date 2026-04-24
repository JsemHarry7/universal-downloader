import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { writeFile, unlink } from "node:fs/promises";
import fs from "node:fs";
import path from "node:path";
import AdmZip from "adm-zip";
import { BIN_DIR, ensureDir } from "./paths";

const execFileAsync = promisify(execFile);

const FFMPEG_URL =
  "https://github.com/BtbN/FFmpeg-Builds/releases/latest/download/ffmpeg-master-latest-win64-gpl.zip";
const LOCAL_FFMPEG = path.join(BIN_DIR, "ffmpeg.exe");

export async function ensureFfmpeg(): Promise<string> {
  if (fs.existsSync(LOCAL_FFMPEG)) {
    return LOCAL_FFMPEG;
  }

  try {
    const { stdout } = await execFileAsync("ffmpeg", ["-version"]);
    if (stdout.length > 0) return "ffmpeg";
  } catch {
    // fall through to download
  }

  console.log("  fetching ffmpeg (one-time, ~90 MB)...");
  ensureDir(BIN_DIR);
  const zipPath = path.join(BIN_DIR, "ffmpeg-download.zip");

  await downloadWithProgress(FFMPEG_URL, zipPath);

  console.log("  extracting ffmpeg.exe + ffprobe.exe...");
  const zip = new AdmZip(zipPath);
  const entries = zip.getEntries();
  let found = 0;
  for (const entry of entries) {
    const name = path.basename(entry.entryName).toLowerCase();
    if (name === "ffmpeg.exe" || name === "ffprobe.exe") {
      const outPath = path.join(BIN_DIR, name);
      await writeFile(outPath, entry.getData());
      found++;
    }
  }

  try {
    await unlink(zipPath);
  } catch {
    // best-effort
  }

  if (found < 2) {
    throw new Error(
      `ffmpeg extraction incomplete (${found}/2 expected binaries found)`,
    );
  }

  return LOCAL_FFMPEG;
}

async function downloadWithProgress(
  url: string,
  destPath: string,
): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`ffmpeg download failed: HTTP ${res.status}`);
  if (!res.body) throw new Error("ffmpeg download: no response body");

  const contentLength = Number(res.headers.get("content-length") ?? 0);
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  let lastReported = -1;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    if (contentLength > 0) {
      const pct = Math.floor((received / contentLength) * 100);
      if (pct >= lastReported + 10) {
        console.log(`    ${pct}% (${(received / 1024 / 1024).toFixed(1)} MB)`);
        lastReported = pct - (pct % 10);
      }
    }
  }

  await writeFile(destPath, Buffer.concat(chunks));
}

export async function ffmpegVersion(exe: string): Promise<string> {
  try {
    const { stdout } = await execFileAsync(exe, ["-version"]);
    const firstLine = stdout.split("\n")[0] ?? "";
    const m = firstLine.match(/ffmpeg version (\S+)/);
    return m?.[1] ?? firstLine.trim();
  } catch {
    return "unknown";
  }
}

export function ffmpegDirFor(ffmpegPath: string): string {
  if (!ffmpegPath || ffmpegPath === "ffmpeg") return "";
  return path.dirname(ffmpegPath);
}
