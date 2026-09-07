import { db } from "../src/lib/db";
import { passwordHash } from "../src/lib/auth";
import { ensureDefaults } from "../src/lib/studio";

async function main() {
  const email = process.env.OWNER_EMAIL?.trim().toLowerCase();
  const password = process.env.OWNER_PASSWORD;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !password) throw new Error("Set OWNER_EMAIL and OWNER_PASSWORD (12+ characters).");
  if (await db.user.count()) throw new Error("Single-owner setup is complete. No additional owner was created.");
  const user = await db.user.create({ data: { email, passwordHash: await passwordHash(password) } });
  await ensureDefaults(user.id);
  console.info("Owner created. Sign in to your private studio.");
}
main().catch((e: Error) => { console.error(e.message); process.exitCode = 1; }).finally(() => db.$disconnect());
