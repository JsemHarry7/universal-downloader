import { useState } from "react";
import { Cloud, Download, Loader2, Music } from "lucide-react";
import { motion } from "motion/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { SavedTrack } from "@/lib/types";

interface SavedTrackCardProps {
  track: SavedTrack;
  index: number;
  onDownloaded: () => void;
}

type Status =
  | { kind: "idle" }
  | { kind: "downloading"; percent: number; stage?: string }
  | { kind: "done" }
  | { kind: "error" };

export function SavedTrackCard({
  track,
  index,
  onDownloaded,
}: SavedTrackCardProps) {
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  async function handleDownload() {
    setStatus({ kind: "downloading", percent: 0 });
    try {
      const url =
        track.source_url && track.source !== "spotify"
          ? track.source_url
          : `ytsearch1:${track.artist ?? ""} ${track.title}`.trim();

      const res = await fetch("/api/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          title: track.title,
          artist: track.artist ?? undefined,
          album: track.album ?? undefined,
        }),
      });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let error: Error | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            const event = JSON.parse(trimmed) as
              | { type: "progress"; percent: number }
              | { type: "stage"; name: string }
              | { type: "done"; outputFiles: string[] }
              | { type: "error"; message: string };
            if (event.type === "progress") {
              setStatus({ kind: "downloading", percent: event.percent });
            } else if (event.type === "stage") {
              setStatus((prev) =>
                prev.kind === "downloading"
                  ? { ...prev, stage: event.name }
                  : prev,
              );
            } else if (event.type === "error") {
              error = new Error(event.message);
            }
          } catch {
            // ignore non-JSON
          }
        }
      }

      if (error) throw error;

      setStatus({ kind: "done" });
      toast.success(`Downloaded "${track.title}"`);
      onDownloaded();
    } catch (err) {
      setStatus({ kind: "error" });
      toast.error("Download failed", {
        description: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 0.7, y: 0 }}
      whileHover={{ opacity: 1 }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.02, 0.3) }}
      className="group relative overflow-hidden rounded-lg border border-dashed border-border/50 bg-card/30 backdrop-blur-sm transition-all hover:border-border hover:bg-card/60"
    >
      <div className="relative aspect-square overflow-hidden bg-muted">
        {track.artwork_url ? (
          <img
            src={track.artwork_url}
            alt={track.title}
            className="h-full w-full object-cover grayscale transition-all group-hover:grayscale-0"
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-muted to-muted-foreground/10">
            <Music className="h-10 w-10 text-muted-foreground/40" />
          </div>
        )}

        <div className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-md bg-background/80 px-2 py-0.5 text-xs font-medium backdrop-blur">
          <Cloud className="h-3 w-3" />
          Saved
        </div>
      </div>

      <div className="space-y-2 p-3">
        <div>
          <h3 className="truncate text-sm font-medium">{track.title}</h3>
          <p className="truncate text-xs text-muted-foreground">
            {track.artist ?? "Unknown artist"}
          </p>
        </div>

        {status.kind === "downloading" && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span className="truncate">
                {status.stage ?? "downloading"}
              </span>
              <span className="shrink-0 tabular-nums">
                {Math.round(status.percent)}%
              </span>
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-muted">
              <motion.div
                className="h-full bg-primary"
                animate={{ width: `${status.percent}%` }}
                transition={{ duration: 0.2 }}
              />
            </div>
          </div>
        )}

        <Button
          size="sm"
          variant="outline"
          className="w-full gap-2"
          onClick={handleDownload}
          disabled={status.kind === "downloading" || status.kind === "done"}
        >
          {status.kind === "downloading" ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Download className="h-3 w-3" />
          )}
          {status.kind === "downloading"
            ? "Downloading…"
            : status.kind === "done"
              ? "Downloaded"
              : "Download here"}
        </Button>
      </div>
    </motion.div>
  );
}
