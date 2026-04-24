import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { db } from "./firebase";
import type { SavedTrack } from "./types";

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
