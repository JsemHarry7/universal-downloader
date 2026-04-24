import { Plus, MoreVertical, Pencil, Trash2, ListMusic } from "lucide-react";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { Playlist } from "@/lib/types";

interface PlaylistBarProps {
  playlists: Playlist[];
  activeId: string | null;
  onSelect: (id: string | null) => void;
  onNew: () => void;
  onRename: (playlist: Playlist) => void;
  onDelete: (playlist: Playlist) => void;
}

export function PlaylistBar({
  playlists,
  activeId,
  onSelect,
  onNew,
  onRename,
  onDelete,
}: PlaylistBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Pill active={activeId === null} onClick={() => onSelect(null)}>
        All
      </Pill>

      {playlists.map((p) => (
        <div key={p.id} className="group/pill relative">
          <Pill
            active={activeId === p.id}
            onClick={() => onSelect(p.id)}
            icon={<ListMusic className="h-3 w-3" />}
            count={p.track_count}
          >
            {p.name}
          </Pill>
          {activeId === p.id && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="ml-1 rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                  title="Playlist actions"
                  aria-label="Playlist actions"
                >
                  <MoreVertical className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={() => onRename(p)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Rename
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => onDelete(p)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      ))}

      <Button
        variant="ghost"
        size="sm"
        onClick={onNew}
        className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
      >
        <Plus className="h-3.5 w-3.5" />
        New
      </Button>
    </div>
  );
}

interface PillProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  icon?: React.ReactNode;
  count?: number;
}

function Pill({ active, onClick, children, icon, count }: PillProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative inline-flex h-7 items-center gap-1.5 rounded-md px-3 text-xs font-medium transition-colors",
        active
          ? "text-foreground"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {active && (
        <motion.div
          layoutId="playlist-pill-active"
          className="absolute inset-0 rounded-md bg-accent"
          transition={{ type: "spring", stiffness: 380, damping: 30 }}
        />
      )}
      <span className="relative flex items-center gap-1.5">
        {icon}
        {children}
        {count !== undefined && count > 0 && (
          <span className="ml-0.5 rounded bg-muted px-1 py-0.5 text-[10px] tabular-nums text-muted-foreground">
            {count}
          </span>
        )}
      </span>
    </button>
  );
}
