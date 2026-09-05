# Lyric Veil

A frameless, fully transparent, click-through desktop overlay that shows word-synced lyrics for whatever is playing on Spotify.

Text only — no panel, no album art, no border. The active line is opaque white with a karaoke-style word-by-word wipe; the lines around it are dimmed and scaled back. Clicks pass straight through to whatever is underneath, so it never gets in the way of the desktop.

Windows 10 (1809+) and Windows 11.

![status](https://github.com/akshit-bansal11/lyric-veil/actions/workflows/ci.yml/badge.svg)

---

## Quick start

```bash
npm install
cp .env.example .env      # then paste your Spotify client ID into it
npm run dev
```

### Getting a Spotify client ID

1. Create an app at the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard).
2. Add this redirect URI, exactly:

   ```
   http://127.0.0.1:8888/callback
   ```

   Use `127.0.0.1`, **not** `localhost` — Spotify rejects `localhost` for new redirect URIs.
3. Copy the Client ID into `.env` as `MAIN_VITE_SPOTIFY_CLIENT_ID`.

There is no client secret. Authentication is Authorization Code + PKCE, so nothing secret is ever shipped in the binary. The only scopes requested are `user-read-playback-state` and `user-read-currently-playing` — read-only, no playback control.

Until a client ID is present the overlay runs and renders, but shows a "No Spotify client ID" hint instead of lyrics.

## Controls

| Shortcut | Action |
| --- | --- |
| `Ctrl+Alt+L` | Toggle interactive mode — lets you drag, resize and open settings |
| `Ctrl+Alt+H` | Show / hide the overlay |
| `Ctrl+Alt+[` | Sync offset −100 ms |
| `Ctrl+Alt+]` | Sync offset +100 ms |
| `Ctrl+Alt+0` | Reset sync offset |

Everything is also in the tray menu. The overlay is click-through by default; interactive mode is the only time it accepts the mouse.

If the lyrics run consistently early or late for a track, nudge the offset — it is persisted.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Run with hot reload |
| `npm run check` | The quality gate: format, organise imports, lint, typecheck, test |
| `npm test` | Tests only |
| `npm run build` | Typecheck and build all three bundles |
| `npm run package` | Build, then produce a portable `.exe` and an installer in `dist/` |

## How it works

```
Spotify Web API  --1 Hz-->  poller  --anchor-->  renderer clock  --60 Hz-->  word wipe
                                |
LRCLIB  --LRC-->  parser  --> normalizer --> disk cache
```

**The clock is the important part.** Spotify is polled once per second; rendering at 1 Hz would be unwatchable. So each poll produces an *anchor* — a position plus the wall-clock time the response arrived — and the renderer extrapolates between anchors at frame rate. Corrections are eased at ~8% of the error per frame rather than snapped, because snapping every second produces a visible jump in the wipe. A difference over 700 ms is treated as a seek and snapped instead.

`positionMs` never enters React state. It lives in a ref, and the animation loop writes progress values straight onto DOM nodes as a CSS custom property. React state tracks only *which line is active*, which changes a few times a minute rather than sixty times a second.

**Word timings are usually synthesized.** LRCLIB serves line-level LRC, so each line's duration is distributed across its words by character weight. Every word first gets a 90 ms floor and only the surplus is weighted — weighting first and clamping afterwards overruns the line end on any line that mixes very long and very short words. Enhanced LRC (`<mm:ss.xx>` markers) is parsed and used directly when a source provides it.

## Layout

```
src/
  shared/     domain model, IPC contract, config, clock arithmetic
  main/       app bootstrap, overlay window, tray, hotkeys
    auth/     PKCE + loopback redirect
    lib/      Spotify client, LRCLIB client, LRC parser, word timing, cache, logger
    services/ playback poller, lyrics resolution, persisted store
  preload/    the contextBridge surface, and nothing else
  renderer/   React overlay: stage, lines, words, interlude dots, status hint
site/         the download page
tests/        vitest, no DOM required
```

## Notes and limits

- **Lyrics come from [LRCLIB](https://lrclib.net)** — free, no auth, no API key. It serves line-level timing; the app synthesizes word timing from it. Musixmatch's true word-level data was deliberately not used: it needs an unofficial client, sits in a terms-of-service grey area, and only covers a minority of tracks anyway.
- **Podcasts and local files** have no Spotify track ID, so no lookup is attempted.
- **A free Spotify account works**, but there must be an active device — otherwise the API returns 204 and the overlay shows "Nothing playing".
- **No bundled font.** The overlay uses Segoe UI Variable Display, already on every Windows machine, so it works offline with no asset to ship. `fontFamily` in the settings panel points it anywhere else.
- Lyrics are cached to disk by track ID and never expire; "no lyrics" results are cached for 7 days so instrumentals are not re-fetched on every play.
- Personal use. Do not redistribute cached lyric data.

## Licence

MIT — see [LICENSE](LICENSE).
