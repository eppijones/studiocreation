/** Timecode annotations (comments + markers): list / create / update / delete. */
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { listAnnotations, addAnnotation, updateAnnotation, deleteAnnotation } from "@/studiolibrary/lib/review";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const assetId = Number(new URL(req.url).searchParams.get("assetId"));
  return NextResponse.json({ annotations: await listAnnotations(assetId) });
}

export async function POST(req: Request) {
  const author = (await cookies()).get("studio_operator")?.value ?? null;
  const b = await req.json();
  const a = await addAnnotation({
    assetId: Number(b.assetId), kind: b.kind ?? "comment", author,
    body: b.body, tcIn: b.tcIn ?? null, tcOut: b.tcOut ?? null,
    color: b.color ?? null, assignedTo: b.assignedTo ?? null, parentId: b.parentId ?? null,
  });
  return NextResponse.json({ annotation: a });
}

export async function PATCH(req: Request) {
  const b = await req.json();
  await updateAnnotation(Number(b.id), {
    body: b.body, tcIn: b.tcIn, tcOut: b.tcOut, resolved: b.resolved, assignedTo: b.assignedTo,
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const id = Number(new URL(req.url).searchParams.get("id"));
  await deleteAnnotation(id);
  return NextResponse.json({ ok: true });
}
