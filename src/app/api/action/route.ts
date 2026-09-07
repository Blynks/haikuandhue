import { NextResponse } from "next/server";
import { z } from "zod";
import { requireOwner, verifyOrigin } from "@/lib/auth";
import { errorResponse, readJson } from "@/lib/http";
import { approveExport, cancelApproval, markHandoff, moveHistory, prepareReview, releaseExport, requestGeneration, saveCandidate, saveDefaults, saveEntry } from "@/lib/studio";

export async function POST(request: Request) {
  try {
    verifyOrigin(request);
    const ownerId = await requireOwner();
    const input = z.object({ action: z.string(), data: z.unknown() }).parse(await readJson(request));
    let result: unknown;
    switch (input.action) {
      case "checkin": result = await saveEntry(ownerId, input.data); break;
      case "defaults": result = await saveDefaults(ownerId, input.data); break;
      case "generate": result = await requestGeneration(ownerId, input.data); break;
      case "compose": result = await saveCandidate(ownerId, input.data); break;
      case "history": {
        const data = z.object({ entryId: z.string(), delta: z.number() }).parse(input.data);
        result = await moveHistory(ownerId, data.entryId, data.delta); break;
      }
      case "review": result = await prepareReview(ownerId, input.data); break;
      case "approve": {
        const data = z.object({ reviewId: z.string(), digest: z.string() }).parse(input.data);
        result = await approveExport(ownerId, data.reviewId, data.digest); break;
      }
      case "cancel": result = await cancelApproval(ownerId, z.object({ approvalId: z.string() }).parse(input.data).approvalId); break;
      case "release": result = await releaseExport(ownerId, z.object({ publicationId: z.string() }).parse(input.data).publicationId); break;
      case "handoff": result = await markHandoff(ownerId, z.object({ publicationId: z.string() }).parse(input.data).publicationId); break;
      default: return NextResponse.json({ error: "Unknown action." }, { status: 400 });
    }
    return NextResponse.json({ ok: true, result });
  } catch (e) { return errorResponse(e); }
}
