import { config } from "dotenv";
import { spawnSync } from "node:child_process";
config({ path: ".env.test.local", override: true, quiet: true });
if (
  !process.env.DATABASE_URL ||
  !new URL(process.env.DATABASE_URL).pathname.endsWith("_test")
)
  throw new Error(
    "Specify a dedicated database ending in _test in .env.test.local",
  );
for (const args of [
  ["node_modules/prisma/build/index.js", "migrate", "deploy"],
  ["--import", "tsx", "prisma/seed.ts"],
]) {
  const result = spawnSync(process.execPath, args, {
    env: { ...process.env, SEED_DEMO: "false" },
    stdio: "inherit",
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
