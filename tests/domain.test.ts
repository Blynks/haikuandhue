import { describe, expect, it, vi } from "vitest";
import { checkCounts, defaultGuidance, defaultLayout, defaultLocks, demoPoems, localDay, localTime, preflight, recommendations, syllables } from "../src/lib/domain";
import { artworkSvg, compositionSvg, escapeXml, renderArt, renderComposition, type ArtSource } from "../src/lib/render";
import { manifestDigest } from "../src/lib/media";
import { activeSocialAdapters, mayRetry } from "../src/lib/social";
import { generatePoem } from "../src/lib/providers";
import { verifyOrigin, passwordHash, verifyPassword } from "../src/lib/auth";
import sharp from "sharp";

describe("independent generation and guidance", () => {
  it("accepts 5 + 2, allows a zero component, and rejects 0 + 0 or invalid limits", () => {
    expect(() => checkCounts(5, 2)).not.toThrow();
    expect(() => checkCounts(0, 2)).not.toThrow();
    expect(() => checkCounts(3, 0)).not.toThrow();
    for (const counts of [[0, 0], [-1, 2], [1.5, 2], [9, 1]]) expect(() => checkCounts(...counts as [number, number])).toThrow();
    expect(recommendations(Array.from({ length: 5 }, (_, id) => ({ id: String(id) })), [{ id: "a" }, { id: "b" }])).toHaveLength(3);
    expect(recommendations([], [{ id: "a" }])).toEqual([]);
  });
  it("blocks whole-poem, per-line avoid, art and contradictory guidance conflicts", () => {
    expect(() => preflight(1, 0, { ...defaultLocks, poem: true }, demoPoems[0].lines, defaultGuidance)).toThrow("whole poem");
    expect(() => preflight(0, 1, { ...defaultLocks, art: true }, [], defaultGuidance)).toThrow("artwork");
    expect(() => preflight(1, 0, { ...defaultLocks, lines: [true, false, false] }, demoPoems[0].lines, { ...defaultGuidance, avoid: "gray" })).toThrow("line 1");
    expect(() => preflight(1, 1, defaultLocks, [], { ...defaultGuidance, emphasize: "rain", avoid: "rain" })).toThrow("both");
  });
  it("demo examples stay fixed, preserve locked lines, and never use network calls", async () => {
    const network = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("must not call"));
    const result = await generatePoem({ feelings: ["tired"], intensity: 3, publicInspiration: "rain", guidance: { ...defaultGuidance, instruction: "rewrite everything" } }, 0, "demo", { ...defaultLocks, lines: [true, false, false] }, ["My own first line"]);
    expect(result.lines).toEqual(["My own first line", ...demoPoems[0].lines.slice(1)]);
    expect(result.model).toBe("fixed-demo-v1"); expect(network).not.toHaveBeenCalled(); network.mockRestore();
  });
  it("flags dictionary uncertainty without making a model meter authoritative", () => {
    expect(syllables(demoPoems[0].lines).map((l) => l.count)).toEqual([5, 7, 5]);
    expect(syllables(["quizzacious wonder", "a", "a"])[0].unknown).toContain("quizzacious");
  });
});
describe("approval and platform foundations", () => {
  it("canonicalizes PostgreSQL JSONB object key order while covering every field", () => {
    expect(manifestDigest({ a: 1, b: { z: 2, c: 3 } })).toBe(manifestDigest({ b: { c: 3, z: 2 }, a: 1 }));
    expect(manifestDigest({ caption: "a" })).not.toBe(manifestDigest({ caption: "b" }));
  });
  it("never blindly retries unknown acceptance or replays success, and enables no pretend connector", () => {
    expect(mayRetry("unknown")).toBe(false); expect(mayRetry("unknown", true)).toBe(true);
    expect(mayRetry("published")).toBe(false); expect(mayRetry("failed")).toBe(true);
    expect(activeSocialAdapters).toEqual([]);
  });
  it("requires exact same-origin POST origin, not an arbitrary Host header", () => {
    process.env.APP_ORIGIN = "http://localhost:3000";
    expect(() => verifyOrigin(new Request("http://localhost:3000", { headers: { origin: "https://evil.example" } }))).toThrow();
    expect(() => verifyOrigin(new Request("http://localhost:3000"))).toThrow();
    expect(() => verifyOrigin(new Request("http://localhost:3000", { headers: { origin: "http://localhost:3000", "sec-fetch-site": "same-origin" } }))).not.toThrow();
  });
  it("hashes passwords with salted memory-hard scrypt and rejects wrong credentials", async () => {
    const hash = await passwordHash("a long test-only passphrase");
    expect(hash).not.toContain("passphrase");
    expect(await verifyPassword("a long test-only passphrase", hash)).toBe(true);
    expect(await verifyPassword("incorrect", hash)).toBe(false);
  });
});
describe("calendar and deterministic actual PNGs", () => {
  it("uses the local date correctly through spring-forward and fall-back DST", () => {
    expect(localDay(new Date("2026-03-08T06:59:00Z"), "America/New_York")).toBe("2026-03-08");
    expect(localTime(new Date("2026-03-08T07:01:00Z"), "America/New_York")).toBe("03:01");
    expect(localDay(new Date("2026-11-01T05:30:00Z"), "America/New_York")).toBe(localDay(new Date("2026-11-01T06:30:00Z"), "America/New_York"));
    expect(localDay(new Date("2026-09-07T00:30:00Z"), "America/Los_Angeles")).toBe("2026-09-06");
  });
  it("escapes user text and renders both actual sizes with deterministic pixels and no model call", async () => {
    const network = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("must not call"));
    expect(escapeXml("<script>&'\"")).toBe("&lt;script&gt;&amp;&apos;&quot;");
    const source: ArtSource = { palette: "slate", seed: 123, medium: "rain window", warmth: 45, brightness: 65, negativeSpace: 65, composition: "open center" };
    expect(artworkSvg(source)).not.toContain("<script");
    const background = await renderArt(source);
    const lines = ["A <gray> morning", "Rain & sunlight", '"I" rest'];
    expect(compositionSvg(background, lines, defaultLayout, "square")).toContain("Rain &amp; sunlight");
    const square = await renderComposition(background, lines, defaultLayout, "square");
    const portrait = await renderComposition(background, lines, defaultLayout, "portrait");
    expect(await sharp(square).metadata()).toMatchObject({ width: 1080, height: 1080, format: "png" });
    expect(await sharp(portrait).metadata()).toMatchObject({ width: 1080, height: 1350 });
    expect(await renderComposition(background, lines, defaultLayout, "square")).toEqual(square);
    expect(await renderComposition(background, lines, { ...defaultLayout, position: "bottom" }, "square")).not.toEqual(square);
    expect(network).not.toHaveBeenCalled(); network.mockRestore();
  });
});
