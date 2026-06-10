import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export async function GET() {
  const jobs = await sql`
    SELECT j.id, j.model, j.prompt, j.status, j.est_usd, j.operator, j.project, j.label,
           j.error, j.created_at, j.completed_at,
           COALESCE(json_agg(json_build_object('id', a.id, 'blob_url', a.blob_url, 'content_type', a.content_type))
                    FILTER (WHERE a.id IS NOT NULL), '[]') AS assets
    FROM jobs j
    LEFT JOIN assets a ON a.job_id = j.id
    GROUP BY j.id
    ORDER BY j.created_at DESC
    LIMIT 30
  `;
  return NextResponse.json({ jobs });
}
