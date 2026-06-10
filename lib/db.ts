import { neon } from "@neondatabase/serverless";

if (typeof window !== "undefined") {
  throw new Error("lib/db.ts was imported in a client bundle");
}

export const sql = neon(process.env.DATABASE_URL!);

export type JobStatus = "queued" | "running" | "done" | "error";

export interface JobRow {
  id: number;
  provider: string;
  model: string;
  request_id: string | null;
  prompt: string;
  params: Record<string, unknown>;
  status: JobStatus;
  est_usd: string;
  actual_usd: string | null;
  operator: string;
  project: string;
  label: string;
  error: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface AssetRow {
  id: number;
  job_id: number;
  blob_url: string;
  source_url: string | null;
  content_type: string | null;
  width: number | null;
  height: number | null;
  duration_s: number | null;
  score: number | null;
  created_at: string;
}
