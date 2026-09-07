import { Prisma, type PrismaClient } from "@prisma/client";
import { z } from "zod";
import { db } from "./db";
import {
  assert, checkCounts, clockSchema, defaultGuidance, defaultLocks, guidanceSchema,
  layoutSchema, linesSchema, localDay, localTime, locksSchema, preflight, syllables, timezoneSchema, type Manifest,
} from "./domain";
import { deleteStoredAsset, manifestDigest, ownedAsset, readAsset, saveAsset } from "./media";
import { renderComposition } from "./render";
import type { Brief } from "./providers";

const json = (value: unknown) => value as Prisma.InputJsonValue;
export async function ownerTransaction<T>(ownerId: string, operation: (tx: Prisma.TransactionClient) => Promise<T>, client: PrismaClient = db) {
  return client.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${ownerId}))`;
    return operation(tx);
  }, { timeout: 15_000 });
}
export async function ensureDefaults(ownerId: string) {
  return db.creativeDefaults.upsert({ where: { ownerId }, update: {}, create: { ownerId, guidance: json(defaultGuidance) } });
}
const entrySchema = z.object({
  feelings: z.array(z.string().trim().min(1).max(40)).min(1).max(8),
  intensity: z.number().int().min(1).max(10).nullable(),
  privateNotes: z.string().max(5000), publicInspiration: z.string().max(1000),
  permissionToUse: z.boolean(), guidance: guidanceSchema,
});
export async function saveEntry(ownerId: string, raw: unknown) {
  const input = entrySchema.parse(raw);
  const defaults = await ensureDefaults(ownerId);
  const date = localDay(new Date(), defaults.timezone);
  return ownerTransaction(ownerId, async (tx) => {
    const entry = await tx.dailyEntry.upsert({
      where: { ownerId_localDate: { ownerId, localDate: date } },
      create: { ...input, ownerId, localDate: date, timezone: defaults.timezone, guidance: json(input.guidance) },
      update: { ...input, inputProvided: true, guidance: json(input.guidance) },
    });
    await tx.auditEvent.create({ data: { ownerId, action: "checkin.saved", targetId: entry.id } });
    return entry;
  });
}
export const settingsSchema = z.object({
  timezone: timezoneSchema, haikuCount: z.number().int().min(0).max(8), artCount: z.number().int().min(0).max(8),
  guidance: guidanceSchema, dailyBudgetCents: z.number().int().min(0).max(10000),
  localOnly: z.boolean(), publishingPaused: z.boolean(),
  remindersEnabled: z.boolean(), generationEnabled: z.boolean(), neutralOptIn: z.boolean(),
  reminderTime: clockSchema, generationTime: clockSchema, cutoffTime: clockSchema,
}).refine((s) => s.generationTime < s.cutoffTime && s.reminderTime < s.cutoffTime, "Reminder and generation times must be before the draft cutoff.")
  .refine((s) => !s.generationEnabled || s.haikuCount + s.artCount > 0, "Scheduled generation needs at least one output.");
export async function saveDefaults(ownerId: string, raw: unknown) {
  const input = settingsSchema.parse(raw);
  return ownerTransaction(ownerId, async (tx) => {
    const result = await tx.creativeDefaults.upsert({
      where: { ownerId }, create: { ownerId, ...input, guidance: json(input.guidance) }, update: { ...input, guidance: json(input.guidance) },
    });
    await tx.auditEvent.create({ data: { ownerId, action: "defaults.saved" } });
    return result;
  });
}
export const generationSchema = z.object({
  entryId: z.string(), haikuCount: z.number(), artCount: z.number(),
  guidance: guidanceSchema, scope: z.enum(["next batch", "this poem", "this art"]),
  clientKey: z.string().min(8).max(100),
});
export async function requestGeneration(ownerId: string, raw: unknown, client: PrismaClient = db, now = new Date()) {
  const input = generationSchema.parse(raw);
  checkCounts(input.haikuCount, input.artCount, Number(process.env.MAX_HAIKUS ?? 8), Number(process.env.MAX_ARTWORKS ?? 8));
  assert(input.scope !== "this poem" || input.artCount === 0, "This poem scope requires 0 artworks.");
  assert(input.scope !== "this art" || input.haikuCount === 0, "This art scope requires 0 haikus.");
  return ownerTransaction(ownerId, async (tx) => {
    const existing = await tx.generationRequest.findUnique({ where: { ownerId_clientKey: { ownerId, clientKey: input.clientKey } } });
    if (existing) return existing;
    const defaults = await tx.creativeDefaults.findUnique({ where: { ownerId } });
    assert(defaults, "Save your defaults first.");
    assert(localTime(now, defaults.timezone) < defaults.cutoffTime, "Today's draft cutoff has passed. Existing alternatives remain available.");
    // The generation process intentionally cannot SELECT privateNotes at the database level.
    const entry = await tx.dailyEntry.findFirst({
      where: { id: input.entryId, ownerId },
      select: { id: true, localDate: true, feelings: true, intensity: true, publicInspiration: true, permissionToUse: true, selectedCandidateId: true, archivedAt: true },
    });
    assert(entry && !entry.archivedAt, "Today's entry was not found.", 404);
    assert(entry.localDate === localDay(now, defaults.timezone), "Generation is only available for today's input. No yesterday mood or missed backlog.");
    const selected = entry.selectedCandidateId ? await tx.candidateRevision.findFirst({ where: { id: entry.selectedCandidateId, ownerId, entryId: entry.id } }) : null;
    if (input.scope !== "next batch") assert(selected, "Choose a composition before scoped regeneration.");
    const locks = locksSchema.parse(selected?.locks ?? defaultLocks);
    preflight(input.haikuCount, input.artCount, locks, selected?.lines ?? [], input.guidance);
    const provider = defaults.localOnly || process.env.TEXT_PROVIDER !== "live" ? "demo" : "live";
    if (provider === "live") assert(process.env.TEXT_API_KEY && process.env.TEXT_API_URL && process.env.TEXT_API_ALLOWED_HOST && process.env.TEXT_MODEL, "Live provider is not configured. Choose local-only mode.");
    const estimateCents = provider === "live" ? input.haikuCount * Number(process.env.TEXT_COST_CENTS ?? 2) : 0;
    assert(Number.isFinite(estimateCents) && estimateCents >= 0, "Provider cost is not configured correctly.");
    const daily = await tx.generationRequest.aggregate({ where: { ownerId, localDate: entry.localDate }, _sum: { estimateCents: true } });
    assert((daily._sum.estimateCents ?? 0) + estimateCents <= defaults.dailyBudgetCents, "This batch exceeds your daily budget. Nothing was queued.");
    const recent = await tx.generationRequest.count({ where: { ownerId, createdAt: { gte: new Date(now.getTime() - 60_000) } } });
    assert(recent < 6, "Please wait a minute before creating more batches.", 429);
    const brief: Brief = { feelings: entry.feelings, intensity: entry.intensity, publicInspiration: entry.permissionToUse ? entry.publicInspiration : "", guidance: input.guidance };
    const request = await tx.generationRequest.create({ data: {
      ownerId, entryId: entry.id, clientKey: input.clientKey, haikuCount: input.haikuCount, artCount: input.artCount,
      guidance: json(input.guidance), brief: json(brief), locks: json(locks), scope: input.scope, provider, estimateCents,
      sourcePoemId: selected?.poemId, sourceArtId: selected?.artId, localDate: entry.localDate, expiresAt: new Date(now.getTime() + 86400_000),
    } });
    await tx.generationOutput.createMany({ data: [
      ...Array.from({ length: input.haikuCount }, (_, ordinal) => ({ ownerId, requestId: request.id, kind: "haiku", ordinal })),
      ...Array.from({ length: input.artCount }, (_, ordinal) => ({ ownerId, requestId: request.id, kind: "art", ordinal })),
    ] });
    await tx.auditEvent.create({ data: { ownerId, action: "generation.requested", targetId: request.id } });
    return request;
  }, client);
}
const candidateSchema = z.object({
  entryId: z.string(), expectedCandidateId: z.string().nullable(),
  poemId: z.string(), artId: z.string(), lines: linesSchema,
  caption: z.string().max(2200), alt: z.string().min(1).max(2000),
  layout: layoutSchema, locks: locksSchema, meterOverride: z.boolean(),
});
async function invalidate(tx: Prisma.TransactionClient, ownerId: string, entryId: string) {
  await tx.approval.updateMany({ where: { ownerId, entryId, cancelledAt: null }, data: { cancelledAt: new Date() } });
  await tx.publication.updateMany({
    where: { ownerId, approvalId: { in: (await tx.approval.findMany({ where: { ownerId, entryId }, select: { id: true } })).map((a) => a.id) }, state: "approved" },
    data: { state: "cancelled", result: "Composition changed; review and approve the new revision." },
  });
}
export async function saveCandidate(ownerId: string, raw: unknown) {
  const input = candidateSchema.parse(raw);
  return ownerTransaction(ownerId, async (tx) => {
    const entry = await tx.dailyEntry.findFirst({ where: { id: input.entryId, ownerId } });
    assert(entry, "Entry not found.", 404);
    assert(entry.selectedCandidateId === input.expectedCandidateId, "The composition changed in another tab. Reload before saving.", 409);
    const poem = await tx.haikuRevision.findFirst({ where: { id: input.poemId, entryId: entry.id, ownerId } });
    const art = await tx.artworkRevision.findFirst({ where: { id: input.artId, entryId: entry.id, ownerId } });
    assert(poem && art, "Choose an owned haiku and artwork from this entry.", 404);
    const previous = entry.selectedCandidateId ? await tx.candidateRevision.findFirst({ where: { id: entry.selectedCandidateId, ownerId } }) : null;
    if (previous) {
      const locks = locksSchema.parse(previous.locks);
      assert(!locks.poem || JSON.stringify(previous.lines) === JSON.stringify(input.lines), "The poem is locked. Save an unlocked revision first.");
      for (let i = 0; i < 3; i++) assert(!locks.lines[i] || previous.lines[i] === input.lines[i], `Line ${i + 1} is locked. Save an unlocked revision first.`);
      assert(!locks.art || previous.artId === input.artId, "Artwork is locked. Save an unlocked revision first.");
      assert(!locks.layout || JSON.stringify(layoutSchema.parse(previous.layout)) === JSON.stringify(input.layout), "Layout is locked. Save an unlocked revision first.");
    }
    let poemId = poem.id;
    if (JSON.stringify(input.lines) !== JSON.stringify(poem.lines)) {
      poemId = (await tx.haikuRevision.create({ data: { ownerId, entryId: entry.id, parentId: poem.id, lines: input.lines, caption: input.caption, metadata: { provider: "manual", promptVersion: "none" } } })).id;
    }
    const candidate = await tx.candidateRevision.create({ data: {
      ownerId, entryId: entry.id, parentId: previous?.id, poemId, artId: art.id,
      lines: input.lines, caption: input.caption, alt: input.alt, layout: json(input.layout), locks: json(input.locks), meterOverride: input.meterOverride,
    } });
    const history = [...entry.history.slice(0, entry.historyIndex + 1), candidate.id];
    await tx.dailyEntry.update({ where: { id: entry.id }, data: { selectedCandidateId: candidate.id, history, historyIndex: history.length - 1 } });
    await invalidate(tx, ownerId, entry.id);
    await tx.auditEvent.create({ data: { ownerId, action: "composition.saved", targetId: candidate.id } });
    return candidate;
  });
}
export async function moveHistory(ownerId: string, entryId: string, delta: number) {
  assert(delta === -1 || delta === 1, "Choose undo or redo.");
  return ownerTransaction(ownerId, async (tx) => {
    const entry = await tx.dailyEntry.findFirst({ where: { id: entryId, ownerId } });
    assert(entry, "Entry not found.", 404);
    const index = entry.historyIndex + delta;
    assert(index >= 0 && index < entry.history.length, "No revision in that direction.");
    const candidate = await tx.candidateRevision.findFirst({ where: { id: entry.history[index], ownerId, entryId } });
    assert(candidate, "Revision not found.", 404);
    await tx.dailyEntry.update({ where: { id: entry.id }, data: { historyIndex: index, selectedCandidateId: candidate.id } });
    await invalidate(tx, ownerId, entryId);
    return candidate;
  });
}
export async function prepareReview(ownerId: string, raw: unknown) {
  const input = z.object({ candidateId: z.string(), scheduledAt: z.string().datetime({ offset: true }), expiryHours: z.number().int().min(1).max(168) }).parse(raw);
  const candidate = await db.candidateRevision.findFirst({ where: { id: input.candidateId, ownerId } });
  assert(candidate, "Composition not found.", 404);
  const defaults = await ensureDefaults(ownerId);
  const entry = await db.dailyEntry.findFirst({ where: { id: candidate.entryId, ownerId } });
  assert(entry?.selectedCandidateId === candidate.id, "Review the currently selected revision.", 409);
  const guidance = guidanceSchema.parse(entry.guidance);
  assert(guidance.meter === "free" || candidate.meterOverride || syllables(candidate.lines).every((line) => line.valid), "Meter needs attention. Explicitly accept a free/uncertain meter in the composer, then save.");
  assert(candidate.lines.every((line) => candidate.alt.includes(line)), "Alt text must include all three poem lines.");
  assert(candidate.lines.every((line) => candidate.caption.includes(line)), "Caption must include all three poem lines.");
  const scheduledAt = new Date(input.scheduledAt);
  assert(scheduledAt.getTime() >= Date.now() - 120_000 && scheduledAt.getTime() <= Date.now() + 30 * 86400_000, "Choose a release time from now through the next 30 days.");
  const art = await db.artworkRevision.findFirst({ where: { id: candidate.artId, ownerId } });
  assert(art, "Artwork not found.", 404);
  const background = await readAsset(await ownedAsset(ownerId, art.assetId));
  const layout = layoutSchema.parse(candidate.layout);
  const [squareBuffer, portraitBuffer] = await Promise.all([
    renderComposition(background, candidate.lines, layout, "square"), renderComposition(background, candidate.lines, layout, "portrait"),
  ]);
  const storedKeys: string[] = [];
  try {
    return await ownerTransaction(ownerId, async (tx) => {
      const current = await tx.dailyEntry.findFirst({ where: { id: candidate.entryId, ownerId } });
      assert(current?.selectedCandidateId === candidate.id, "The composition changed while rendering. Prepare a fresh review.", 409);
      const square = await saveAsset(ownerId, squareBuffer, 1080, 1080, `Final composition ${candidate.id}`, tx);
      storedKeys.push(square.key);
      const portrait = await saveAsset(ownerId, portraitBuffer, 1080, 1350, `Final composition ${candidate.id}`, tx);
      storedKeys.push(portrait.key);
      const manifest: Manifest = {
        version: 1, candidateId: candidate.id, entryId: candidate.entryId,
        assets: { square: { id: square.id, hash: square.sha256 }, portrait: { id: portrait.id, hash: portrait.sha256 } },
        caption: candidate.caption, alt: candidate.alt, destination: "manual", account: "Personal download",
        visibility: "private handoff", interactions: "not applicable", scheduledAt: scheduledAt.toISOString(), timezone: defaults.timezone,
        expiresAt: new Date(scheduledAt.getTime() + input.expiryHours * 3600_000).toISOString(),
        retryPolicy: "manual download only; never social publish",
      };
      return tx.renderReview.create({ data: { ownerId, entryId: candidate.entryId, candidateId: candidate.id, manifest: json(manifest), digest: manifestDigest(manifest) } });
    });
  } catch (error) {
    await Promise.all(storedKeys.map(deleteStoredAsset));
    throw error;
  }
}
export async function approveExport(ownerId: string, reviewId: string, expectedDigest: string) {
  return ownerTransaction(ownerId, async (tx) => {
    const review = await tx.renderReview.findFirst({ where: { id: reviewId, ownerId } });
    assert(review && review.digest === expectedDigest && manifestDigest(review.manifest) === expectedDigest, "The review manifest changed. Prepare a new review.", 409);
    const manifest = review.manifest as unknown as Manifest;
    const entry = await tx.dailyEntry.findFirst({ where: { id: review.entryId, ownerId } });
    const defaults = await tx.creativeDefaults.findUnique({ where: { ownerId } });
    assert(!defaults?.publishingPaused, "Global export/publishing pause is on.");
    assert(entry?.selectedCandidateId === review.candidateId, "This is no longer the selected revision.", 409);
    assert(new Date(manifest.expiresAt) > new Date(), "This review has expired.");
    for (const value of Object.values(manifest.assets)) {
      const asset = await tx.asset.findFirst({ where: { id: value.id, ownerId, sha256: value.hash } });
      assert(asset, "Final asset identity mismatch.", 409);
      await readAsset(asset);
    }
    const existing = await tx.approval.findUnique({ where: { reviewId } });
    if (existing) {
      assert(!existing.cancelledAt, "This approval was cancelled. Prepare a new review.");
      return existing;
    }
    const approval = await tx.approval.create({ data: {
      ownerId, entryId: review.entryId, candidateId: review.candidateId, reviewId,
      manifest: review.manifest as Prisma.InputJsonValue, digest: review.digest, actorId: ownerId, expiresAt: new Date(manifest.expiresAt),
    } });
    await tx.publication.create({ data: {
      ownerId, approvalId: approval.id, destination: manifest.destination, account: manifest.account, scheduledAt: new Date(manifest.scheduledAt),
    } });
    await tx.auditEvent.create({ data: { ownerId, action: "export.approved", targetId: approval.id } });
    return approval;
  });
}
export async function cancelApproval(ownerId: string, approvalId: string) {
  return ownerTransaction(ownerId, async (tx) => {
    const approval = await tx.approval.findFirst({ where: { id: approvalId, ownerId } });
    assert(approval, "Approval not found.", 404);
    await tx.approval.update({ where: { id: approval.id }, data: { cancelledAt: new Date() } });
    await tx.publication.updateMany({ where: { ownerId, approvalId, state: "approved" }, data: { state: "cancelled", result: "Cancelled before release." } });
    await tx.auditEvent.create({ data: { ownerId, action: "approval.cancelled", targetId: approvalId } });
  });
}
async function validateRelease(tx: Prisma.TransactionClient, ownerId: string, publicationId: string, now: Date) {
  const publication = await tx.publication.findFirst({ where: { id: publicationId, ownerId } });
  assert(publication, "Export not found.", 404);
  const approval = await tx.approval.findFirst({ where: { id: publication.approvalId, ownerId } });
  assert(approval && approval.actorId === ownerId && !approval.cancelledAt, "Approval is cancelled or invalid.", 409);
  const defaults = await tx.creativeDefaults.findUnique({ where: { ownerId } });
  assert(!defaults?.publishingPaused, "Global export/publishing pause is on.");
  assert(approval.expiresAt > now, "Approval expired. Review again.", 409);
  assert(publication.scheduledAt <= now, "The approved release window has not started.");
  const entry = await tx.dailyEntry.findFirst({ where: { id: approval.entryId, ownerId } });
  assert(entry?.selectedCandidateId === approval.candidateId, "The composition changed. Review again.", 409);
  const manifest = approval.manifest as unknown as Manifest;
  assert(manifestDigest(manifest) === approval.digest && manifest.destination === "manual" && publication.destination === "manual" && publication.account === manifest.account, "Manifest integrity check failed.", 409);
  for (const value of Object.values(manifest.assets)) {
    const asset = await tx.asset.findFirst({ where: { id: value.id, ownerId, sha256: value.hash } });
    assert(asset, "Final asset identity mismatch.", 409);
    await readAsset(asset);
  }
  return { publication, approval, manifest };
}
export async function releaseExport(ownerId: string, publicationId: string, now = new Date()) {
  return ownerTransaction(ownerId, async (tx) => {
    const { publication } = await validateRelease(tx, ownerId, publicationId, now);
    if (publication.state === "exported" || publication.state === "manual-handoff") return publication;
    assert(publication.state === "approved", "This export cannot be released.", 409);
    const changed = await tx.publication.updateMany({ where: { id: publication.id, ownerId, state: "approved" }, data: {
      state: "exported", attempts: { increment: 1 }, submittedAt: now, result: "Approved files released for private download. Not published to any social network.",
    } });
    assert(changed.count === 1, "Export was already released.", 409);
    await tx.auditEvent.create({ data: { ownerId, action: "export.released", targetId: publication.id } });
    return tx.publication.findUniqueOrThrow({ where: { id: publication.id } });
  });
}
export async function downloadAsset(ownerId: string, publicationId: string, format: "square" | "portrait") {
  return ownerTransaction(ownerId, async (tx) => {
    const { publication, manifest } = await validateRelease(tx, ownerId, publicationId, new Date());
    assert(["exported", "manual-handoff"].includes(publication.state), "Explicitly release the approved export first.", 409);
    const asset = await tx.asset.findFirstOrThrow({ where: { id: manifest.assets[format].id, ownerId } });
    return readAsset(asset);
  });
}
export async function markHandoff(ownerId: string, publicationId: string) {
  return ownerTransaction(ownerId, async (tx) => {
    const { publication } = await validateRelease(tx, ownerId, publicationId, new Date());
    assert(publication.state === "exported" || publication.state === "manual-handoff", "Release the download first.");
    return tx.publication.update({ where: { id: publication.id }, data: { state: "manual-handoff", result: "Owner marked manual handoff. Social publication is unverified." } });
  });
}
export async function snapshot(ownerId: string, requestedEntryId?: string) {
  const defaults = await ensureDefaults(ownerId);
  const today = localDay(new Date(), defaults.timezone);
  const entry = await db.dailyEntry.findFirst({ where: { ownerId, ...(requestedEntryId ? { id: requestedEntryId } : { localDate: today }) } });
  if (requestedEntryId) assert(entry, "Entry not found.", 404);
  const where = { ownerId, entryId: entry?.id ?? "none" };
  const [poems, artworks, candidates, requests, reviews, approvals, publications, entries, notifications, outputs, audit] = await Promise.all([
    db.haikuRevision.findMany({ where, orderBy: { createdAt: "asc" } }),
    db.artworkRevision.findMany({ where, orderBy: { createdAt: "asc" } }),
    db.candidateRevision.findMany({ where, orderBy: { createdAt: "asc" } }),
    db.generationRequest.findMany({ where, orderBy: { createdAt: "desc" } }),
    db.renderReview.findMany({ where, orderBy: { createdAt: "desc" }, take: 10 }),
    db.approval.findMany({ where, orderBy: { approvedAt: "desc" } }),
    db.publication.findMany({ where: { ownerId }, orderBy: { updatedAt: "desc" }, take: 100 }),
    db.dailyEntry.findMany({ where: { ownerId }, select: { id: true, localDate: true, feelings: true, selectedCandidateId: true, archivedAt: true }, orderBy: { localDate: "desc" }, take: 100 }),
    db.notification.findMany({ where: { ownerId }, orderBy: { createdAt: "desc" }, take: 7 }),
    db.generationOutput.findMany({ where: { ownerId }, orderBy: { updatedAt: "desc" }, take: 200 }),
    db.auditEvent.findMany({ where: { ownerId }, orderBy: { createdAt: "desc" }, take: 20 }),
  ]);
  const spent = await db.generationRequest.aggregate({ where: { ownerId, localDate: today }, _sum: { estimateCents: true } });
  return {
    defaults, today, entry, poems, artworks, candidates, requests, reviews, approvals, publications, entries, notifications, outputs, audit,
    limits: { haikus: Number(process.env.MAX_HAIKUS ?? 8), artworks: Number(process.env.MAX_ARTWORKS ?? 8) },
    provider: defaults.localOnly || process.env.TEXT_PROVIDER !== "live" ? "demo" : "live",
    textCostCents: Number(process.env.TEXT_COST_CENTS ?? 2), reservedCents: spent._sum.estimateCents ?? 0,
  };
}
