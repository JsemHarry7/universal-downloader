import { execFile } from "node:child_process";
import { promisify } from "node:util";
import NodeID3 from "node-id3";
import { ensureDir } from "./paths";

const execFileAsync = promisify(execFile);

export interface DownloadOptions {
  url: string;
  destDir: string;
  title?: string;
  artist?: string;
  album?: string;
  ffmpegDir?: string;
}

export interface DownloadResult {
  outputFiles: string[];
}

function safeFilenameComponent(s: string): string {
  return s
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

export async function downloadUrl(
  ytdlpPath: string,
  opts: DownloadOptions,
): Promise<DownloadResult> {
  ensureDir(opts.destDir);

  const destPrefix = opts.destDir.replace(/\\/g, "/");

  const outputTemplate =
    opts.artist && opts.title
      ? `${destPrefix}/${safeFilenameComponent(opts.artist)} - ${safeFilenameComponent(opts.title)}.%(ext)s`
      : `${destPrefix}/%(uploader)s - %(title)s.%(ext)s`;

  const args = [
    "--no-warnings",
    "--extract-audio",
    "--audio-format",
    "mp3",
    "--audio-quality",
    "320K",
    "--embed-metadata",
    "--embed-thumbnail",
    "--convert-thumbnails",
    "jpg",
    "--force-overwrites",
    "-o",
    outputTemplate,
    "--print",
    "after_move:filepath",
  ];

  if (opts.ffmpegDir) {
    args.push("--ffmpeg-location", opts.ffmpegDir);
  }

  args.push(opts.url);

  const { stdout } = await execFileAsync(ytdlpPath, args, {
    maxBuffer: 1024 * 1024 * 500,
  });

  const outputFiles = stdout
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (opts.title || opts.artist || opts.album) {
    for (const file of outputFiles) {
      if (!file.toLowerCase().endsWith(".mp3")) continue;
      const tagUpdate: Record<string, string> = {};
      if (opts.title) tagUpdate.title = opts.title;
      if (opts.artist) tagUpdate.artist = opts.artist;
      if (opts.album) tagUpdate.album = opts.album;
      try {
        NodeID3.update(tagUpdate, file);
      } catch (err) {
        console.warn(`tag rewrite failed for ${file}:`, (err as Error).message);
      }
    }
  }

  return { outputFiles };
}
