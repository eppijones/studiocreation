import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

/** Asset feed for the gallery, Finalize Center and scripts/studio_sync.sh (?after_id= for incremental pulls). */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const afterId = Number(url.searchParams.get("after_id") ?? 0);
  const project = url.searchParams.get("project");
  const status = url.searchParams.get("status");

  const assets = await sql`
    SELECT a.*, j.model, j.project, j.label, j.operator, j.prompt, j.est_usd, j.actual_usd,
           j.request_id, j.source_asset_id, j.params->>'role' AS role
    FROM assets a JOIN jobs j ON j.id = a.job_id
    WHERE a.id > ${afterId}
      AND (${project}::text IS NULL OR j.project = ${project})
      AND (${status}::text IS NULL OR a.status = ${status})
    ORDER BY a.id DESC LIMIT 200
  `;
  return NextResponse.json({ assets });
}
