import { useCallback, useEffect, useState } from "react";
import {
  Download,
  Music,
  ListMusic,
  Disc3,
  Loader2,
  CheckCircle2,
  X,
  Plus,
  ChevronDown,
  Check,
} from "lucide-react";
import { motion } from "motion/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useAuth } from "@/features/auth/useAuth";
import { saveTrackCloud, syncKey, pushPlaylistByIdToCloud } from "@/lib/sync";
import { streamDownload } from "@/lib/download-stream";
import { NewPlaylistDialog } from "@/features/library/NewPlaylistDialog";
import type { ResolvedItem, TrackMeta, Playlist } from "@/lib/types";

const kindIcon = {
  track: Music,
  playlist: ListMusic,
  album: Disc3,
} as const;

const sourceAccent = {
  spotify: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  soundcloud: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  youtube: "bg-red-500/15 text-red-400 border-red-500/30",
  other: "bg-muted/50 text-muted-foreground border-border",
} as const;

interface PreviewCardProps {
  item: ResolvedItem;
  onClear: () => void;
}

type Status =
  | { kind: "idle" }
  | {
      kind: "downloading";
      current: number;
      total: number;
      trackTitle: string;
      trackPercent: number;
      stage?: string;
    }
  | { kind: "done"; downloaded: number };

