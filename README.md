# Universal Downloader

Local web app that downloads music from **Spotify**, **SoundCloud**, **YouTube**, and anything else [yt-dlp](https://github.com/yt-dlp/yt-dlp) supports. Paste a track / album / playlist URL → preview → click download → an MP3 with embedded tags and artwork lands in `~/Music/universal-downloader/`. Comes with a full library — playlists, tags, shuffle/queue, synced lyrics, cross-device sync — plus a proper web player.

Runs entirely on your machine at `http://localhost:1420`. No logins (for the downloader itself), no API keys, no cloud.

## ⚠️ Legal notice

This is a personal tool. Using it is your decision and your responsibility. In short:

- Downloading content from YouTube / Spotify / SoundCloud violates their Terms of Service. ToS violations are a civil matter, not criminal — but they're still violations.
- Copyright law differs by country. Some places (parts of the EU) have private-copying exceptions; the UK and US don't. **Assume downloads are infringing unless you specifically know they're not.**
- **Don't redistribute** what you download. Sharing copies is a clearer copyright problem than personal downloads.
- **Don't host a public instance** of this. Running a service that downloads media for other people is a different legal category and this repo isn't designed for that use.

The source code is fine to share — tools like yt-dlp have been defended on the basis that code-is-speech (see the EFF's 2020 response to the RIAA's DMCA takedown of youtube-dl on GitHub). Running the tool locally for personal use sits in the same gray area yt-dlp itself occupies.

This project **does not** circumvent DRM. Spotify streams are DRM-protected and never touched — Spotify support works by reading public embed metadata, then fetching audio from public YouTube streams via yt-dlp.

**If you like the music, pay the people who made it.** Spotify Premium and YouTube Premium both support offline playback. Bandcamp pays artists directly. Go to shows. Buy merch. Those are the right answers — this tool isn't a replacement.

This is not legal advice.

## Quick start

```bash
git clone https://github.com/JsemHarry7/universal-downloader.git
cd universal-downloader
npm install
npm run dev
```

Open **http://localhost:1420**. Vite also binds LAN, so you can open the same URL on your phone from your PC's IP — the UI is touch-friendly and audio streams over HTTP Range.

First boot auto-downloads `yt-dlp.exe` (~18 MB) and a static `ffmpeg` build (~200 MB) into `./bin/`. Audio files land in `~/Music/universal-downloader/` by default.

## What works

**Download**
- Paste any public Spotify / SoundCloud / YouTube URL — tracks, albums, playlists
- Spotify uses public embed-page scraping (no API key) → audio routed via yt-dlp YouTube search
- Live per-track progress bars via NDJSON streaming
- All tracks convert to MP3 320 CBR with embedded metadata + thumbnail artwork
- `node-id3` rewrites ID3 tags so Spotify-sourced tracks keep their real artist/album (not the YouTube video title)
- Clipboard monitor toasts when you copy a recognized URL; batch dialog accepts many URLs at once
- "Add to playlist" dropdown attaches everything you download to a chosen playlist

**Library**
- Grid of everything in your download dir with artwork, auto-scanned on boot and on `fs.watch`
- Indexes pre-existing audio files too
- Sort (recent / title / artist / duration), search, tag filter, click-artist-to-filter
- Playlists (mix-source), tags with colors, bulk-select dialog to add many songs at once
- Stats panel — total tracks, disk size, duration, top artist, source breakdown bar
- Duplicate detector — groups tracks by matching title+artist+duration
- Context menu on every card (right-click / long-press): play now, play next, add to queue, play artist/album, add to playlist, edit tags, rename, delete

**Player**
- Proper player bar with scrubbable progress, volume, shuffle, repeat (off / all / one)
- Queue panel (slide-in from right) with jump-to, reorder, remove
- Synced lyrics via [LRCLib](https://lrclib.net/) — karaoke-style highlight (slide-in from left)
- Auto-advance, Media Session API (Windows volume overlay / macOS Now Playing / hardware headphone buttons)
- Keyboard shortcuts: `Space` play/pause, `← / →` seek, `Shift + ← / →` prev/next, `M` mute, `S` shuffle, `R` repeat, `?` help

## Cross-device sync (optional)

Sign in with Google to sync your library metadata across devices. The cloud only stores **metadata** (title, artist, source URL) — audio files never leave your machine. On a new device, signed in, your Library tab grows a "Saved on other devices" row with one-click "Download here" buttons.

**Setup (5 min, one-time):**

1. Go to [Firebase Console](https://console.firebase.google.com/) → **Add project**
2. In the new project:
   - **Authentication** → Sign-in method → enable **Google**
   - **Firestore Database** → Create database (production mode)
   - **Firestore → Rules** → paste the contents of `firestore.rules` from this repo → Publish
3. **Project Settings → Your apps → Web app (`</>`)** → register → copy the config values
4. Copy `.env.example` to `.env.local` and paste `apiKey`, `authDomain`, `projectId`, `appId`

Restart `npm run dev`. A **Sign in** button appears in the header. Without Firebase configured, the app works exactly as before — fully local, no sign-in UI shown.

## Stack

- **Frontend**: Vite + React 19 + TypeScript + Tailwind v4 + shadcn/ui + motion
- **Backend**: Node.js + Hono, better-sqlite3 for the library, music-metadata for tag reading
- **Audio tooling**: yt-dlp + ffmpeg (both auto-downloaded to `./bin/`), node-id3 for tag cleanup
- **Optional cloud**: Firebase Auth + Firestore

Single `npm install`, single `npm run dev` boots both frontend (`:1420`) and API (`:8787`). Vite proxies `/api/*` through to Hono.

## Known limitations

- **Spotify scraping is fragile by nature.** Uses the `open.spotify.com/embed/` pages and parses `__NEXT_DATA__`. If Spotify restructures the page, resolve breaks until the scraper is patched — usually a small fix.
- **Spotify audio is sourced from YouTube.** Match is usually correct, but occasionally picks a live version / cover / sped-up edit. Manual override isn't wired up yet.
- **Playlist downloads for non-Spotify sources run as one yt-dlp call.** No per-track progress inside the call.
- **Windows ARM64 uses x64 ffmpeg/Rust under emulation** — fine for this use case, slightly slower first compile.

## Requirements

- Node.js 22+
- Windows / macOS / Linux — tested on Windows 11 ARM64

## Architecture

```
Browser :1420 ──► Vite dev server ──/api/*──► Hono on :8787
                     │                            │
                     └── src/ (React)             ├── ./bin/yt-dlp.exe + ffmpeg.exe
                                                  ├── ./data/library.db (SQLite)
                                                  └── ~/Music/universal-downloader/
```
