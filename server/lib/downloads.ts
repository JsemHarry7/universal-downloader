import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { ensureDir } from "./paths";

const execFileAsync = promisify(execFile);

export interface DownloadOptions {
  url: string;
  destDir: string;
  title?: string;
  artist?: string;
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
    "-f",
    "bestaudio/best",
    "-o",
    outputTemplate,
    "--print",
    "after_move:filepath",
    opts.url,
  ];

  const { stdout } = await execFileAsync(ytdlpPath, args, {
    maxBuffer: 1024 * 1024 * 500,
  });

  const outputFiles = stdout
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);

  return { outputFiles };
}
