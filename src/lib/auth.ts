import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { db } from "./db";
import { assert, DomainError } from "./domain";

const scrypt = (password: string, salt: string) => new Promise<Buffer>((resolve, reject) => {
  scryptCallback(password, salt, 64, { N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 }, (error, key) => error ? reject(error) : resolve(key));
});
export const SESSION_COOKIE = "hh_session";
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
export async function passwordHash(password: string) {
  assert(password.length >= 12 && password.length <= 200, "Use a password with 12–200 characters.");
  const salt = randomBytes(24).toString("hex");
  const key = await scrypt(password, salt);
  return `scrypt:${salt}:${key.toString("hex")}`;
}
export async function verifyPassword(password: string, encoded: string) {
  const [, salt, key] = encoded.split(":");
  if (!salt || !key || password.length > 200) return false;
  const actual = await scrypt(password, salt);
  const expected = Buffer.from(key, "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
export function verifyOrigin(request: Request) {
  const expected = new URL(process.env.APP_ORIGIN ?? "http://localhost:3000").origin;
  assert(request.headers.get("origin") === expected, "This action must come from your studio.", 403);
  const site = request.headers.get("sec-fetch-site");
  assert(!site || site === "same-origin" || site === "none", "Cross-site action blocked.", 403);
}
export async function ownerFromToken(token?: string) {
  assert(token && /^[a-f0-9]{64}$/.test(token), "Please sign in.", 401);
  const session = await db.session.findUnique({ where: { id: hashToken(token) } });
  assert(session && session.expiresAt > new Date(), "Your session has expired. Please sign in.", 401);
  return session.ownerId;
}
export async function requireOwner() {
  return ownerFromToken((await cookies()).get(SESSION_COOKIE)?.value);
}
export async function login(email: string, password: string) {
  // A database-wide single-owner limiter cannot be bypassed by spoofing forwarding headers.
  const now = new Date();
  const attempt = await db.loginAttempt.upsert({
    where: { id: "owner-login" }, create: { id: "owner-login", count: 1 },
    update: { count: { increment: 1 } },
  });
  if (now.getTime() - attempt.windowAt.getTime() > 15 * 60_000) {
    await db.loginAttempt.update({ where: { id: attempt.id }, data: { count: 1, windowAt: now } });
  } else if (attempt.count > 10) {
    throw new DomainError("Too many sign-in attempts. Try again in 15 minutes.", 429);
  }
  const user = await db.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  const dummy = "scrypt:000000000000000000000000000000000000000000000000:".concat("00".repeat(64));
  const valid = await verifyPassword(password, user?.passwordHash ?? dummy);
  assert(user && valid, "Email or password is incorrect.", 401);
  const token = randomBytes(32).toString("hex");
  await db.session.create({
    data: { id: hashToken(token), ownerId: user.id, expiresAt: new Date(now.getTime() + 7 * 86400_000) },
  });
  await db.auditEvent.create({ data: { ownerId: user.id, action: "session.created" } });
  return token;
}
export const sessionCookieOptions = {
  httpOnly: true, secure: process.env.COOKIE_SECURE !== "false" && process.env.NODE_ENV === "production",
  sameSite: "strict" as const, path: "/", maxAge: 7 * 86400,
};
