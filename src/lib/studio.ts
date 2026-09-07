"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { DestinationState, EmotionalDirection, Prisma, RevisionStatus, VisualStyle } from "@prisma/client";
import { createSession, clearSession, isAuthenticated, verifyPassword } from "./auth";
import { canUseDatabase, prisma } from "./prisma";
import { generateBackgrounds, generateHaikus, type CheckInInput } from "./generation";
import { publishingCapabilities } from "./publishing";
import { enqueueUnique } from "./queue";

const userEmail = "studio@haikuandhue.local";
const defaultTypography = { family: "Georgia, serif", ink: "#2f2925", align: "center", scale: 1 } as const;

export async function signInAction(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  if (!verifyPassword(password)) redirect("/login?error=1");
  await createSession();
  redirect("/");
}

export async function signOutAction() {
  await clearSession();
  redirect("/login");
}

export async function ensureSeedData() {
  if (!(await canUseDatabase())) return;
  await prisma.user.upsert({ where: { email: userEmail }, update: {}, create: { email: userEmail, name: "Private Studio" } });
  await Promise.all(
    publishingCapabilities.map((capability) =>
      prisma.destination.upsert({
        where: { slug: capability.slug },
        update: {
          label: capability.label,
          state: capability.state.toUpperCase().replace("-", "_") as DestinationState,
          capabilities: capability as unknown as Prisma.InputJsonValue,
          note: capability.note
        },
        create: {
          slug: capability.slug,
          label: capability.label,
          state: capability.state.toUpperCase().replace("-", "_") as DestinationState,
          capabilities: capability as unknown as Prisma.InputJsonValue,
          note: capability.note
        }
      })
    )
  );
}

async function requireStudioUser() {
  if (!(await isAuthenticated())) redirect("/login");
  if (!(await canUseDatabase())) redirect("/?demo=database-required");
  await ensureSeedData();
  return prisma.user.findUniqueOrThrow({ where: { email: userEmail } });
}

async function requireOwnedRevision(revisionId: string) {
  const user = await requireStudioUser();
  const revision = await prisma.artworkRevision.findFirstOrThrow({
    where: { id: revisionId, checkIn: { userId: user.id } },
    include: { poem: true, background: true, deliveries: true }
  });
  return { user, revision };
}

export async function getStudioSnapshot() {
  if (!(await canUseDatabase())) return demoSnapshot();
  await ensureSeedData();
  const user = await prisma.user.findUniqueOrThrow({ where: { email: userEmail } });
  const [today, revisions, destinations] = await Promise.all([
    prisma.moodCheckIn.findFirst({ where: { userId: user.id, createdAt: { gte: startOfToday() } }, orderBy: { createdAt: "desc" }, include: { poems: true, backgrounds: true, revisions: { include: { poem: true, background: true, deliveries: { include: { destination: true } } }, orderBy: { revisionNumber: "asc" } } } }),
    prisma.artworkRevision.findMany({ where: { checkIn: { userId: user.id } }, include: { poem: true, background: true, deliveries: { include: { destination: true } } }, orderBy: { updatedAt: "desc" }, take: 12 }),
    prisma.destination.findMany({ orderBy: { label: "asc" } })
  ]);
  return { demoMode: false, today, revisions, destinations, reminder: !today };
}

