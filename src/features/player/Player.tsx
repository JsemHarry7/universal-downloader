import { useState } from "react";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Repeat1,
  Volume2,
  VolumeX,
  Volume1,
  X,
  Music,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { usePlayer } from "./PlayerProvider";
import { usePlayerShortcuts } from "./useKeyboardShortcuts";

function formatTime(s: number): string {
  if (!Number.isFinite(s) || s < 0) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export function Player() {
  const { state, currentTrack, dispatch, seek } = usePlayer();
  const [scrubbing, setScrubbing] = useState(false);
  const [scrubValue, setScrubValue] = useState(0);

  usePlayerShortcuts();

  const effectiveTime = scrubbing ? scrubValue : state.currentTime;
  const artwork =
    currentTrack?.has_artwork
      ? `/api/library/${currentTrack.id}/artwork`
      : null;

  const VolumeIcon =
    state.muted || state.volume === 0
      ? VolumeX
      : state.volume < 0.5
        ? Volume1
        : Volume2;

  const RepeatIcon = state.repeat === "one" ? Repeat1 : Repeat;

  return (
    <AnimatePresence>
      {currentTrack && (
        <motion.div
          key="player"
          initial={{ y: 120, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 120, opacity: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 30 }}
          className="fixed inset-x-0 bottom-0 z-30 border-t border-border/60 bg-background/85 backdrop-blur-xl"
        >
          <div className="mx-auto max-w-7xl px-4 py-3">
            <div className="mb-2 flex items-center gap-2 px-1 tabular-nums text-xs text-muted-foreground">
              <span className="shrink-0">{formatTime(effectiveTime)}</span>
              <Slider
                value={[effectiveTime]}
                min={0}
                max={state.duration || 1}
                step={0.1}
                onValueChange={([v]) => {
                  setScrubbing(true);
                  setScrubValue(v);
                }}
                onValueCommit={([v]) => {
                  seek(v);
                  setScrubbing(false);
                }}
                className="flex-1"
              />
              <span className="shrink-0">
                {formatTime(state.duration)}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                {artwork ? (
                  <img
                    src={artwork}
                    alt=""
                    className="h-12 w-12 shrink-0 rounded object-cover ring-1 ring-border/40"
                  />
                ) : (
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded bg-muted">
                    <Music className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {currentTrack.title}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {currentTrack.artist ?? "Unknown artist"}
                    {state.queue.length > 1 && (
                      <span className="ml-2 tabular-nums">
                        · {state.index + 1} / {state.queue.length}
                      </span>
                    )}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => dispatch({ type: "TOGGLE_SHUFFLE" })}
                  className={cn(
                    "h-9 w-9",
                    state.shuffle && "text-primary",
                  )}
                  title="Shuffle (S)"
                >
                  <Shuffle className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => dispatch({ type: "PREV" })}
                  className="h-9 w-9"
                  title="Previous (Shift+←)"
                >
                  <SkipBack className="h-5 w-5" fill="currentColor" />
                </Button>
                <Button
                  variant="default"
                  size="icon"
                  onClick={() => dispatch({ type: "TOGGLE_PLAY" })}
                  className="h-11 w-11 rounded-full"
                  title="Play/pause (Space)"
                >
                  {state.playing ? (
                    <Pause className="h-5 w-5" fill="currentColor" />
                  ) : (
                    <Play className="h-5 w-5" fill="currentColor" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => dispatch({ type: "NEXT" })}
                  className="h-9 w-9"
                  title="Next (Shift+→)"
                >
                  <SkipForward className="h-5 w-5" fill="currentColor" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => dispatch({ type: "CYCLE_REPEAT" })}
                  className={cn(
                    "h-9 w-9",
                    state.repeat !== "off" && "text-primary",
                  )}
                  title={`Repeat: ${state.repeat} (R)`}
                >
                  <RepeatIcon className="h-4 w-4" />
                </Button>
              </div>

              <div className="hidden w-48 items-center gap-2 md:flex">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => dispatch({ type: "TOGGLE_MUTE" })}
                  className="h-8 w-8 shrink-0"
                  title="Mute (M)"
                >
                  <VolumeIcon className="h-4 w-4" />
                </Button>
                <Slider
                  value={[state.muted ? 0 : state.volume * 100]}
                  min={0}
                  max={100}
                  step={1}
                  onValueChange={([v]) =>
                    dispatch({ type: "SET_VOLUME", volume: v / 100 })
                  }
                  className="flex-1"
                />
              </div>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => dispatch({ type: "STOP" })}
                className="h-8 w-8 shrink-0"
                title="Close player"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
