import { db } from "../src/lib/db";
import { defaultGuidance, demoPoems, localDay } from "../src/lib/domain";
import { ensureDefaults } from "../src/lib/studio";
import { renderArt, type ArtSource } from "../src/lib/render";
import { saveAsset } from "../src/lib/media";

async function main() {
  const user = await db.user.findFirst();
  if (!user) throw new Error("Create the owner first.");
  const settings = await ensureDefaults(user.id);
  const date = localDay(new Date(), settings.timezone);
  if (await db.dailyEntry.findUnique({ where: { ownerId_localDate: { ownerId: user.id, localDate: date } } })) {
    console.info("Today's entry already exists. Demo seed does not overwrite it."); return;
  }
  const entry = await db.dailyEntry.create({ data: {
    ownerId: user.id, localDate: date, timezone: settings.timezone, feelings: ["reflective", "tired", "quietly hopeful"], intensity: 4,
    privateNotes: "Rain at my window, cold tea, and permission to slow down.",
    publicInspiration: "Rain, a window, and a slow morning.", permissionToUse: true, guidance: defaultGuidance,
  } });
  for (let i = 0; i < demoPoems.length; i++) {
    await db.haikuRevision.create({ data: { ownerId: user.id, entryId: entry.id, ...demoPoems[i], metadata: { provider: "demo", model: "fixed-demo-v1", fixedExample: true } } });
    const source: ArtSource = { palette: (["slate", "cream", "sage", "sage"] as const)[i], seed: 17 + i * 103, medium: i === 0 ? "rain window" : "paper gradients", warmth: i > 1 ? 75 : 35, brightness: 65, negativeSpace: 65, composition: "open center" };
    const asset = await saveAsset(user.id, await renderArt(source), 1080, 1350, "Explicit demo seed: procedural artwork");
    await db.artworkRevision.create({ data: { ownerId: user.id, entryId: entry.id, assetId: asset.id, source, provenance: "Procedural demo; not a photograph or AI painting." } });
  }
  console.info("Fixed demo examples saved. Nothing selected, approved, or published.");
}
main().catch((e: Error) => { console.error(e.message); process.exitCode = 1; }).finally(() => db.$disconnect());