export async function createCheckInAction(formData: FormData) {
  if (!(await canUseDatabase())) redirect("/?demo=database-required");
  const user = await requireStudioUser();
  const input = parseCheckIn(formData);
  const poems = generateHaikus(input);
  const backgrounds = generateBackgrounds(input);
  const checkIn = await prisma.moodCheckIn.create({
    data: {
      userId: user.id,
      feelings: input.feelings,
      intensity: input.intensity,
      inspiration: input.inspiration,
      visualStyle: input.visualStyle as VisualStyle,
      direction: input.direction as EmotionalDirection,
      poems: { create: poems },
      backgrounds: { create: backgrounds.map((background) => ({ ...background, palette: background.palette as unknown as Prisma.InputJsonValue, style: input.visualStyle as VisualStyle })) }
    },
    include: { poems: true, backgrounds: true }
  });
  for (let index = 0; index < checkIn.poems.length; index += 1) {
    const poem = checkIn.poems[index];
    const background = checkIn.backgrounds[index];
    if (!poem || !background) continue;
    await prisma.artworkRevision.create({
      data: {
        checkInId: checkIn.id,
        poemId: poem.id,
        backgroundId: background.id,
        revisionNumber: index + 1,
        immutableSnapshot: makeSnapshot(poem.lines, background.svgTemplate, defaultTypography, [], null),
        typography: defaultTypography,
        caption: poem.caption,
        altText: poem.altText
      }
    });
  }
  await enqueueUnique("daily-generation", { source: "check-in", demoMode: false }, checkIn.id);
  revalidatePath("/");
  redirect("/review");
}

export async function createMixedRevisionAction(formData: FormData) {
  const user = await requireStudioUser();
  const poemId = String(formData.get("poemId"));
  const backgroundId = String(formData.get("backgroundId"));
  const checkInId = String(formData.get("checkInId"));
  const [poem, background, , count] = await Promise.all([
    prisma.poem.findFirstOrThrow({ where: { id: poemId, checkInId } }),
    prisma.background.findFirstOrThrow({ where: { id: backgroundId, checkInId } }),
    prisma.moodCheckIn.findFirstOrThrow({ where: { id: checkInId, userId: user.id } }),
    prisma.artworkRevision.count({ where: { checkInId } })
  ]);
  await prisma.artworkRevision.create({
    data: {
      checkInId,
      poemId,
      backgroundId,
      revisionNumber: count + 1,
      immutableSnapshot: makeSnapshot(poem.lines, background.svgTemplate, defaultTypography, [], null),
      typography: defaultTypography,
      caption: poem.caption,
      altText: poem.altText
    }
  });
  revalidatePath("/review");
}

export async function updateRevisionAction(formData: FormData) {
  const revisionId = String(formData.get("revisionId"));
  const lines = ["line1", "line2", "line3"].map((field) => String(formData.get(field) ?? "").trim()).filter(Boolean);
  const caption = String(formData.get("caption") ?? "").trim();
  const altText = String(formData.get("altText") ?? "").trim();
  const ink = String(formData.get("ink") || "#2f2925");
  const typography = {
    family: String(formData.get("family") || "Georgia, serif").slice(0, 80),
    ink: /^#[0-9a-fA-F]{6}$/.test(ink) ? ink : "#2f2925",
    align: String(formData.get("align") || "center") === "left" ? "left" : "center",
    scale: Math.min(1.4, Math.max(0.7, Number(formData.get("scale") || 1)))
  };
  const { revision } = await requireOwnedRevision(revisionId);
  await prisma.artworkRevision.update({
    where: { id: revisionId },
    data: {
      status: RevisionStatus.DRAFT,
      approvedAt: null,
      approvalInvalidatedAt: revision.approvedAt ? new Date() : revision.approvalInvalidatedAt,
      immutableSnapshot: makeSnapshot(lines.length === 3 ? lines : revision.poem.lines, revision.background.svgTemplate, typography, [], null),
      typography: typography as Prisma.InputJsonValue,
      caption: caption || revision.caption,
      altText: altText || revision.altText,
      deliveries: { updateMany: { where: {}, data: { status: "CANCELLED", lastError: "Approval invalidated by edit." } } }
    }
  });
  revalidatePath("/review");
}

