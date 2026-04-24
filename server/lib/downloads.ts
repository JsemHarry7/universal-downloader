import { spawn } from "node:child_process";
import readline from "node:readline";
import NodeID3 from "node-id3";
import { ensureDir } from "./paths";
import { getDb } from "./db";
import { indexTrack } from "./library";

export interface DownloadOptions {
  url: string;
  destDir: string;
  title?: string;
  artist?: string;
  album?: string;
  ffmpegDir?: string;
}

export type DownloadEvent =
  | { type: "stage"; name: string }
  | {
      type: "progress";
      percent: number;
      total?: string;
      speed?: string;
      eta?: string;
    };

export interface StreamingDownloadResult {
  outputFiles: string[];
  libraryIds: string[];
}

function safeFilenameComponent(s: string): string {
  return s
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

const PROGRESS_RE =
  /\[download\]\s+(\d+(?:\.\d+)?)%\s+of\s+~?\s*([\d.]+\s*\w+)(?:\s+at\s+(\S+))?(?:\s+ETA\s+(\S+))?/;
const STAGE_RE = /^\[([A-Za-z][\w:]*)\]/;

export async function downloadUrlStream(
  ytdlpPath: string,
  opts: DownloadOptions,
  onEvent: (ev: DownloadEvent) => void,
): Promise<StreamingDownloadResult> {
  ensureDir(opts.destDir);

  const destPrefix = opts.destDir.replace(/\\/g, "/");
  const outputTemplate =
    opts.artist && opts.title
      ? `${destPrefix}/${safeFilenameComponent(opts.artist)} - ${safeFilenameComponent(opts.title)}.%(ext)s`
      : `${destPrefix}/%(uploader)s - %(title)s.%(ext)s`;

  const args = [
    "--no-warnings",
    "--newline",
    "--progress",
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
    "after_move:UDL_DONE:%(filepath)s",
  ];

  if (opts.ffmpegDir) {
    args.push("--ffmpeg-location", opts.ffmpegDir);
  }
  args.push(opts.url);

  const outputFiles: string[] = [];

  await new Promise<void>((resolve, reject) => {
    const proc = spawn(ytdlpPath, args, {
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, PYTHONUNBUFFERED: "1" },
    });

    const stdoutReader = readline.createInterface({ input: proc.stdout });
    const stderrReader = readline.createInterface({ input: proc.stderr });

    let lastReportedPercent = -1;
    let lastReportedStage = "";

    const handleLine = (line: string) => {
      if (line.startsWith("UDL_DONE:")) {
        outputFiles.push(line.slice("UDL_DONE:".length).trim());
        return;
      }

      const progressMatch = line.match(PROGRESS_RE);
      if (progressMatch) {
        const percent = parseFloat(progressMatch[1]);
        if (
          percent === 100 ||
          percent - lastReportedPercent >= 1 ||
          percent < lastReportedPercent
        ) {
          lastReportedPercent = percent;
          onEvent({
            type: "progress",
            percent,
            total: progressMatch[2],
            speed: progressMatch[3],
            eta: progressMatch[4],
          });
        }
        return;
      }

      const stageMatch = line.match(STAGE_RE);
      if (stageMatch) {
        const name = stageMatch[1];
        if (name !== "download" && name !== lastReportedStage) {
          lastReportedStage = name;
          onEvent({ type: "stage", name });
        }
      }
    };

    stdoutReader.on("line", handleLine);
    stderrReader.on("line", handleLine);

    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`yt-dlp exited with code ${code}`));
        return;
      }
      resolve();
    });
  });

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

  const libraryIds: string[] = [];
  for (const file of outputFiles) {
    try {
      const id = await indexTrack(file, getDb());
      libraryIds.push(id);
    } catch (err) {
      console.warn(`indexing failed for ${file}:`, (err as Error).message);
      libraryIds.push("");
    }
  }

  return { outputFiles, libraryIds };
}
