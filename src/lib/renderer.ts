import sharp from "sharp";

export type RenderSize = "square" | "portrait";
export type RenderTypography = { family: string; ink: string; align: "left" | "center"; scale: number };

const sizes: Record<RenderSize, { width: number; height: number }> = {
  square: { width: 1200, height: 1200 },
  portrait: { width: 1080, height: 1350 }
};

function escapeXml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

export async function renderArtwork(input: { backgroundSvg: string; lines: string[]; typography: RenderTypography; size?: RenderSize }): Promise<Buffer> {
  const size = sizes[input.size ?? "square"];
  const fontSize = Math.round(54 * input.typography.scale);
  const lineHeight = Math.round(fontSize * 1.45);
  const x = input.typography.align === "center" ? size.width / 2 : Math.round(size.width * 0.18);
  const anchor = input.typography.align === "center" ? "middle" : "start";
  const textSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size.width}" height="${size.height}" viewBox="0 0 ${size.width} ${size.height}">
    <rect x="${size.width * 0.11}" y="${size.height * 0.3}" width="${size.width * 0.78}" height="${lineHeight * 4.2}" rx="42" fill="#fff8ed" opacity="0.58"/>
    <text x="${x}" y="${size.height * 0.42}" text-anchor="${anchor}" font-family="${escapeXml(input.typography.family)}" font-size="${fontSize}" fill="${escapeXml(input.typography.ink)}" letter-spacing="0.4">
      ${input.lines.map((line, index) => `<tspan x="${x}" dy="${index === 0 ? 0 : lineHeight}">${escapeXml(line)}</tspan>`).join("")}
    </text>
  </svg>`;
  const background = await sharp(Buffer.from(input.backgroundSvg)).resize(size.width, size.height, { fit: "cover" }).png().toBuffer();
  return sharp(background).composite([{ input: Buffer.from(textSvg), top: 0, left: 0 }]).png().toBuffer();
}
