import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { db } from "./firebase";
import type { SavedTrack, Playlist, Tag } from "./types";

export function syncKey(params: {
  source?: string | null;
  sourceId?: string | null;
  title: string;
  artist: string | null;
}): string {
  if (params.source && params.sourceId) {
    return `${params.source}_${params.sourceId}`
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, "_")
      .slice(0, 200);
  }
  return `t_${matchKey(params)}`.slice(0, 200);
}

export function matchKey(t: { title: string; artist: string | null }): string {
  const titleKey = t.title
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 80);
  const artistKey = (t.artist ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 80);
  return `${artistKey}::${titleKey}` || "unknown";
}

export async function saveTrackCloud(
  uid: string,
  track: SavedTrack,
): Promise<void> {
  if (!db) return;
  const ref = doc(db, "users", uid, "saved", track.id);
  await setDoc(
    ref,
    {
      ...track,
      saved_at: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function fetchSavedTracks(uid: string): Promise<SavedTrack[]> {
  if (!db) return [];
  const snap = await getDocs(collection(db, "users", uid, "saved"));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SavedTrack, "id">) }));
}

export async function deleteSavedTrack(uid: string, id: string): Promise<void> {
  if (!db) return;
  await deleteDoc(doc(db, "users", uid, "saved", id));
}

export interface CloudPlaylist {
  id: string;
  name: string;
  track_keys: string[];
}

export async function fetchPlaylistsCloud(
  uid: string,
): Promise<CloudPlaylist[]> {
  if (!db) return [];
  const snap = await getDocs(collection(db, "users", uid, "playlists"));
  return snap.docs.map((d) => {
    const data = d.data() as { name?: string; track_keys?: string[] };
    return {
      id: d.id,
      name: data.name ?? "Untitled",
      track_keys: data.track_keys ?? [],
    };
  });
}

export async function savePlaylistCloud(
  uid: string,
  p: CloudPlaylist,
): Promise<void> {
  if (!db) return;
  await setDoc(
    doc(db, "users", uid, "playlists", p.id),
    {
      name: p.name,
      track_keys: p.track_keys,
      updated_at: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function deletePlaylistCloud(
  uid: string,
  id: string,
): Promise<void> {
  if (!db) return;
  await deleteDoc(doc(db, "users", uid, "playlists", id));
}

export interface CloudTag {
  id: string;
  name: string;
  color: string;
}

export async function fetchTagsCloud(uid: string): Promise<CloudTag[]> {
  if (!db) return [];
  const snap = await getDocs(collection(db, "users", uid, "tags"));
  return snap.docs.map((d) => {
    const data = d.data() as { name?: string; color?: string };
    return {
      id: d.id,
      name: data.name ?? "tag",
      color: data.color ?? "emerald",
    };
  });
}

export async function saveTagCloud(uid: string, t: CloudTag): Promise<void> {
  if (!db) return;
  await setDoc(
    doc(db, "users", uid, "tags", t.id),
    { name: t.name, color: t.color, updated_at: serverTimestamp() },
    { merge: true },
  );
}

export async function deleteTagCloud(uid: string, id: string): Promise<void> {
  if (!db) return;
  await deleteDoc(doc(db, "users", uid, "tags", id));
}

export async function updateSavedTrackTags(
  uid: string,
  syncDocId: string,
  tag_ids: string[],
): Promise<void> {
  if (!db) return;
  await setDoc(
    doc(db, "users", uid, "saved", syncDocId),
    { tag_ids, updated_at: serverTimestamp() },
    { merge: true },
  );
}

interface LocalLibraryTrack {
  id: string;
  title: string;
  artist: string | null;
}

export function buildSyncKeyToIdMap(
  tracks: LocalLibraryTrack[],
): Map<string, string> {
  return new Map(tracks.map((t) => [matchKey(t), t.id]));
}

export async function pushAllPlaylistsToCloud(
  uid: string,
  localPlaylists: Playlist[],
  fetchTracks: (playlistId: string) => Promise<LocalLibraryTrack[]>,
): Promise<void> {
  if (!db) return;
  const cloud = await fetchPlaylistsCloud(uid);
  const localIds = new Set(localPlaylists.map((p) => p.id));

  for (const cp of cloud) {
    if (!localIds.has(cp.id)) {
      await deletePlaylistCloud(uid, cp.id);
    }
  }

  for (const lp of localPlaylists) {
    const tracks = await fetchTracks(lp.id);
    const track_keys = tracks.map((t) => matchKey(t));
    await savePlaylistCloud(uid, {
      id: lp.id,
      name: lp.name,
      track_keys,
    });
  }
}

export async function pushAllTagsToCloud(
  uid: string,
  localTags: Tag[],
): Promise<void> {
  if (!db) return;
  const cloud = await fetchTagsCloud(uid);
  const localIds = new Set(localTags.map((t) => t.id));

  for (const ct of cloud) {
    if (!localIds.has(ct.id)) {
      await deleteTagCloud(uid, ct.id);
    }
  }

  for (const lt of localTags) {
    await saveTagCloud(uid, { id: lt.id, name: lt.name, color: lt.color });
  }
}

export async function pushAllTrackTagsToCloud(
  uid: string,
  tracks: Array<LocalLibraryTrack & { tag_ids: string[] }>,
): Promise<void> {
  if (!db) return;
  for (const t of tracks) {
    if (!t.tag_ids || t.tag_ids.length === 0) continue;
    await updateSavedTrackTags(uid, matchKey(t), t.tag_ids);
  }
}

export async function pushPlaylistByIdToCloud(
  uid: string,
  playlistId: string,
): Promise<void> {
  if (!db) return;
  try {
    const [listRes, tracksRes] = await Promise.all([
      fetch("/api/playlists"),
      fetch(`/api/playlists/${playlistId}/tracks`),
    ]);
    if (!listRes.ok || !tracksRes.ok) return;
    const { playlists } = (await listRes.json()) as {
      playlists: Array<{ id: string; name: string }>;
    };
    const { tracks } = (await tracksRes.json()) as {
      tracks: LocalLibraryTrack[];
    };
    const p = playlists.find((x) => x.id === playlistId);
    if (!p) return;
    await savePlaylistCloud(uid, {
      id: p.id,
      name: p.name,
      track_keys: tracks.map((t) => matchKey(t)),
    });
  } catch (err) {
    console.warn("pushPlaylistByIdToCloud failed:", err);
  }
}
