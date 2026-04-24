import { useEffect, useRef } from "react";
import { toast } from "sonner";
import type { User } from "firebase/auth";
import type { LibraryTrack, Playlist, Tag } from "@/lib/types";
import {
  fetchPlaylistsCloud,
  fetchTagsCloud,
  fetchSavedTracks,
  savePlaylistCloud,
  saveTagCloud,
  buildSyncKeyToIdMap,
  matchKey,
} from "@/lib/sync";

interface UseCloudSyncParams {
  user: User | null;
  onReconciled: () => void;
}

export function useCloudSync({ user, onReconciled }: UseCloudSyncParams): void {
  const ranFor = useRef<string | null>(null);

  useEffect(() => {
    if (!user) {
      ranFor.current = null;
      return;
    }
    if (ranFor.current === user.uid) return;
    ranFor.current = user.uid;

    (async () => {
      try {
        await reconcile(user.uid);
        onReconciled();
      } catch (err) {
        console.warn("cloud reconcile failed:", err);
        toast.error("Cloud sync skipped", {
          description: err instanceof Error ? err.message : String(err),
        });
      }
    })();
  }, [user, onReconciled]);
}

async function reconcile(uid: string) {
  const [
    cloudPlaylists,
    cloudTags,
    cloudSaved,
    localPlaylistsRes,
    localTagsRes,
    localLibraryRes,
  ] = await Promise.all([
    fetchPlaylistsCloud(uid),
    fetchTagsCloud(uid),
    fetchSavedTracks(uid),
    fetch("/api/playlists"),
    fetch("/api/tags"),
    fetch("/api/library"),
  ]);

  if (!localPlaylistsRes.ok || !localTagsRes.ok || !localLibraryRes.ok) {
    throw new Error("couldn't read local state");
  }

  const localPlaylists = (
    (await localPlaylistsRes.json()) as { playlists: Playlist[] }
  ).playlists;
  const localTags = ((await localTagsRes.json()) as { tags: Tag[] }).tags;
  const localLibrary = (
    (await localLibraryRes.json()) as { tracks: LibraryTrack[] }
  ).tracks;

  const syncKeyToLocalId = buildSyncKeyToIdMap(localLibrary);
  const localPlaylistIds = new Set(localPlaylists.map((p) => p.id));
  const localTagIds = new Set(localTags.map((t) => t.id));
  const cloudPlaylistIds = new Set(cloudPlaylists.map((p) => p.id));
  const cloudTagIds = new Set(cloudTags.map((t) => t.id));

  // PULL: cloud items missing locally → create local
  for (const cp of cloudPlaylists) {
    if (localPlaylistIds.has(cp.id)) continue;
    await fetch("/api/playlists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: cp.name, id: cp.id }),
    });
    const trackIds = cp.track_keys
      .map((k) => syncKeyToLocalId.get(k))
      .filter((id): id is string => Boolean(id));
    if (trackIds.length > 0) {
      await fetch(`/api/playlists/${cp.id}/tracks/batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trackIds }),
      });
    }
  }

  for (const ct of cloudTags) {
    if (localTagIds.has(ct.id)) continue;
    await fetch("/api/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: ct.name, color: ct.color, id: ct.id }),
    });
  }

  // Apply cloud tag assignments to local tracks
  for (const s of cloudSaved) {
    const tagIds = (s as unknown as { tag_ids?: string[] }).tag_ids;
    if (!tagIds || tagIds.length === 0) continue;
    const localId = syncKeyToLocalId.get(s.id);
    if (!localId) continue;
    for (const tagId of tagIds) {
      await fetch(`/api/tags/${tagId}/tracks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trackId: localId }),
      });
    }
  }

  // PUSH: local items missing in cloud → create cloud
  for (const lp of localPlaylists) {
    if (cloudPlaylistIds.has(lp.id)) continue;
    const res = await fetch(`/api/playlists/${lp.id}/tracks`);
    if (!res.ok) continue;
    const { tracks } = (await res.json()) as { tracks: LibraryTrack[] };
    const track_keys = tracks.map((t) => matchKey(t));
    await savePlaylistCloud(uid, {
      id: lp.id,
      name: lp.name,
      track_keys,
    });
  }

  for (const lt of localTags) {
    if (cloudTagIds.has(lt.id)) continue;
    await saveTagCloud(uid, { id: lt.id, name: lt.name, color: lt.color });
  }

  // PUSH: local track-tag assignments that aren't yet in cloud
  for (const lt of localLibrary) {
    if (!lt.tag_ids || lt.tag_ids.length === 0) continue;
    const key = matchKey(lt);
    const cloudDoc = cloudSaved.find((s) => s.id === key);
    const cloudTagsOnDoc =
      (cloudDoc as unknown as { tag_ids?: string[] } | undefined)?.tag_ids ??
      [];
    const differs =
      cloudTagsOnDoc.length !== lt.tag_ids.length ||
      lt.tag_ids.some((id) => !cloudTagsOnDoc.includes(id));
    if (differs) {
      await (async () => {
        const { updateSavedTrackTags } = await import("@/lib/sync");
        await updateSavedTrackTags(uid, key, lt.tag_ids);
      })();
    }
  }
}
