import { useCallback, useEffect, useMemo, useState } from "react";
import { Search, RefreshCw, Music4, Loader2, Cloud } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { LibraryTrack, SavedTrack } from "@/lib/types";
import { LibraryCard } from "./LibraryCard";
import { MiniPlayer } from "./MiniPlayer";
import { RenameDialog } from "./RenameDialog";
import { SavedTrackCard } from "./SavedTrackCard";
import { useAuth } from "@/features/auth/useAuth";
import { fetchSavedTracks, matchKey } from "@/lib/sync";

export function LibraryView() {
  const [tracks, setTracks] = useState<LibraryTrack[]>([]);
  const [saved, setSaved] = useState<SavedTrack[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [playing, setPlaying] = useState<LibraryTrack | null>(null);
  const [renaming, setRenaming] = useState<LibraryTrack | null>(null);
  const [toDelete, setToDelete] = useState<LibraryTrack | null>(null);
  const { user, isConfigured: firebaseConfigured } = useAuth();

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/library");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { tracks: LibraryTrack[] };
      setTracks(data.tracks);
    } catch (err) {
      toast.error("Couldn't load library", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setLoading(false);
    }
  }, []);

  const rescan = useCallback(async () => {
    setScanning(true);
    try {
      const res = await fetch("/api/library/scan", { method: "POST" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as {
        indexed: number;
        removed: number;
        errors: number;
      };
      toast.success(
        `Scanned ${data.indexed} file${data.indexed === 1 ? "" : "s"}`,
        {
          description:
            data.removed > 0 || data.errors > 0
              ? `${data.removed} removed, ${data.errors} errors`
              : undefined,
        },
      );
      await refresh();
    } catch (err) {
      toast.error("Scan failed", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setScanning(false);
    }
  }, [refresh]);

  const refreshSaved = useCallback(async () => {
    if (!user) {
      setSaved([]);
      return;
    }
    try {
      const list = await fetchSavedTracks(user.uid);
      setSaved(list);
    } catch (err) {
      console.warn("fetch saved failed:", err);
    }
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    refreshSaved();
  }, [refreshSaved]);

  const localKeys = useMemo(
    () => new Set(tracks.map((t) => matchKey(t))),
    [tracks],
  );

  const remoteOnly = useMemo(
    () => saved.filter((s) => !localKeys.has(matchKey(s))),
    [saved, localKeys],
  );

  const filtered = useMemo(() => {
    if (!search.trim()) return tracks;
    const q = search.toLowerCase();
    return tracks.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        (t.artist?.toLowerCase().includes(q) ?? false) ||
        (t.album?.toLowerCase().includes(q) ?? false),
    );
  }, [tracks, search]);

  const filteredRemote = useMemo(() => {
    if (!search.trim()) return remoteOnly;
    const q = search.toLowerCase();
    return remoteOnly.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        (t.artist?.toLowerCase().includes(q) ?? false) ||
        (t.album?.toLowerCase().includes(q) ?? false),
    );
  }, [remoteOnly, search]);

  async function confirmDelete() {
    if (!toDelete) return;
    const target = toDelete;
    setToDelete(null);
    try {
      const res = await fetch(`/api/library/${target.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setTracks((prev) => prev.filter((t) => t.id !== target.id));
      if (playing?.id === target.id) setPlaying(null);
      toast.success(`Deleted "${target.title}"`);
    } catch (err) {
      toast.error("Delete failed", {
        description: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return (
    <div className="space-y-6 pb-32">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[16rem]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search library…"
            className="pl-9"
          />
        </div>
        <div className="text-sm text-muted-foreground">
          {filtered.length} / {tracks.length}
        </div>
        <Button
          variant="outline"
          onClick={rescan}
          disabled={scanning}
          className="gap-2"
        >
          {scanning ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          {scanning ? "Scanning…" : "Rescan"}
        </Button>
      </div>

      {loading && tracks.length === 0 ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : tracks.length === 0 && remoteOnly.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center gap-3 rounded-lg border border-border/40 bg-card/30 py-20 text-center backdrop-blur-sm"
        >
          <Music4 className="h-10 w-10 text-muted-foreground/50" />
          <div>
            <p className="font-medium">Your library is empty</p>
            <p className="text-sm text-muted-foreground">
              {firebaseConfigured && !user
                ? "Download a track, click Rescan, or sign in to pull from your other devices."
                : "Download a track or click Rescan to detect existing files."}
            </p>
          </div>
        </motion.div>
      ) : (
        <div className="space-y-8">
          {filtered.length > 0 && (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              <AnimatePresence mode="popLayout">
                {filtered.map((t, i) => (
                  <LibraryCard
                    key={t.id}
                    track={t}
                    index={i}
                    isPlaying={playing?.id === t.id}
                    onPlay={() => setPlaying(t)}
                    onRename={() => setRenaming(t)}
                    onDelete={() => setToDelete(t)}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}

          {user && filteredRemote.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Cloud className="h-4 w-4" />
                <span className="font-medium">
                  Saved on other devices ({filteredRemote.length})
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                <AnimatePresence mode="popLayout">
                  {filteredRemote.map((s, i) => (
                    <SavedTrackCard
                      key={s.id}
                      track={s}
                      index={i}
                      onDownloaded={() => {
                        refresh();
                      }}
                    />
                  ))}
                </AnimatePresence>
              </div>
            </div>
          )}
        </div>
      )}

      <AnimatePresence>
        {playing && (
          <MiniPlayer track={playing} onClose={() => setPlaying(null)} />
        )}
      </AnimatePresence>

      <RenameDialog
        track={renaming}
        onClose={() => setRenaming(null)}
        onSaved={refresh}
      />

      <AlertDialog
        open={toDelete !== null}
        onOpenChange={(next) => {
          if (!next) setToDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this track?</AlertDialogTitle>
            <AlertDialogDescription>
              "{toDelete?.title}" will be permanently deleted from disk and removed
              from the library. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
