import { defineConfig } from "vitest/config";
import { config } from "dotenv";
config({ path: ".env.test.local", override: true, quiet: true });
if (
  !process.env.DATABASE_URL ||
  !new URL(process.env.DATABASE_URL).pathname.endsWith("_test")
)
  throw new Error(
    "Tests require .env.test.local with a separate database ending in _test",
  );
export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    testTimeout: 20000,
    hookTimeout: 60000,
    fileParallelism: false,
    reporters: ["default", "json"],
    outputFile: { json: "output/test-results.json" },
  },
});
