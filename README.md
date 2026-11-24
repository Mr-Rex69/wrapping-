# Wrapping

A standalone Wrapped-style listening recap for Last.fm and ListenBrainz.

## Features

- Yearly top artists, tracks and albums from Last.fm or ListenBrainz
- MusicBrainz artist IDs and genres, with exact-name checks for ID discovery
- Conservative album/release matching: exact normalized album title plus primary credited artist; ambiguous matches do not receive artwork
- Cover Art Archive artwork only for verified MusicBrainz releases
- Exact artist + track iTunes previews when a 30-second preview is available
- Full story flow: welcome, yearly plays, artist count, genre counts, top tracks, individual artist spotlights, genre spotlights and badges
- Contextual preview audio for the opening track, each artist highlight and each genre highlight
- Full-story video export with mixed preview audio (WebM on Chromium; MP4 only where the browser supports it)
- Complete downloadable PNG report card with tracks, artists, albums, genres, stats and badges

## Local development

Requires Node.js 20+.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Set `LASTFM_API_KEY` to enable Last.fm and Last.fm global artist statistics. Public ListenBrainz profiles work without a token. `LISTENBRAINZ_USER_TOKEN` is optional.

## Matching and data accuracy

Wrapping prefers MusicBrainz identifiers supplied by the listening source. When an artist ID is absent, it only adopts a MusicBrainz ID when the normalized artist name is an exact match. Album artwork is attached only after verifying the release title and primary credited artist; if there are multiple plausible releases, artwork is withheld rather than guessed. Track previews use the same conservative exact artist + title rule.

Last.fm's yearly play total is calculated by summing all pages of the user's 12-month top-artist chart. ListenBrainz uses its yearly artist-stat total and genre-activity endpoint. ListenBrainz genre counts are listens; Last.fm genre counts are estimates weighted from the play counts of artists with matching tags, and can overlap. Time-of-day percentages are calculated from the recent-listen sample in UTC. Global popularity comparisons are estimates, not listener percentiles.

## Production build

The Next.js build uses standalone output. GitHub Actions uploads a runnable `wrapping-standalone-build` artifact on successful pushes to `main`. Extract it, set the required environment variables, and run `node server.js`. The artifact includes the standalone server and static assets.

## Privacy

API credentials are read only by the server and are never sent to the browser. Do not commit `.env.local`. SQLite cache defaults to `data/cache.sqlite`.
