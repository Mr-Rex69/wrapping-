# Wrapping

A standalone Spotify Wrapped-style listening recap for Last.fm and ListenBrainz.

## Status

Initial scaffold in progress. See `.env.example` for configuration.

## Requirements

- Node.js 20+
- npm

## Development

```bash
npm install
cp .env.example .env.local
npm run dev
```

Set `LASTFM_API_KEY` in `.env.local` to enable Last.fm data and global artist comparisons. ListenBrainz public profiles work without a token.
