import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

async function migrate() {
  await sql`
    CREATE TABLE IF NOT EXISTS jobs (
      id           SERIAL PRIMARY KEY,
      provider     TEXT NOT NULL DEFAULT 'fal',
      model        TEXT NOT NULL,
      request_id   TEXT UNIQUE,
      prompt       TEXT NOT NULL DEFAULT '',
      params       JSONB NOT NULL DEFAULT '{}',
      status       TEXT NOT NULL DEFAULT 'queued',
      est_usd      NUMERIC(10,4) NOT NULL DEFAULT 0,
      actual_usd   NUMERIC(10,4),
      operator     TEXT NOT NULL DEFAULT 'unknown',
      project      TEXT NOT NULL DEFAULT 'studio',
      label        TEXT NOT NULL DEFAULT 'asset',
      error        TEXT,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
      completed_at TIMESTAMPTZ
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS assets (
      id           SERIAL PRIMARY KEY,
      job_id       INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
      blob_url     TEXT NOT NULL,
      source_url   TEXT,
      content_type TEXT,
      width        INTEGER,
      height       INTEGER,
      duration_s   REAL,
      score        SMALLINT CHECK (score BETWEEN 0 AND 10),
      created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  // v2 — asset lifecycle (review pipeline), tags, approval audit, finish lineage.
  await sql`ALTER TABLE assets ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'new'`;
  await sql`ALTER TABLE assets ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}'`;
  await sql`ALTER TABLE assets ADD COLUMN IF NOT EXISTS approved_by TEXT`;
  await sql`ALTER TABLE assets ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ`;
  // For finish jobs (upscale/fps): which asset this one was derived from.
  await sql`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS source_asset_id INTEGER REFERENCES assets(id) ON DELETE SET NULL`;

  // v3 — completion pipeline + review.
  // Claim flag so a webhook and concurrent pollers can't double-finalize a job.
  await sql`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS finalizing_at TIMESTAMPTZ`;
  // Auto quality/fidelity critique (companion to the existing assets.score).
  await sql`ALTER TABLE assets ADD COLUMN IF NOT EXISTS review_note TEXT`;

  // v2 — runtime-editable studio settings (budget governance lives here).
  await sql`
    CREATE TABLE IF NOT EXISTS settings (
      key        TEXT PRIMARY KEY,
      value      JSONB NOT NULL,
      updated_by TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS jobs_created_at_idx ON jobs (created_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS jobs_status_idx ON jobs (status)`;
  await sql`CREATE INDEX IF NOT EXISTS assets_job_id_idx ON assets (job_id)`;
  await sql`CREATE INDEX IF NOT EXISTS assets_status_idx ON assets (status)`;

  // v4 — per-user accounts (Phase 0). Canonical identity lives here in Neon (the
  // only DB the edge middleware can reach); the library `users` table mirrors it.
  // Role vocabulary reuses lib/auth.ts StudioRole exactly — do not diverge.
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id            SERIAL PRIMARY KEY,
      email         TEXT NOT NULL UNIQUE,
      name          TEXT NOT NULL,
      handle        TEXT NOT NULL UNIQUE,
      role          TEXT NOT NULL DEFAULT 'creative'
                      CHECK (role IN ('creative','producer','finance','admin')),
      password_hash TEXT,
      avatar_url    TEXT,
      active        BOOLEAN NOT NULL DEFAULT TRUE,
      token_version INTEGER NOT NULL DEFAULT 0,
      last_login_at TIMESTAMPTZ,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS users_email_idx ON users (lower(email))`;
  // Link existing free-text operator/approver strings to real users — keep the
  // name columns as a display cache (dual-write), add the id alongside.
  await sql`ALTER TABLE jobs   ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE SET NULL`;
  await sql`ALTER TABLE assets ADD COLUMN IF NOT EXISTS approved_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL`;
  await sql`CREATE INDEX IF NOT EXISTS jobs_user_id_idx ON jobs (user_id)`;

  console.log("migration complete");
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
