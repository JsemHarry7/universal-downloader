import { useEffect, useState, type FormEvent } from "react";
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
import type { Playlist } from "@/lib/types";

interface Props {
  open: boolean;
  target: Playlist | null;
  onClose: () => void;
  onSaved: (playlist?: Playlist) => void;
}

export function NewPlaylistDialog({ open, target, onClose, onSaved }: Props) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const isRename = target !== null;

  useEffect(() => {
    if (open) {
      setName(target?.name ?? "");
    }
  }, [open, target]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;

    setSaving(true);
    try {
      if (isRename) {
        const res = await fetch(`/api/playlists/${target.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: trimmed }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        toast.success("Renamed");
        onSaved();
      } else {
        const res = await fetch(`/api/playlists`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: trimmed }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const created = (await res.json()) as Playlist;
        toast.success(`Created "${created.name}"`);
        onSaved(created);
      }
      onClose();
      setName("");
    } catch (err) {
      toast.error(isRename ? "Rename failed" : "Create failed", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isRename ? "Rename playlist" : "New playlist"}
          </DialogTitle>
          <DialogDescription>
            {isRename
              ? "Give this playlist a new name."
              : "Playlists can mix tracks from any source in any order."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Workout, Roadtrip, Late night…"
            autoFocus
            disabled={saving}
          />
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !name.trim()}>
              {saving ? "Saving…" : isRename ? "Rename" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
