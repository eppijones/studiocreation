-- StudioLibrary — review tool + media-management schema (migration 002).
-- Layered on top of schema.sql. Idempotent. Turns the read-only index into a
-- review + management surface: states, ratings, timecode annotations, activity
-- history, manual tags, custom fields, subclips, share links, automation rules.

-- ── Asset review fields ─────────────────────────────────────────────────────
ALTER TABLE assets ADD COLUMN IF NOT EXISTS review_state TEXT NOT NULL DEFAULT 'new';
ALTER TABLE assets ADD COLUMN IF NOT EXISTS rating SMALLINT;          -- 0..5 stars
ALTER TABLE assets ADD COLUMN IF NOT EXISTS custom JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS reviewed_by TEXT;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS assets_review_state_idx ON assets (review_state);
CREATE INDEX IF NOT EXISTS assets_rating_idx ON assets (rating);

-- Fix legacy proxy `source` check (renamed reused_elements → reused_external).
ALTER TABLE proxies DROP CONSTRAINT IF EXISTS proxies_source_check;
ALTER TABLE proxies ADD CONSTRAINT proxies_source_check
  CHECK (source IN ('generated','reused_external'));

-- ── Review workflow states (configurable; data, not code) ───────────────────
CREATE TABLE IF NOT EXISTS review_states (
  key   TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  color TEXT,
  ord   INT NOT NULL DEFAULT 0,
  kind  TEXT NOT NULL DEFAULT 'neutral'
          CHECK (kind IN ('start','neutral','approved','rejected','terminal'))
);
INSERT INTO review_states (key, label, color, ord, kind) VALUES
  ('new',               'To review',          '#868fa4', 0, 'start'),
  ('in_review',         'In review',          '#5b6cff', 1, 'neutral'),
  ('approved_internal', 'Approved · internal','#36c98e', 2, 'approved'),
  ('approved_client',   'Approved · client',  '#1f9d6b', 3, 'approved'),
  ('rejected',          'Rejected',           '#e5564b', 4, 'rejected'),
  ('delivered',         'Delivered',          '#b98cff', 5, 'terminal')
ON CONFLICT (key) DO NOTHING;

-- ── User mirror (Phase 0) — read-through projection of Neon's canonical users.
--    id mirrors the Neon users.id; library code joins/links against it. The
--    library never writes back; studiolibrary/lib/users-mirror.ts upserts here.
ALTER TABLE users ADD COLUMN IF NOT EXISTS handle     TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email      TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS active     BOOLEAN NOT NULL DEFAULT TRUE;
CREATE INDEX IF NOT EXISTS users_handle_idx ON users (handle);

