import { NextResponse } from "next/server";
import { getBudgetState } from "@/lib/budget";

export async function GET() {
  return NextResponse.json(await getBudgetState());
}
