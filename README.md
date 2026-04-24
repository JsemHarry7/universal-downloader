# Universal Downloader

Local web app that downloads music from **Spotify**, **SoundCloud**, **YouTube**, and anything else [yt-dlp](https://github.com/yt-dlp/yt-dlp) supports. Paste a track, album, or playlist URL → preview the metadata → click download → files land in `~/Music/universal-downloader/`. Comes with a library view to browse, play, rename, and delete what you've collected.

Runs entirely on your machine at `http://localhost:1420`. No logins, no API keys, no cloud.

## Quick start

```bash
git clone https://github.com/JsemHarry7/universal-downloader.git
cd universal-downloader
npm install
npm run dev
```

Open **http://localhost:1420**.

First boot auto-downloads `yt-dlp.exe` (~18 MB) into `./bin/`. Audio files default to `~/Music/universal-downloader/`.

## What works

**Download tab**
- Paste any public Spotify / SoundCloud / YouTube URL (tracks, albums, playlists)
- Preview card with artwork, track count, source badge
- Spotify uses public embed-page scraping (no API key) → audio routed via yt-dlp YouTube search
- Playlist downloads iterate client-side with per-track progress

**Library tab**
- Grid of everything in your download dir with artwork
- Scans on every server boot + a manual Rescan button
- Detects and indexes pre-existing audio files you already had
- Search, delete (with confirmation), rename (updates tags + the file on disk)
- Built-in mini-player using HTML5 audio with range-request streaming

## Cross-device sync (optional)

Sign in with Google to sync your "saved" list across devices. The cloud only stores **metadata** (title, artist, source URL) — audio files never leave your machine. When you sign in on a new device, your Library tab grows a "Saved on other devices" section with one-click "Download here" buttons.

**Setup (5 min, one-time):**

1. Go to [Firebase Console](https://console.firebase.google.com/) → **Add project**
2. In the new project:
   - **Authentication** → Sign-in method → enable **Google**
   - **Firestore Database** → Create database (production mode)
   - **Firestore → Rules** → paste the contents of `firestore.rules` from this repo → Publish
3. **Project Settings → Your apps → Web app (`</>`)** → register → copy the config values
4. Copy `.env.example` to `.env.local` and paste your `apiKey`, `authDomain`, `projectId`, `appId`

Restart `npm run dev`. A **Sign in** button appears in the header. Without Firebase configured, the app works exactly as before — fully local, no sign-in UI shown.

## Stack

- **Frontend**: Vite + React 19 + TypeScript + Tailwind v4 + shadcn/ui + motion
- **Backend**: Node.js + Hono
- **Storage**: SQLite (`better-sqlite3`) for the library index
- **Audio tooling**: yt-dlp (auto-downloaded) + `music-metadata` for tag reading

Single `npm install`, single `npm run dev` boots both frontend (`:1420`) and API (`:8787`). Vite proxies `/api/*` through to Hono.

## Known limitations

- **No ffmpeg yet.** Downloads come out in whatever format the source provides (webm / m4a / opus / mp3). No format conversion, no embedded ID3 tags, no artwork embedding. Safari can't play webm audio — use Chrome / Edge / Firefox until ffmpeg lands.
- **No live download progress.** Each track blocks one HTTP request while yt-dlp runs. Spinner, then done.
- **Playlist downloads are serial.** 50 tracks = 50 sequential downloads. No parallelism, no pause/resume.
- **Spotify scraping is fragile by nature.** Uses the `open.spotify.com/embed/` pages and parses `__NEXT_DATA__`. If Spotify changes the page structure, resolve breaks until the scraper is patched.

## Requirements

- Node.js 22+
- Windows / macOS / Linux — tested on Windows 11 (ARM64)

## Architecture

```
Browser :1420 ──► Vite dev server ──/api/*──► Hono on :8787
                      │                           │
                      └── src/ (React)            ├── ./bin/yt-dlp.exe (subprocess)
                                                  ├── ./data/library.db (SQLite)
                                                  └── ~/Music/universal-downloader/
```

## Legal

Download material you have the right to. This is a local tool for personal use.
