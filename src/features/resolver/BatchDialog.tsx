import { useEffect, useState } from "react";
import { Loader2, ListPlus, CheckCircle2, AlertTriangle } from "lucide-react";
import { motion } from "motion/react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { detectSource } from "@/lib/detect-source";
import { streamDownload } from "@/lib/download-stream";
import { saveTrackCloud, syncKey } from "@/lib/sync";
import { useAuth } from "@/features/auth/useAuth";
import type { ResolvedItem, TrackMeta } from "@/lib/types";

interface BatchDialogProps {
  open: boolean;
  initialUrls?: string[];
  onClose: () => void;
  onFinished: () => void;
}

type RunStatus =
  | { kind: "idle" }
  | {
      kind: "running";
      urlIndex: number;
      totalUrls: number;
      trackIndex: number;
      totalTracks: number;
      currentTitle: string;
      percent: number;
    }
  | { kind: "done"; downloaded: number; failed: number; skipped: number };

export function BatchDialog({
  open,
  initialUrls,
  onClose,
  onFinished,
}: BatchDialogProps) {
  const [text, setText] = useState("");
  const [status, setStatus] = useState<RunStatus>({ kind: "idle" });
  const { user } = useAuth();

  useEffect(() => {
    if (open && initialUrls && initialUrls.length > 0 && !text) {
      setText(initialUrls.join("\n"));
    }
    if (!open) {
      setStatus({ kind: "idle" });
    }
  }, [open, initialUrls, text]);

  const urls = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => {
      try {
        new URL(l);
        return true;
      } catch {
        return false;
      }
    });

  const recognized = urls.filter(
    (u) => detectSource(u).source !== "unknown",
  );

  async function run() {
    if (recognized.length === 0) return;
    let downloaded = 0;
    let failed = 0;
    let skipped = 0;

    for (let i = 0; i < recognized.length; i++) {
      const url = recognized[i];

      setStatus({
        kind: "running",
        urlIndex: i + 1,
        totalUrls: recognized.length,
        trackIndex: 0,
        totalTracks: 0,
        currentTitle: url,
        percent: 0,
      });

      let resolved: ResolvedItem;
      try {
        const res = await fetch("/api/resolve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url }),
        });
        if (!res.ok) throw new Error(`resolve HTTP ${res.status}`);
        resolved = (await res.json()) as ResolvedItem;
      } catch (err) {
        console.warn("resolve failed for", url, err);
        skipped++;
        continue;
      }

      const tracks: TrackMeta[] =
        resolved.source === "spotify" || resolved.kind === "track"
          ? resolved.tracks
          : [];

      if (resolved.source !== "spotify" && resolved.kind !== "track") {
        try {
          await streamDownload({ url: resolved.source_url }, (ev) => {
            setStatus((prev) =>
              prev.kind === "running"
                ? {
                    ...prev,
                    percent: ev.percent ?? prev.percent,
                    currentTitle: resolved.title,
                  }
                : prev,
            );
          });
          downloaded++;
        } catch (err) {
          console.warn("download failed for", url, err);
          failed++;
        }
        continue;
      }

      for (let j = 0; j < tracks.length; j++) {
        const t = tracks[j];
        setStatus({
          kind: "running",
          urlIndex: i + 1,
          totalUrls: recognized.length,
          trackIndex: j + 1,
          totalTracks: tracks.length,
          currentTitle: t.title,
          percent: 0,
        });

        const downloadUrl =
          resolved.source === "spotify"
            ? `ytsearch1:${t.artist} ${t.title}`.trim()
            : t.source_url;

        try {
          await streamDownload(
            {
              url: downloadUrl,
              title: t.title,
              artist: t.artist,
              album: resolved.kind === "album" ? resolved.title : undefined,
            },
            (ev) => {
              setStatus((prev) =>
                prev.kind === "running"
                  ? { ...prev, percent: ev.percent ?? prev.percent }
                  : prev,
              );
            },
          );
          downloaded++;

          if (user) {
            try {
              await saveTrackCloud(user.uid, {
                id: syncKey({
                  source: resolved.source,
                  sourceId: t.id,
                  title: t.title,
                  artist: t.artist,
                }),
                title: t.title,
                artist: t.artist || null,
                album: resolved.kind === "album" ? resolved.title : null,
                source: resolved.source,
                source_url: t.source_url,
                artwork_url: t.artwork_url ?? resolved.artwork_url ?? null,
              });
            } catch {
              // sync failure is non-blocking
            }
          }
        } catch (err) {
          console.warn("download failed for track", t.title, err);
          failed++;
        }
      }
    }

    setStatus({ kind: "done", downloaded, failed, skipped });
    onFinished();
    if (downloaded > 0) {
      toast.success(`Batch done: ${downloaded} downloaded`, {
        description:
          failed || skipped
            ? `${failed} failed, ${skipped} unresolvable`
            : undefined,
      });
    } else if (failed + skipped > 0) {
      toast.error(`Batch finished with no successful downloads`, {
        description: `${failed} failed, ${skipped} unresolvable`,
      });
    }
  }

  const running = status.kind === "running";

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Batch download</DialogTitle>
          <DialogDescription>
            Paste multiple URLs (one per line). Spotify / SoundCloud / YouTube all work.
          </DialogDescription>
        </DialogHeader>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={running}
          placeholder="https://open.spotify.com/track/…&#10;https://soundcloud.com/…&#10;https://www.youtube.com/watch?v=…"
          className="h-40 w-full resize-none rounded-md border border-input bg-transparent px-3 py-2 font-mono text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
        />

        <div className="text-xs text-muted-foreground">
          {recognized.length} recognized URL{recognized.length === 1 ? "" : "s"}
          {urls.length > recognized.length && (
            <>, {urls.length - recognized.length} unrecognized (will be skipped)</>
          )}
        </div>

        {running && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-1 rounded-md border border-border/40 bg-card/40 p-3 text-xs"
          >
            <div className="flex justify-between text-muted-foreground">
              <span className="truncate">{status.currentTitle}</span>
              <span className="shrink-0 tabular-nums">
                URL {status.urlIndex}/{status.totalUrls}
                {status.totalTracks > 0
                  ? ` · Track ${status.trackIndex}/${status.totalTracks}`
                  : ""}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <motion.div
                className="h-full bg-primary"
                animate={{ width: `${status.percent}%` }}
                transition={{ duration: 0.2 }}
              />
            </div>
          </motion.div>
        )}

        {status.kind === "done" && (
          <div className="flex items-center gap-2 rounded-md border border-border/40 bg-card/40 p-3 text-sm">
            {status.downloaded > 0 ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-amber-500" />
            )}
            <span>
              {status.downloaded} downloaded · {status.failed} failed ·{" "}
              {status.skipped} skipped
            </span>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={running}>
            {status.kind === "done" ? "Close" : "Cancel"}
          </Button>
          <Button
            onClick={run}
            disabled={running || recognized.length === 0}
            className="gap-2"
          >
            {running ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ListPlus className="h-4 w-4" />
            )}
            {running
              ? `Running…`
              : status.kind === "done"
                ? "Run again"
                : `Start ${recognized.length} URL${recognized.length === 1 ? "" : "s"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
