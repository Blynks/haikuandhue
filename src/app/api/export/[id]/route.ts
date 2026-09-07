import { requireOwner } from "@/lib/auth";
import { downloadAsset } from "@/lib/studio";
import { errorResponse } from "@/lib/http";
import { assert } from "@/lib/domain";
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const format = new URL(request.url).searchParams.get("format");
    assert(format === "square" || format === "portrait", "Choose square or portrait.");
    const buffer = await downloadAsset(await requireOwner(), (await context.params).id, format);
    return new Response(new Uint8Array(buffer), { headers: {
      "Content-Type": "image/png", "Content-Disposition": `attachment; filename="haiku-and-hue-${format}.png"`,
      "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
    } });
  } catch (e) { return errorResponse(e); }
}
