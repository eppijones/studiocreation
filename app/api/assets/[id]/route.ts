import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { del } from "@vercel/blob";
import { sql, type AssetStatus } from "@/lib/db";
import { OPERATOR_COOKIE, ROLE_COOKIE, parseRole, type StudioRole } from "@/lib/auth";

const STATUSES: AssetStatus[] = ["new", "flagged", "hidden", "approved", "delivered"];

// Permanent delete drops the Blob original + row — irreversible under File Law.
// Creatives can Hide (non-destructive); only production/governance roles may
// hard-delete, so a junior can't nuke the shared library.
const DELETE_ROLES: StudioRole[] = ["producer", "finance", "admin"];

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();

  const updates: { score?: number | null; status?: AssetStatus; tags?: string[]; project?: string } = {};

  if ("project" in body) {
    if (typeof body.project !== "string" || !body.project.trim()) {
      return NextResponse.json({ error: "project must be a non-empty string" }, { status: 400 });
    }
    updates.project = body.project.trim().slice(0, 60);
  }
  if ("score" in body) {
    const score = body.score === null ? null : Number(body.score);
    if (score !== null && (!Number.isInteger(score) || score < 0 || score > 10)) {
      return NextResponse.json({ error: "score must be 0-10 or null" }, { status: 400 });
    }
    updates.score = score;
  }
  if ("status" in body) {
    if (!STATUSES.includes(body.status)) {
      return NextResponse.json({ error: `status must be one of ${STATUSES.join(", ")}` }, { status: 400 });
    }
    updates.status = body.status;
  }
  if ("tags" in body) {
    if (!Array.isArray(body.tags) || body.tags.some((t: unknown) => typeof t !== "string")) {
      return NextResponse.json({ error: "tags must be a string array" }, { status: 400 });
    }
    updates.tags = (body.tags as string[]).map((t) => t.trim().slice(0, 40)).filter(Boolean).slice(0, 12);
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "nothing to update" }, { status: 400 });
  }

  const cookieStore = await cookies();
  const operator = cookieStore.get(OPERATOR_COOKIE)?.value ?? "unknown";
  const approving = updates.status === "approved" || updates.status === "delivered";

  const rows = await sql`
    UPDATE assets SET
      score = CASE WHEN ${"score" in updates} THEN ${updates.score ?? null} ELSE score END,
      status = COALESCE(${updates.status ?? null}, status),
      tags = COALESCE(${updates.tags ?? null}::text[], tags),
      approved_by = CASE WHEN ${approving} THEN ${operator} ELSE approved_by END,
      approved_at = CASE WHEN ${approving} THEN now() ELSE approved_at END
    WHERE id = ${Number(id)}
    RETURNING id, job_id, score, status, tags, approved_by, approved_at
  `;
  if (!rows[0]) return NextResponse.json({ error: "not found" }, { status: 404 });

  // Project lives on the parent job — reassigning an asset's project moves its job.
  if (updates.project !== undefined) {
    await sql`UPDATE jobs SET project = ${updates.project} WHERE id = ${rows[0].job_id}`;
    return NextResponse.json({ ...rows[0], project: updates.project });
  }
  return NextResponse.json(rows[0]);
}

/** Permanently remove an asset from the library — deletes the Blob original and the row. */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const assetId = Number(id);
  if (!Number.isInteger(assetId)) {
    return NextResponse.json({ error: "bad id" }, { status: 400 });
  }

  const cookieStore = await cookies();
  const role = parseRole(cookieStore.get(ROLE_COOKIE)?.value);
  if (!DELETE_ROLES.includes(role)) {
    return NextResponse.json(
      { error: "delete_forbidden", message: "Permanent delete is producer/finance/admin only — Hide it instead." },
      { status: 403 }
    );
  }
  const operator = cookieStore.get(OPERATOR_COOKIE)?.value ?? "unknown";

  const rows = await sql`SELECT id, blob_url FROM assets WHERE id = ${assetId}`;
  if (!rows[0]) return NextResponse.json({ error: "not found" }, { status: 404 });

  // Best-effort blob cleanup — a missing/already-gone blob must not block the row delete.
  const blobUrl = rows[0].blob_url as string | null;
  if (blobUrl) {
    try {
      await del(blobUrl);
    } catch {
      /* blob already gone or token missing — proceed with the row delete */
    }
  }

  await sql`DELETE FROM assets WHERE id = ${assetId}`;
  // Attributable audit line — destructive action under File Law.
  console.log(`asset.delete id=${assetId} by=${operator} (${role})`);
  return NextResponse.json({ ok: true, id: assetId });
}
