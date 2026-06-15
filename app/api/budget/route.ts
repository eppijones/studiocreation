import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getBudgetState } from "@/lib/budget";
import { OPERATOR_COOKIE } from "@/lib/auth";

export async function GET() {
  const cookieStore = await cookies();
  const operator = cookieStore.get(OPERATOR_COOKIE)?.value;
  return NextResponse.json(await getBudgetState(operator));
}
