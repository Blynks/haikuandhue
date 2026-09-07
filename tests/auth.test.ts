import { afterEach, describe, expect, it, vi } from "vitest";
import { hashPassword, verifyPassword } from "../src/lib/auth";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("password verification", () => {
  it("accepts a scrypt hash generated with the embedded salt", () => {
    vi.stubEnv("APP_PASSWORD_HASH", hashPassword("correct horse", "test-salt"));
    expect(verifyPassword("correct horse")).toBe(true);
  });

  it("rejects a wrong password", () => {
    vi.stubEnv("APP_PASSWORD_HASH", hashPassword("correct horse", "test-salt"));
    expect(verifyPassword("wrong horse")).toBe(false);
  });

  it("rejects malformed hashes without throwing", () => {
    vi.stubEnv("APP_PASSWORD_HASH", "not-a-scrypt-hash");
    expect(verifyPassword("anything")).toBe(false);
  });
});
