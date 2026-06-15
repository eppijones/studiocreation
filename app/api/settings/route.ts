import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  getBudgetSettings,
  saveBudgetSettings,
  getStudioSettings,
  saveStudioSettings,
} from "@/lib/settings";
import { GOVERNOR_ROLES, OPERATOR_COOKIE, parseRole, ROLE_COOKIE } from "@/lib/auth";

export async function GET() {
  const cookieStore = await cookies();
  const role = parseRole(cookieStore.get(ROLE_COOKIE)?.value);
  return NextResponse.json({
    budget: await getBudgetSettings(),
    studio: await getStudioSettings(),
    role,
    canEdit: GOVERNOR_ROLES.includes(role),
  });
}

export async function PUT(request: Request) {
  const cookieStore = await cookies();
  const role = parseRole(cookieStore.get(ROLE_COOKIE)?.value);
  if (!GOVERNOR_ROLES.includes(role)) {
    return NextResponse.json(
      { error: "Studio settings are finance/admin only — switch role at login." },
      { status: 403 }
    );
  }
  const operator = cookieStore.get(OPERATOR_COOKIE)?.value ?? "unknown";
  const by = `${operator} (${role})`;
  const patch = await request.json();

  const studio =
    "autoScore" in patch
      ? await saveStudioSettings({ autoScore: patch.autoScore === true }, by)
      : await getStudioSettings();
  const budget = await saveBudgetSettings(patch, by);

  return NextResponse.json({ budget, studio });
}
