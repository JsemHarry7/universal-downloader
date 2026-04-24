import { Play, Pencil, Trash2, Music } from "lucide-react";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import type { LibraryTrack } from "@/lib/types";

interface LibraryCardProps {
  track: LibraryTrack;
  index: number;
  isPlaying: boolean;
  onPlay: () => void;
  onRename: () => void;
  onDelete: () => void;
}

function formatDuration(seconds: number): string {
  if (!seconds || !Number.isFinite(seconds)) return "";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function LibraryCard({
  track,
  index,
  isPlaying,
  onPlay,
  onRename,
  onDelete,
}: LibraryCardProps) {
  const artworkUrl = track.has_artwork
    ? `/api/library/${track.id}/artwork`
    : null;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.02, 0.3) }}
      className="group relative overflow-hidden rounded-lg border border-border/40 bg-card/40 backdrop-blur-sm transition-all hover:border-border hover:bg-card/60 hover:shadow-lg"
    >
      <div className="relative aspect-square overflow-hidden bg-muted">
        {artworkUrl ? (
          <img
            src={artworkUrl}
            alt={track.title}
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-muted to-muted-foreground/10">
            <Music className="h-10 w-10 text-muted-foreground/50" />
          </div>
        )}

        <div className="absolute inset-0 flex items-center justify-center gap-1 bg-black/60 opacity-0 transition-opacity group-hover:opacity-100">
          <Button
            size="icon"
            variant="secondary"
            className="h-10 w-10 rounded-full"
            onClick={onPlay}
            title="Play"
          >
            <Play className="h-4 w-4" fill="currentColor" />
          </Button>
          <Button
            size="icon"
            variant="secondary"
            className="h-10 w-10 rounded-full"
            onClick={onRename}
            title="Rename"
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="destructive"
            className="h-10 w-10 rounded-full"
            onClick={onDelete}
            title="Delete"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>

        {isPlaying && (
          <div className="absolute bottom-2 left-2 flex items-center gap-1 rounded-full bg-primary/90 px-2 py-0.5 text-xs font-medium text-primary-foreground">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary-foreground/70 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary-foreground" />
            </span>
            Playing
          </div>
        )}
      </div>

      <div className="p-3">
        <h3 className="truncate text-sm font-medium">{track.title}</h3>
        <p className="truncate text-xs text-muted-foreground">
          {track.artist ?? "Unknown artist"}
        </p>
        <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
          <span>{formatDuration(track.duration_s)}</span>
          <span className="uppercase">{track.format}</span>
        </div>
      </div>
    </motion.div>
  );
}