-- ── Annotations: comments + markers, timecode-anchored, threaded ────────────
-- One table backs both the Comments and Markers surfaces (kind discriminates).
CREATE TABLE IF NOT EXISTS annotations (
  id          SERIAL PRIMARY KEY,
  asset_id    INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL DEFAULT 'comment' CHECK (kind IN ('comment','marker')),
  author      TEXT,
  body        TEXT,
  tc_in       DOUBLE PRECISION,        -- seconds; NULL = asset-level (no timecode)
  tc_out      DOUBLE PRECISION,        -- NULL = single frame/point
  color       TEXT,
  resolved    BOOLEAN NOT NULL DEFAULT FALSE,
  assigned_to TEXT,
  parent_id   INTEGER REFERENCES annotations(id) ON DELETE CASCADE,  -- thread reply
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS annotations_asset_idx  ON annotations (asset_id);
CREATE INDEX IF NOT EXISTS annotations_assigned_idx ON annotations (assigned_to) WHERE resolved = FALSE;

-- Phase 0 identity linkage: real user ids alongside the denormalized name
-- strings (author / assigned_to). Names stay as a display cache (dual-write).
ALTER TABLE annotations ADD COLUMN IF NOT EXISTS author_id      INTEGER;
ALTER TABLE annotations ADD COLUMN IF NOT EXISTS assigned_to_id INTEGER;
CREATE INDEX IF NOT EXISTS annotations_assigned_id_idx ON annotations (assigned_to_id) WHERE resolved = FALSE;

-- ── Activity / history feed (append-only) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS asset_events (
  id         SERIAL PRIMARY KEY,
  asset_id   INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  actor      TEXT,
  type       TEXT NOT NULL,   -- comment|rating|state_change|tag|custom_field|upload|file_op|share|proxy|transcribe
  payload    JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS asset_events_asset_idx ON asset_events (asset_id, created_at DESC);
ALTER TABLE asset_events ADD COLUMN IF NOT EXISTS actor_id INTEGER;

-- ── Custom metadata field definitions (values live in assets.custom jsonb) ──
CREATE TABLE IF NOT EXISTS custom_fields (
  key            TEXT PRIMARY KEY,
  label          TEXT NOT NULL,
  type           TEXT NOT NULL DEFAULT 'text'
                   CHECK (type IN ('text','textarea','select','checkbox','number','date')),
  options        JSONB NOT NULL DEFAULT '[]'::jsonb,
  ord            INT NOT NULL DEFAULT 0,
  use_for_upload BOOLEAN NOT NULL DEFAULT FALSE,
  help           TEXT
);
INSERT INTO custom_fields (key, label, type, options, ord, use_for_upload) VALUES
  ('production', 'Production', 'text',   '[]', 0, true),
  ('shoot_date', 'Shoot date', 'date',   '[]', 1, true),
  ('usage',      'Usage',      'select', '["Internal","Client","Social","Broadcast","Archive"]', 2, false)
ON CONFLICT (key) DO NOTHING;

-- ── Subclips: named virtual in/out ranges over an existing asset ────────────
CREATE TABLE IF NOT EXISTS subclips (
  id         SERIAL PRIMARY KEY,
  asset_id   INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  name       TEXT,
  tc_in      DOUBLE PRECISION NOT NULL,
  tc_out     DOUBLE PRECISION NOT NULL,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS subclips_asset_idx ON subclips (asset_id);
ALTER TABLE subclips ADD COLUMN IF NOT EXISTS created_by_id INTEGER;

-- Phase 2: who signed off on the asset's current review state (real user id).
ALTER TABLE assets ADD COLUMN IF NOT EXISTS reviewed_by_id INTEGER;

-- ── Collections (bundles) — extend the existing tables for drag-drop order ──
ALTER TABLE collections ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE collections ADD COLUMN IF NOT EXISTS cover_asset_id INTEGER;
ALTER TABLE collection_items ADD COLUMN IF NOT EXISTS ord INT NOT NULL DEFAULT 0;

-- ── Share links (external review) ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS share_links (
  id             SERIAL PRIMARY KEY,
  token          TEXT UNIQUE NOT NULL,
  target_type    TEXT NOT NULL CHECK (target_type IN ('asset','collection')),
  target_id      INTEGER NOT NULL,
  mode           TEXT NOT NULL DEFAULT 'anonymous' CHECK (mode IN ('anonymous','email','user')),
  allow_comments BOOLEAN NOT NULL DEFAULT TRUE,
  allow_download BOOLEAN NOT NULL DEFAULT FALSE,
  embed          TEXT NOT NULL DEFAULT 'full' CHECK (embed IN ('full','player','direct')),
  password_hash  TEXT,
  recipient      TEXT,
  expires_at     TIMESTAMPTZ,
  view_limit     INTEGER,
  views_used     INTEGER NOT NULL DEFAULT 0,
  revoked        BOOLEAN NOT NULL DEFAULT FALSE,
  created_by     TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS share_links_target_idx ON share_links (target_type, target_id);
ALTER TABLE share_links ADD COLUMN IF NOT EXISTS created_by_id INTEGER;

-- ── Automation rules (trigger → conditions → steps over the job queue) ──────
CREATE TABLE IF NOT EXISTS automation_rules (
  id           SERIAL PRIMARY KEY,
  name         TEXT NOT NULL,
  enabled      BOOLEAN NOT NULL DEFAULT TRUE,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('event','schedule','manual')),
  event        TEXT,                       -- asset.created | asset.state_changed | proxy.failed | ...
  cron         TEXT,                        -- for schedule triggers (local tz)
  conditions   JSONB NOT NULL DEFAULT '[]'::jsonb,  -- [{field,op,value}] ANDed
  steps        JSONB NOT NULL DEFAULT '[]'::jsonb,  -- [{action,params,runOn}]
  last_run_at  TIMESTAMPTZ,
  runs         INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Seed example rules ONLY when the table is empty (idempotent across re-runs).
INSERT INTO automation_rules (name, enabled, trigger_type, event, conditions, steps)
SELECT * FROM (VALUES
  -- Built-in pipeline: proxy every new asset (the worker then chains transcribe
  -- on success). Disable this and new footage stops auto-proxying.
  ('Proxy new footage on ingest', true, 'event', 'asset.created',
   '[]'::jsonb, '[{"action":"proxy","params":{}}]'::jsonb),
  -- Example reaction rule (additive, safe): log a note when video is approved.
  ('Note when video approved', false, 'event', 'asset.state_changed',
   '[{"field":"kind","op":"eq","value":"video"}]'::jsonb,
   '[{"action":"notify","params":{"message":"Approved — ready to finish"}}]'::jsonb)
) AS v(name, enabled, trigger_type, event, conditions, steps)
WHERE NOT EXISTS (SELECT 1 FROM automation_rules);
