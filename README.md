# Wrapping

A standalone Spotify Wrapped-style listening recap for Last.fm and ListenBrainz.

## Stack
- Next.js App Router and TypeScript
- Server-side Last.fm and ListenBrainz API integration
- SQLite TTL cache for user wraps and global artist metadata
- Responsive story-style recap UI

## Local development
Requires Node.js 20+.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Set `LASTFM_API_KEY` in `.env.local` to enable Last.fm and global artist comparisons. Public ListenBrainz profiles work without a token. An optional `LISTENBRAINZ_USER_TOKEN` can be used for authenticated requests.

## Privacy
API credentials are read only by the server and are never sent to the browser. Do not commit `.env.local`. The service caches results in `data/cache.sqlite` by default.

## MVP scope
- Last.fm top artists, tracks, albums and recent timestamped listens
- ListenBrainz top artists, recordings, releases and recent listens
- Normalized listening data, cached global artist stats and heuristic taste badges
- Six-slide recap and copyable text summary

Global average multipliers are estimates based on Last.fm artist-wide playcount/listener totals, not actual listener percentile rankings. Time-of-day analysis uses the timestamps returned in the recent-listens sample.
