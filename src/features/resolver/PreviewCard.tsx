import { useState } from "react";
import {
  Download,
  Music,
  ListMusic,
  Disc3,
  Loader2,
  CheckCircle2,
  X,
} from "lucide-react";
import { motion } from "motion/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/features/auth/useAuth";
import { saveTrackCloud, syncKey } from "@/lib/sync";
import type { ResolvedItem, TrackMeta } from "@/lib/types";

const kindIcon = {
  track: Music,
  playlist: ListMusic,
  album: Disc3,
} as const;

const sourceAccent = {
  spotify: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  soundcloud: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  youtube: "bg-red-500/15 text-red-400 border-red-500/30",
  other: "bg-muted/50 text-muted-foreground border-border",
} as const;

interface PreviewCardProps {
  item: ResolvedItem;
  onClear: () => void;
}

type Status =
  | { kind: "idle" }
  | { kind: "downloading"; current: number; total: number; trackTitle: string }
  | { kind: "done"; downloaded: number };

async function downloadOne(
  body: { url: string; title?: string; artist?: string; album?: string },
): Promise<string[]> {
  const res = await fetch("/api/download", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
  const data = (await res.json()) as { outputFiles: string[] };
  return data.outputFiles ?? [];
}

export function PreviewCard({ item, onClear }: PreviewCardProps) {
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const KindIcon = kindIcon[item.kind];
  const { user } = useAuth();

  async function syncOne(t: TrackMeta) {
    if (!user) return;
    try {
      await saveTrackCloud(user.uid, {
        id: syncKey({
          source: item.source,
          sourceId: t.id,
          title: t.title,
          artist: t.artist,
        }),
        title: t.title,
        artist: t.artist || null,
        album: item.kind === "album" ? item.title : null,
        source: item.source,
        source_url: t.source_url,
        artwork_url: t.artwork_url ?? item.artwork_url ?? null,
      });
    } catch (err) {
      console.warn("cloud sync failed:", err);
    }
  }

  async function handleDownload() {
    const pending = toast.loading(`Starting ${item.title}…`);
    const outputs: string[] = [];
    try {
      if (item.source === "spotify") {
        const total = item.tracks.length;
        for (let i = 0; i < total; i++) {
          const t: TrackMeta = item.tracks[i];
          setStatus({
            kind: "downloading",
            current: i + 1,
            total,
            trackTitle: t.title,
          });
          toast.loading(`Track ${i + 1}/${total}: ${t.title}`, { id: pending });
          const query = `ytsearch1:${t.artist} ${t.title}`.trim();
          try {
            const files = await downloadOne({
              url: query,
              title: t.title,
              artist: t.artist,
              album: item.kind === "album" ? item.title : undefined,
            });
            outputs.push(...files);
            await syncOne(t);
          } catch (err) {
            console.warn(`Skipping ${t.title}:`, err);
          }
        }
      } else {
        setStatus({
          kind: "downloading",
          current: 1,
          total: 1,
          trackTitle: item.title,
        });
        const files = await downloadOne({ url: item.source_url });
        outputs.push(...files);
        if (item.kind === "track" && item.tracks[0]) {
          await syncOne(item.tracks[0]);
        }
      }
      setStatus({ kind: "done", downloaded: outputs.length });
      toast.success(
        outputs.length === 1
          ? "Downloaded"
          : `Downloaded ${outputs.length}/${item.tracks.length} tracks`,
        {
          id: pending,
          description: outputs[0] ?? undefined,
        },
      );
    } catch (err) {
      setStatus({ kind: "idle" });
      toast.error("Download failed", {
        id: pending,
        description: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const isDownloading = status.kind === "downloading";
  const isDone = status.kind === "done";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="relative overflow-hidden rounded-xl border border-border/60 bg-card/60 shadow-xl shadow-black/10 backdrop-blur-md"
    >
      <Button
        variant="ghost"
        size="icon"
        onClick={onClear}
        className="absolute right-2 top-2 z-10 h-8 w-8"
        title="Clear"
      >
        <X className="h-4 w-4" />
      </Button>

      <div className="flex gap-5 p-5">
        <div className="relative shrink-0">
          {item.artwork_url ? (
            <img
              src={item.artwork_url}
              alt={item.title}
              className="h-32 w-32 rounded-lg object-cover shadow-lg ring-1 ring-border/40"
            />
          ) : (
            <div className="flex h-32 w-32 items-center justify-center rounded-lg bg-muted">
              <KindIcon className="h-10 w-10 text-muted-foreground" />
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium capitalize",
                sourceAccent[item.source],
              )}
            >
              {item.source}
            </span>
            <span className="inline-flex items-center gap-1 rounded-md bg-accent/50 px-2 py-0.5 text-xs font-medium capitalize text-accent-foreground">
              <KindIcon className="h-3 w-3" />
              {item.kind}
            </span>
            {item.track_count > 1 && (
              <span className="text-xs text-muted-foreground">
                {item.track_count} tracks
              </span>
            )}
          </div>

          <h2 className="truncate text-xl font-semibold tracking-tight">
            {item.title}
          </h2>
          {item.artist && (
            <p className="truncate text-sm text-muted-foreground">{item.artist}</p>
          )}

          {isDownloading && (
            <div className="mt-1 space-y-1 text-xs text-muted-foreground">
              <div className="flex justify-between">
                <span className="truncate">{status.trackTitle}</span>
                <span className="ml-2 shrink-0 tabular-nums">
                  {status.current}/{status.total}
                </span>
              </div>
              <div className="h-1 overflow-hidden rounded-full bg-muted">
                <motion.div
                  className="h-full bg-primary"
                  initial={{ width: 0 }}
                  animate={{
                    width: `${(status.current / status.total) * 100}%`,
                  }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            </div>
          )}

          <div className="mt-auto flex gap-2 pt-2">
            <Button
              onClick={handleDownload}
              disabled={isDownloading}
              className="gap-2"
            >
              {isDownloading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isDone ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              {isDownloading
                ? `Downloading ${status.current}/${status.total}…`
                : isDone
                  ? `Downloaded ${status.downloaded}`
                  : item.kind === "track"
                    ? "Download"
                    : `Download all ${item.track_count}`}
            </Button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
