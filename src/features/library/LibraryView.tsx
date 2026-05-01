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
  CopyCheck,
  Download,
  CloudDownload,
  CheckSquare,
  Trash2,
  LayoutGrid,
  List as ListIcon,
  MoreHorizontal,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
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
import { DuplicatesDialog } from "./DuplicatesDialog";
import { useAuth } from "@/features/auth/useAuth";
import {
  fetchSavedTracks,
  fetchPlaylistsCloud,
  matchKey,
  deletePlaylistCloud,
  pushAllTagsToCloud,
  pushAllTrackTagsToCloud,
  pushPlaylistByIdToCloud,
  type CloudPlaylist,
} from "@/lib/sync";
import { streamDownload } from "@/lib/download-stream";
import { useCloudSync } from "@/features/cloud/useCloudSync";
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
  const [dupesOpen, setDupesOpen] = useState(false);
  const [artistFilter, setArtistFilter] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<"added" | "title" | "artist" | "duration">("added");
  const [viewMode, setViewMode] = useState<"grid" | "list">(() => {
    if (typeof window === "undefined") return "grid";
    return window.localStorage.getItem("library-view-mode") === "list"
      ? "list"
      : "grid";
  });
  const [cloudPlaylists, setCloudPlaylists] = useState<CloudPlaylist[]>([]);
  const [bulkDownloading, setBulkDownloading] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
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
      setCloudPlaylists([]);
      return;
    }
    try {
      const [savedList, playlistList] = await Promise.all([
        fetchSavedTracks(user.uid),
        fetchPlaylistsCloud(user.uid),
      ]);
      setSaved(savedList);
      setCloudPlaylists(playlistList);
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
    if (typeof window !== "undefined") {
      window.localStorage.setItem("library-view-mode", viewMode);
    }
  }, [viewMode]);

  useCloudSync({
    user,
    onReconciled: () => {
      refresh();
      refreshPlaylists();
      refreshTags();
      refreshStats();
      refreshSaved();
    },
  });

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

  const activeCloudPlaylist = useMemo(
    () =>
      activePlaylistId
        ? (cloudPlaylists.find((p) => p.id === activePlaylistId) ?? null)
        : null,
    [cloudPlaylists, activePlaylistId],
  );

  const missingInActivePlaylist = useMemo(() => {
    if (!activeCloudPlaylist) return [];
    const localKeysInPlaylist = new Set(playlistTracks.map((t) => matchKey(t)));
    return activeCloudPlaylist.track_keys
      .filter((k) => !localKeysInPlaylist.has(k))
      .map((k) => saved.find((s) => s.id === k))
      .filter((t): t is SavedTrack => t !== undefined);
  }, [activeCloudPlaylist, playlistTracks, saved]);

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
      // Playlists this track was in need a track_keys push (local track gone)
      if (user) {
        const freshPlRes = await fetch("/api/playlists");
        if (freshPlRes.ok) {
          const { playlists: pls } = (await freshPlRes.json()) as {
            playlists: Playlist[];
          };
          for (const p of pls) await syncPlaylistToCloud(p.id);
        }
      }
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
      if (user) await deletePlaylistCloud(user.uid, target.id);
      toast.success(`Deleted playlist "${target.name}"`);
    } catch (err) {
      toast.error("Playlist delete failed", {
        description: err instanceof Error ? err.message : String(err),
      });
    }
  }

  async function syncPlaylistToCloud(playlistId: string) {
    if (!user) return;
    await pushPlaylistByIdToCloud(user.uid, playlistId);
  }

  async function onPlaylistMutated() {
    await refreshPlaylists();
    await refreshPlaylistTracks();
    if (user && activePlaylistId) {
      await syncPlaylistToCloud(activePlaylistId);
      await refreshSaved();
    }
  }

  async function downloadBatch(tracks: SavedTrack[], label: string) {
    if (tracks.length === 0) return;
    setBulkDownloading(true);
    const pending = toast.loading(`Downloading ${label}… 0/${tracks.length}`);
    let ok = 0;
    let fail = 0;
    for (let i = 0; i < tracks.length; i++) {
      const t = tracks[i];
      toast.loading(
        `Downloading ${label}… ${i + 1}/${tracks.length}: ${t.title}`,
        { id: pending },
      );
      const url =
        t.source_url && t.source !== "spotify"
          ? t.source_url
          : `ytsearch1:${t.artist ?? ""} ${t.title}`.trim();
      try {
        await streamDownload({
          url,
          title: t.title,
          artist: t.artist ?? undefined,
          album: t.album ?? undefined,
        });
        ok++;
      } catch (err) {
        console.warn(`skipped ${t.title}:`, err);
        fail++;
      }
    }
    setBulkDownloading(false);
    toast.success(`Downloaded ${ok} of ${tracks.length}`, {
      id: pending,
      description: fail > 0 ? `${fail} failed` : undefined,
    });
    await refresh();
    await refreshStats();
    await refreshPlaylistTracks();
  }

  async function downloadAllMissing() {
    await downloadBatch(remoteOnly, "saved tracks");
  }

  async function downloadMissingInActivePlaylist() {
    if (missingInActivePlaylist.length === 0 || !activePlaylistId) return;
    await downloadBatch(
      missingInActivePlaylist,
      activeCloudPlaylist?.name ?? "playlist",
    );
    await onPlaylistMutated();
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function enterSelectMode() {
    setSelectMode(true);
    setSelectedIds(new Set());
  }

  function exitSelectMode() {
    setSelectMode(false);
    setSelectedIds(new Set());
  }

  function selectAllVisible() {
    setSelectedIds(new Set(filtered.map((t) => t.id)));
  }

  async function confirmBulkDelete() {
    if (selectedIds.size === 0) return;
    setBulkDeleteConfirm(false);
    setBulkDeleting(true);
    const ids = Array.from(selectedIds);
    try {
      const res = await fetch("/api/library/batch-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as {
        deleted: number;
        failed: number;
      };
      toast.success(`Deleted ${data.deleted} tracks`, {
        description: data.failed > 0 ? `${data.failed} failed` : undefined,
      });
      if (nowPlaying && selectedIds.has(nowPlaying.id)) {
        playerDispatch({ type: "STOP" });
      }
      await refresh();
      await refreshStats();
      await refreshPlaylistTracks();
      // Push any playlists' updated track_keys to cloud (tracks gone from them)
      if (user) {
        const plRes = await fetch("/api/playlists");
        if (plRes.ok) {
          const { playlists: pls } = (await plRes.json()) as {
            playlists: Playlist[];
          };
          for (const p of pls) await syncPlaylistToCloud(p.id);
        }
      }
      exitSelectMode();
    } catch (err) {
      toast.error("Bulk delete failed", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setBulkDeleting(false);
    }
  }

  function playSelected() {
    if (selectedIds.size === 0) return;
    const queue = filtered.filter((t) => selectedIds.has(t.id));
    if (queue.length === 0) return;
    playerDispatch({ type: "PLAY_QUEUE", queue, startIndex: 0 });
    exitSelectMode();
  }

  async function onTagMutated() {
    await refresh();
    await refreshPlaylistTracks();
    await refreshTags();
    if (user) {
      try {
        const [tRes, lRes] = await Promise.all([
          fetch("/api/tags"),
          fetch("/api/library"),
        ]);
        const { tags: fresh } = (await tRes.json()) as { tags: Tag[] };
        const { tracks: libTracks } = (await lRes.json()) as {
          tracks: LibraryTrack[];
        };
        await pushAllTagsToCloud(user.uid, fresh);
        await pushAllTrackTagsToCloud(user.uid, libTracks);
      } catch (err) {
        console.warn("sync tags failed:", err);
      }
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
      if (user) await syncPlaylistToCloud(activePlaylistId);
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
        {activePlaylist && missingInActivePlaylist.length > 0 && (
          <Button
            variant="default"
            onClick={downloadMissingInActivePlaylist}
            disabled={bulkDownloading}
            className="gap-2"
            title="Download this playlist's tracks that aren't on this device"
          >
            {bulkDownloading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CloudDownload className="h-4 w-4" />
            )}
            Download {missingInActivePlaylist.length} missing
          </Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="gap-2" title="Sort & view">
              <ArrowUpDown className="h-4 w-4" />
              <span className="hidden sm:inline">{SORT_LABELS[sortKey]}</span>
              {viewMode === "list" ? (
                <ListIcon className="h-4 w-4 text-muted-foreground" />
              ) : (
                <LayoutGrid className="h-4 w-4 text-muted-foreground" />
              )}
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
            <DropdownMenuSeparator />
            <DropdownMenuLabel>View as</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => setViewMode("grid")}>
              {viewMode === "grid" ? (
                <Check className="mr-2 h-4 w-4" />
              ) : (
                <LayoutGrid className="mr-2 h-4 w-4" />
              )}
              Grid
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setViewMode("list")}>
              {viewMode === "list" ? (
                <Check className="mr-2 h-4 w-4" />
              ) : (
                <ListIcon className="mr-2 h-4 w-4" />
              )}
              List
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button
          variant={selectMode ? "default" : "outline"}
          size="icon"
          onClick={selectMode ? exitSelectMode : enterSelectMode}
          title={selectMode ? "Exit select mode" : "Select multiple tracks"}
        >
          <CheckSquare className="h-4 w-4" />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" title="More actions">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setDupesOpen(true)}>
              <CopyCheck className="mr-2 h-4 w-4" />
              Find duplicates
            </DropdownMenuItem>
            <DropdownMenuItem onClick={rescan} disabled={scanning}>
              {scanning ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              {scanning ? "Scanning…" : "Rescan files"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {selectMode && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="sticky top-16 z-10 flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-4 py-2 backdrop-blur-md"
        >
          <span className="text-sm font-medium">
            {selectedIds.size} selected
          </span>
          <Button
            size="sm"
            variant="ghost"
            onClick={selectAllVisible}
            disabled={filtered.length === 0}
            className="h-7 text-xs"
          >
            Select all visible
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setSelectedIds(new Set())}
            disabled={selectedIds.size === 0}
            className="h-7 text-xs"
          >
            Clear
          </Button>
          <div className="ml-auto flex gap-1">
            <Button
              size="sm"
              variant="outline"
              onClick={playSelected}
              disabled={selectedIds.size === 0}
              className="gap-1.5"
            >
              <Play className="h-3.5 w-3.5" fill="currentColor" />
              Play
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => setBulkDeleteConfirm(true)}
              disabled={selectedIds.size === 0 || bulkDeleting}
              className="gap-1.5"
            >
              {bulkDeleting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
              Delete
            </Button>
          </div>
        </motion.div>
      )}

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
            <div
              className={cn(
                viewMode === "grid"
                  ? "grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
                  : "flex flex-col divide-y divide-border/30 overflow-hidden rounded-lg border border-border/40 bg-card/30",
              )}
            >
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
                      compact={viewMode === "list"}
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
                      selectMode={selectMode}
                      selected={selectedIds.has(t.id)}
                      onToggleSelect={() => toggleSelect(t.id)}
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
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Cloud className="h-4 w-4" />
                  <span className="font-medium">
                    Saved on other devices ({filteredRemote.length})
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="default"
                  onClick={downloadAllMissing}
                  disabled={bulkDownloading}
                  className="gap-2"
                  title="Download every saved track not already on this device"
                >
                  {bulkDownloading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  Download all {filteredRemote.length}
                </Button>
              </div>
              <div
                className={cn(
                  viewMode === "grid"
                    ? "grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
                    : "flex flex-col divide-y divide-border/30 overflow-hidden rounded-lg border border-dashed border-border/40 bg-card/20",
                )}
              >
                <AnimatePresence mode="popLayout">
                  {filteredRemote.map((s, i) => (
                    <SavedTrackCard
                      key={s.id}
                      track={s}
                      index={i}
                      compact={viewMode === "list"}
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

      <DuplicatesDialog
        open={dupesOpen}
        onClose={() => setDupesOpen(false)}
        onMutated={async () => {
          await refresh();
          await refreshStats();
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

      <AlertDialog
        open={bulkDeleteConfirm}
        onOpenChange={(next) => !next && setBulkDeleteConfirm(false)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {selectedIds.size} track{selectedIds.size === 1 ? "" : "s"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              These files will be permanently deleted from disk and removed
              from every playlist. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmBulkDelete}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Delete {selectedIds.size}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
