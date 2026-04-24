import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { logger } from "hono/logger";
import { ensureYtdlp, ytdlpVersion } from "./lib/ytdlp";
import { ensureFfmpeg, ffmpegVersion, ffmpegDirFor } from "./lib/ffmpeg";
import { DEFAULT_DOWNLOAD_DIR, ensureDir } from "./lib/paths";
import { downloadRoutes } from "./routes/download";
import { libraryRoutes } from "./routes/library";
import { getDb } from "./lib/db";
import { scanDir } from "./lib/library";
import { startDownloadDirWatcher } from "./lib/watcher";

const app = new Hono();

app.use("*", logger());

let ytdlpPath = "";
let ytdlpVer = "";
let ffmpegPath = "";
let ffmpegVer = "";

app.get("/api/health", (c) =>
  c.json({
    ok: true,
    uptime_s: Math.round(process.uptime()),
    ytdlp: { path: ytdlpPath, version: ytdlpVer },
    ffmpeg: { path: ffmpegPath, version: ffmpegVer },
    download_dir: DEFAULT_DOWNLOAD_DIR,
  }),
);

app.route(
  "/api",
  downloadRoutes(
    () => ytdlpPath,
    () => ffmpegDirFor(ffmpegPath),
  ),
);
app.route("/api", libraryRoutes());

async function main() {
  ensureDir(DEFAULT_DOWNLOAD_DIR);

  console.log("  resolving yt-dlp...");
  ytdlpPath = await ensureYtdlp();
  ytdlpVer = await ytdlpVersion(ytdlpPath);
  console.log(`  yt-dlp ${ytdlpVer} at ${ytdlpPath}`);

  console.log("  resolving ffmpeg...");
  ffmpegPath = await ensureFfmpeg();
  ffmpegVer = await ffmpegVersion(ffmpegPath);
  console.log(`  ffmpeg ${ffmpegVer} at ${ffmpegPath}`);

  const port = Number(process.env.PORT) || 8787;
  serve({ fetch: app.fetch, port }, (info) => {
    console.log(`\n  ➜  API ready on http://localhost:${info.port}\n`);
  });

  scanDir(DEFAULT_DOWNLOAD_DIR, getDb())
    .then((r) =>
      console.log(
        `  library scan: indexed=${r.indexed} removed=${r.removed} errors=${r.errors}`,
      ),
    )
    .catch((err) => console.warn("  library scan failed:", err.message));

  startDownloadDirWatcher(DEFAULT_DOWNLOAD_DIR, getDb());
}

main().catch((err) => {
  console.error("Server failed to start:", err);
  process.exit(1);
});
