import { watch } from "node:fs";
import type { Database } from "better-sqlite3";
import { scanDir } from "./library";

const AUDIO_EXT = /\.(mp3|m4a|flac|opus|webm|ogg|wav|aac)$/i;
const DEBOUNCE_MS = 2000;

export function startDownloadDirWatcher(dir: string, db: Database): void {
  let timer: NodeJS.Timeout | null = null;
  let pending = false;

  const triggerScan = async () => {
    if (pending) return;
    pending = true;
    try {
      const r = await scanDir(dir, db);
      if (r.indexed > 0 || r.removed > 0) {
        console.log(
          `  auto-rescan: indexed=${r.indexed} removed=${r.removed} errors=${r.errors}`,
        );
      }
    } catch (err) {
      console.warn("  auto-rescan failed:", (err as Error).message);
    } finally {
      pending = false;
    }
  };

  try {
    watch(dir, { recursive: true, persistent: true }, (_eventType, filename) => {
      if (!filename || !AUDIO_EXT.test(filename)) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(triggerScan, DEBOUNCE_MS);
    });
    console.log(`  watching ${dir} for changes`);
  } catch (err) {
    console.warn(
      `  fs.watch on ${dir} failed; auto-rescan disabled:`,
      (err as Error).message,
    );
  }
}
