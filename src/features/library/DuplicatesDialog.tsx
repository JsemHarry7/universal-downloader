import { useEffect, useState } from "react";
import {
  CopyCheck,
  Loader2,
  Music,
  Trash2,
  CheckCircle2,
} from "lucide-react";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { LibraryTrack } from "@/lib/types";

interface DuplicatesDialogProps {
  open: boolean;
  onClose: () => void;
  onMutated: () => void;
}

function formatBytes(bytes: number): string {
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function formatDuration(seconds: number): string {
  if (!seconds) return "";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function DuplicatesDialog({
  open,
  onClose,
  onMutated,
}: DuplicatesDialogProps) {
  const [groups, setGroups] = useState<LibraryTrack[][]>([]);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    (async () => {
      try {
        const res = await fetch("/api/library/duplicates");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { groups: LibraryTrack[][] };
        setGroups(data.groups);
      } catch (err) {
        toast.error("Couldn't scan for duplicates", {
          description: err instanceof Error ? err.message : String(err),
        });
      } finally {
        setLoading(false);
      }
    })();
  }, [open]);

  async function deleteTrack(track: LibraryTrack) {
    setDeleting((prev) => new Set(prev).add(track.id));
    try {
      const res = await fetch(`/api/library/${track.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setGroups((prev) =>
        prev
          .map((g) => g.filter((t) => t.id !== track.id))
          .filter((g) => g.length >= 2),
      );
      toast.success(`Deleted "${track.title}"`);
      onMutated();
    } catch (err) {
      toast.error("Delete failed", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setDeleting((prev) => {
        const next = new Set(prev);
        next.delete(track.id);
        return next;
      });
    }
  }

  const totalDupes = groups.reduce((acc, g) => acc + (g.length - 1), 0);

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="flex h-[85vh] max-h-[42rem] max-w-2xl flex-col gap-4">
        <DialogHeader>
          <DialogTitle>
            <CopyCheck className="mr-2 inline h-5 w-5" />
            Possible duplicates
          </DialogTitle>
          <DialogDescription>
            Tracks grouped by matching title + artist and close duration
            (within 3s). Delete the copies you don't want.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 rounded-md border border-border/50">
          {loading ? (
            <div className="flex items-center justify-center py-20 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : groups.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-20 text-sm text-muted-foreground">
              <CheckCircle2 className="h-8 w-8 text-emerald-500" />
              <p>No duplicates found. Clean library!</p>
            </div>
          ) : (
            <div className="divide-y divide-border/40">
              {groups.map((group, gi) => (
                <section key={gi} className="p-3">
                  <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <span>
                      {group.length} copies of{" "}
                      <span className="text-foreground">
                        {group[0].title}
                      </span>
                      {group[0].artist && (
                        <span className="text-muted-foreground">
                          {" "}
                          — {group[0].artist}
                        </span>
                      )}
                    </span>
                  </div>
                  <ul className="space-y-1">
                    {group.map((t) => (
                      <li
                        key={t.id}
                        className="flex items-center gap-3 rounded-md bg-card/40 px-3 py-2"
                      >
                        {t.has_artwork ? (
                          <img
                            src={`/api/library/${t.id}/artwork`}
                            alt=""
                            className="h-10 w-10 shrink-0 rounded object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-muted">
                            <Music className="h-4 w-4 text-muted-foreground/60" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1 text-xs">
                          <p className="truncate font-mono text-[11px] text-muted-foreground">
                            {t.path}
                          </p>
                          <p className="flex gap-3 text-muted-foreground">
                            <span>{formatDuration(t.duration_s)}</span>
                            <span>{formatBytes(t.file_size)}</span>
                            <span className="uppercase">{t.format}</span>
                            {t.has_artwork ? (
                              <span className="text-emerald-400">art</span>
                            ) : null}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          className={cn(
                            "text-destructive hover:text-destructive",
                          )}
                          onClick={() => deleteTrack(t)}
                          disabled={deleting.has(t.id)}
                        >
                          {deleting.has(t.id) ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                          <span className="ml-1 hidden sm:inline">Delete</span>
                        </Button>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </ScrollArea>

        <DialogFooter className="sm:justify-between">
          <div className="text-xs text-muted-foreground">
            {groups.length > 0
              ? `${groups.length} group${groups.length === 1 ? "" : "s"} · ${totalDupes} extra copy${totalDupes === 1 ? "" : "ies"}`
              : ""}
          </div>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
