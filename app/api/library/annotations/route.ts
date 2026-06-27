/** Timecode annotations (comments + markers): list / create / update / delete. */
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { listAnnotations, addAnnotation, updateAnnotation, deleteAnnotation } from "@/studiolibrary/lib/review";
import { currentUser } from "@/lib/users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Acting identity: real user (per-user mode) or just the operator-name cookie. */
async function actor(): Promise<{ name: string | null; id: number | null }> {
  const me = await currentUser();
  if (me) return { name: me.name, id: me.id };
  return { name: (await cookies()).get("studio_operator")?.value ?? null, id: null };
}

export async function GET(req: Request) {
  const assetId = Number(new URL(req.url).searchParams.get("assetId"));
  return NextResponse.json({ annotations: await listAnnotations(assetId) });
}

export async function POST(req: Request) {
  const me = await actor();
  const b = await req.json();
  const a = await addAnnotation({
    assetId: Number(b.assetId), kind: b.kind ?? "comment", author: me.name, authorId: me.id,
    body: b.body, tcIn: b.tcIn ?? null, tcOut: b.tcOut ?? null,
    color: b.color ?? null, assignedTo: b.assignedTo ?? null, assignedToId: b.assignedToId ?? null,
    parentId: b.parentId ?? null,
  });
  return NextResponse.json({ annotation: a });
}

export async function PATCH(req: Request) {
  const me = await actor();
  const b = await req.json();
  await updateAnnotation(Number(b.id), {
    body: b.body, tcIn: b.tcIn, tcOut: b.tcOut, resolved: b.resolved,
    assignedTo: b.assignedTo, assignedToId: b.assignedToId,
  }, me);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const id = Number(new URL(req.url).searchParams.get("id"));
  await deleteAnnotation(id);
  return NextResponse.json({ ok: true });
}
