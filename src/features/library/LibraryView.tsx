import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Search,
  RefreshCw,
  Music4,
  Loader2,
  Cloud,
  Play,
  Shuffle,
} from "lucide-react";
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
import type { LibraryTrack, SavedTrack, Playlist } from "@/lib/types";
import { LibraryCard } from "./LibraryCard";
import { RenameDialog } from "./RenameDialog";
import { SavedTrackCard } from "./SavedTrackCard";
import { PlaylistBar } from "./PlaylistBar";
import { NewPlaylistDialog } from "./NewPlaylistDialog";
import { useAuth } from "@/features/auth/useAuth";
import { fetchSavedTracks, matchKey } from "@/lib/sync";
import { usePlayer } from "@/features/player/PlayerProvider";

export function LibraryView() {
  const [tracks, setTracks] = useState<LibraryTrack[]>([]);
  const [saved, setSaved] = useState<SavedTrack[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [activePlaylistId, setActivePlaylistId] = useState<string | null>(null);
  const [playlistTracks, setPlaylistTracks] = useState<LibraryTrack[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [renaming, setRenaming] = useState<LibraryTrack | null>(null);
  const [toDelete, setToDelete] = useState<LibraryTrack | null>(null);
  const [playlistDialogTarget, setPlaylistDialogTarget] =
    useState<Playlist | null>(null);
  const [playlistDialogOpen, setPlaylistDialogOpen] = useState(false);
  const [playlistToDelete, setPlaylistToDelete] = useState<Playlist | null>(null);
  const { user, isConfigured: firebaseConfigured } = useAuth();
  const { currentTrack: nowPlaying, dispatch: playerDispatch } = usePlayer();

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

  const refreshPlaylists = useCallback(async () => {
    try {
      const res = await fetch("/api/playlists");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { playlists: Playlist[] };
      setPlaylists(data.playlists);
      // drop active if it was deleted
      if (
        activePlaylistId &&
        !data.playlists.some((p) => p.id === activePlaylistId)
      ) {
        setActivePlaylistId(null);
      }
    } catch (err) {
      console.warn("fetch playlists failed:", err);
    }
  }, [activePlaylistId]);

  const refreshPlaylistTracks = useCallback(async () => {
    if (!activePlaylistId) {
      setPlaylistTracks([]);
      return;
    }
    try {
      const res = await fetch(`/api/playlists/${activePlaylistId}/tracks`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { tracks: LibraryTrack[] };
      setPlaylistTracks(data.tracks);
    } catch (err) {
      console.warn("fetch playlist tracks failed:", err);
    }
  }, [activePlaylistId]);

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
      await refreshPlaylistTracks();
    } catch (err) {
      toast.error("Scan failed", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setScanning(false);
    }
  }, [refresh, refreshPlaylistTracks]);

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
    refreshPlaylists();
  }, [refresh, refreshPlaylists]);

  useEffect(() => {
    refreshSaved();
  }, [refreshSaved]);

  useEffect(() => {
    refreshPlaylistTracks();
  }, [refreshPlaylistTracks]);

  const activePlaylist = useMemo(
    () => playlists.find((p) => p.id === activePlaylistId) ?? null,
    [playlists, activePlaylistId],
  );

  const visibleTracks = activePlaylistId ? playlistTracks : tracks;

  const localKeys = useMemo(
    () => new Set(tracks.map((t) => matchKey(t))),
    [tracks],
  );

  const remoteOnly = useMemo(
    () => saved.filter((s) => !localKeys.has(matchKey(s))),
    [saved, localKeys],
  );

  const filtered = useMemo(() => {
    if (!search.trim()) return visibleTracks;
    const q = search.toLowerCase();
    return visibleTracks.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        (t.artist?.toLowerCase().includes(q) ?? false) ||
        (t.album?.toLowerCase().includes(q) ?? false),
    );
  }, [visibleTracks, search]);

  const filteredRemote = useMemo(() => {
    if (activePlaylistId) return []; // hide cloud row inside a playlist view
    if (!search.trim()) return remoteOnly;
    const q = search.toLowerCase();
    return remoteOnly.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        (t.artist?.toLowerCase().includes(q) ?? false) ||
        (t.album?.toLowerCase().includes(q) ?? false),
    );
  }, [remoteOnly, search, activePlaylistId]);

  async function confirmDelete() {
    if (!toDelete) return;
    const target = toDelete;
    setToDelete(null);
    try {
      const res = await fetch(`/api/library/${target.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setTracks((prev) => prev.filter((t) => t.id !== target.id));
      setPlaylistTracks((prev) => prev.filter((t) => t.id !== target.id));
      if (nowPlaying?.id === target.id) {
        playerDispatch({ type: "STOP" });
      }
      await refreshPlaylists();
      toast.success(`Deleted "${target.title}"`);
    } catch (err) {
      toast.error("Delete failed", {
        description: err instanceof Error ? err.message : String(err),
      });
    }
  }

  function playTrackInContext(track: LibraryTrack) {
    const contextTracks = filtered.length > 0 ? filtered : [track];
    const startIndex = Math.max(
      0,
      contextTracks.findIndex((t) => t.id === track.id),
    );
    playerDispatch({
      type: "PLAY_QUEUE",
      queue: contextTracks,
      startIndex,
    });
  }

  function playAll() {
    if (filtered.length === 0) return;
    playerDispatch({ type: "PLAY_QUEUE", queue: filtered, startIndex: 0 });
  }

  function shufflePlay() {
    if (filtered.length === 0) return;
    const startIndex = Math.floor(Math.random() * filtered.length);
    playerDispatch({ type: "PLAY_QUEUE", queue: filtered, startIndex });
    // ensure shuffle is on
    setTimeout(() => playerDispatch({ type: "TOGGLE_SHUFFLE" }), 0);
  }

  async function confirmDeletePlaylist() {
    if (!playlistToDelete) return;
    const target = playlistToDelete;
    setPlaylistToDelete(null);
    try {
      const res = await fetch(`/api/playlists/${target.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      if (activePlaylistId === target.id) setActivePlaylistId(null);
      await refreshPlaylists();
      toast.success(`Deleted playlist "${target.name}"`);
    } catch (err) {
      toast.error("Playlist delete failed", {
        description: err instanceof Error ? err.message : String(err),
      });
    }
  }

  async function onPlaylistMutated() {
    await refreshPlaylists();
    await refreshPlaylistTracks();
  }

  return (
    <div className="space-y-5 pb-32">
      <PlaylistBar
        playlists={playlists}
        activeId={activePlaylistId}
        onSelect={setActivePlaylistId}
        onNew={() => {
          setPlaylistDialogTarget(null);
          setPlaylistDialogOpen(true);
        }}
        onRename={(p) => {
          setPlaylistDialogTarget(p);
          setPlaylistDialogOpen(true);
        }}
        onDelete={(p) => setPlaylistToDelete(p)}
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[16rem] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={
              activePlaylist
                ? `Search in "${activePlaylist.name}"…`
                : "Search library…"
            }
            className="pl-9"
          />
        </div>
        <div className="text-sm text-muted-foreground">
          {filtered.length} / {visibleTracks.length}
        </div>
        {filtered.length > 0 && (
          <>
            <Button
              variant="default"
              onClick={playAll}
              disabled={filtered.length === 0}
              className="gap-2"
              title="Play all visible"
            >
              <Play className="h-4 w-4" fill="currentColor" />
              Play all
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={shufflePlay}
              title="Shuffle play"
            >
              <Shuffle className="h-4 w-4" />
            </Button>
          </>
        )}
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
      ) : visibleTracks.length === 0 && filteredRemote.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center gap-3 rounded-lg border border-border/40 bg-card/30 py-20 text-center backdrop-blur-sm"
        >
          <Music4 className="h-10 w-10 text-muted-foreground/50" />
          <div>
            <p className="font-medium">
              {activePlaylist
                ? `"${activePlaylist.name}" is empty`
                : "Your library is empty"}
            </p>
            <p className="text-sm text-muted-foreground">
              {activePlaylist
                ? 'Hover a track in "All" and click the list icon to add it here.'
                : firebaseConfigured && !user
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
                    isPlaying={nowPlaying?.id === t.id}
                    playlists={playlists}
                    activePlaylist={activePlaylist}
                    onPlay={() => playTrackInContext(t)}
                    onRename={() => setRenaming(t)}
                    onDelete={() => setToDelete(t)}
                    onPlaylistMutated={onPlaylistMutated}
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

      <RenameDialog
        track={renaming}
        onClose={() => setRenaming(null)}
        onSaved={() => {
          refresh();
          refreshPlaylistTracks();
        }}
      />

      <NewPlaylistDialog
        open={playlistDialogOpen}
        target={playlistDialogTarget}
        onClose={() => {
          setPlaylistDialogOpen(false);
          setPlaylistDialogTarget(null);
        }}
        onSaved={async (created) => {
          await refreshPlaylists();
          if (created) setActivePlaylistId(created.id);
        }}
      />

      <AlertDialog
        open={toDelete !== null}
        onOpenChange={(next) => !next && setToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this track?</AlertDialogTitle>
            <AlertDialogDescription>
              "{toDelete?.title}" will be permanently deleted from disk and
              removed from the library and all playlists. This can't be undone.
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

      <AlertDialog
        open={playlistToDelete !== null}
        onOpenChange={(next) => !next && setPlaylistToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this playlist?</AlertDialogTitle>
            <AlertDialogDescription>
              "{playlistToDelete?.name}" will be removed. The tracks in it stay
              on disk — only the playlist is deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeletePlaylist}
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
