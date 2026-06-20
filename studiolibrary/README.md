# StudioLibrary — the Media Library (footage archive)

A **separate surface** inside Portal One that indexes **produced footage** — the
local `test-media` replica now, the 120 TB on-prem archive in Oslo
later. It is **not** the AI-render Gallery: separate data model, separate local
database, its own routes. It shares the Portal One design system.

> **Read-only on sources, always.** The filesystem is the source of truth; this
> index is disposable (wipe → re-crawl → rebuild). Masters are never moved,
> renamed or deleted. Proxies are the working/sharing surface. The engine never
> runs on Vercel serverless — localhost now, WSL2 (Oslo) later.

## Layout

```
studiolibrary/
├── docker-compose.yml        # local Postgres + pgvector (port 5433)
├── lib/
│   ├── config/               # SINGLE SOURCE OF TRUTH (presets, encoder, volumes, share policy)
│   ├── db/                   # pg client + schema.sql + migrate (Media Library only)
│   ├── volumes/              # Volume adapter: LocalVolume (now) | SMBVolume (Oslo stub)
│   ├── encoders/             # Encoder adapter: videotoolbox (now) | nvenc | windows-ffmpeg
│   ├── media/                # ffprobe, sampled signature, thumbnails (poster/sprite/waveform/page)
│   ├── crawler.ts            # walk → signature → ffprobe → reconcile new/moved/deleted → enqueue
│   ├── proxy.ts              # per-kind derivative generation
│   ├── queries.ts            # read-side: browse/search/detail/stats/feed
│   └── repo.ts               # data access + the DB-backed job queue
├── worker/                   # long-running crawl + proxy queue runner
└── test-media/  proxies/  .cache/   # git-ignored; LocalVolume + writable proxy output
```

App-side (in the repo, reusing the design system):
- `app/library/` — browse grid + asset detail (proxy player, sprite scrub).
- `app/api/library/*` — `status`, `assets`, `assets/[id]`, `media/[id]/[kind]` (HTTP range), `feed`.
- Nav: the old "Media Library" item was renamed **Gallery**; **Media Library** is this new surface.
- Home carousel reads BOTH feeds (Neon renders + local-PG footage), merged client-side.

## The two hard abstractions (dev → Oslo is a CONFIG SWAP)

| | Phase 0 — Mac (now) | Oslo — A6000 (later) |
|---|---|---|
| Volume | `LocalVolume` → `test-media` | `SMBVolume` → on-prem archive, mounted **ro** |
| Encoder | `videotoolbox` (`h264_videotoolbox`) | `nvenc` (`h264_nvenc`) |

Switch = `LIBRARY_ENCODER=nvenc` + add an SMB volume in `lib/config`. Everything
else (UI, jobs, search, the dev DB + test volume) carries over untouched; the
on-prem archive volume is **added**, never swapped in. SMBVolume refuses to construct
unless `LIBRARY_ALLOW_SMB=1` (set only in Oslo, share mounted read-only).

## Run it (localhost)

```bash
pnpm library:db:up        # Postgres + pgvector on :5433  (docker)
pnpm library:migrate      # create schema + seed volumes from config
pnpm library:once         # crawl + drain the proxy queue, then exit
# or:  pnpm library:crawl   (index only)   /   pnpm library:work  (run the queue forever)
pnpm dev                  # the app — open /library
```

`DATABASE_URL_LIBRARY` defaults to the local docker DB; override in `.env.local`
(see `.env.example`). The library DB is entirely separate from Neon.

## Smoke-test plan (run BEFORE pointing it at the full test set)

1. **Toolchain check** (already verified on this Mac):
   - `ffmpeg -encoders | grep videotoolbox` → `h264_videotoolbox` present.
   - One `h264_videotoolbox` re-encode of a sample runs **faster than realtime**
     (measured ~7×). `docker exec studiolibrary-db psql -c "SELECT extversion
     FROM pg_extension WHERE extname='vector'"` → pgvector present.
2. **Pick a tiny subfolder** — e.g. point `LIBRARY_LOCAL_ROOT` at
   `studiolibrary/test-media/Resources` (a handful of files), then:
   ```bash
   LIBRARY_LOCAL_ROOT=$PWD/studiolibrary/test-media/Resources pnpm library:migrate
   LIBRARY_LOCAL_ROOT=$PWD/studiolibrary/test-media/Resources pnpm library:once
   ```
3. **Assert the crawl** — `scanned`/`new`/`enqueued` match the file count; no
   crashes on unreadable/odd files. Re-run `library:once`: second pass shows
   `unchanged` (idempotent — no duplicate rows, no re-proxy).
4. **Assert derivatives** — `proxies/<id>/` has the expected files; in psql,
   `SELECT kind,status FROM proxies` is all `ready`; `assets.status='proxied'`.
   Video proxy probes as H.264 ~1080p with `+faststart`.
5. **Assert the surface** — open `/library`: grid renders with thumbnails;
   open a video → the proxy plays, scrub the sprite bar, metadata is correct;
   a range request returns `206 Partial Content`.
6. **Reconcile** — move a file to a new path, re-crawl → it reports `moved`
   (id + proxies preserved). Delete a file, re-crawl → it reports `missing`
   (the source is never touched; only the index updates).
7. **Wipe → rebuild** — `TRUNCATE assets,proxies,jobs RESTART IDENTITY CASCADE`
   + `rm -rf proxies/*` + `library:once` → identical result. The index is
   disposable; the filesystem is the source of truth.
8. **Only then** point `LIBRARY_LOCAL_ROOT` back at the full `test-media` root
   (or drop in your real files) and run `pnpm library:work`.

## Phase status

- **Phase 0 (done):** crawler + ffprobe, VideoToolbox proxies (video/poster/
  sprite), image thumbs, audio waveforms, PDF page-preview (poppler), browse +
  range player + sprite scrub, filters/search, jobs queue, unified Home feed,
  pgvector tables pre-created.
- **Phase 2 — Whisper transcription LIVE:** local faster-whisper (in
  `studiolibrary/.venv`, python3.11) runs offline over audio-bearing assets,
  chained after the proxy step. Stores searchable transcripts + timed segments,
  writes `captions.srt`/`captions.vtt`, marks the asset `enriched`. On the A6000
  it's the same path with `WHISPER_DEVICE=cuda`. Still pending in Phase 2:
  vision tags + embeddings/semantic search (tables already exist).
- **Phase 3:** scenes, timecode comments/markers, CSV import, share links, HLS.

### Whisper setup (one-time)

```bash
python3.11 -m venv studiolibrary/.venv
studiolibrary/.venv/bin/pip install faster-whisper
# then crawling auto-transcribes; or run the script directly:
studiolibrary/.venv/bin/python studiolibrary/worker/transcribe.py <media> base cpu
```
