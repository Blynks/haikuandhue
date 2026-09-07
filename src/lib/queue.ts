import { QueueStatus } from "@prisma/client";
import { prisma } from "./prisma";

export async function enqueueUnique(kind: string, payload: object, checkInId?: string, revisionId?: string, runAt = new Date()) {
  const dedupeKey = `${kind}:${checkInId ?? "none"}:${revisionId ?? "none"}`;
  return prisma.queueJob.upsert({
    where: { dedupeKey },
    update: { runAt, payload, status: QueueStatus.PENDING },
    create: { kind, payload, checkInId, revisionId, runAt, dedupeKey }
  });
}

export async function claimDueJob() {
  const job = await prisma.queueJob.findFirst({ where: { status: QueueStatus.PENDING, runAt: { lte: new Date() } }, orderBy: { runAt: "asc" } });
  if (!job) return null;
  return prisma.queueJob.update({ where: { id: job.id }, data: { status: QueueStatus.CLAIMED, lockedAt: new Date(), attempts: { increment: 1 } } });
}
