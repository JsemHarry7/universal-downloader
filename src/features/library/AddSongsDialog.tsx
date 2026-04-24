import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Search,
  Music,
  Check,
  ArrowUpDown,
  Loader2,
  ListPlus,
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
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { LibraryTrack, Playlist } from "@/lib/types";

type SortKey = "added" | "title" | "artist" | "duration";

const SORT_LABELS: Record<SortKey, string> = {
  added: "Recently added",
  title: "Title A–Z",
  artist: "Artist A–Z",
  duration: "Duration",
};

function formatDuration(seconds: number): string {
  if (!seconds || !Number.isFinite(seconds)) return "";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

interface AddSongsDialogProps {
  open: boolean;
  playlist: Playlist | null;
  onClose: () => void;
  onAdded: () => void;
}

export function AddSongsDialog({
  open,
  playlist,
  onClose,
  onAdded,
}: AddSongsDialogProps) {
  const [library, setLibrary] = useState<LibraryTrack[]>([]);
  const [existing, setExisting] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("added");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!playlist) return;
    setLoading(true);
    try {
      const [libRes, ptRes] = await Promise.all([
        fetch("/api/library"),
        fetch(`/api/playlists/${playlist.id}/tracks`),
      ]);
      if (!libRes.ok) throw new Error(`library HTTP ${libRes.status}`);
      if (!ptRes.ok) throw new Error(`playlist HTTP ${ptRes.status}`);
      const libData = (await libRes.json()) as { tracks: LibraryTrack[] };
      const ptData = (await ptRes.json()) as { tracks: LibraryTrack[] };
      setLibrary(libData.tracks);
      setExisting(new Set(ptData.tracks.map((t) => t.id)));
    } catch (err) {
      toast.error("Couldn't load library", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setLoading(false);
    }
  }, [playlist]);

  useEffect(() => {
    if (open) {
      setSelected(new Set());
      setSearch("");
      load();
    }
  }, [open, load]);

  const addable = useMemo(
    () => library.filter((t) => !existing.has(t.id)),
    [library, existing],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let result = q
      ? addable.filter(
          (t) =>
            t.title.toLowerCase().includes(q) ||
            (t.artist?.toLowerCase().includes(q) ?? false) ||
            (t.album?.toLowerCase().includes(q) ?? false),
        )
      : [...addable];

    switch (sortKey) {
      case "title":
        result.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case "artist":
        result.sort((a, b) => (a.artist ?? "").localeCompare(b.artist ?? ""));
        break;
      case "duration":
        result.sort((a, b) => b.duration_s - a.duration_s);
        break;
      case "added":
      default:
        result.sort((a, b) => b.added_at - a.added_at);
    }
    return result;
  }, [addable, search, sortKey]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllInView() {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const t of filtered) next.add(t.id);
      return next;
    });
  }

  function clearSelection() {
    setSelected(new Set());
  }

  async function handleAdd() {
    if (!playlist || selected.size === 0) return;
    setBusy(true);
    try {
      const ids = Array.from(selected);
      const res = await fetch(
        `/api/playlists/${playlist.id}/tracks/batch`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ trackIds: ids }),
        },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { added: number; skipped: number };
      toast.success(
        `Added ${data.added} song${data.added === 1 ? "" : "s"} to "${playlist.name}"`,
        {
          description:
            data.skipped > 0 ? `${data.skipped} already in playlist` : undefined,
        },
      );
      onAdded();
      onClose();
    } catch (err) {
      toast.error("Couldn't add songs", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="flex h-[85vh] max-h-[40rem] max-w-2xl flex-col gap-4">
        <DialogHeader>
          <DialogTitle>Add songs to "{playlist?.name ?? ""}"</DialogTitle>
          <DialogDescription>
            Pick tracks from your library. Already-included tracks are hidden.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search library…"
              className="pl-9"
              autoFocus
              disabled={busy}
            />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2" disabled={busy}>
                <ArrowUpDown className="h-4 w-4" />
                {SORT_LABELS[sortKey]}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Sort by</DropdownMenuLabel>
              {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
                <DropdownMenuItem key={k} onClick={() => setSortKey(k)}>
                  {sortKey === k && <Check className="mr-2 h-4 w-4" />}
                  <span className={sortKey === k ? "" : "ml-6"}>
                    {SORT_LABELS[k]}
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {selected.size} of {filtered.length} selected
            {filtered.length !== addable.length &&
              ` · ${addable.length} total addable`}
          </span>
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={selectAllInView}
              disabled={busy || filtered.length === 0}
              className="h-7 text-xs"
            >
              Select all in view
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={clearSelection}
              disabled={busy || selected.size === 0}
              className="h-7 text-xs"
            >
              Clear
            </Button>
          </div>
        </div>

        <ScrollArea className="min-h-0 flex-1 rounded-md border border-border/50">
          {loading ? (
            <div className="flex items-center justify-center py-20 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16 text-sm text-muted-foreground">
              <Music className="h-8 w-8 opacity-40" />
              {addable.length === 0
                ? "Every track in your library is already in this playlist."
                : "No matches."}
            </div>
          ) : (
            <ul className="divide-y divide-border/40">
              {filtered.map((t) => {
                const checked = selected.has(t.id);
                return (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => toggle(t.id)}
                      disabled={busy}
                      className={cn(
                        "flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-accent/30",
                        checked && "bg-accent/40",
                      )}
                    >
                      <div
                        className={cn(
                          "flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors",
                          checked
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border",
                        )}
                      >
                        {checked && <Check className="h-3.5 w-3.5" />}
                      </div>
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
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {t.title}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {t.artist ?? "Unknown artist"}
                        </p>
                      </div>
                      <span className="shrink-0 tabular-nums text-xs text-muted-foreground">
                        {formatDuration(t.duration_s)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            onClick={handleAdd}
            disabled={busy || selected.size === 0}
            className="gap-2"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ListPlus className="h-4 w-4" />
            )}
            {busy
              ? "Adding…"
              : `Add ${selected.size} song${selected.size === 1 ? "" : "s"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
