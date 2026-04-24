import { useEffect, useState, type FormEvent } from "react";
import { Plus, X, Trash2 } from "lucide-react";
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
import { cn } from "@/lib/utils";
import type { LibraryTrack, Tag } from "@/lib/types";

const tagColorClasses: Record<string, string> = {
  emerald: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  orange: "bg-orange-500/15 text-orange-300 border-orange-500/30",
  sky: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  violet: "bg-violet-500/15 text-violet-300 border-violet-500/30",
  amber: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  rose: "bg-rose-500/15 text-rose-300 border-rose-500/30",
  cyan: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
  lime: "bg-lime-500/15 text-lime-300 border-lime-500/30",
};

export function tagClass(color: string): string {
  return tagColorClasses[color] ?? tagColorClasses.emerald;
}

interface TagEditorProps {
  track: LibraryTrack | null;
  tags: Tag[];
  onClose: () => void;
  onMutated: () => void;
}

export function TagEditor({ track, tags, onClose, onMutated }: TagEditorProps) {
  const [newTagName, setNewTagName] = useState("");
  const [busy, setBusy] = useState(false);
  const [localTagIds, setLocalTagIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (track) setLocalTagIds(new Set(track.tag_ids));
  }, [track]);

  if (!track) {
    return (
      <Dialog open={false} onOpenChange={onClose}>
        <DialogContent />
      </Dialog>
    );
  }

  async function toggle(tag: Tag) {
    if (!track) return;
    const has = localTagIds.has(tag.id);
    try {
      const res = await fetch(
        `/api/tags/${tag.id}/tracks${has ? `/${track.id}` : ""}`,
        {
          method: has ? "DELETE" : "POST",
          headers: { "Content-Type": "application/json" },
          body: has ? undefined : JSON.stringify({ trackId: track.id }),
        },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setLocalTagIds((prev) => {
        const next = new Set(prev);
        if (has) next.delete(tag.id);
        else next.add(tag.id);
        return next;
      });
      onMutated();
    } catch (err) {
      toast.error("Couldn't update tag", {
        description: err instanceof Error ? err.message : String(err),
      });
    }
  }

  async function createAndAttach(e: FormEvent) {
    e.preventDefault();
    const name = newTagName.trim();
    if (!name || !track) return;

    setBusy(true);
    try {
      const res = await fetch("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const created = (await res.json()) as Tag;
      await fetch(`/api/tags/${created.id}/tracks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trackId: track.id }),
      });
      setLocalTagIds((prev) => new Set(prev).add(created.id));
      setNewTagName("");
      onMutated();
    } catch (err) {
      toast.error("Couldn't create tag", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setBusy(false);
    }
  }

  async function deleteTag(tag: Tag) {
    if (!confirm(`Delete tag "${tag.name}"? It will be removed from all tracks.`)) {
      return;
    }
    try {
      const res = await fetch(`/api/tags/${tag.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setLocalTagIds((prev) => {
        const next = new Set(prev);
        next.delete(tag.id);
        return next;
      });
      onMutated();
    } catch (err) {
      toast.error("Couldn't delete", {
        description: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return (
    <Dialog open={track !== null} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tags</DialogTitle>
          <DialogDescription>
            Tag "{track.title}" — click to toggle, or create a new one.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-1.5">
          {tags.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No tags yet. Create one below.
            </p>
          ) : (
            tags.map((tag) => {
              const selected = localTagIds.has(tag.id);
              return (
                <div key={tag.id} className="group flex items-center">
                  <button
                    onClick={() => toggle(tag)}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-l-md border px-2 py-1 text-xs font-medium transition-all",
                      selected
                        ? tagClass(tag.color)
                        : "border-border/50 bg-card/50 text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {selected && <X className="h-3 w-3" />}
                    {tag.name}
                    <span className="ml-1 text-[10px] opacity-60">
                      {tag.track_count}
                    </span>
                  </button>
                  <button
                    onClick={() => deleteTag(tag)}
                    className="rounded-r-md border border-l-0 border-border/50 bg-card/50 px-1.5 py-1 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                    title={`Delete "${tag.name}"`}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              );
            })
          )}
        </div>

        <form onSubmit={createAndAttach} className="flex gap-2">
          <Input
            value={newTagName}
            onChange={(e) => setNewTagName(e.target.value)}
            placeholder="New tag (e.g. chill, workout, sleep)…"
            disabled={busy}
            maxLength={32}
          />
          <Button
            type="submit"
            disabled={busy || !newTagName.trim()}
            className="gap-1"
          >
            <Plus className="h-4 w-4" />
            Add
          </Button>
        </form>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
