import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Search,
  RefreshCw,
  Music4,
  Loader2,
  Cloud,
  Play,
  Shuffle,
  X as XIcon,
  ListPlus,
  ArrowUpDown,
  User,
  Check,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { cn } from "@/lib/utils";
import type {
  LibraryTrack,
  SavedTrack,
  Playlist,
  Tag,
  LibraryStats,
} from "@/lib/types";
import { LibraryCard } from "./LibraryCard";
import { RenameDialog } from "./RenameDialog";
import { SavedTrackCard } from "./SavedTrackCard";
import { PlaylistBar } from "./PlaylistBar";
import { NewPlaylistDialog } from "./NewPlaylistDialog";
import { TagEditor, tagClass } from "./TagEditor";
import { StatsPanel } from "./StatsPanel";
import { AddSongsDialog } from "./AddSongsDialog";
import { useAuth } from "@/features/auth/useAuth";
import { fetchSavedTracks, matchKey } from "@/lib/sync";
import { usePlayer } from "@/features/player/PlayerProvider";

export function LibraryView() {
  const [tracks, setTracks] = useState<LibraryTrack[]>([]);
  const [saved, setSaved] = useState<SavedTrack[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [stats, setStats] = useState<LibraryStats | null>(null);
  const [activePlaylistId, setActivePlaylistId] = useState<string | null>(null);
  const [activeTagId, setActiveTagId] = useState<string | null>(null);
  const [playlistTracks, setPlaylistTracks] = useState<LibraryTrack[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [renaming, setRenaming] = useState<LibraryTrack | null>(null);
  const [taggingTrack, setTaggingTrack] = useState<LibraryTrack | null>(null);
  const [toDelete, setToDelete] = useState<LibraryTrack | null>(null);
  const [playlistDialogTarget, setPlaylistDialogTarget] =
    useState<Playlist | null>(null);
  const [playlistDialogOpen, setPlaylistDialogOpen] = useState(false);
  const [playlistToDelete, setPlaylistToDelete] = useState<Playlist | null>(null);
  const [addSongsFor, setAddSongsFor] = useState<Playlist | null>(null);
  const [artistFilter, setArtistFilter] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<"added" | "title" | "artist" | "duration">("added");
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

  const refreshTags = useCallback(async () => {
    try {
      const res = await fetch("/api/tags");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { tags: Tag[] };
      setTags(data.tags);
      if (activeTagId && !data.tags.some((t) => t.id === activeTagId)) {
        setActiveTagId(null);
      }
    } catch (err) {
      console.warn("fetch tags failed:", err);
    }
  }, [activeTagId]);

  const refreshStats = useCallback(async () => {
    try {
      const res = await fetch("/api/stats");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as LibraryStats;
      setStats(data);
    } catch (err) {
      console.warn("fetch stats failed:", err);
    }
  }, []);

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
      await refreshStats();
    } catch (err) {
      toast.error("Scan failed", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setScanning(false);
    }
  }, [refresh, refreshPlaylistTracks, refreshStats]);

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
    refreshTags();
    refreshStats();
  }, [refresh, refreshPlaylists, refreshTags, refreshStats]);

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

  const activeTag = useMemo(
    () => tags.find((t) => t.id === activeTagId) ?? null,
    [tags, activeTagId],
  );

  const visibleTracks = activePlaylistId ? playlistTracks : tracks;

  const afterTagFilter = useMemo(() => {
    if (!activeTagId) return visibleTracks;
    return visibleTracks.filter((t) => t.tag_ids.includes(activeTagId));
  }, [visibleTracks, activeTagId]);

  const afterArtistFilter = useMemo(() => {
    if (!artistFilter) return afterTagFilter;
    return afterTagFilter.filter((t) => t.artist === artistFilter);
  }, [afterTagFilter, artistFilter]);

  const localKeys = useMemo(
    () => new Set(tracks.map((t) => matchKey(t))),
    [tracks],
  );

  const remoteOnly = useMemo(
    () => saved.filter((s) => !localKeys.has(matchKey(s))),
    [saved, localKeys],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = q
      ? afterArtistFilter.filter(
          (t) =>
            t.title.toLowerCase().includes(q) ||
            (t.artist?.toLowerCase().includes(q) ?? false) ||
            (t.album?.toLowerCase().includes(q) ?? false),
        )
      : [...afterArtistFilter];
    switch (sortKey) {
      case "title":
        base.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case "artist":
        base.sort((a, b) => (a.artist ?? "").localeCompare(b.artist ?? ""));
        break;
      case "duration":
        base.sort((a, b) => b.duration_s - a.duration_s);
        break;
      case "added":
      default:
        base.sort((a, b) => b.added_at - a.added_at);
    }
    return base;
  }, [afterArtistFilter, search, sortKey]);

  const filteredRemote = useMemo(() => {
    if (activePlaylistId || activeTagId || artistFilter) return [];
    if (!search.trim()) return remoteOnly;
    const q = search.toLowerCase();
    return remoteOnly.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        (t.artist?.toLowerCase().includes(q) ?? false) ||
        (t.album?.toLowerCase().includes(q) ?? false),
    );
  }, [remoteOnly, search, activePlaylistId, activeTagId, artistFilter]);

  const SORT_LABELS: Record<typeof sortKey, string> = {
    added: "Recently added",
    title: "Title A–Z",
    artist: "Artist A–Z",
    duration: "Duration",
  };

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
      await refreshTags();
      await refreshStats();
      toast.success(`Deleted "${target.title}"`);
    } catch (err) {
      toast.error("Delete failed", {
        description: err instanceof Error ? err.message : String(err),
      });
    }
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

  async function onTagMutated() {
    await refresh();
    await refreshPlaylistTracks();
    await refreshTags();
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
    setTimeout(() => playerDispatch({ type: "TOGGLE_SHUFFLE" }), 0);
  }

  function playArtist(track: LibraryTrack) {
    if (!track.artist) return;
    const byArtist = tracks.filter((t) => t.artist === track.artist);
    if (byArtist.length === 0) return;
    const startIndex = Math.max(
      0,
      byArtist.findIndex((t) => t.id === track.id),
    );
    playerDispatch({ type: "PLAY_QUEUE", queue: byArtist, startIndex });
    toast.info(`Playing ${byArtist.length} tracks by ${track.artist}`);
  }

  function playAlbum(track: LibraryTrack) {
    if (!track.album) return;
    const album = tracks.filter(
      (t) => t.album === track.album && t.artist === track.artist,
    );
    if (album.length === 0) return;
    const startIndex = Math.max(
      0,
      album.findIndex((t) => t.id === track.id),
    );
    playerDispatch({ type: "PLAY_QUEUE", queue: album, startIndex });
    toast.info(`Playing ${album.length} tracks from ${track.album}`);
  }

  async function movePlaylistTrack(track: LibraryTrack, direction: -1 | 1) {
    if (!activePlaylistId) return;
    const idx = playlistTracks.findIndex((t) => t.id === track.id);
    if (idx < 0) return;
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= playlistTracks.length) return;
    const reordered = [...playlistTracks];
    [reordered[idx], reordered[newIdx]] = [reordered[newIdx], reordered[idx]];
    setPlaylistTracks(reordered);
    try {
      const res = await fetch(
        `/api/playlists/${activePlaylistId}/tracks/order`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ trackIds: reordered.map((t) => t.id) }),
        },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch (err) {
      toast.error("Reorder failed", {
        description: err instanceof Error ? err.message : String(err),
      });
      await refreshPlaylistTracks();
    }
  }

  return (
    <div className="space-y-5 pb-32">
      <StatsPanel stats={stats} />

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

      {tags.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-muted-foreground">Tags:</span>
          {tags.map((tag) => {
            const active = activeTagId === tag.id;
            return (
              <button
                key={tag.id}
                onClick={() => setActiveTagId(active ? null : tag.id)}
                className={cn(
                  "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 font-medium transition-all",
                  active
                    ? tagClass(tag.color)
                    : "border-border/40 bg-card/30 text-muted-foreground hover:text-foreground",
                )}
              >
                {tag.name}
                <span className="text-[10px] opacity-60">{tag.track_count}</span>
              </button>
            );
          })}
          {activeTagId && (
            <button
              onClick={() => setActiveTagId(null)}
              className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-muted-foreground hover:text-foreground"
              title="Clear tag filter"
            >
              <XIcon className="h-3 w-3" />
              clear
            </button>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[16rem] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={
              activePlaylist
                ? `Search in "${activePlaylist.name}"…`
                : activeTag
                  ? `Search #${activeTag.name}…`
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
        {activePlaylist && (
          <Button
            variant="outline"
            onClick={() => setAddSongsFor(activePlaylist)}
            className="gap-2"
            title="Add songs to this playlist"
          >
            <ListPlus className="h-4 w-4" />
            Add songs
          </Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="gap-2" title="Sort library">
              <ArrowUpDown className="h-4 w-4" />
              <span className="hidden sm:inline">{SORT_LABELS[sortKey]}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Sort by</DropdownMenuLabel>
            {(Object.keys(SORT_LABELS) as Array<keyof typeof SORT_LABELS>).map(
              (k) => (
                <DropdownMenuItem key={k} onClick={() => setSortKey(k)}>
                  {sortKey === k && <Check className="mr-2 h-4 w-4" />}
                  <span className={sortKey === k ? "" : "ml-6"}>
                    {SORT_LABELS[k]}
                  </span>
                </DropdownMenuItem>
              ),
            )}
          </DropdownMenuContent>
        </DropdownMenu>
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

      {artistFilter && (
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">Filter:</span>
          <span className="inline-flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary/10 px-2 py-1 font-medium text-primary">
            <User className="h-3 w-3" />
            {artistFilter}
            <button
              onClick={() => setArtistFilter(null)}
              className="-mr-0.5 opacity-60 hover:opacity-100"
              title="Clear artist filter"
            >
              <XIcon className="h-3 w-3" />
            </button>
          </span>
        </div>
      )}

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
                ? "Pick songs from your library to add."
                : firebaseConfigured && !user
                  ? "Download a track, click Rescan, or sign in to pull from your other devices."
                  : "Download a track or click Rescan to detect existing files."}
            </p>
          </div>
          {activePlaylist && (
            <Button
              onClick={() => setAddSongsFor(activePlaylist)}
              className="gap-2"
            >
              <ListPlus className="h-4 w-4" />
              Add songs
            </Button>
          )}
        </motion.div>
      ) : (
        <div className="space-y-8">
          {filtered.length > 0 && (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              <AnimatePresence mode="popLayout">
                {filtered.map((t, i) => {
                  const pIdx = activePlaylistId
                    ? playlistTracks.findIndex((pt) => pt.id === t.id)
                    : -1;
                  return (
                    <LibraryCard
                      key={t.id}
                      track={t}
                      index={i}
                      isPlaying={nowPlaying?.id === t.id}
                      playlists={playlists}
                      activePlaylist={activePlaylist}
                      tags={tags}
                      canMoveUp={activePlaylistId !== null && pIdx > 0}
                      canMoveDown={
                        activePlaylistId !== null &&
                        pIdx >= 0 &&
                        pIdx < playlistTracks.length - 1
                      }
                      onPlay={() => playTrackInContext(t)}
                      onPlayNext={() =>
                        playerDispatch({ type: "PLAY_NEXT", track: t })
                      }
                      onEnqueue={() =>
                        playerDispatch({ type: "ENQUEUE", track: t })
                      }
                      onRename={() => setRenaming(t)}
                      onDelete={() => setToDelete(t)}
                      onEditTags={() => setTaggingTrack(t)}
                      onTagClick={(tagId) =>
                        setActiveTagId(tagId === activeTagId ? null : tagId)
                      }
                      onArtistClick={() => {
                        if (t.artist) setArtistFilter(t.artist);
                      }}
                      onPlayArtist={() => playArtist(t)}
                      onPlayAlbum={() => playAlbum(t)}
                      onMoveUp={
                        activePlaylistId
                          ? () => movePlaylistTrack(t, -1)
                          : undefined
                      }
                      onMoveDown={
                        activePlaylistId
                          ? () => movePlaylistTrack(t, 1)
                          : undefined
                      }
                      onPlaylistMutated={onPlaylistMutated}
                    />
                  );
                })}
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
                        refreshStats();
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
          if (created) {
            setActivePlaylistId(created.id);
            setAddSongsFor(created);
          }
        }}
      />

      <AddSongsDialog
        open={addSongsFor !== null}
        playlist={addSongsFor}
        onClose={() => setAddSongsFor(null)}
        onAdded={async () => {
          await refreshPlaylists();
          await refreshPlaylistTracks();
        }}
      />

      <TagEditor
        track={taggingTrack}
        tags={tags}
        onClose={() => setTaggingTrack(null)}
        onMutated={onTagMutated}
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
