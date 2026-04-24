import type { ResolvedItem, TrackMeta } from "./resolve";

interface CoverArtSource {
  url: string;
  width?: number;
  height?: number;
  maxWidth?: number;
  maxHeight?: number;
}

interface SpotifyArtistRef {
  name: string;
  uri?: string;
}

interface SpotifyTrackListEntry {
  uri?: string;
  uid?: string;
  title?: string;
  subtitle?: string;
  duration?: number;
  artists?: SpotifyArtistRef[];
  coverArt?: { sources?: CoverArtSource[] };
}

interface SpotifyEntity {
  type?: string;
  id?: string;
  uri?: string;
  name?: string;
  title?: string;
  subtitle?: string;
  artists?: SpotifyArtistRef[];
  duration?: number;
  coverArt?: { sources?: CoverArtSource[] };
  visualIdentity?: { image?: CoverArtSource[] };
  albumOfTrack?: { coverArt?: { sources?: CoverArtSource[] } };
  trackList?: SpotifyTrackListEntry[];
}

export function isSpotifyUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return (
      u.hostname === "open.spotify.com" ||
      u.hostname === "spotify.com" ||
      u.hostname.endsWith(".spotify.com")
    );
  } catch {
    return false;
  }
}

function parseSpotifyUrl(
  url: string,
): { kind: "track" | "playlist" | "album"; id: string } {
  const m = url.match(
    /spotify\.com\/(?:intl-[^/]+\/)?(track|playlist|album)\/([a-zA-Z0-9]+)/,
  );
  if (!m) {
    throw new Error(
      "Unrecognized Spotify URL — expected /track/, /playlist/, or /album/",
    );
  }
  return { kind: m[1] as "track" | "playlist" | "album", id: m[2] };
}

async function fetchEmbedEntity(
  kind: string,
  id: string,
): Promise<SpotifyEntity> {
  const embedUrl = `https://open.spotify.com/embed/${kind}/${id}`;
  const res = await fetch(embedUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      "Accept-Language": "en-US,en;q=0.9",
    },
  });
  if (!res.ok) {
    throw new Error(`Spotify embed fetch failed: HTTP ${res.status}`);
  }
  const html = await res.text();

  const match = html.match(
    /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/,
  );
  if (!match) {
    throw new Error(
      "Spotify page format changed — __NEXT_DATA__ script not found",
    );
  }
  const data = JSON.parse(match[1]);
  const entity = data?.props?.pageProps?.state?.data?.entity;
  if (!entity) {
    throw new Error(
      "Spotify embed data missing entity — page structure may have changed",
    );
  }
  return entity as SpotifyEntity;
}

function bestCoverArt(sources?: CoverArtSource[]): string | undefined {
  if (!sources || sources.length === 0) return undefined;
  const dim = (s: CoverArtSource) => s.width ?? s.maxWidth ?? 0;
  let best = sources[0];
  for (const s of sources) {
    if (dim(s) > dim(best)) best = s;
  }
  return best.url;
}

function entityArtwork(entity: SpotifyEntity): string | undefined {
  return (
    bestCoverArt(entity.coverArt?.sources) ??
    bestCoverArt(entity.visualIdentity?.image) ??
    bestCoverArt(entity.albumOfTrack?.coverArt?.sources)
  );
}

function artistNames(artists?: SpotifyArtistRef[]): string {
  return (artists ?? []).map((a) => a.name).filter(Boolean).join(", ");
}

function idFromUri(uri?: string): string {
  return uri?.split(":").pop() ?? "";
}

function mapTrack(
  t: SpotifyTrackListEntry,
  fallbackArtwork?: string,
): TrackMeta {
  const id = idFromUri(t.uri) || t.uid || "";
  const artist = artistNames(t.artists) || t.subtitle || "";
  return {
    id,
    title: t.title ?? "Untitled",
    artist,
    duration_s: Math.round((t.duration ?? 0) / 1000),
    artwork_url: bestCoverArt(t.coverArt?.sources) ?? fallbackArtwork,
    source_url: id
      ? `https://open.spotify.com/track/${id}`
      : "",
  };
}

export async function resolveSpotifyUrl(url: string): Promise<ResolvedItem> {
  const { kind, id } = parseSpotifyUrl(url);
  const entity = await fetchEmbedEntity(kind, id);

  const title = entity.name ?? entity.title ?? "Untitled";
  const artist = artistNames(entity.artists) || entity.subtitle || undefined;
  const artwork_url = entityArtwork(entity);

  if (kind === "track") {
    const trackId = idFromUri(entity.uri) || entity.id || id;
    return {
      kind: "track",
      title,
      artist,
      artwork_url,
      track_count: 1,
      tracks: [
        {
          id: trackId,
          title,
          artist: artist ?? "",
          duration_s: Math.round((entity.duration ?? 0) / 1000),
          artwork_url,
          source_url: `https://open.spotify.com/track/${trackId}`,
        },
      ],
      source: "spotify",
      source_url: url,
    };
  }

  const trackList = entity.trackList ?? [];
  return {
    kind,
    title,
    artist,
    artwork_url,
    track_count: trackList.length,
    tracks: trackList.map((t) => mapTrack(t, artwork_url)),
    source: "spotify",
    source_url: url,
  };
}
