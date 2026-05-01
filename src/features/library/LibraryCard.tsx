import {
  Play,
  Pencil,
  Trash2,
  Music,
  Tag as TagIcon,
  ListPlus,
  ListEnd,
  SkipForward,
  User,
  Disc3,
  ChevronUp,
  ChevronDown,
  Check,
} from "lucide-react";
import { motion } from "motion/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { cn } from "@/lib/utils";
import type { LibraryTrack, Playlist, Tag } from "@/lib/types";
import { tagClass } from "./TagEditor";

interface LibraryCardProps {
  track: LibraryTrack;
  index: number;
  isPlaying: boolean;
  playlists: Playlist[];
  activePlaylist: Playlist | null;
  tags: Tag[];
  compact?: boolean;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  selectMode?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
  onPlay: () => void;
  onPlayNext: () => void;
  onEnqueue: () => void;
  onRename: () => void;
  onDelete: () => void;
  onEditTags: () => void;
  onTagClick: (tagId: string) => void;
  onArtistClick: () => void;
  onPlayArtist: () => void;
  onPlayAlbum: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onPlaylistMutated: () => void;
}

function formatDuration(seconds: number): string {
  if (!seconds || !Number.isFinite(seconds)) return "";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function LibraryCard({
  track,
  index,
  isPlaying,
  playlists,
  activePlaylist,
  tags,
  compact = false,
  canMoveUp,
  canMoveDown,
  selectMode = false,
  selected = false,
  onToggleSelect,
  onPlay,
  onPlayNext,
  onEnqueue,
  onRename,
  onDelete,
  onEditTags,
  onTagClick,
  onArtistClick,
  onPlayArtist,
  onPlayAlbum,
  onMoveUp,
  onMoveDown,
  onPlaylistMutated,
}: LibraryCardProps) {
  const artworkUrl = track.has_artwork
    ? `/api/library/${track.id}/artwork`
    : null;
  const trackTags = track.tag_ids
    .map((id) => tags.find((t) => t.id === id))
    .filter((t): t is Tag => t !== undefined);

  async function addTo(playlist: Playlist) {
    try {
      const res = await fetch(`/api/playlists/${playlist.id}/tracks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trackId: track.id }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { ok: boolean };
      if (data.ok) {
        toast.success(`Added to "${playlist.name}"`);
        onPlaylistMutated();
      } else {
        toast.info(`Already in "${playlist.name}"`);
      }
    } catch (err) {
      toast.error("Couldn't add to playlist", {
        description: err instanceof Error ? err.message : String(err),
      });
    }
  }

  async function removeFromActive() {
    if (!activePlaylist) return;
    try {
      const res = await fetch(
        `/api/playlists/${activePlaylist.id}/tracks/${track.id}`,
        { method: "DELETE" },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success(`Removed from "${activePlaylist.name}"`);
      onPlaylistMutated();
    } catch (err) {
      toast.error("Couldn't remove", {
        description: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const rowContent = (
    <motion.div
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2, delay: Math.min(index * 0.01, 0.15) }}
      onClick={selectMode ? onToggleSelect : undefined}
      onDoubleClick={
        selectMode
          ? undefined
          : (e) => {
              if ((e.target as HTMLElement).closest("button, a")) return;
              onPlay();
            }
      }
      className={cn(
        "group relative flex items-center gap-3 px-3 py-2 transition-colors hover:bg-card/60",
        selectMode && "cursor-pointer select-none",
        selected && "bg-primary/10",
        isPlaying && !selected && "bg-primary/5",
      )}
    >
      <div className="flex w-6 shrink-0 items-center justify-center text-xs tabular-nums text-muted-foreground">
        {selectMode ? (
          <div
            className={cn(
              "flex h-4 w-4 items-center justify-center rounded border transition-colors",
              selected
                ? "border-primary bg-primary text-primary-foreground"
                : "border-muted-foreground/40",
            )}
          >
            {selected && <Check className="h-3 w-3" />}
          </div>
        ) : isPlaying ? (
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/70 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
          </span>
        ) : (
          <>
            <span className="group-hover:hidden">{index + 1}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onPlay();
              }}
              className="hidden text-foreground group-hover:inline-flex"
              title="Play"
            >
              <Play className="h-3.5 w-3.5" fill="currentColor" />
            </button>
          </>
        )}
      </div>

      <div className="h-10 w-10 shrink-0 overflow-hidden rounded bg-muted">
        {artworkUrl ? (
          <img
            src={artworkUrl}
            alt={track.title}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-muted to-muted-foreground/10">
            <Music className="h-4 w-4 text-muted-foreground/50" />
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div
          className={cn(
            "truncate text-sm font-medium",
            isPlaying && "text-primary",
          )}
        >
          {track.title}
        </div>
        {track.artist ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onArtistClick();
            }}
            className="block max-w-full truncate text-left text-xs text-muted-foreground transition-colors hover:text-foreground hover:underline"
            title={`Filter to ${track.artist}`}
          >
            {track.artist}
          </button>
        ) : (
          <div className="truncate text-xs text-muted-foreground">
            Unknown artist
          </div>
        )}
      </div>

      {track.album && (
        <div
          className="hidden min-w-0 flex-1 truncate text-sm text-muted-foreground md:block"
          title={track.album}
        >
          {track.album}
        </div>
      )}

      {trackTags.length > 0 && (
        <div className="hidden items-center gap-1 lg:flex">
          {trackTags.slice(0, 2).map((tag) => (
            <button
              key={tag.id}
              onClick={(e) => {
                e.stopPropagation();
                onTagClick(tag.id);
              }}
              className={cn(
                "rounded border px-1.5 py-0.5 text-[10px] font-medium",
                tagClass(tag.color),
              )}
            >
              {tag.name}
            </button>
          ))}
          {trackTags.length > 2 && (
            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
              +{trackTags.length - 2}
            </span>
          )}
        </div>
      )}

      <div className="w-12 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
        {formatDuration(track.duration_s)}
      </div>

      {!selectMode && (
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 shrink-0 text-muted-foreground opacity-0 hover:text-destructive group-hover:opacity-100 max-sm:opacity-100"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          title="Delete"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      )}
    </motion.div>
  );

  const cardContent = (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.02, 0.3) }}
      onClick={selectMode ? onToggleSelect : undefined}
      onDoubleClick={
        selectMode
          ? undefined
          : (e) => {
              if ((e.target as HTMLElement).closest("button, a")) return;
              onPlay();
            }
      }
      className={cn(
        "group relative overflow-hidden rounded-lg border border-border/40 bg-card/40 backdrop-blur-sm transition-all hover:border-border hover:bg-card/60 hover:shadow-lg",
        selectMode && "cursor-pointer select-none",
        selected && "ring-2 ring-primary",
      )}
    >
      <div className="relative aspect-square overflow-hidden bg-muted">
        {artworkUrl ? (
          <img
            src={artworkUrl}
            alt={track.title}
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-muted to-muted-foreground/10">
            <Music className="h-10 w-10 text-muted-foreground/50" />
          </div>
        )}

        {selectMode ? (
          <div
            className={cn(
              "absolute inset-0 flex items-center justify-center transition-colors",
              selected ? "bg-primary/40" : "bg-black/30 hover:bg-black/40",
            )}
          >
            <div
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors",
                selected
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-white/70 bg-black/40",
              )}
            >
              {selected && <Check className="h-5 w-5" />}
            </div>
          </div>
        ) : (
          <>
            <div className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 transition-opacity group-hover:opacity-100 max-sm:bg-black/40 max-sm:opacity-100">
              <Button
                size="icon"
                variant="secondary"
                className="h-12 w-12 rounded-full"
                onClick={(e) => {
                  e.stopPropagation();
                  onPlay();
                }}
                title="Play"
              >
                <Play className="h-5 w-5" fill="currentColor" />
              </Button>
            </div>
            <Button
              size="icon"
              variant="destructive"
              className="absolute right-2 top-2 h-8 w-8 opacity-0 transition-opacity group-hover:opacity-100 max-sm:opacity-100"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              title="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </>
        )}

            {isPlaying && (
              <div className="absolute bottom-2 left-2 flex items-center gap-1 rounded-full bg-primary/90 px-2 py-0.5 text-xs font-medium text-primary-foreground">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary-foreground/70 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-primary-foreground" />
                </span>
                Playing
              </div>
            )}
          </div>

          <div className="p-3">
            <h3 className="truncate text-sm font-medium">{track.title}</h3>
            {track.artist ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onArtistClick();
                }}
                className="block w-full truncate text-left text-xs text-muted-foreground transition-colors hover:text-foreground hover:underline"
                title={`Filter to ${track.artist}`}
              >
                {track.artist}
              </button>
            ) : (
              <p className="truncate text-xs text-muted-foreground">
                Unknown artist
              </p>
            )}
            {trackTags.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {trackTags.slice(0, 3).map((tag) => (
                  <button
                    key={tag.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onTagClick(tag.id);
                    }}
                    className={cn(
                      "rounded border px-1.5 py-0.5 text-[10px] font-medium",
                      tagClass(tag.color),
                    )}
                  >
                    {tag.name}
                  </button>
                ))}
                {trackTags.length > 3 && (
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    +{trackTags.length - 3}
                  </span>
                )}
              </div>
            )}
            <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
              <span>{formatDuration(track.duration_s)}</span>
              <span className="uppercase">{track.format}</span>
            </div>
          </div>
        </motion.div>
  );

  const body = compact ? rowContent : cardContent;

  if (selectMode) return body;

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{body}</ContextMenuTrigger>

      <ContextMenuContent className="w-56">
        <ContextMenuItem onClick={onPlay}>
          <Play className="mr-2 h-4 w-4" />
          Play now
        </ContextMenuItem>
        <ContextMenuItem onClick={onPlayNext}>
          <SkipForward className="mr-2 h-4 w-4" />
          Play next
        </ContextMenuItem>
        <ContextMenuItem onClick={onEnqueue}>
          <ListEnd className="mr-2 h-4 w-4" />
          Add to queue
        </ContextMenuItem>

        {track.artist && (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem onClick={onPlayArtist}>
              <User className="mr-2 h-4 w-4" />
              Play all by {track.artist}
            </ContextMenuItem>
            <ContextMenuItem onClick={onArtistClick}>
              <User className="mr-2 h-4 w-4" />
              Go to artist
            </ContextMenuItem>
          </>
        )}

        {track.album && (
          <ContextMenuItem onClick={onPlayAlbum}>
            <Disc3 className="mr-2 h-4 w-4" />
            Play album
          </ContextMenuItem>
        )}

        <ContextMenuSeparator />

        <ContextMenuSub>
          <ContextMenuSubTrigger>
            <ListPlus className="mr-2 h-4 w-4" />
            Add to playlist
          </ContextMenuSubTrigger>
          <ContextMenuSubContent className="w-48">
            {playlists.length === 0 ? (
              <ContextMenuItem disabled>No playlists yet</ContextMenuItem>
            ) : (
              <>
                <ContextMenuLabel>Choose one</ContextMenuLabel>
                {playlists.map((p) => (
                  <ContextMenuItem key={p.id} onClick={() => addTo(p)}>
                    <span className="truncate">{p.name}</span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {p.track_count}
                    </span>
                  </ContextMenuItem>
                ))}
              </>
            )}
          </ContextMenuSubContent>
        </ContextMenuSub>

        {activePlaylist && (
          <>
            {onMoveUp && (
              <ContextMenuItem onClick={onMoveUp} disabled={!canMoveUp}>
                <ChevronUp className="mr-2 h-4 w-4" />
                Move up
              </ContextMenuItem>
            )}
            {onMoveDown && (
              <ContextMenuItem onClick={onMoveDown} disabled={!canMoveDown}>
                <ChevronDown className="mr-2 h-4 w-4" />
                Move down
              </ContextMenuItem>
            )}
            <ContextMenuItem
              onClick={removeFromActive}
              className="text-destructive focus:text-destructive"
            >
              Remove from "{activePlaylist.name}"
            </ContextMenuItem>
          </>
        )}

        <ContextMenuItem onClick={onEditTags}>
          <TagIcon className="mr-2 h-4 w-4" />
          Edit tags…
        </ContextMenuItem>

        <ContextMenuSeparator />

        <ContextMenuItem onClick={onRename}>
          <Pencil className="mr-2 h-4 w-4" />
          Rename…
        </ContextMenuItem>
        <ContextMenuItem
          onClick={onDelete}
          className="text-destructive focus:text-destructive"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete from disk
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
