import { NextRequest } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { renderArtwork, type RenderSize } from "@/lib/renderer";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ revisionId: string }> }) {
  if (!(await isAuthenticated())) return new Response("Unauthorized", { status: 401 });
  const { revisionId } = await params;
  const revision = await prisma.artworkRevision.findUnique({ where: { id: revisionId }, include: { poem: true, background: true } });
  if (!revision) return new Response("Not found", { status: 404 });
  const size = (request.nextUrl.searchParams.get("size") === "portrait" ? "portrait" : "square") as RenderSize;
  const typography = revision.typography as { family: string; ink: string; align: "left" | "center"; scale: number };
  const image = await renderArtwork({ backgroundSvg: revision.background.svgTemplate, lines: revision.poem.lines, typography, size });
  return new Response(new Uint8Array(image), { headers: { "Content-Type": "image/png", "Content-Disposition": `attachment; filename="haiku-and-hue-${revision.id}-${size}.png"` } });
}
