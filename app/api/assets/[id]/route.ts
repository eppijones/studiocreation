import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const score = body.score === null ? null : Number(body.score);

  if (score !== null && (!Number.isInteger(score) || score < 0 || score > 10)) {
    return NextResponse.json({ error: "score must be 0-10 or null" }, { status: 400 });
  }

  const rows = await sql`
    UPDATE assets SET score = ${score} WHERE id = ${Number(id)} RETURNING id, score
  `;
  if (!rows[0]) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(rows[0]);
}
