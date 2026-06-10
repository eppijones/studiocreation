import { NextResponse } from "next/server";
import { listBriefs } from "@/lib/briefs";

export async function GET() {
  return NextResponse.json({ briefs: listBriefs() });
}
