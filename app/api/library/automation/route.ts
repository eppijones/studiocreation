/** Automation rules: list / create / update / delete / run-now. */
import { NextResponse } from "next/server";
import { listRules, createRule, updateRule, deleteRule, runRuleManually } from "@/studiolibrary/lib/automation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ rules: await listRules() });
}

export async function POST(req: Request) {
  const b = await req.json();
  try {
    switch (b.action) {
      case "create": return NextResponse.json({ rule: await createRule(b.rule ?? {}) });
      case "update": await updateRule(Number(b.id), b.rule ?? {}); return NextResponse.json({ ok: true });
      case "toggle": await updateRule(Number(b.id), { enabled: !!b.enabled }); return NextResponse.json({ ok: true });
      case "delete": await deleteRule(Number(b.id)); return NextResponse.json({ ok: true });
      case "run": await runRuleManually(Number(b.id), (b.assetIds ?? []).map(Number)); return NextResponse.json({ ok: true });
      default: return NextResponse.json({ error: "unknown action" }, { status: 400 });
    }
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
