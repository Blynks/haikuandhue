import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

const cookieName = "haiku_hue_session";

function secret(): string {
  if (!process.env.APP_SECRET && process.env.NODE_ENV === "production") {
    throw new Error("APP_SECRET must be set in production.");
  }
  return process.env.APP_SECRET || "demo-secret-change-me";
}

function sign(value: string): string {
  return createHmac("sha256", secret()).update(value).digest("hex");
}

export function hashPassword(password: string): string {
  const salt = process.env.APP_PASSWORD_SALT || randomBytes(16).toString("hex");
  return `scrypt$${salt}$${scryptSync(password, salt, 64).toString("hex")}`;
}

export function verifyPassword(password: string): boolean {
  const expected = process.env.APP_PASSWORD_HASH || "scrypt$demo-salt$" + scryptSync(process.env.APP_PASSWORD || "demo", "demo-salt", 64).toString("hex");
  const [, salt] = expected.split("$");
  if (!salt) return false;
  const actual = `scrypt$${salt}$${scryptSync(password, salt, 64).toString("hex")}`;
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}

export async function createSession(): Promise<void> {
  const value = `private:${Date.now()}`;
  const jar = await cookies();
  jar.set(cookieName, `${value}.${sign(value)}`, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 30 });
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
  return Boolean(value && signature && signature === sign(value));
}
