/** Subclips: named virtual in/out ranges over an asset. */
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { listSubclips, addSubclip, deleteSubclip } from "@/studiolibrary/lib/review";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const assetId = Number(new URL(req.url).searchParams.get("assetId"));
  return NextResponse.json({ subclips: await listSubclips(assetId) });
}

export async function POST(req: Request) {
  const by = (await cookies()).get("studio_operator")?.value ?? null;
  const b = await req.json();
  const s = await addSubclip(Number(b.assetId), b.name ?? null, Number(b.tcIn), Number(b.tcOut), by);
  return NextResponse.json({ subclip: s });
}

export async function DELETE(req: Request) {
  await deleteSubclip(Number(new URL(req.url).searchParams.get("id")));
  return NextResponse.json({ ok: true });
}
