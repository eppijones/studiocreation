/** Review actions: set state, rating, tags, custom fields. */
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { setReviewState, setRating, addTag, removeTag, setCustomField, tagSuggestions } from "@/studiolibrary/lib/review";
import { fireEvent } from "@/studiolibrary/lib/automation";
import { getAsset } from "@/studiolibrary/lib/repo";
import { currentUser } from "@/lib/users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  // Tag autocomplete.
  const q = new URL(req.url).searchParams.get("tagq") ?? "";
  return NextResponse.json({ suggestions: await tagSuggestions(q) });
}

export async function POST(req: Request) {
  const me = await currentUser();
  const actor = me?.name ?? (await cookies()).get("studio_operator")?.value ?? null;
  const actorId = me?.id ?? null;
  const b = await req.json();
  const assetId = Number(b.assetId);
  try {
    switch (b.action) {
      case "state": {
        await setReviewState(assetId, String(b.state), actor, actorId);
        // Let automation react to the new state (additive).
        const a = await getAsset(assetId);
        await fireEvent("asset.state_changed", { assetId, kind: a?.kind, relPath: a?.rel_path, reviewState: String(b.state) }).catch(() => {});
        break;
      }
      case "rating": await setRating(assetId, b.rating == null ? null : Number(b.rating), actor); break;
      case "tag": await addTag(assetId, String(b.label), actor); break;
      case "untag": await removeTag(assetId, String(b.label), actor); break;
      case "customField": await setCustomField(assetId, String(b.key), b.value, actor); break;
      default: return NextResponse.json({ error: "unknown action" }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
