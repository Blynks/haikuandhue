import { makeBackgroundSvg, pickPalette } from "./backgrounds";
import { estimateHaiku } from "./syllables";

export type CheckInInput = {
  feelings: string[];
  intensity: number;
  inspiration: string;
  visualStyle: "PAPER_GARDEN" | "DUSK_GRADIENT" | "PLAYFUL_SHAPES" | "QUIET_SEA";
  direction: "REFLECT" | "LIFT" | "CONTRAST";
};

export type GeneratedPoem = { title: string; lines: string[]; syllableCounts: number[]; syllableUncertain: boolean; caption: string; altText: string };
export type GeneratedBackground = { name: string; prompt: string; palette: { name: string; colors: string[] }; svgTemplate: string };

const demoPoems: Record<CheckInInput["direction"], string[][]> = {
  REFLECT: [
    ["Quiet cup of rain", "Window light holds what I feel", "Tea steam learns my name"],
    ["Soft shoes by the door", "The day folds into my palms", "Evening keeps its hush"],
    ["Ink settles slowly", "One small thought becomes a shore", "Breath returns like tide"]
  ],
  LIFT: [
    ["Morning loosens gold", "Even tired roots remember", "How to drink the sun"],
    ["A shy bird answers", "From the fence of the grey hour", "Hope tilts into song"],
    ["Light on folded sheets", "Finds the room before I do", "And opens a path"]
  ],
  CONTRAST: [
    ["Thunder wears slippers", "Puddles practice tiny jokes", "Clouds applaud in blue"],
    ["Grief meets a red kite", "Both pretend not to notice", "Sky tugging the string"],
    ["Sour lemons moonwalk", "Across my serious plate", "Sugar taps the glass"]
  ]
};

export function isDemoMode(): boolean {
  return !process.env.TEXT_MODEL_API_KEY || process.env.TEXT_MODEL_PROVIDER === "demo";
}

export function generateHaikus(input: CheckInInput): GeneratedPoem[] {
  const mood = input.feelings.join(", ") || "today";
  return demoPoems[input.direction].map((lines, index) => {
    const estimate = estimateHaiku(lines);
    const title = ["Moonlit note", "Small weather", "Pocket almanac"][index];
    return {
      title,
      lines,
      syllableCounts: estimate.counts,
      syllableUncertain: estimate.uncertain,
      caption: `${lines.join(" / ")}\n\nInspired by ${input.inspiration || mood}. #haiku #creativejournal`,
      altText: `Original haiku about ${mood} set on a ${input.visualStyle.toLowerCase().replaceAll("_", " ")} background.`,
    };
  });
}

export function generateBackgrounds(input: CheckInInput): GeneratedBackground[] {
  return Array.from({ length: 3 }, (_, index) => {
    const palette = pickPalette(input.feelings, input.intensity + index, input.direction);
    return {
      name: `${palette.name} ${index + 1}`,
      prompt: `Procedural ${input.visualStyle.toLowerCase().replaceAll("_", " ")} for ${input.feelings.join(", ") || "a daily mood"}`,
      palette,
      svgTemplate: makeBackgroundSvg(palette, input.visualStyle, input.inspiration.length + index * 13)
    };
  });
}