export async function approveRevisionAction(formData: FormData) {
  const revisionId = String(formData.get("revisionId"));
  const scheduledFor = new Date(String(formData.get("scheduledFor") || new Date(Date.now() + 60 * 60 * 1000).toISOString()));
  const destinationSlugs = formData.getAll("destinations").map(String);
  const { revision } = await requireOwnedRevision(revisionId);
  const destinations = await prisma.destination.findMany({ where: { slug: { in: destinationSlugs.length ? destinationSlugs : ["manual-export"] } } });
  await prisma.$transaction(async (tx) => {
    await tx.artworkRevision.update({
      where: { id: revisionId },
      data: {
        status: RevisionStatus.SCHEDULED,
        scheduledFor,
        approvedAt: new Date(),
        immutableSnapshot: makeSnapshot(revision.poem.lines, revision.background.svgTemplate, revision.typography, destinationSlugs, scheduledFor.toISOString())
      }
    });
    for (const destination of destinations) {
      await tx.destinationDelivery.upsert({
        where: { revisionId_destinationId: { revisionId, destinationId: destination.id } },
        update: { status: "SCHEDULED", scheduledFor, lastError: null },
        create: { revisionId, destinationId: destination.id, status: "SCHEDULED", scheduledFor, attemptToken: `${revisionId}:${destination.slug}:${scheduledFor.toISOString()}` }
      });
    }
  });
  await enqueueUnique("scheduled-publish", { destinations: destinationSlugs }, undefined, revisionId, scheduledFor);
  revalidatePath("/review");
  redirect("/almanac");
}

export async function rejectRevisionAction(formData: FormData) {
  const { revision } = await requireOwnedRevision(String(formData.get("revisionId")));
  await prisma.artworkRevision.update({ where: { id: revision.id }, data: { status: RevisionStatus.REJECTED } });
  revalidatePath("/review");
}

export async function cancelRevisionAction(formData: FormData) {
  const revisionId = String(formData.get("revisionId"));
  await requireOwnedRevision(revisionId);
  await prisma.artworkRevision.update({ where: { id: revisionId }, data: { status: RevisionStatus.CANCELLED, deliveries: { updateMany: { where: {}, data: { status: "CANCELLED" } } } } });
  await prisma.queueJob.updateMany({ where: { revisionId, status: "PENDING" }, data: { status: "CANCELLED" } });
  revalidatePath("/almanac");
}

function parseCheckIn(formData: FormData): CheckInInput {
  return {
    feelings: formData.getAll("feelings").map(String),
    intensity: Number(formData.get("intensity") || 5),
    inspiration: String(formData.get("inspiration") || "today's small weather").slice(0, 800),
    visualStyle: String(formData.get("visualStyle") || "PAPER_GARDEN") as CheckInInput["visualStyle"],
    direction: String(formData.get("direction") || "REFLECT") as CheckInInput["direction"]
  };
}

function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function makeSnapshot(lines: string[], backgroundSvg: string, typography: unknown, destinations: string[], scheduledFor: string | null): Prisma.InputJsonValue {
  return { lines, backgroundSvg, typography, destinations, scheduledFor, createdAt: new Date().toISOString() } as Prisma.InputJsonValue;
}

function demoSnapshot() {
  const input: CheckInInput = { feelings: ["calm", "curious"], intensity: 5, inspiration: "a quiet window garden", visualStyle: "PAPER_GARDEN", direction: "LIFT" };
  const poems = generateHaikus(input).map((poem, index) => ({ id: `demo-poem-${index}`, ...poem }));
  const backgrounds = generateBackgrounds(input).map((background, index) => ({ id: `demo-background-${index}`, style: input.visualStyle, ...background }));
  const revisions = poems.map((poem, index) => ({ id: `demo-revision-${index}`, revisionNumber: index + 1, status: "DRAFT", caption: poem.caption, altText: poem.altText, scheduledFor: null, poem, background: backgrounds[index], deliveries: [] }));
  return { demoMode: true, today: { id: "demo-check-in", feelings: input.feelings, intensity: input.intensity, inspiration: input.inspiration, visualStyle: input.visualStyle, direction: input.direction, poems, backgrounds, revisions }, revisions, destinations: publishingCapabilities.map((capability) => ({ id: capability.slug, slug: capability.slug, label: capability.label, state: capability.state.toUpperCase().replace("-", "_"), note: capability.note })), reminder: false };
}
