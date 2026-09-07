import { PgBoss } from "pg-boss";
import { Client } from "pg";
import { readFile } from "node:fs/promises";

async function main() {
  const boss = new PgBoss(process.env.DATABASE_URL!);
  await boss.start();
  await boss.createQueue("creative-output", { retryLimit: 0 });
  await boss.createQueue("daily-check", { retryLimit: 2 });
  await boss.stop();
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query(await readFile("scripts/worker-role.sql", "utf8"));
    if (process.env.WORKER_PASSWORD) {
      const result = await client.query<{ sql: string }>("SELECT format('ALTER ROLE haiku_worker LOGIN PASSWORD %L', $1::text) AS sql", [process.env.WORKER_PASSWORD]);
      await client.query(result.rows[0].sql);
    }
    console.info("Queues and restricted haiku_worker role provisioned. Set its password securely before starting the worker.");
  } finally { await client.end(); }
}
main().catch(() => { console.error("Queue setup failed. Run with the migration administrator database URL."); process.exitCode = 1; });
