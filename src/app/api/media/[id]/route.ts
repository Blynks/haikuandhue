import { requireOwner } from "@/lib/auth";
import { ownedAsset, readAsset } from "@/lib/media";
import { errorResponse } from "@/lib/http";
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const asset = await ownedAsset(await requireOwner(), (await context.params).id);
    const buffer = await readAsset(asset);
    return new Response(new Uint8Array(buffer), { headers: { "Content-Type": "image/png", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch (e) { return errorResponse(e); }
}
