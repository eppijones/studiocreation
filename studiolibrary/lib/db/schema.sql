-- StudioLibrary — Media Library schema (LOCAL Postgres + pgvector ONLY).
-- Completely separate from the app's Neon DB (renders / generations). The
-- filesystem is the source of truth; this index is disposable: wipe it,
-- re-crawl, rebuild. Idempotent — safe to run repeatedly.

CREATE EXTENSION IF NOT EXISTS vector;

-- ── Volumes ─────────────────────────────────────────────────────────────────
-- One DB, many volumes. The Mac test volume lives here forever alongside the
-- real on-prem archive volume once Oslo is connected (added, never swapped).
CREATE TABLE IF NOT EXISTS volumes (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,
  kind        TEXT NOT NULL CHECK (kind IN ('local','smb')),
  root        TEXT NOT NULL,
  read_only   BOOLEAN NOT NULL DEFAULT TRUE,
  status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','offline','disabled')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Assets (discovered files — the app never OWNS these) ─────────────────────
CREATE TABLE IF NOT EXISTS assets (
  id            SERIAL PRIMARY KEY,
  volume_id     INTEGER NOT NULL REFERENCES volumes(id) ON DELETE CASCADE,
  abs_path      TEXT NOT NULL,
  rel_path      TEXT NOT NULL,
  filename      TEXT NOT NULL,
  kind          TEXT NOT NULL CHECK (kind IN ('video','image','audio','doc','project')),
  ext           TEXT,
  size_bytes    BIGINT,
  -- size + mtime + head/tail hash (NOT a full-file hash — huge masters)
  signature     TEXT,
  container     TEXT,
  codec         TEXT,
  width         INTEGER,
  height        INTEGER,
  duration_s    DOUBLE PRECISION,
  fps           DOUBLE PRECISION,
  audio_codec   TEXT,
  mtime         TIMESTAMPTZ,
  status        TEXT NOT NULL DEFAULT 'new'
                  CHECK (status IN ('new','proxied','enriched','error')),
  -- reconcile bookkeeping (moved = same signature/new path; deleted = missing)
  discovered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  missing_at    TIMESTAMPTZ,
  error         TEXT,
  -- Postgres full-text now; pgvector semantic search is Phase 2 (below).
  fts           TSVECTOR GENERATED ALWAYS AS (
                  to_tsvector('simple',
                    coalesce(filename,'') || ' ' || replace(coalesce(rel_path,''), '/', ' '))
                ) STORED,
  UNIQUE (volume_id, abs_path)
);
CREATE INDEX IF NOT EXISTS assets_fts_idx       ON assets USING GIN (fts);
CREATE INDEX IF NOT EXISTS assets_kind_idx      ON assets (kind);
CREATE INDEX IF NOT EXISTS assets_status_idx    ON assets (status);
CREATE INDEX IF NOT EXISTS assets_volume_idx    ON assets (volume_id);
CREATE INDEX IF NOT EXISTS assets_signature_idx ON assets (signature);
CREATE INDEX IF NOT EXISTS assets_relpath_idx   ON assets (rel_path text_pattern_ops);

-- ── Proxies / thumbnails (the working + sharing surface) ─────────────────────
CREATE TABLE IF NOT EXISTS proxies (
  id        SERIAL PRIMARY KEY,
  asset_id  INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  kind      TEXT NOT NULL
              CHECK (kind IN ('video_proxy','poster','sprite','waveform','page_preview','thumb')),
  path      TEXT,
  codec     TEXT,
  bitrate   TEXT,
  meta      JSONB NOT NULL DEFAULT '{}'::jsonb,
  status    TEXT NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending','ready','error')),
  error     TEXT,
  -- reused_external = linked from the archive's own pre-existing proxies (Oslo)
  source    TEXT NOT NULL DEFAULT 'generated' CHECK (source IN ('generated','reused_external')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (asset_id, kind)
);
CREATE INDEX IF NOT EXISTS proxies_asset_idx ON proxies (asset_id);

-- ── Jobs ledger / queue (DB IS the queue — FOR UPDATE SKIP LOCKED) ──────────
CREATE TABLE IF NOT EXISTS jobs (
  id          SERIAL PRIMARY KEY,
  type        TEXT NOT NULL CHECK (type IN ('index','proxy','transcribe','tag','embed')),
  asset_id    INTEGER REFERENCES assets(id) ON DELETE CASCADE,
  state       TEXT NOT NULL DEFAULT 'queued'
                CHECK (state IN ('queued','running','done','error','canceled')),
  attempts    INTEGER NOT NULL DEFAULT 0,
  priority    INTEGER NOT NULL DEFAULT 100,
  payload     JSONB NOT NULL DEFAULT '{}'::jsonb,
  error       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at  TIMESTAMPTZ,
  finished_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS jobs_pick_idx  ON jobs (state, priority, id) WHERE state = 'queued';
CREATE INDEX IF NOT EXISTS jobs_asset_idx ON jobs (asset_id);
CREATE INDEX IF NOT EXISTS jobs_type_idx  ON jobs (type);

-- ── Enrichment: tags / transcripts / embeddings (Phase 2 AI layer) ──────────
CREATE TABLE IF NOT EXISTS tags (
  id         SERIAL PRIMARY KEY,
  asset_id   INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  source     TEXT NOT NULL CHECK (source IN ('ai','manual')),
  label      TEXT NOT NULL,
  confidence REAL,
  timecode_s DOUBLE PRECISION,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tags_asset_idx  ON tags (asset_id);
CREATE INDEX IF NOT EXISTS tags_label_idx  ON tags (label);

CREATE TABLE IF NOT EXISTS transcripts (
  id         SERIAL PRIMARY KEY,
  asset_id   INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE UNIQUE,
  language   TEXT,
  segments   JSONB NOT NULL DEFAULT '[]'::jsonb,
  full_text  TEXT,
  fts        TSVECTOR GENERATED ALWAYS AS (to_tsvector('simple', coalesce(full_text,''))) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS transcripts_fts_idx ON transcripts USING GIN (fts);

-- Vector column created NOW so Phase 2 semantic search drops in with no
-- migration rewrite. Dimension-agnostic storage; the ANN index is added in
-- Phase 2 once the local embedding model (and its dim) is locked.
CREATE TABLE IF NOT EXISTS embeddings (
  id         SERIAL PRIMARY KEY,
  asset_id   INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  modality   TEXT NOT NULL CHECK (modality IN ('frame','transcript')),
  timecode_s DOUBLE PRECISION,
  dim        INTEGER,
  vector     vector,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS embeddings_asset_idx ON embeddings (asset_id);

-- ── Collections (manual + smart) ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS collections (
  id         SERIAL PRIMARY KEY,
  name       TEXT NOT NULL,
  kind       TEXT NOT NULL DEFAULT 'manual' CHECK (kind IN ('manual','smart')),
  query      JSONB,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS collection_items (
  collection_id INTEGER NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  asset_id      INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  added_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (collection_id, asset_id)
);

-- ── Phase 3 stubs (created now; unused until parity work) ────────────────────
CREATE TABLE IF NOT EXISTS comments (
  id         SERIAL PRIMARY KEY,
  asset_id   INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  author     TEXT,
  body       TEXT NOT NULL,
  timecode_s DOUBLE PRECISION,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS markers (
  id         SERIAL PRIMARY KEY,
  asset_id   INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  label      TEXT,
  timecode_s DOUBLE PRECISION,
  source     TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Users / roles (reuses Portal One's operator + role; mirrored for the
--    Media Library's own admin/editor/guest gating) ──────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id         SERIAL PRIMARY KEY,
  name       TEXT NOT NULL UNIQUE,
  role       TEXT NOT NULL DEFAULT 'guest' CHECK (role IN ('admin','editor','guest')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
