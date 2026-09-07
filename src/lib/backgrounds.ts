import type { VisualStyle } from "@prisma/client";

export type Palette = { name: string; colors: [string, string, string, string] };

const palettes: Record<string, Palette[]> = {
  warm: [
    { name: "Apricot quiet", colors: ["#f7ead7", "#f5cda7", "#d88964", "#3f302b"] },
    { name: "Rose paper", colors: ["#fbf1e9", "#ecc7bf", "#c6797d", "#423036"] }
  ],
  cool: [
    { name: "Mist garden", colors: ["#edf5ee", "#b7d8c6", "#6b9b87", "#263b35"] },
    { name: "Moon tide", colors: ["#eef4f8", "#bad4e2", "#6f90a6", "#263142"] }
  ],
  vivid: [
    { name: "Citrus play", colors: ["#fff4cc", "#ffd166", "#ef476f", "#30243a"] },
    { name: "Blueberry laugh", colors: ["#f1edff", "#b8a4ff", "#5d6be0", "#272044"] }
  ]
};

export function pickPalette(feelings: string[], intensity: number, direction: string): Palette {
  const key = direction === "CONTRAST" || intensity > 7 ? "vivid" : feelings.some((f) => ["calm", "tender", "hopeful"].includes(f)) ? "cool" : "warm";
  const list = palettes[key];
  return list[Math.abs(feelings.join("").length + intensity) % list.length];
}

export function makeBackgroundSvg(palette: Palette, style: VisualStyle | string, seed: number): string {
  const [paper, wash, accent, ink] = palette.colors;
  const shapeOpacity = style === "PLAYFUL_SHAPES" ? 0.26 : 0.14;
  const radius = 80 + (seed % 90);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200" viewBox="0 0 1200 1200">
  <defs>
    <linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop stop-color="${paper}"/><stop offset="0.56" stop-color="${wash}"/><stop offset="1" stop-color="${accent}"/></linearGradient>
    <filter id="paper"><feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="4" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="table" tableValues="0 0.075"/></feComponentTransfer></filter>
  </defs>
  <rect width="1200" height="1200" fill="url(#g)"/>
  <rect width="1200" height="1200" filter="url(#paper)" opacity="0.38"/>
  <circle cx="${220 + (seed % 120)}" cy="260" r="${radius}" fill="${paper}" opacity="${shapeOpacity}"/>
  <circle cx="940" cy="${780 - (seed % 140)}" r="${radius + 110}" fill="${ink}" opacity="0.08"/>
  <path d="M105 890 C 345 790, 520 980, 780 850 S 1060 780, 1130 610" fill="none" stroke="${paper}" stroke-width="34" opacity="0.16" stroke-linecap="round"/>
</svg>`;
}
