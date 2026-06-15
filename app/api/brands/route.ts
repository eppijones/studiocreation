import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getBrandList, saveBrand, synthesizeBrand } from "@/lib/brands";
import { OPERATOR_COOKIE, ROLE_COOKIE, parseRole } from "@/lib/auth";

export async function GET() {
  return NextResponse.json({ brands: await getBrandList() });
}

/**
 * Demo-mode brand formula: take a name + optional website + pasted brand
 * material, synthesize a brand profile and persist it. A real version would
 * route the source material through a model; this is the MVP stub.
 */
export async function POST(request: Request) {
  const cookieStore = await cookies();
  const operator = cookieStore.get(OPERATOR_COOKIE)?.value ?? "unknown";
  const role = parseRole(cookieStore.get(ROLE_COOKIE)?.value);

  const body = await request.json().catch(() => ({}));
  const name = String(body.name ?? "").trim();
  if (!name) {
    return NextResponse.json({ error: "A brand name is required." }, { status: 400 });
  }

  const brand = synthesizeBrand({
    name,
    website: body.website ? String(body.website) : undefined,
    parent: body.parent ? String(body.parent) : undefined,
    sourceText: body.sourceText ? String(body.sourceText) : undefined,
  });

  try {
    await saveBrand(brand, `${operator} (${role || "operator"})`);
  } catch {
    return NextResponse.json(
      { error: "Couldn't persist the brand — the settings store is unavailable. Run the migration first.", brand },
      { status: 503 }
    );
  }
  return NextResponse.json({ brand });
}
