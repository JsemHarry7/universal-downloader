import { useEffect, useRef } from "react";
import { X, Music } from "lucide-react";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import type { LibraryTrack } from "@/lib/types";

interface MiniPlayerProps {
  track: LibraryTrack;
  onClose: () => void;
}

export function MiniPlayer({ track, onClose }: MiniPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.load();
      audio.play().catch(() => {
        // Autoplay may fail without user gesture; user can click play manually
      });
    }
  }, [track.id]);

  const artworkUrl = track.has_artwork
    ? `/api/library/${track.id}/artwork`
    : null;

  return (
    <motion.div
      initial={{ y: 80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 80, opacity: 0 }}
      transition={{ type: "spring", stiffness: 260, damping: 28 }}
      className="fixed inset-x-0 bottom-0 z-20 border-t border-border/60 bg-background/85 backdrop-blur-lg"
    >
      <div className="mx-auto flex max-w-5xl items-center gap-4 px-6 py-3">
        <div className="flex min-w-0 items-center gap-3">
          {artworkUrl ? (
            <img
              src={artworkUrl}
              alt=""
              className="h-12 w-12 shrink-0 rounded object-cover ring-1 ring-border/40"
            />
          ) : (
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded bg-muted">
              <Music className="h-5 w-5 text-muted-foreground" />
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{track.title}</p>
            <p className="truncate text-xs text-muted-foreground">
              {track.artist ?? "Unknown artist"}
            </p>
          </div>
        </div>

        <audio
          ref={audioRef}
          controls
          src={`/api/library/${track.id}/audio`}
          className="min-w-0 flex-1"
        >
          Your browser doesn't support audio playback.
        </audio>

        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          title="Close player"
          className="shrink-0"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </motion.div>
  );
}
