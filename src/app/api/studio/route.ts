import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth";
import { snapshot } from "@/lib/studio";
import { errorResponse } from "@/lib/http";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    return NextResponse.json(await snapshot(await requireOwner(), new URL(request.url).searchParams.get("entry") ?? undefined), { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) { return errorResponse(e); }
}
