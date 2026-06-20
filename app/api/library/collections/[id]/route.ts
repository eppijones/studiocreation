/** A single collection with its ordered assets. */
import { NextResponse } from "next/server";
import { getCollection } from "@/studiolibrary/lib/collections";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getCollection(Number(id));
  if (!data) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(data);
}
