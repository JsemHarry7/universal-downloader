export type Source = "spotify" | "soundcloud" | "youtube" | "unknown";
export type Kind = "track" | "playlist" | "album" | "artist" | "unknown";

export interface DetectedUrl {
  source: Source;
  kind: Kind;
}

export function detectSource(raw: string): DetectedUrl {
  try {
    const url = new URL(raw.trim());
    const host = url.hostname.replace(/^www\./, "");

    if (host === "open.spotify.com" || host === "spotify.com" || host.endsWith(".spotify.com")) {
      const segments = url.pathname.split("/").filter(Boolean);
      const kind = segments.find((s) =>
        ["track", "playlist", "album", "artist"].includes(s),
      ) as Kind | undefined;
      return { source: "spotify", kind: kind ?? "unknown" };
    }

    if (host === "soundcloud.com" || host === "on.soundcloud.com" || host.endsWith(".soundcloud.com")) {
      const segments = url.pathname.split("/").filter(Boolean);
      const kind: Kind = segments.includes("sets") ? "playlist" : "track";
      return { source: "soundcloud", kind };
    }

    if (
      host === "youtube.com" ||
      host === "music.youtube.com" ||
      host === "youtu.be" ||
      host.endsWith(".youtube.com")
    ) {
      const isList = url.searchParams.has("list");
      return { source: "youtube", kind: isList ? "playlist" : "track" };
    }

    return { source: "unknown", kind: "unknown" };
  } catch {
    return { source: "unknown", kind: "unknown" };
  }
}
