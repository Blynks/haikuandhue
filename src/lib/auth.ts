import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

const cookieName = "haiku_hue_session";
const sessionMaxAgeMs = 60 * 60 * 24 * 30 * 1000;

function secret(): string {
  if (!process.env.APP_SECRET && process.env.NODE_ENV === "production") {
    throw new Error("APP_SECRET must be set in production.");
  }
  return process.env.APP_SECRET || "demo-secret-change-me";
}

function sign(value: string): string {
  return createHmac("sha256", secret()).update(value).digest("hex");
}

export function hashPassword(password: string, salt = randomBytes(16).toString("hex")): string {
  return `scrypt$${salt}$${scryptSync(password, salt, 64).toString("hex")}`;
}

export function verifyPassword(password: string): boolean {
  if (!process.env.APP_PASSWORD_HASH && process.env.NODE_ENV === "production") {
    throw new Error("APP_PASSWORD_HASH must be set in production.");
  }
  const expected = process.env.APP_PASSWORD_HASH || hashPassword(process.env.APP_PASSWORD || "demo", process.env.APP_PASSWORD_SALT || "demo-salt");
  const [, salt] = expected.split("$");
  if (!salt) return false;
  return safeEqual(hashPassword(password, salt), expected);
}

export async function createSession(): Promise<void> {
  const value = `private:${Date.now()}`;
  const jar = await cookies();
  jar.set(cookieName, `${value}.${sign(value)}`, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: sessionMaxAgeMs / 1000 });
}

export async function clearSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(cookieName);
}

export async function isAuthenticated(): Promise<boolean> {
  const jar = await cookies();
  const cookie = jar.get(cookieName)?.value;
  if (!cookie) return false;
  const [value, signature] = cookie.split(".");
  const timestamp = Number(value?.split(":")[1]);
  if (!timestamp || Date.now() - timestamp > sessionMaxAgeMs) return false;
  return Boolean(value && signature && safeEqual(signature, sign(value)));
}

function safeEqual(actual: string, expected: string): boolean {
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}