export function PreviewCard({ item, onClear }: PreviewCardProps) {
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(
    null,
  );
  const [newPlaylistOpen, setNewPlaylistOpen] = useState(false);
  const KindIcon = kindIcon[item.kind];
  const { user } = useAuth();

  const refreshPlaylists = useCallback(async () => {
    try {
      const res = await fetch("/api/playlists");
      if (!res.ok) return;
      const data = (await res.json()) as { playlists: Playlist[] };
      setPlaylists(data.playlists);
    } catch {
      // best-effort
    }
  }, []);

  useEffect(() => {
    refreshPlaylists();
  }, [refreshPlaylists]);

  const selectedPlaylist = playlists.find((p) => p.id === selectedPlaylistId);

  async function attachToSelected(libraryIds: string[]) {
    if (!selectedPlaylistId || libraryIds.length === 0) return;
    const real = libraryIds.filter(Boolean);
    if (real.length === 0) return;
    try {
      if (real.length === 1) {
        await fetch(`/api/playlists/${selectedPlaylistId}/tracks`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ trackId: real[0] }),
        });
      } else {
        await fetch(`/api/playlists/${selectedPlaylistId}/tracks/batch`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ trackIds: real }),
        });
      }
    } catch (err) {
      console.warn("attach to playlist failed:", err);
    }
  }

  async function syncOne(t: TrackMeta) {
    if (!user) return;
    try {
      await saveTrackCloud(user.uid, {
        id: syncKey({
          source: item.source,
          sourceId: t.id,
          title: t.title,
          artist: t.artist,
        }),
        title: t.title,
        artist: t.artist || null,
        album: item.kind === "album" ? item.title : null,
        source: item.source,
        source_url: t.source_url,
        artwork_url: t.artwork_url ?? item.artwork_url ?? null,
      });
    } catch (err) {
      console.warn("cloud sync failed:", err);
    }
  }

  async function handleDownload() {
    const pending = toast.loading(`Starting ${item.title}…`);
    const outputs: string[] = [];
    const allLibraryIds: string[] = [];
    try {
      if (item.source === "spotify") {
        const total = item.tracks.length;
        for (let i = 0; i < total; i++) {
          const t: TrackMeta = item.tracks[i];
          setStatus({
            kind: "downloading",
            current: i + 1,
            total,
            trackTitle: t.title,
            trackPercent: 0,
          });
          toast.loading(`Track ${i + 1}/${total}: ${t.title}`, { id: pending });
          const query = `ytsearch1:${t.artist} ${t.title}`.trim();
          try {
            const result = await streamDownload(
              {
                url: query,
                title: t.title,
                artist: t.artist,
                album: item.kind === "album" ? item.title : undefined,
              },
              ({ percent, stage }) => {
                setStatus((prev) =>
                  prev.kind === "downloading"
                    ? {
                        ...prev,
                        trackPercent: percent ?? prev.trackPercent,
                        stage: stage ?? prev.stage,
                      }
                    : prev,
                );
              },
            );
            outputs.push(...result.outputFiles);
            allLibraryIds.push(...result.libraryIds);
            await syncOne(t);
            await attachToSelected(result.libraryIds);
          } catch (err) {
            console.warn(`Skipping ${t.title}:`, err);
          }
        }
      } else {
        setStatus({
          kind: "downloading",
          current: 1,
          total: 1,
          trackTitle: item.title,
          trackPercent: 0,
        });
        const result = await streamDownload(
          { url: item.source_url },
          ({ percent, stage }) => {
            setStatus((prev) =>
              prev.kind === "downloading"
                ? {
                    ...prev,
                    trackPercent: percent ?? prev.trackPercent,
                    stage: stage ?? prev.stage,
                  }
                : prev,
            );
          },
        );
        outputs.push(...result.outputFiles);
        allLibraryIds.push(...result.libraryIds);
        if (item.kind === "track" && item.tracks[0]) {
          await syncOne(item.tracks[0]);
        }
        await attachToSelected(result.libraryIds);
      }
      setStatus({ kind: "done", downloaded: outputs.length });
      const suffix = selectedPlaylist
        ? ` · added to "${selectedPlaylist.name}"`
        : "";
      toast.success(
        outputs.length === 1
          ? `Downloaded${suffix}`
          : `Downloaded ${outputs.length}/${item.tracks.length}${suffix}`,
        {
          id: pending,
          description: outputs[0] ?? undefined,
        },
      );
      if (selectedPlaylistId) {
        await refreshPlaylists();
        if (user) await pushPlaylistByIdToCloud(user.uid, selectedPlaylistId);
      }
    } catch (err) {
      setStatus({ kind: "idle" });
      toast.error("Download failed", {
        id: pending,
        description: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const isDownloading = status.kind === "downloading";
  const isDone = status.kind === "done";

  return (
    <>
      <motion.div
        layout
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -16 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="relative overflow-hidden rounded-xl border border-border/60 bg-card/60 shadow-xl shadow-black/10 backdrop-blur-md"
      >
        <Button
          variant="ghost"
          size="icon"
          onClick={onClear}
          className="absolute right-2 top-2 z-10 h-8 w-8"
          title="Clear"
        >
          <X className="h-4 w-4" />
        </Button>

        <div className="flex gap-5 p-5">
          <div className="relative shrink-0">
            {item.artwork_url ? (
              <img
                src={item.artwork_url}
                alt={item.title}
                className="h-32 w-32 rounded-lg object-cover shadow-lg ring-1 ring-border/40"
              />
            ) : (
              <div className="flex h-32 w-32 items-center justify-center rounded-lg bg-muted">
                <KindIcon className="h-10 w-10 text-muted-foreground" />
              </div>
            )}
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium capitalize",
                  sourceAccent[item.source],
                )}
              >
                {item.source}
              </span>
              <span className="inline-flex items-center gap-1 rounded-md bg-accent/50 px-2 py-0.5 text-xs font-medium capitalize text-accent-foreground">
                <KindIcon className="h-3 w-3" />
                {item.kind}
              </span>
              {item.track_count > 1 && (
                <span className="text-xs text-muted-foreground">
                  {item.track_count} tracks
                </span>
              )}
            </div>

            <h2 className="truncate text-xl font-semibold tracking-tight">
              {item.title}
            </h2>
            {item.artist && (
              <p className="truncate text-sm text-muted-foreground">
                {item.artist}
              </p>
            )}

            {isDownloading && (
              <div className="mt-1 space-y-1 text-xs text-muted-foreground">
                <div className="flex justify-between gap-2">
                  <span className="truncate">{status.trackTitle}</span>
                  <span className="shrink-0 tabular-nums">
                    {status.total > 1 ? `${status.current}/${status.total} · ` : ""}
                    {Math.round(status.trackPercent)}%
                    {status.stage ? ` · ${status.stage}` : ""}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <motion.div
                    className="h-full bg-primary"
                    animate={{
                      width: `${
                        ((status.current - 1 + status.trackPercent / 100) /
                          status.total) *
                        100
                      }%`,
                    }}
                    transition={{ duration: 0.2 }}
                  />
                </div>
              </div>
            )}

            <div className="mt-auto flex flex-wrap items-center gap-2 pt-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isDownloading}
                    className="gap-1.5"
                  >
                    <ListMusic className="h-3.5 w-3.5" />
                    <span className="max-w-[10rem] truncate">
                      {selectedPlaylist ? selectedPlaylist.name : "No playlist"}
                    </span>
                    <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56">
                  <DropdownMenuLabel>Add to playlist</DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => setSelectedPlaylistId(null)}>
                    {selectedPlaylistId === null && (
                      <Check className="mr-2 h-4 w-4" />
                    )}
                    <span className={selectedPlaylistId === null ? "" : "ml-6"}>
                      Don't add
                    </span>
                  </DropdownMenuItem>
                  {playlists.length > 0 && <DropdownMenuSeparator />}
                  {playlists.map((p) => (
                    <DropdownMenuItem
                      key={p.id}
                      onClick={() => setSelectedPlaylistId(p.id)}
                    >
                      {selectedPlaylistId === p.id && (
                        <Check className="mr-2 h-4 w-4" />
                      )}
                      <span
                        className={cn(
                          "flex-1 truncate",
                          selectedPlaylistId !== p.id && "ml-6",
                        )}
                      >
                        {p.name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {p.track_count}
                      </span>
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setNewPlaylistOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    New playlist…
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Button
                onClick={handleDownload}
                disabled={isDownloading}
                className="gap-2"
              >
                {isDownloading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : isDone ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                {isDownloading
                  ? `Downloading ${status.current}/${status.total}…`
                  : isDone
                    ? `Downloaded ${status.downloaded}`
                    : item.kind === "track"
                      ? "Download"
                      : `Download all ${item.track_count}`}
              </Button>
            </div>
          </div>
        </div>
      </motion.div>

      <NewPlaylistDialog
        open={newPlaylistOpen}
        target={null}
        onClose={() => setNewPlaylistOpen(false)}
        onSaved={async (created) => {
          await refreshPlaylists();
          if (created) setSelectedPlaylistId(created.id);
        }}
      />
    </>
  );
}
