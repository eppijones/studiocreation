/** Single asset detail: row + proxies + transcript + tags. */
import { NextResponse } from "next/server";
import { assetDetail } from "@/studiolibrary/lib/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await assetDetail(Number(id));
  if (!detail) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(detail);
}
