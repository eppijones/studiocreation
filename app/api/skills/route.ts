import { NextResponse } from "next/server";
import { listEmployees } from "@/lib/skills";

export async function GET() {
  return NextResponse.json({ employees: listEmployees() });
}
