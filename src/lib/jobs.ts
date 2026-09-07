import type { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { PgBoss } from "pg-boss";
import { db } from "./db";
import { defaultGuidance, guidanceSchema, localDay, localTime, locksSchema, syllables } from "./domain";
import { AmbiguousProviderError, generatePoem, type Brief } from "./providers";
import { renderArt, type ArtSource } from "./render";
import { saveAsset } from "./media";
import { requestGeneration } from "./studio";

export const OUTPUT_QUEUE = "creative-output";
export const DAILY_QUEUE = "daily-check";
export async function processOutput(outputId: string, client: PrismaClient = db, now = new Date()) {
  const output = await client.generationOutput.findUnique({ where: { id: outputId } });
  if (!output || output.state !== "pending") return;
  const request = await client.generationRequest.findFirst({ where: { id: output.requestId, ownerId: output.ownerId } });
  if (!request) return;
  const defaults = await client.creativeDefaults.findUnique({ where: { ownerId: output.ownerId } });
  if (!defaults || request.expiresAt < now || request.localDate !== localDay(now, defaults.timezone) || localTime(now, defaults.timezone) >= defaults.cutoffTime) {
    await client.generationOutput.updateMany({ where: { id: outputId, state: "pending" }, data: { state: "expired", error: "Today's draft window closed. No backlog generation." } });
    return;
  }
  const claim = await client.generationOutput.updateMany({
    where: { id: outputId, ownerId: output.ownerId, state: "pending" },
    data: { state: "running", attempts: { increment: 1 }, startedAt: now },
  });
  if (claim.count !== 1) return;
  if (request.provider === "live" && defaults.localOnly) {
    await client.generationOutput.update({ where: { id: outputId }, data: { state: "failed", error: "Remote generation blocked by your current local-only setting." } });
    return;
  }
  try {
    const guidance = guidanceSchema.parse(request.guidance);
    const locks = locksSchema.parse(request.locks);
    let revisionId: string;
    if (output.kind === "haiku") {
      const source = request.sourcePoemId ? await client.haikuRevision.findFirst({ where: { id: request.sourcePoemId, ownerId: output.ownerId } }) : null;
      const result = await generatePoem(request.brief as unknown as Brief, output.ordinal, request.provider, locks, source?.lines ?? []);
      const recent = await client.haikuRevision.findMany({ where: { ownerId: output.ownerId }, select: { lines: true }, orderBy: { createdAt: "desc" }, take: 30 });
      revisionId = (await client.haikuRevision.create({ data: {
        ownerId: output.ownerId, entryId: request.entryId, parentId: source?.id, lines: result.lines, caption: result.caption,
        interpretation: result.interpretation,
        metadata: {
          provider: request.provider, model: result.model, promptVersion: result.promptVersion, guidance,
          meter: syllables(result.lines), recentRepeat: recent.some((p) => p.lines.join("\n") === result.lines.join("\n")),
          visualTags: result.visualTags, backgroundBrief: result.backgroundBrief,
        },
      } })).id;
    } else {
      const source: ArtSource = {
        palette: guidance.palette, seed: output.ordinal * 103 + request.id.split("").reduce((a, c) => a + c.charCodeAt(0), 0),
        medium: guidance.medium, warmth: guidance.warmth, brightness: guidance.brightness,
        negativeSpace: guidance.negativeSpace, composition: guidance.composition,
      };
      const image = await renderArt(source);
      const asset = await saveAsset(output.ownerId, image, 1080, 1350, "Local deterministic procedural paper, gradient and shapes", client);
      revisionId = (await client.artworkRevision.create({ data: {
        ownerId: output.ownerId, entryId: request.entryId, parentId: request.sourceArtId, assetId: asset.id,
        source, provenance: "Procedural SVG + Sharp. Not a photograph or AI watercolor. Subject/freeform guidance is not interpreted by this renderer.",
      } })).id;
    }
    await client.$transaction(async (tx) => {
      await tx.generationOutput.update({ where: { id: outputId }, data: { state: "completed", revisionId, error: null } });
      await tx.generationRequest.update({ where: { id: request.id }, data: output.kind === "haiku" ? { completedHaiku: { increment: 1 } } : { completedArt: { increment: 1 } } });
    });
  } catch (error) {
    // Never persist provider text, prompts, credentials, or personal journal contents in error logs.
    await client.generationOutput.update({ where: { id: outputId }, data: {
      state: error instanceof AmbiguousProviderError ? "unknown" : "failed",
      error: error instanceof AmbiguousProviderError ? "Provider response unknown; no automatic paid retry." : "Output failed. Existing alternatives are safe. Check server configuration, then explicitly request the shortfall.",
    } });
  }
}
export async function pumpOutputs(boss: PgBoss, client: PrismaClient = db) {
  const stalled = await client.generationOutput.findMany({ where: { state: "running", startedAt: { lt: new Date(Date.now() - 5 * 60_000) } }, take: 100 });
  for (const output of stalled) {
    // A crash could happen after paid acceptance or artifact creation. Conservatively require inspection.
    await client.generationOutput.updateMany({ where: { id: output.id, state: "running" }, data: { state: "unknown", error: "Worker interrupted after starting; no blind retry. Existing saved alternatives remain available." } });
  }
  const pending = await client.generationOutput.findMany({ where: { state: "pending" }, take: 100, orderBy: { updatedAt: "asc" } });
  for (const output of pending) {
    await boss.send(OUTPUT_QUEUE, { outputId: output.id }, { singletonKey: output.id, singletonSeconds: 60, retryLimit: 0, expireInSeconds: 300 });
  }
}
export async function runDaily(now = new Date(), client: PrismaClient = db) {
  const defaultsList = await client.creativeDefaults.findMany();
  for (const settings of defaultsList) {
    const date = localDay(now, settings.timezone), time = localTime(now, settings.timezone);
    await client.dailyEntry.updateMany({ where: { ownerId: settings.ownerId, localDate: { lt: date }, archivedAt: null }, data: { archivedAt: now } });
    if (time >= settings.cutoffTime) {
      await client.dailyEntry.updateMany({ where: { ownerId: settings.ownerId, localDate: { lte: date }, archivedAt: null }, data: { archivedAt: now } });
      continue;
    }
    let entry = await client.dailyEntry.findUnique({
      where: { ownerId_localDate: { ownerId: settings.ownerId, localDate: date } },
      select: { id: true, inputProvided: true },
    });
    if (!entry?.inputProvided && settings.remindersEnabled && time >= settings.reminderTime) {
      const claim = await client.dailyRun.createMany({ data: [{ ownerId: settings.ownerId, localDate: date, kind: "reminder", timezone: settings.timezone }], skipDuplicates: true });
      if (claim.count) {
        await client.notification.upsert({
          where: { ownerId_localDate: { ownerId: settings.ownerId, localDate: date } }, update: {},
          create: { ownerId: settings.ownerId, localDate: date, message: "A feeling. Three lines. A little color. Your private check-in is ready when you are. No draft was made from yesterday's mood." },
        });
        if (process.env.NOTIFICATION_DRIVER === "stdout") console.info(JSON.stringify({ event: "checkin.reminder", date, delivery: "development stdout; not email" }));
      }
    }
    if (!settings.generationEnabled || time < settings.generationTime) continue;
    if (!entry?.inputProvided && !settings.neutralOptIn) continue;
    if (!entry) {
      // Explicit columns avoid ORM-inserted defaults touching protected journal/selection columns.
      await client.$executeRaw`INSERT INTO "DailyEntry" ("id", "ownerId", "localDate", "timezone", "feelings", "guidance", "inputProvided", "updatedAt")
        VALUES (${randomUUID()}, ${settings.ownerId}, ${date}, ${settings.timezone}, ARRAY['neutral'], ${JSON.stringify(settings.guidance)}::jsonb, false, ${now})
        ON CONFLICT ("ownerId", "localDate") DO NOTHING`;
      entry = await client.dailyEntry.findUniqueOrThrow({
        where: { ownerId_localDate: { ownerId: settings.ownerId, localDate: date } },
        select: { id: true, inputProvided: true },
      });
    }
    // Request and outputs are one transaction; this stable key survives crashes, DST and timezone changes.
    try {
      await requestGeneration(settings.ownerId, {
        entryId: entry.id, haikuCount: settings.haikuCount, artCount: settings.artCount,
        guidance: settings.guidance ?? defaultGuidance, scope: "next batch", clientKey: `daily-${date}`,
      }, client, now);
      await client.dailyRun.createMany({ data: [{ ownerId: settings.ownerId, localDate: date, kind: "generation", timezone: settings.timezone }], skipDuplicates: true });
    } catch {
      await client.notification.upsert({
        where: { ownerId_localDate: { ownerId: settings.ownerId, localDate: date } }, update: {},
        create: { ownerId: settings.ownerId, localDate: date, message: "Today's scheduled draft is blocked by a limit, lock, or configuration. Open the studio to review. Nothing was approved or published." },
      });
    }
  }
}
