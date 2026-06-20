/** Share links for external review (asset or collection). */
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createShareLink, listShareLinks, revokeShareLink } from "@/studiolibrary/lib/collections";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const u = new URL(req.url);
  const targetType = (u.searchParams.get("targetType") as "asset" | "collection") ?? "asset";
  const targetId = Number(u.searchParams.get("targetId"));
  return NextResponse.json({ links: await listShareLinks(targetType, targetId) });
}

export async function POST(req: Request) {
  const by = (await cookies()).get("studio_operator")?.value ?? null;
  const b = await req.json();
  const link = await createShareLink({
    targetType: b.targetType, targetId: Number(b.targetId), mode: b.mode,
    allowComments: b.allowComments, allowDownload: b.allowDownload, embed: b.embed,
    recipient: b.recipient ?? null, expiresInDays: b.expiresInDays ?? 30,
    viewLimit: b.viewLimit ?? null, by,
  });
  return NextResponse.json({ link });
}

export async function DELETE(req: Request) {
  await revokeShareLink(Number(new URL(req.url).searchParams.get("id")));
  return NextResponse.json({ ok: true });
}
