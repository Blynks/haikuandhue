async function main() {
  if (!process.env.WORKER_DATABASE_URL) throw new Error("WORKER_DATABASE_URL is required; use the restricted worker database role.");
  process.env.DATABASE_URL = process.env.WORKER_DATABASE_URL;
  const { PgBoss } = await import("pg-boss");
  const { db } = await import("./lib/db");
  const { DAILY_QUEUE, OUTPUT_QUEUE, processOutput, pumpOutputs, runDaily } = await import("./lib/jobs");
  const permission = await db.$queryRaw<{ allowed: boolean }[]>`SELECT has_table_privilege(current_user, '"Approval"', 'INSERT') AS allowed`;
  if (permission[0]?.allowed) throw new Error("Refusing privileged worker: its database role can mint approvals. Run queue:setup and provision the restricted role.");
  const boss = new PgBoss({ connectionString: process.env.WORKER_DATABASE_URL, migrate: false, createSchema: false });
  boss.on("error", () => console.error("queue.error (details suppressed to protect connection information)"));
  await boss.start();
  await boss.work<{ outputId: string }>(OUTPUT_QUEUE, { batchSize: 1, pollingIntervalSeconds: 2 }, async (jobs) => {
    for (const job of jobs) await processOutput(job.data.outputId);
  });
  await boss.work(DAILY_QUEUE, async () => { await runDaily(); await pumpOutputs(boss); });
  await boss.schedule(DAILY_QUEUE, "* * * * *");
  await runDaily();
  await pumpOutputs(boss);
  let busy = false;
  const timer = setInterval(async () => {
    if (busy) return;
    busy = true;
    try { await pumpOutputs(boss); } catch { console.error("queue.pump_failed"); } finally { busy = false; }
  }, 5000);
  console.info("Haiku & Hue draft worker ready. No approval or social publishing capability.");
  const stop = async () => { clearInterval(timer); await boss.stop(); await db.$disconnect(); process.exit(0); };
  process.on("SIGINT", stop); process.on("SIGTERM", stop);
}
main().catch(() => { console.error("Worker startup failed. Check restricted role, queue setup, and environment."); process.exit(1); });
