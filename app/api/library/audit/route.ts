/** Activity audit log — time-ranged export of asset_events. Admin/finance only. */
import { NextResponse } from "next/server";
import { currentUser } from "@/lib/users";
import { auditLog } from "@/studiolibrary/lib/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function toCsv(rows: { id: number; created_at: string; actor: string | null; type: string; asset_id: number; filename: string | null }[]): string {
  const head = "id,created_at,actor,type,asset_id,filename";
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = rows.map((r) => [r.id, r.created_at, r.actor, r.type, r.asset_id, r.filename].map(esc).join(","));
  return [head, ...lines].join("\n");
}

export async function GET(req: Request) {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (me.role !== "admin" && me.role !== "finance") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const u = new URL(req.url);
  const rows = await auditLog({
    days: Number(u.searchParams.get("days")) || 30,
    actor: u.searchParams.get("actor") || undefined,
    type: u.searchParams.get("type") || undefined,
    limit: Number(u.searchParams.get("limit")) || undefined,
  });

  if (u.searchParams.get("format") === "csv") {
    return new NextResponse(toCsv(rows), {
      headers: { "Content-Type": "text/csv", "Content-Disposition": `attachment; filename="audit.csv"` },
    });
  }
  return NextResponse.json({ events: rows });
}
