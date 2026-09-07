import { QueueStatus, RevisionStatus } from "@prisma/client";
import { claimDueJob } from "./lib/queue";
import { prisma } from "./lib/prisma";

async function processOne() {
  const job = await claimDueJob();
  if (!job) return false;
  try {
    if (job.kind === "scheduled-publish" && job.revisionId) {
      const revision = await prisma.artworkRevision.findUnique({ where: { id: job.revisionId }, include: { deliveries: { include: { destination: true } } } });
      if (!revision || revision.status !== RevisionStatus.SCHEDULED) throw new Error("Revision is not approved for scheduled publishing.");
      let publishedDeliveries = 0;
      for (const delivery of revision.deliveries) {
        if (delivery.destination.slug === "manual-export") {
          await prisma.destinationDelivery.update({ where: { id: delivery.id }, data: { status: "PUBLISHED", publishedAt: new Date(), remotePostId: `manual:${delivery.id}` } });
          publishedDeliveries += 1;
        } else {
          await prisma.destinationDelivery.update({ where: { id: delivery.id }, data: { status: "FAILED_NEEDS_REVIEW", lastError: `${delivery.destination.label} is ${delivery.destination.state.toLowerCase().replaceAll("_", " ")}, not connected.` } });
        }
      }
      await prisma.artworkRevision.update({ where: { id: revision.id }, data: { status: publishedDeliveries > 0 ? RevisionStatus.PUBLISHED : RevisionStatus.FAILED } });
    }
    await prisma.queueJob.update({ where: { id: job.id }, data: { status: QueueStatus.COMPLETED } });
    return true;
  } catch (error) {
    const originalPayload = job.payload && typeof job.payload === "object" && !Array.isArray(job.payload) ? job.payload : { original: job.payload };
    await prisma.queueJob.update({ where: { id: job.id }, data: { status: QueueStatus.FAILED, payload: { ...originalPayload, error: error instanceof Error ? error.message : "Unknown worker error" } } });
    return true;
  }
}

async function main() {
  const once = process.argv.includes("--once");
  do {
    const didWork = await processOne();
    if (once) break;
    if (!didWork) await new Promise((resolve) => setTimeout(resolve, 5000));
  } while (true);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
