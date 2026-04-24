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

export function SavedTrackCard({
  track,
  index,
  onDownloaded,
}: SavedTrackCardProps) {
  const [status, setStatus] = useState<"idle" | "downloading" | "done" | "error">("idle");

  async function handleDownload() {
    setStatus("downloading");
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
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      setStatus("done");
      toast.success(`Downloaded "${track.title}"`);
      onDownloaded();
    } catch (err) {
      setStatus("error");
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
        <Button
          size="sm"
          variant="outline"
          className="w-full gap-2"
          onClick={handleDownload}
          disabled={status === "downloading" || status === "done"}
        >
          {status === "downloading" ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Download className="h-3 w-3" />
          )}
          {status === "downloading"
            ? "Downloading…"
            : status === "done"
              ? "Downloaded"
              : "Download here"}
        </Button>
      </div>
    </motion.div>
  );
}
