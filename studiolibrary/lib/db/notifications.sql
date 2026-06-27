-- StudioLibrary — notifications + presence (Phase 1 collaboration layer).
-- Layered on review.sql. Idempotent. Notifications fan out from the asset_events
-- spine (repo.ts:addEvent → notify.ts:fanOutEvent). recipient_id / actor_id are
-- canonical Neon user ids (mirrored into the library `users` table).

CREATE TABLE IF NOT EXISTS notifications (
  id              SERIAL PRIMARY KEY,
  recipient_id    INTEGER NOT NULL,
  type            TEXT NOT NULL,   -- mention|assignment|review_state|comment|share_comment|job_done|job_error
  actor_id        INTEGER,         -- who caused it (NULL = system / external guest)
  actor_name      TEXT,
  asset_id        INTEGER REFERENCES assets(id) ON DELETE CASCADE,
  target_type     TEXT,            -- asset|collection|job|annotation
  target_id       INTEGER,
  title           TEXT NOT NULL,
  body            TEXT,
  source_event_id INTEGER,         -- asset_events.id when derived from one
  read_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notifications_inbox_idx
  ON notifications (recipient_id, read_at, created_at DESC);
-- Never double-notify the same recipient from the same source event.
CREATE UNIQUE INDEX IF NOT EXISTS notifications_dedupe_idx
  ON notifications (recipient_id, type, source_event_id)
  WHERE source_event_id IS NOT NULL;

-- Soft presence: who is currently viewing an asset. Staleness is a query filter
-- (seen_at), so no cleanup job is required.
CREATE TABLE IF NOT EXISTS presence (
  asset_id   INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL,
  user_name  TEXT NOT NULL,
  seen_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (asset_id, user_id)
);
CREATE INDEX IF NOT EXISTS presence_seen_idx ON presence (asset_id, seen_at DESC);
