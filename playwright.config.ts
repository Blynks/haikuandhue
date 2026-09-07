import { defineConfig } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";

process.env.TMPDIR = path.resolve(".runtime/browser");
mkdirSync(process.env.TMPDIR, { recursive: true });
export default defineConfig({
  testDir: "./tests", testMatch: "browser.spec.ts", workers: 1, timeout: 90_000,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    viewport: { width: 1360, height: 980 },
    launchOptions: { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH || undefined },
    screenshot: "only-on-failure",
  },
  outputDir: "test-results",
});
