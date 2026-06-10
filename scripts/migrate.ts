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
  await sql`CREATE INDEX IF NOT EXISTS jobs_created_at_idx ON jobs (created_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS jobs_status_idx ON jobs (status)`;
  await sql`CREATE INDEX IF NOT EXISTS assets_job_id_idx ON assets (job_id)`;
  console.log("migration complete");
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
