import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

/**
 * PUBLIC, pre-auth feed for the login screen showcase wall.
 *
 * Surfaces only the renders the studio has explicitly curated by tagging them
 * `showcaser` in the gallery — the "top picks". Returns a deliberately thin,
 * safe shape (no operator names, costs or request ids) since this is reachable
 * before sign-in. Failures degrade to an empty wall so login never breaks.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await sql`
      SELECT a.id, a.blob_url, a.content_type, a.width, a.height, a.duration_s,
             a.score, j.label, j.project
      FROM assets a JOIN jobs j ON j.id = a.job_id
      WHERE a.tags @> ARRAY['showcaser']::text[]
        AND a.status <> 'hidden'
        AND a.blob_url IS NOT NULL
      ORDER BY a.id DESC
      LIMIT 60
    `;
    return NextResponse.json(
      { showcase: rows },
      { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" } }
    );
  } catch {
    // No DB / not migrated yet / no curated picks — the wall falls back gracefully.
    return NextResponse.json({ showcase: [] });
  }
}
