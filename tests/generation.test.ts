import { describe, expect, it } from "vitest";
import { generateBackgrounds, generateHaikus } from "../src/lib/generation";
import { estimateHaiku } from "../src/lib/syllables";
import { publishingCapabilities } from "../src/lib/publishing";

const input = { feelings: ["calm", "curious"], intensity: 5, inspiration: "window herbs", visualStyle: "PAPER_GARDEN" as const, direction: "LIFT" as const };

describe("creative pipeline", () => {
  it("generates three poems with syllable uncertainty metadata", () => {
    const poems = generateHaikus(input);
    expect(poems).toHaveLength(3);
    expect(poems[0].lines).toHaveLength(3);
    expect(poems[0].syllableCounts).toHaveLength(3);
    expect(typeof poems[0].syllableUncertain).toBe("boolean");
  });

  it("generates three procedural SVG backgrounds", () => {
    const backgrounds = generateBackgrounds(input);
    expect(backgrounds).toHaveLength(3);
    expect(backgrounds[0].svgTemplate).toContain("<svg");
    expect(backgrounds[0].palette.colors).toHaveLength(4);
  });

  it("flags imperfect or uncertain syllable estimates", () => {
    expect(estimateHaiku(["one", "two three", "four"]).uncertain).toBe(true);
  });

  it("keeps manual export functional while platform publishing is capability-aware", () => {
    expect(publishingCapabilities.find((capability) => capability.slug === "manual-export")?.state).toBe("manual-export");
    expect(publishingCapabilities.find((capability) => capability.slug === "tiktok")?.state).toBe("blocked");
  });
});
