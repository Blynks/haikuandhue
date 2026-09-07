import sharp from "sharp";
import type { Guidance, Layout } from "./domain";

export const escapeXml = (text: string) => text.replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[c]!);
export const palettes = {
  slate: ["#e4e8e7", "#8babb9", "#304e65"],
  cream: ["#f6ecdb", "#c8b6a4", "#796a61"],
  sage: ["#e6ead5", "#aaba9a", "#61785c"],
  rose: ["#f5e5df", "#c79d9b", "#855f70"],
};
export type ArtSource = { palette: keyof typeof palettes; seed: number; medium: Guidance["medium"]; warmth: number; brightness: number; negativeSpace: number; composition: Guidance["composition"] };
export function artworkSvg(source: ArtSource, width = 1080, height = 1350) {
  const [paper, mid, dark] = palettes[source.palette];
  const y = source.composition === "open top" ? 1100 : source.composition === "open bottom" ? 180 : 1000;
  const shapes = source.medium === "rain window"
    ? Array.from({ length: 24 }, (_, i) => `<path d="M${(i * 107 + source.seed * 17) % 1080},${(i * 173) % 1350} l-10,${30 + (i % 4) * 12}" stroke="${dark}" stroke-width="${2 + i % 3}" stroke-linecap="round" opacity=".13"/>`).join("")
    : `<ellipse cx="${150 + source.seed % 350}" cy="${y}" rx="510" ry="300" fill="${mid}" opacity=".4"/><ellipse cx="990" cy="${1350 - y}" rx="420" ry="440" fill="${dark}" opacity=".1"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 1080 1350">
    <defs><linearGradient id="wash" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${paper}"/><stop offset="1" stop-color="${mid}"/></linearGradient>
    <filter id="grain"><feTurbulence type="fractalNoise" baseFrequency=".55" numOctaves="3" seed="${source.seed % 1000}"/><feColorMatrix type="saturate" values="0"/></filter></defs>
    <rect width="1080" height="1350" fill="url(#wash)"/>${shapes}
    <rect width="1080" height="1350" fill="${source.warmth > 50 ? "#eacda3" : "#c5d9e6"}" opacity="${Math.abs(source.warmth - 50) / 400}"/>
    <rect width="1080" height="1350" fill="${paper}" opacity="${source.negativeSpace / 220}"/>
    <rect width="1080" height="1350" fill="${source.brightness > 55 ? "#fff" : "#182b30"}" opacity="${Math.abs(source.brightness - 55) / 150}"/>
    <rect width="1080" height="1350" opacity=".055" filter="url(#grain)"/>
    <path d="M70 1280h80" stroke="${dark}" opacity=".2" stroke-width="2"/>
  </svg>`;
}
export function compositionSvg(background: Buffer, lines: string[], layout: Layout, format: "square" | "portrait") {
  const width = 1080, height = format === "square" ? 1080 : 1350;
  const lineHeight = layout.size * 1.8;
  const y = layout.position === "top" ? 220 : layout.position === "bottom" ? height - 290 : height / 2 - lineHeight;
  const x = layout.align === "center" ? 540 : 120;
  const fill = layout.contrast === "ink" ? "#213a3e" : "#fffaf0";
  const longest = Math.max(...lines.map((line) => line.length));
  const size = Math.min(layout.size, 830 / Math.max(1, longest * 0.62));
  const imageHeight = 1350;
  const imageY = -((imageHeight - height) * layout.cropY / 100);
  // Slight zoom provides useful horizontal placement while keeping every crop fully covered.
  const zoom = 1.12, imageWidth = width * zoom;
  const imageX = -(imageWidth - width) * layout.cropX / 100;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <image href="data:image/png;base64,${background.toString("base64")}" x="${imageX}" y="${imageY}" width="${imageWidth}" height="${imageHeight * zoom}" preserveAspectRatio="none"/>
    <rect width="${width}" height="${height}" fill="${layout.contrast === "ink" ? "#fffaf0" : "#172d35"}" opacity="${layout.overlay}"/>
    ${lines.map((line, i) => `<text x="${x}" y="${y + i * lineHeight}" text-anchor="${layout.align === "center" ? "middle" : "start"}" font-family="${layout.font === "serif" ? "DejaVu Serif" : "DejaVu Sans"}" font-size="${size}" fill="${fill}">${escapeXml(line)}</text>`).join("")}
    <text x="540" y="${height - 76}" text-anchor="middle" font-family="DejaVu Sans" letter-spacing="5" font-size="14" fill="${fill}" opacity=".55">HAIKU &amp; HUE</text>
  </svg>`;
}
export async function renderArt(source: ArtSource) {
  return sharp(Buffer.from(artworkSvg(source))).png().toBuffer();
}
export async function renderComposition(background: Buffer, lines: string[], layout: Layout, format: "square" | "portrait") {
  return sharp(Buffer.from(compositionSvg(background, lines, layout, format))).png().toBuffer();
}
