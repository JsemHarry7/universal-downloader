import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { isSpotifyUrl, resolveSpotifyUrl } from "./spotify";

const execFileAsync = promisify(execFile);

export type SourceKind = "spotify" | "soundcloud" | "youtube" | "other";
export type ItemKind = "track" | "playlist" | "album";

export interface TrackMeta {
  id: string;
  title: string;
  artist: string;
  duration_s: number;
  artwork_url?: string;
  source_url: string;
}

export interface ResolvedItem {
  kind: ItemKind;
  title: string;
  artist?: string;
  artwork_url?: string;
  track_count: number;
  tracks: TrackMeta[];
  source: SourceKind;
  source_url: string;
}

export async function resolveUrl(
  url: string,
  ytdlpPath: string,
): Promise<ResolvedItem> {
  if (isSpotifyUrl(url)) {
    return resolveSpotifyUrl(url);
  }
  const { stdout } = await execFileAsync(
    ytdlpPath,
    [
      "--dump-single-json",
      "--flat-playlist",
      "--no-warnings",
      "--no-playlist",
      url,
    ],
    { maxBuffer: 1024 * 1024 * 100 },
  );

  const data = JSON.parse(stdout);
  const source = detectSource(url);

  if (data._type === "playlist" || Array.isArray(data.entries)) {
    const entries = (data.entries ?? []) as Array<Record<string, unknown>>;
    return {
      kind: data.playlist_type === "album" ? "album" : "playlist",
      title: (data.title as string) ?? "Untitled",
      artist: (data.uploader as string) ?? (data.channel as string),
      artwork_url:
        (data.thumbnail as string) ??
        (entries[0]?.thumbnail as string | undefined),
      track_count: entries.length,
      tracks: entries.map((e) => ({
        id: String(e.id ?? e.url),
        title: (e.title as string) ?? "Untitled",
        artist:
          (e.uploader as string) ??
          (e.artist as string) ??
          (data.uploader as string) ??
          "",
        duration_s: Math.round((e.duration as number) ?? 0),
        artwork_url: e.thumbnail as string | undefined,
        source_url: (e.url as string) ?? (e.webpage_url as string) ?? url,
      })),
      source,
      source_url: url,
    };
  }

  return {
    kind: "track",
    title: (data.title as string) ?? "Untitled",
    artist: (data.uploader as string) ?? (data.artist as string),
    artwork_url: data.thumbnail as string | undefined,
    track_count: 1,
    tracks: [
      {
        id: String(data.id),
        title: (data.title as string) ?? "Untitled",
        artist:
          (data.uploader as string) ?? (data.artist as string) ?? "",
        duration_s: Math.round((data.duration as number) ?? 0),
        artwork_url: data.thumbnail as string | undefined,
        source_url: (data.webpage_url as string) ?? url,
      },
    ],
    source,
    source_url: url,
  };
}

function detectSource(url: string): SourceKind {
  try {
    const u = new URL(url);
    if (u.hostname.includes("soundcloud.com")) return "soundcloud";
    if (u.hostname.includes("spotify.com")) return "spotify";
    if (u.hostname.includes("youtube.com") || u.hostname === "youtu.be")
      return "youtube";
  } catch {
    // invalid URL
  }
  return "other";
}
