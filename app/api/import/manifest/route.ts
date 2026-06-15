import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { sql } from "@/lib/db";

export const maxDuration = 60;

interface ManifestRow {
  ts?: string;
  project?: string;
  model?: string;
  label?: string;
  cost_usd?: number;
  file?: string;
  url?: string;
  request_id?: string;
}

function parseRows(text: string): ManifestRow[] {
  const trimmed = text.trim();
  if (trimmed.startsWith("[")) return JSON.parse(trimmed);
  return trimmed
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

export async function POST(request: Request) {
  const text = await request.text();
  let rows: ManifestRow[];
  try {
    rows = parseRows(text);
  } catch {
    return NextResponse.json({ error: "Body must be JSONL or a JSON array" }, { status: 400 });
  }

  let imported = 0;
  let skipped = 0;

  for (const row of rows) {
    if (!row.url && !row.file) {
      skipped++;
      continue;
    }
    // Agent/MCP-driven fal generations logged to the manifest, in dollars.
    const provider = "fal-mcp";
    const usd = row.cost_usd ?? 0;
    const requestId =
      row.request_id && row.request_id.length > 0
        ? row.request_id
        : `manifest:${createHash("sha1").update(row.url ?? row.file ?? "").digest("hex").slice(0, 16)}`;

    const inserted = await sql`
      INSERT INTO jobs (provider, model, request_id, prompt, params, status, est_usd, actual_usd,
                        operator, project, label, created_at, completed_at)
      VALUES (${provider}, ${row.model ?? "unknown"}, ${requestId}, '',
              ${JSON.stringify({ imported: true, file: row.file })}, 'done', ${usd}, ${usd},
              'mcp', ${row.project ?? "misc"}, ${row.label ?? "asset"},
              ${row.ts ?? new Date().toISOString()}, ${row.ts ?? new Date().toISOString()})
      ON CONFLICT (request_id) DO NOTHING
      RETURNING id
    `;

    if (!inserted[0]) {
      skipped++;
      continue;
    }
    if (row.url) {
      await sql`
        INSERT INTO assets (job_id, blob_url, source_url)
        VALUES (${inserted[0].id}, ${row.url}, ${row.url})
      `;
    }
    imported++;
  }

  return NextResponse.json({ imported, skipped });
}
