import { DestinationState, EmotionalDirection, PrismaClient, RevisionStatus, VisualStyle } from "@prisma/client";
import { generateBackgrounds, generateHaikus } from "../src/lib/generation";
import { publishingCapabilities, toDestinationState } from "../src/lib/publishing";

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.upsert({ where: { email: "studio@haikuandhue.local" }, update: {}, create: { email: "studio@haikuandhue.local", name: "Private Studio" } });
  for (const capability of publishingCapabilities) {
    await prisma.destination.upsert({
      where: { slug: capability.slug },
      update: { label: capability.label, state: toDestinationState(capability.state) as DestinationState, capabilities: capability, note: capability.note },
      create: { slug: capability.slug, label: capability.label, state: toDestinationState(capability.state) as DestinationState, capabilities: capability, note: capability.note }
    });
  }
  const input = { feelings: ["calm", "hopeful"], intensity: 6, inspiration: "seeded moonlight on paper", visualStyle: "PAPER_GARDEN" as const, direction: "LIFT" as const };
  const existing = await prisma.moodCheckIn.findFirst({ where: { userId: user.id, inspiration: input.inspiration } });
  if (!existing) {
    const poems = generateHaikus(input);
    const backgrounds = generateBackgrounds(input);
    const checkIn = await prisma.moodCheckIn.create({
      data: {
        userId: user.id,
        feelings: input.feelings,
        intensity: input.intensity,
        inspiration: input.inspiration,
        visualStyle: VisualStyle.PAPER_GARDEN,
        direction: EmotionalDirection.LIFT,
        poems: { create: poems },
        backgrounds: { create: backgrounds.map((background) => ({ ...background, palette: background.palette, style: VisualStyle.PAPER_GARDEN })) }
      },
      include: { poems: true, backgrounds: true }
    });
    await prisma.artworkRevision.create({
      data: {
        checkInId: checkIn.id,
        poemId: checkIn.poems[0].id,
        backgroundId: checkIn.backgrounds[0].id,
        revisionNumber: 1,
        status: RevisionStatus.DRAFT,
        typography: { family: "Georgia, serif", ink: "#2f2925", align: "center", scale: 1 },
        immutableSnapshot: { lines: checkIn.poems[0].lines, backgroundSvg: checkIn.backgrounds[0].svgTemplate, createdAt: new Date().toISOString() },
        caption: checkIn.poems[0].caption,
        altText: checkIn.poems[0].altText
      }
    });
  }
}

main().finally(async () => prisma.$disconnect());
