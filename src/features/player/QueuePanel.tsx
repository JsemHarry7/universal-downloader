import {
  ChevronUp,
  ChevronDown,
  X,
  Music,
  ListOrdered,
  Trash2,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { usePlayer } from "./PlayerProvider";

interface QueuePanelProps {
  open: boolean;
  onClose: () => void;
}

function formatDuration(s: number): string {
  if (!Number.isFinite(s) || s < 0) return "";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export function QueuePanel({ open, onClose }: QueuePanelProps) {
  const { state, dispatch } = usePlayer();

  const rows = state.order.map((queueIdx, orderPos) => ({
    orderPos,
    track: state.queue[queueIdx],
  }));

  const upcoming = rows.slice(state.index);
  const current = upcoming[0];
  const rest = upcoming.slice(1);

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
            key="queue"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 260, damping: 30 }}
            className="fixed right-0 top-0 z-40 flex h-full w-full max-w-md flex-col border-l border-border/60 bg-background/95 backdrop-blur-xl"
          >
            <div className="flex items-center justify-between border-b border-border/40 px-4 py-3">
              <div className="flex items-center gap-2">
                <ListOrdered className="h-4 w-4 text-muted-foreground" />
                <h2 className="font-semibold">Up next</h2>
                <span className="text-xs text-muted-foreground">
                  {rest.length} track{rest.length === 1 ? "" : "s"}
                </span>
              </div>
              <div className="flex items-center gap-1">
                {state.queue.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => dispatch({ type: "STOP" })}
                    className="h-8 gap-1 text-xs text-muted-foreground"
                    title="Clear queue"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Clear
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                  className="h-8 w-8"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {state.queue.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center text-sm text-muted-foreground">
                <Music className="h-8 w-8 opacity-40" />
                <p>Queue is empty.</p>
                <p className="text-xs">
                  Play a track or right-click a card → Add to queue.
                </p>
              </div>
            ) : (
              <ScrollArea className="min-h-0 flex-1">
                {current && (
                  <div className="border-b border-border/40 bg-primary/5 px-3 py-2.5">
                    <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-primary">
                      Now playing
                    </div>
                    <QueueRow
                      track={current.track}
                      orderPos={current.orderPos}
                      isCurrent
                      canMoveUp={false}
                      canMoveDown={false}
                      dispatch={dispatch}
                    />
                  </div>
                )}
                <ul className="divide-y divide-border/30">
                  {rest.map(({ orderPos, track }, i) => (
                    <li key={`${orderPos}-${track.id}`}>
                      <QueueRow
                        track={track}
                        orderPos={orderPos}
                        isCurrent={false}
                        canMoveUp={i > 0}
                        canMoveDown={i < rest.length - 1}
                        dispatch={dispatch}
                      />
                    </li>
                  ))}
                  {rest.length === 0 && (
                    <li className="px-4 py-6 text-center text-sm text-muted-foreground">
                      Nothing queued after this.
                    </li>
                  )}
                </ul>
              </ScrollArea>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

interface QueueRowProps {
  track: { id: string; title: string; artist: string | null; duration_s: number; has_artwork: 0 | 1 };
  orderPos: number;
  isCurrent: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  dispatch: ReturnType<typeof usePlayer>["dispatch"];
}

function QueueRow({
  track,
  orderPos,
  isCurrent,
  canMoveUp,
  canMoveDown,
  dispatch,
}: QueueRowProps) {
  return (
    <div
      className={cn(
        "group flex items-center gap-3 px-3 py-2 transition-colors",
        !isCurrent && "hover:bg-accent/30",
      )}
    >
      <button
        onClick={() => dispatch({ type: "JUMP_TO", orderPosition: orderPos })}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
        title={isCurrent ? track.title : "Play this"}
      >
        {track.has_artwork ? (
          <img
            src={`/api/library/${track.id}/artwork`}
            alt=""
            className={cn(
              "h-10 w-10 shrink-0 rounded object-cover",
              isCurrent && "ring-2 ring-primary",
            )}
            loading="lazy"
          />
        ) : (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-muted">
            <Music className="h-4 w-4 text-muted-foreground/60" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "truncate text-sm",
              isCurrent ? "font-semibold text-primary" : "font-medium",
            )}
          >
            {track.title}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {track.artist ?? "Unknown artist"}
          </p>
        </div>
      </button>
      <span className="shrink-0 tabular-nums text-xs text-muted-foreground">
        {formatDuration(track.duration_s)}
      </span>
      {!isCurrent && (
        <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 max-sm:opacity-100">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            disabled={!canMoveUp}
            onClick={() =>
              dispatch({
                type: "REORDER_QUEUE",
                from: orderPos,
                to: orderPos - 1,
              })
            }
            title="Move up"
          >
            <ChevronUp className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            disabled={!canMoveDown}
            onClick={() =>
              dispatch({
                type: "REORDER_QUEUE",
                from: orderPos,
                to: orderPos + 1,
              })
            }
            title="Move down"
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={() =>
              dispatch({ type: "REMOVE_FROM_QUEUE", orderPosition: orderPos })
            }
            title="Remove"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}
