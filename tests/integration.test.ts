import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { readFile, readdir, rm } from "node:fs/promises";
import { PrismaClient, type CandidateRevision } from "@prisma/client";
import { PgBoss } from "pg-boss";
import { db } from "../src/lib/db";
import { defaultGuidance, defaultLayout, defaultLocks, localDay, type Manifest } from "../src/lib/domain";
import { approveExport, cancelApproval, downloadAsset, ensureDefaults, markHandoff, moveHistory, prepareReview, releaseExport, requestGeneration, saveCandidate, saveDefaults, saveEntry, snapshot } from "../src/lib/studio";
import { OUTPUT_QUEUE, processOutput, pumpOutputs, runDaily } from "../src/lib/jobs";
import { hashToken, ownerFromToken } from "../src/lib/auth";
import { ownedAsset } from "../src/lib/media";
import * as media from "../src/lib/media";
import * as render from "../src/lib/render";

const enabled = !!process.env.TEST_DATABASE_URL;
const owners: string[] = [];
let worker: PrismaClient;
let boss: PgBoss;
const originalMedia = process.env.MEDIA_LOCAL_PATH;
beforeAll(async () => {
  if (!enabled) return;
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  process.env.MEDIA_LOCAL_PATH = "./.runtime/test-media";
  process.env.TEXT_PROVIDER = "demo";
  await db.$connect();
  worker = new PrismaClient({ datasources: { db: { url: process.env.TEST_WORKER_DATABASE_URL ?? process.env.TEST_DATABASE_URL } } });
  boss = new PgBoss(process.env.TEST_DATABASE_URL!);
  await boss.start(); await boss.createQueue(OUTPUT_QUEUE, { retryLimit: 0 }); await boss.createQueue("daily-check");
});
afterEach(() => { vi.restoreAllMocks(); process.env.TEXT_PROVIDER = "demo"; });
afterAll(async () => {
  if (!enabled) return;
  const where = { ownerId: { in: owners } };
  await db.$transaction([
    db.session.deleteMany({ where }), db.creativeDefaults.deleteMany({ where }), db.generationOutput.deleteMany({ where }),
    db.generationRequest.deleteMany({ where }), db.candidateRevision.deleteMany({ where }), db.haikuRevision.deleteMany({ where }),
    db.artworkRevision.deleteMany({ where }), db.renderReview.deleteMany({ where }), db.publication.deleteMany({ where }),
    db.approval.deleteMany({ where }), db.asset.deleteMany({ where }), db.dailyEntry.deleteMany({ where }),
    db.dailyRun.deleteMany({ where }), db.notification.deleteMany({ where }), db.auditEvent.deleteMany({ where }),
    db.user.deleteMany({ where: { id: { in: owners } } }),
  ]);
  await boss.stop(); await worker.$disconnect(); await db.$disconnect();
  await rm("./.runtime/test-media", { recursive: true, force: true });
  process.env.MEDIA_LOCAL_PATH = originalMedia;
});
async function owner() {
  const id = randomUUID(); owners.push(id);
  await db.user.create({ data: { id, email: `test-${id}@example.test`, passwordHash: "not-a-real-login" } });
  await ensureDefaults(id); await db.creativeDefaults.update({ where: { ownerId: id }, data: { cutoffTime: "23:59" } });
  return id;
}
async function entry(ownerId: string) {
  return saveEntry(ownerId, { feelings: ["reflective", "tired"], intensity: 4, privateNotes: "PRIVATE_NOT_FOR_PROVIDER", publicInspiration: "rain window", permissionToUse: true, guidance: defaultGuidance });
}
async function batch(ownerId: string, entryId: string, h = 1, a = 1, clientKey = randomUUID()) {
  const request = await requestGeneration(ownerId, { entryId, haikuCount: h, artCount: a, guidance: defaultGuidance, scope: "next batch", clientKey });
  const outputs = await db.generationOutput.findMany({ where: { requestId: request.id } });
  await Promise.all(outputs.map((o) => processOutput(o.id, worker)));
  return request;
}
async function composition(ownerId: string) {
  const e = await entry(ownerId); await batch(ownerId, e.id);
  const poem = await db.haikuRevision.findFirstOrThrow({ where: { ownerId, entryId: e.id } });
  const art = await db.artworkRevision.findFirstOrThrow({ where: { ownerId, entryId: e.id } });
  return saveCandidate(ownerId, {
    entryId: e.id, expectedCandidateId: null, poemId: poem.id, artId: art.id, lines: poem.lines,
    caption: `${poem.caption}\n\n${poem.lines.join("\n")}`, alt: `Abstract artwork. ${poem.lines.join("\n")}`,
    layout: defaultLayout, locks: defaultLocks, meterOverride: false,
  });
}
async function revision(ownerId: string, candidate: CandidateRevision, change: Record<string, unknown> = {}) {
  return saveCandidate(ownerId, { ...candidate, expectedCandidateId: candidate.id, ...change });
}
async function approval(ownerId: string, candidate: CandidateRevision) {
  const review = await prepareReview(ownerId, { candidateId: candidate.id, scheduledAt: new Date().toISOString(), expiryHours: 24 });
  const approved = await approveExport(ownerId, review.id, review.digest);
  const publication = await db.publication.findFirstOrThrow({ where: { approvalId: approved.id } });
  return { review, approved, publication };
}
describe.skipIf(!enabled)("PostgreSQL owner-scoped studio integration", () => {
  it("persists 5 + 2 as only two reusable artworks; 0 one component and reduced counts preserve all samples", async () => {
    const id = await owner(), e = await entry(id); await batch(id, e.id, 5, 2);
    expect(await db.haikuRevision.count({ where: { ownerId: id } })).toBe(5);
    expect(await db.artworkRevision.count({ where: { ownerId: id } })).toBe(2);
    await batch(id, e.id, 0, 1); await batch(id, e.id, 1, 0);
    expect(await db.haikuRevision.count({ where: { ownerId: id } })).toBe(6);
    expect(await db.artworkRevision.count({ where: { ownerId: id } })).toBe(3);
    expect((await snapshot(id)).entry?.selectedCandidateId).toBeNull();
    await expect(batch(id, e.id, 0, 0)).rejects.toThrow("0 + 0");
  });
  it("durably deduplicates concurrent requests and workers without overproducing", async () => {
    const id = await owner(), e = await entry(id), key = randomUUID();
    const input = { entryId: e.id, haikuCount: 1, artCount: 0, guidance: defaultGuidance, scope: "next batch", clientKey: key };
    const [a, b] = await Promise.all([requestGeneration(id, input), requestGeneration(id, input)]);
    expect(a.id).toBe(b.id);
    const o = await db.generationOutput.findFirstOrThrow({ where: { requestId: a.id } });
    await Promise.all([processOutput(o.id, worker), processOutput(o.id, worker)]);
    expect(await db.haikuRevision.count({ where: { ownerId: id } })).toBe(1);
    expect((await db.generationOutput.findUniqueOrThrow({ where: { id: o.id } })).attempts).toBe(1);
  });
  it("checks owner authentication, media, history, candidate and approvals server-side", async () => {
    const id = await owner(), intruder = await owner(), candidate = await composition(id);
    const a = await approval(id, candidate);
    await expect(ownerFromToken()).rejects.toThrow("sign in");
    const token = randomUUID().replaceAll("-", "").repeat(2);
    await db.session.create({ data: { id: hashToken(token), ownerId: id, expiresAt: new Date(Date.now() + 60000) } });
    expect(await ownerFromToken(token)).toBe(id);
    await expect(snapshot(intruder, candidate.entryId)).rejects.toThrow("not found");
    const asset = (a.review.manifest as unknown as Manifest).assets.square;
    await expect(ownedAsset(intruder, asset.id)).rejects.toThrow("not found");
    await expect(approveExport(intruder, a.review.id, a.review.digest)).rejects.toThrow();
    await expect(releaseExport(intruder, a.publication.id)).rejects.toThrow("not found");
    await expect(downloadAsset(intruder, a.publication.id, "square")).rejects.toThrow();
    await expect(moveHistory(intruder, candidate.entryId, -1)).rejects.toThrow();
    await expect(revision(intruder, candidate)).rejects.toThrow();
  });
  it("never lets guidance edits or check-in saves change defaults or call a paid provider", async () => {
    const id = await owner(), before = await ensureDefaults(id);
    const network = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("no network"));
    const e = await entry(id);
    await saveEntry(id, { ...e, guidance: { ...defaultGuidance, tone: "playful" } });
    const after = await ensureDefaults(id);
    expect(after.guidance).toEqual(before.guidance); expect(network).not.toHaveBeenCalled();
    await saveDefaults(id, { ...after, haikuCount: 5 });
    expect((await ensureDefaults(id)).haikuCount).toBe(5);
    expect(await db.generationRequest.count({ where: { ownerId: id } })).toBe(0);
  });
  it("enforces server locks and preserves manual composition while saving alternatives and persistent undo/redo", async () => {
    const id = await owner(), c = await composition(id);
    const changed = await revision(id, c, { lines: ["My own quiet words", c.lines[1], c.lines[2]], meterOverride: true });
    expect(changed.poemId).not.toBe(c.poemId);
    const locked = await revision(id, changed, { locks: { ...defaultLocks, lines: [true, false, false], art: true, layout: true } });
    await expect(revision(id, locked, { lines: ["overwrite", ...locked.lines.slice(1)] })).rejects.toThrow("Line 1");
    await expect(revision(id, locked, { layout: { ...defaultLayout, position: "bottom" } })).rejects.toThrow("Layout");
    await expect(requestGeneration(id, { entryId: c.entryId, haikuCount: 1, artCount: 0, guidance: { ...defaultGuidance, avoid: "quiet" }, scope: "this poem", clientKey: randomUUID() })).rejects.toThrow("conflicts");
    await batch(id, c.entryId, 1, 0);
    const state = await snapshot(id);
    expect(state.entry?.selectedCandidateId).toBe(locked.id);
    const latest = state.poems.at(-1)!; expect(latest.lines[0]).toBe("My own quiet words");
    expect((await moveHistory(id, c.entryId, -1)).id).toBe(changed.id);
    expect((await snapshot(id)).entry?.historyIndex).toBe(1);
    expect((await moveHistory(id, c.entryId, 1)).id).toBe(locked.id);
  });
  it("renders before authenticated approval, deduplicates release and truthfully separates handoff", async () => {
    const id = await owner(), c = await composition(id);
    const network = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("no network"));
    const a = await approval(id, c), manifest = a.review.manifest as unknown as Manifest;
    expect(manifest.caption).toBe(c.caption); expect(manifest.alt).toBe(c.alt);
    expect(await db.asset.count({ where: { ownerId: id } })).toBe(3);
    await expect(downloadAsset(id, a.publication.id, "square")).rejects.toThrow("release");
    await Promise.all([releaseExport(id, a.publication.id), releaseExport(id, a.publication.id)]);
    const publication = await db.publication.findUniqueOrThrow({ where: { id: a.publication.id } });
    expect(publication.state).toBe("exported"); expect(publication.attempts).toBe(1);
    expect((await downloadAsset(id, publication.id, "portrait")).subarray(1, 4).toString()).toBe("PNG");
    expect((await markHandoff(id, publication.id)).state).toBe("manual-handoff");
    expect(network).not.toHaveBeenCalled();
  });
  it("does not persist final assets when the selection changes during rendering", async () => {
    const id = await owner(), c = await composition(id);
    const files = await readdir(process.env.MEDIA_LOCAL_PATH!);
    const renderComposition = render.renderComposition;
    vi.spyOn(render, "renderComposition").mockImplementationOnce(async (...args) => {
      await revision(id, c, { caption: `${c.caption}\nChanged during render.` });
      return renderComposition(...args);
    });
    await expect(prepareReview(id, { candidateId: c.id, scheduledAt: new Date().toISOString(), expiryHours: 24 })).rejects.toThrow("changed while rendering");
    expect(await db.asset.count({ where: { ownerId: id } })).toBe(1);
    expect(await db.renderReview.count({ where: { ownerId: id } })).toBe(0);
    expect(await readdir(process.env.MEDIA_LOCAL_PATH!)).toEqual(files);
  });
  it("rolls back final asset rows and removes files if the second asset fails", async () => {
    const id = await owner(), c = await composition(id);
    const files = await readdir(process.env.MEDIA_LOCAL_PATH!);
    const saveAsset = media.saveAsset;
    vi.spyOn(media, "saveAsset").mockImplementationOnce(saveAsset).mockRejectedValueOnce(new Error("Storage unavailable"));
    await expect(prepareReview(id, { candidateId: c.id, scheduledAt: new Date().toISOString(), expiryHours: 24 })).rejects.toThrow("Storage unavailable");
    expect(await db.asset.count({ where: { ownerId: id } })).toBe(1);
    expect(await db.renderReview.count({ where: { ownerId: id } })).toBe(0);
    expect(await readdir(process.env.MEDIA_LOCAL_PATH!)).toEqual(files);
  });
  it("removes a stored file when its asset row cannot be created", async () => {
    const files = await readdir(process.env.MEDIA_LOCAL_PATH!);
    vi.spyOn(db.asset, "create").mockRejectedValueOnce(new Error("Database unavailable"));
    await expect(media.saveAsset(randomUUID(), Buffer.from("test"), 1, 1, "Failed test asset")).rejects.toThrow("Database unavailable");
    expect(await readdir(process.env.MEDIA_LOCAL_PATH!)).toEqual(files);
  });
  it("unused alternatives do not invalidate approval, covered edits always do", async () => {
    const id = await owner(), c = await composition(id), a = await approval(id, c);
    await batch(id, c.entryId, 1, 0);
    expect((await db.approval.findUniqueOrThrow({ where: { id: a.approved.id } })).cancelledAt).toBeNull();
    await revision(id, c, { caption: `${c.caption}\nA new caption.` });
    await expect(releaseExport(id, a.publication.id)).rejects.toThrow("cancelled");
    expect((await db.publication.findUniqueOrThrow({ where: { id: a.publication.id } })).state).toBe("cancelled");
  });
  it("blocks pause, cancel, expiry and premature schedule with no silent approval", async () => {
    const id = await owner(), c = await composition(id), a = await approval(id, c);
    await db.creativeDefaults.update({ where: { ownerId: id }, data: { publishingPaused: true } });
    await expect(releaseExport(id, a.publication.id)).rejects.toThrow("pause");
    await db.creativeDefaults.update({ where: { ownerId: id }, data: { publishingPaused: false } });
    await expect(releaseExport(id, a.publication.id, new Date(Date.now() + 2 * 86400_000))).rejects.toThrow("expired");
    await expect(releaseExport(id, a.publication.id, new Date(Date.now() - 3600_000))).rejects.toThrow("not started");
    await cancelApproval(id, a.approved.id);
    await expect(releaseExport(id, a.publication.id)).rejects.toThrow("cancelled");
    const another = await prepareReview(id, { candidateId: c.id, scheduledAt: new Date().toISOString(), expiryHours: 24 });
    expect(await db.approval.count({ where: { ownerId: id, reviewId: another.id } })).toBe(0);
  });
  it("rejects tampered asset content before releasing any file", async () => {
    const id = await owner(), c = await composition(id), a = await approval(id, c);
    const assetId = (a.review.manifest as unknown as Manifest).assets.square.id;
    await db.asset.update({ where: { id: assetId }, data: { sha256: "wrong" } });
    await expect(releaseExport(id, a.publication.id)).rejects.toThrow("identity mismatch");
  });
  it("persists missing-input reminders once and never uses yesterday or missed-day backlog", async () => {
    const id = await owner();
    await db.creativeDefaults.update({ where: { ownerId: id }, data: { timezone: "America/New_York", remindersEnabled: true, generationEnabled: true, reminderTime: "01:00", generationTime: "01:15", cutoffTime: "23:59" } });
    await db.dailyEntry.create({ data: { ownerId: id, localDate: "2026-10-31", timezone: "America/New_York", feelings: ["yesterday"], privateNotes: "never use", guidance: defaultGuidance } });
    await runDaily(new Date("2026-11-01T05:30:00Z"), worker); await runDaily(new Date("2026-11-01T06:30:00Z"), worker);
    expect(await db.notification.count({ where: { ownerId: id } })).toBe(1);
    expect(await db.generationRequest.count({ where: { ownerId: id } })).toBe(0);
    expect((await db.notification.findFirstOrThrow({ where: { ownerId: id } })).message).not.toContain("never use");
    await db.creativeDefaults.update({ where: { ownerId: id }, data: { generationEnabled: false, remindersEnabled: false } });
  });
  it("neutral opt-in drafts once across repeated DST hour and timezone change but cannot approve", async () => {
    const id = await owner();
    await db.creativeDefaults.update({ where: { ownerId: id }, data: { timezone: "America/New_York", generationEnabled: true, neutralOptIn: true, generationTime: "01:00", haikuCount: 1, artCount: 0 } });
    await runDaily(new Date("2026-11-01T05:30:00Z"), worker); await runDaily(new Date("2026-11-01T06:30:00Z"), worker);
    await db.creativeDefaults.update({ where: { ownerId: id }, data: { timezone: "UTC" } });
    await runDaily(new Date("2026-11-01T07:30:00Z"), worker);
    expect(await db.dailyEntry.count({ where: { ownerId: id } })).toBe(1);
    expect(await db.generationRequest.count({ where: { ownerId: id } })).toBe(1);
    expect(await db.approval.count({ where: { ownerId: id } })).toBe(0);
    await db.creativeDefaults.update({ where: { ownerId: id }, data: { generationEnabled: false } });
  });
  it("durable outbox reaches actual pg-boss; stale paid work becomes unknown, never blind retry", async () => {
    const id = await owner(), e = await entry(id);
    const request = await requestGeneration(id, { entryId: e.id, haikuCount: 1, artCount: 0, guidance: defaultGuidance, scope: "next batch", clientKey: randomUUID() });
    const o = await db.generationOutput.findFirstOrThrow({ where: { requestId: request.id } });
    await pumpOutputs(boss, worker);
    const queued = await boss.findJobs<{ outputId: string }>(OUTPUT_QUEUE, { key: o.id });
    expect(queued.some((job) => job.data.outputId === o.id)).toBe(true);
    await db.generationOutput.update({ where: { id: o.id }, data: { state: "running", startedAt: new Date(Date.now() - 600_000) } });
    await pumpOutputs(boss, worker);
    expect((await db.generationOutput.findUniqueOrThrow({ where: { id: o.id } })).state).toBe("unknown");
    await processOutput(o.id, worker);
    expect(await db.haikuRevision.count({ where: { ownerId: id } })).toBe(0);
  });
  it("live response timeout is unknown and compact request contains no private notes", async () => {
    const id = await owner(), e = await entry(id);
    process.env.TEXT_PROVIDER = "live"; process.env.TEXT_API_URL = "https://model.example.test/chat";
    process.env.TEXT_API_ALLOWED_HOST = "model.example.test"; process.env.TEXT_MODEL = "configured-model";
    process.env.TEXT_API_KEY = randomUUID();
    await db.creativeDefaults.update({ where: { ownerId: id }, data: { localOnly: false } });
    const request = await requestGeneration(id, { entryId: e.id, haikuCount: 1, artCount: 0, guidance: defaultGuidance, scope: "next batch", clientKey: randomUUID() });
    const network = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("timeout after acceptance"));
    const o = await db.generationOutput.findFirstOrThrow({ where: { requestId: request.id } });
    await processOutput(o.id, worker);
    expect(JSON.stringify(network.mock.calls[0])).not.toContain("PRIVATE_NOT_FOR_PROVIDER");
    expect(JSON.stringify(network.mock.calls[0])).toContain("rain window");
    expect((await db.generationOutput.findUniqueOrThrow({ where: { id: o.id } })).state).toBe("unknown");
    await processOutput(o.id, worker); expect(network).toHaveBeenCalledTimes(1);
  });
  it("refuses over-budget requests and privacy mode blocks previously queued remote work", async () => {
    const id = await owner(), e = await entry(id);
    process.env.TEXT_PROVIDER = "live"; process.env.TEXT_API_URL = "https://model.example.test/chat";
    process.env.TEXT_API_ALLOWED_HOST = "model.example.test"; process.env.TEXT_MODEL = "configured-model"; process.env.TEXT_API_KEY = randomUUID();
    await db.creativeDefaults.update({ where: { ownerId: id }, data: { localOnly: false, dailyBudgetCents: 0 } });
    const input = { entryId: e.id, haikuCount: 1, artCount: 0, guidance: defaultGuidance, scope: "next batch", clientKey: randomUUID() };
    await expect(requestGeneration(id, input)).rejects.toThrow("budget");
    await db.creativeDefaults.update({ where: { ownerId: id }, data: { dailyBudgetCents: 50 } });
    const request = await requestGeneration(id, input);
    await db.creativeDefaults.update({ where: { ownerId: id }, data: { localOnly: true } });
    const network = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("no network"));
    const o = await db.generationOutput.findFirstOrThrow({ where: { requestId: request.id } });
    await processOutput(o.id, worker);
    expect(network).not.toHaveBeenCalled();
    expect((await db.generationOutput.findUniqueOrThrow({ where: { id: o.id } })).state).toBe("failed");
  });
  it.skipIf(!process.env.TEST_WORKER_DATABASE_URL)("database role cannot read private notes, passwords or social tokens; cannot mint approvals", async () => {
    await expect(worker.$queryRaw`SELECT "privateNotes" FROM "DailyEntry" LIMIT 1`).rejects.toThrow();
    await expect(worker.user.findFirst()).rejects.toThrow();
    await expect(worker.socialConnection.findFirst()).rejects.toThrow();
    const permissions = await worker.$queryRaw<{ allowed: boolean }[]>`SELECT has_table_privilege(current_user, '"Approval"', 'INSERT') AS allowed`;
    expect(permissions[0].allowed).toBe(false);
    const sql = await readFile("scripts/worker-role.sql", "utf8");
    expect(sql).not.toContain('GRANT INSERT ON "Approval"');
  });
  it("date checks reject yesterday and expiry makes no alternatives", async () => {
    const id = await owner(), e = await entry(id);
    const request = await requestGeneration(id, { entryId: e.id, haikuCount: 1, artCount: 0, guidance: defaultGuidance, scope: "next batch", clientKey: randomUUID() });
    const nextDay = new Date(Date.now() + 2 * 86400_000), o = await db.generationOutput.findFirstOrThrow({ where: { requestId: request.id } });
    await processOutput(o.id, worker, nextDay);
    expect((await db.generationOutput.findUniqueOrThrow({ where: { id: o.id } })).state).toBe("expired");
    expect(localDay(nextDay, "UTC")).not.toBe(e.localDate);
    await expect(requestGeneration(id, { entryId: e.id, haikuCount: 1, artCount: 0, guidance: defaultGuidance, scope: "next batch", clientKey: randomUUID() }, db, nextDay)).rejects.toThrow("today");
  });
});
