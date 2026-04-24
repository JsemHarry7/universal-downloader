import { useEffect, useMemo, useRef, useState } from "react";
import { Captions, Loader2, X, Music } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { usePlayer } from "./PlayerProvider";

interface LyricsPanelProps {
  open: boolean;
  onClose: () => void;
}

interface SyncedLine {
  time: number;
  text: string;
}

interface LyricsData {
  plain: string | null;
  synced: SyncedLine[] | null;
}

function parseSyncedLyrics(synced: string): SyncedLine[] {
  const lines: SyncedLine[] = [];
  for (const line of synced.split(/\r?\n/)) {
    const m = line.match(/^\[(\d+):(\d+)(?:\.(\d+))?\](.*)$/);
    if (!m) continue;
    const min = parseInt(m[1], 10);
    const sec = parseInt(m[2], 10);
    const frac = m[3] ? parseInt(m[3].padEnd(3, "0").slice(0, 3), 10) / 1000 : 0;
    lines.push({ time: min * 60 + sec + frac, text: (m[4] ?? "").trim() });
  }
  return lines.sort((a, b) => a.time - b.time);
}

const cache = new Map<string, LyricsData>();

export function LyricsPanel({ open, onClose }: LyricsPanelProps) {
  const { currentTrack, state } = usePlayer();
  const [data, setData] = useState<LyricsData | null>(null);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !currentTrack) {
      setData(null);
      return;
    }
    const cached = cache.get(currentTrack.id);
    if (cached) {
      setData(cached);
      return;
    }
    setLoading(true);
    (async () => {
      try {
        const res = await fetch(`/api/lyrics/${currentTrack.id}`);
        if (!res.ok) {
          setData({ plain: null, synced: null });
          return;
        }
        const raw = (await res.json()) as {
          plainLyrics: string | null;
          syncedLyrics: string | null;
        };
        const parsed: LyricsData = {
          plain: raw.plainLyrics,
          synced: raw.syncedLyrics ? parseSyncedLyrics(raw.syncedLyrics) : null,
        };
        cache.set(currentTrack.id, parsed);
        setData(parsed);
      } catch {
        setData({ plain: null, synced: null });
      } finally {
        setLoading(false);
      }
    })();
  }, [open, currentTrack]);

  const activeLineIndex = useMemo(() => {
    if (!data?.synced || data.synced.length === 0) return -1;
    const t = state.currentTime;
    let idx = -1;
    for (let i = 0; i < data.synced.length; i++) {
      if (data.synced[i].time <= t) idx = i;
      else break;
    }
    return idx;
  }, [data, state.currentTime]);

  useEffect(() => {
    if (activeLineIndex < 0) return;
    const root = containerRef.current;
    if (!root) return;
    const el = root.querySelector<HTMLElement>(
      `[data-line-index="${activeLineIndex}"]`,
    );
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [activeLineIndex]);

  const hasSynced = data?.synced && data.synced.length > 0;
  const hasPlain = data?.plain && data.plain.trim().length > 0;

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[35] bg-black/30 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.aside
            key="lyrics"
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", stiffness: 260, damping: 30 }}
            className="fixed left-0 top-0 z-40 flex h-full w-full max-w-md flex-col border-r border-border/60 bg-background/95 backdrop-blur-xl"
          >
            <div className="flex items-center justify-between border-b border-border/40 px-4 py-3">
              <div className="flex items-center gap-2">
                <Captions className="h-4 w-4 text-muted-foreground" />
                <h2 className="font-semibold">Lyrics</h2>
                {hasSynced && (
                  <span className="rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400">
                    synced
                  </span>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="h-8 w-8"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {!currentTrack ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center text-sm text-muted-foreground">
                <Music className="h-8 w-8 opacity-40" />
                <p>Nothing playing.</p>
              </div>
            ) : (
              <>
                <div className="border-b border-border/40 px-4 py-2 text-xs text-muted-foreground">
                  {currentTrack.title}
                  {currentTrack.artist && <> — {currentTrack.artist}</>}
                </div>

                <div ref={containerRef} className="min-h-0 flex-1 overflow-hidden">
                  <ScrollArea className="h-full">
                    {loading ? (
                      <div className="flex items-center justify-center py-20 text-muted-foreground">
                        <Loader2 className="h-5 w-5 animate-spin" />
                      </div>
                    ) : hasSynced ? (
                      <ul className="space-y-1 px-6 py-16 text-base leading-relaxed">
                        {data!.synced!.map((line, i) => (
                          <li
                            key={`${i}-${line.time}`}
                            data-line-index={i}
                            className={cn(
                              "transition-all duration-300",
                              i === activeLineIndex
                                ? "scale-[1.02] font-semibold text-foreground"
                                : i < activeLineIndex
                                  ? "text-muted-foreground/50"
                                  : "text-muted-foreground",
                            )}
                          >
                            {line.text || " "}
                          </li>
                        ))}
                      </ul>
                    ) : hasPlain ? (
                      <pre className="whitespace-pre-wrap px-6 py-6 font-sans text-sm text-foreground">
                        {data!.plain}
                      </pre>
                    ) : (
                      <div className="flex flex-col items-center gap-2 px-6 py-20 text-center text-sm text-muted-foreground">
                        <Captions className="h-8 w-8 opacity-40" />
                        <p>No lyrics found on LRCLib for this track.</p>
                      </div>
                    )}
                  </ScrollArea>
                </div>
              </>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
