import { z } from "zod";

export const guidanceSchema = z.object({
  direction: z.enum(["reflect", "gently lift", "playfully contrast"]).default("reflect"),
  tone: z.string().max(120).default("quiet and observant"),
  abstraction: z.enum(["literal", "balanced", "abstract"]).default("balanced"),
  emphasize: z.string().max(240).default(""),
  avoid: z.string().max(240).default(""),
  medium: z.enum(["paper gradients", "rain window", "soft geometry"]).default("paper gradients"),
  palette: z.enum(["slate", "cream", "sage", "rose"]).default("slate"),
  warmth: z.number().int().min(0).max(100).default(45),
  brightness: z.number().int().min(20).max(90).default(65),
  subject: z.string().max(200).default(""),
  composition: z.enum(["open center", "open top", "open bottom"]).default("open center"),
  negativeSpace: z.number().int().min(30).max(90).default(65),
  variation: z.enum(["close", "explore"]).default("close"),
  instruction: z.string().max(600).default(""),
  meter: z.enum(["5-7-5", "free"]).default("5-7-5"),
});
export type Guidance = z.infer<typeof guidanceSchema>;
export const defaultGuidance = guidanceSchema.parse({});
export const locksSchema = z.object({
  poem: z.boolean().default(false),
  lines: z.tuple([z.boolean(), z.boolean(), z.boolean()]).default([false, false, false]),
  art: z.boolean().default(false),
  layout: z.boolean().default(false),
});
export type Locks = z.infer<typeof locksSchema>;
export const defaultLocks = locksSchema.parse({});
export const layoutSchema = z.object({
  font: z.enum(["serif", "sans"]).default("serif"),
  size: z.number().int().min(28).max(56).default(42),
  position: z.enum(["top", "center", "bottom"]).default("center"),
  align: z.enum(["left", "center"]).default("center"),
  contrast: z.enum(["ink", "paper"]).default("ink"),
  overlay: z.number().min(0).max(0.85).default(0.28),
  cropX: z.number().int().min(0).max(100).default(50),
  cropY: z.number().int().min(0).max(100).default(50),
});
export type Layout = z.infer<typeof layoutSchema>;
export const defaultLayout = layoutSchema.parse({});
export const linesSchema = z.tuple([
  z.string().trim().min(1).max(64), z.string().trim().min(1).max(64), z.string().trim().min(1).max(64),
]).refine((lines) => lines.every((line) => !/[\n\r\u0000-\u001f]/.test(line)), "Use exactly three single lines");
export class DomainError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export function assert(condition: unknown, message: string, status = 400): asserts condition {
  if (!condition) throw new DomainError(message, status);
}
export function localDay(now: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  return ["year", "month", "day"].map((p) => parts.find((x) => x.type === p)!.value).join("-");
}
export function localTime(now: Date, timezone: string) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(now);
}
export const timezoneSchema = z.string().max(80).refine((s) => {
  try { new Intl.DateTimeFormat("en", { timeZone: s }); return true; } catch { return false; }
}, "Use an IANA timezone, such as Europe/London");
export const clockSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
export function checkCounts(haikus: number, artworks: number, maxHaikus = 8, maxArtworks = 8) {
  assert(Number.isInteger(haikus) && Number.isInteger(artworks) && haikus >= 0 && artworks >= 0, "Counts must be non-negative whole numbers.");
  assert(haikus + artworks > 0, "Choose at least one new haiku or artwork. 0 + 0 makes nothing.");
  assert(haikus <= maxHaikus && artworks <= maxArtworks, `Batch limit: ${maxHaikus} haikus and ${maxArtworks} artworks. Nothing was generated.`);
}
export function preflight(haikus: number, artworks: number, locks: Locks, lines: string[], guidance: Guidance) {
  assert(!(haikus && locks.poem), "The whole poem is locked. Unlock it or request 0 haikus.");
  assert(!(artworks && locks.art), "The artwork is locked. Unlock it or request 0 artworks.");
  const avoided = guidance.avoid.toLowerCase().split(/[,;\n]/).map((s) => s.trim()).filter(Boolean);
  const emphasized = guidance.emphasize.toLowerCase().split(/[,;\n]/).map((s) => s.trim()).filter(Boolean);
  assert(!avoided.some((word) => emphasized.includes(word)), "A word/theme is both emphasized and avoided. Resolve this conflict.");
  if (haikus) for (let i = 0; i < 3; i++) {
    assert(!(locks.lines[i] && avoided.some((word) => (lines[i] ?? "").toLowerCase().includes(word))), `Locked line ${i + 1} conflicts with avoided guidance.`);
  }
}
// A deliberately small pronunciation lexicon. Unknown words are flagged, never guessed as authoritative.
const lexicon: Record<string, number> = Object.fromEntries([
  ["a an the i my by on in at of off and through where with to cold tea sill clouds drift pale gray dawn hands rest last rain beads leaves small bird shakes night warm light finds green shoots split hard ground start stand waits taps glass let world slow enough can be just not yet room for", 1],
  ["morning softly little quiet leaving brighter window hopeful permission", 2],
].flatMap(([words, count]) => String(words).split(" ").map((word) => [word, Number(count)])));
export function syllables(lines: string[]) {
  return lines.map((line, i) => {
    const words = line.toLowerCase().match(/[a-z]+(?:'[a-z]+)?/g) ?? [];
    const unknown = words.filter((word) => lexicon[word] === undefined);
    const count = words.reduce((sum, word) => sum + (lexicon[word] ?? 0), 0);
    return { count, unknown, expected: [5, 7, 5][i], valid: !unknown.length && count === [5, 7, 5][i] };
  });
}
export function recommendations(poems: { id: string }[], arts: { id: string }[]) {
  if (!poems.length || !arts.length) return [];
  return Array.from({ length: Math.min(3, Math.max(poems.length, arts.length)) }, (_, i) => ({
    poemId: poems[i % poems.length].id, artId: arts[i % arts.length].id,
  }));
}
export const demoPoems = [
  { lines: ["A gray morning waits", "Rain taps softly on the glass", "I let the world slow"], caption: "Today, enough can be quiet." },
  { lines: ["Cold tea by the sill", "Clouds drift through the pale gray dawn", "My hands rest at last"], caption: "Leaving a little room for rest." },
  { lines: ["Rain beads on the leaves", "A small bird shakes off the night", "Warm light finds my hands"], caption: "Not a brighter day yet. Just a little warmth." },
  { lines: ["Light spills through the leaves", "Small green shoots split the hard ground", "I start where I stand"], caption: "A small beginning is still a beginning." },
];
export type Destination = "manual";
export type Manifest = {
  version: 1; candidateId: string; entryId: string;
  assets: { square: { id: string; hash: string }; portrait: { id: string; hash: string } };
  caption: string; alt: string; destination: "manual"; account: "Personal download";
  visibility: "private handoff"; interactions: "not applicable";
  scheduledAt: string; timezone: string; expiresAt: string;
  retryPolicy: "manual download only; never social publish";
};
