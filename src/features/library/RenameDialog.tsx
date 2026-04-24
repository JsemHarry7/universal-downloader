import { useState, type FormEvent } from "react";
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
import type { LibraryTrack } from "@/lib/types";

interface RenameDialogProps {
  track: LibraryTrack | null;
  onClose: () => void;
  onSaved: () => void;
}

export function RenameDialog({ track, onClose, onSaved }: RenameDialogProps) {
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [album, setAlbum] = useState("");
  const [saving, setSaving] = useState(false);

  const open = track !== null;

  if (open && title === "" && artist === "" && album === "") {
    setTitle(track.title);
    setArtist(track.artist ?? "");
    setAlbum(track.album ?? "");
  }

  function handleOpenChange(next: boolean) {
    if (!next) {
      onClose();
      setTitle("");
      setArtist("");
      setAlbum("");
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!track) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/library/${track.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          artist: artist.trim(),
          album: album.trim(),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      toast.success("Renamed");
      onSaved();
      onClose();
      setTitle("");
      setArtist("");
      setAlbum("");
    } catch (err) {
      toast.error("Rename failed", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit track</DialogTitle>
          <DialogDescription>
            Updates tags in the library and renames the file on disk.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Title</span>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Artist</span>
            <Input value={artist} onChange={(e) => setArtist(e.target.value)} />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Album</span>
            <Input value={album} onChange={(e) => setAlbum(e.target.value)} />
          </label>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => handleOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
