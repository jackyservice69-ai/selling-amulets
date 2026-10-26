import { config } from "dotenv";
import { spawn } from "node:child_process";
import { mkdir, stat } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { resolve } from "node:path";

config({ path: process.env.ENV_FILE || ".env", override: false, quiet: true });
const [action, filename] = process.argv.slice(2);
if (!["backup", "restore"].includes(action))
  throw new Error(
    "ใช้: node scripts/database-backup.mjs backup|restore [ไฟล์.sql]",
  );
const url = new URL(process.env.DATABASE_URL || "");
if (url.protocol !== "mysql:") throw new Error("รองรับ MySQL เท่านั้น");
const database = decodeURIComponent(url.pathname.slice(1));
if (!/^[a-zA-Z0-9_]+$/.test(database))
  throw new Error("ชื่อฐานข้อมูลไม่ถูกต้อง");
const file = resolve(
  filename ||
    `backups/${database}-${new Date().toISOString().replace(/[:.]/g, "-")}.sql`,
);
const bin = process.env.MYSQL_BIN;
const program = action === "backup" ? "mysqldump" : "mysql";
const executable = bin
  ? resolve(bin, `${program}${process.platform === "win32" ? ".exe" : ""}`)
  : program;
const args = [
  "--host",
  url.hostname,
  "--port",
  url.port || "3306",
  "--user",
  decodeURIComponent(url.username),
  "--default-character-set=utf8mb4",
];
if (action === "backup") {
  await mkdir(resolve(file, ".."), { recursive: true });
  try {
    await stat(file);
    throw new Error("ไฟล์ปลายทางมีอยู่แล้ว กรุณาใช้ชื่อใหม่");
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
  }
  args.push(
    "--single-transaction",
    "--no-tablespaces",
    "--set-gtid-purged=OFF",
    "--hex-blob",
    "--result-file",
    file,
    database,
  );
} else {
  if (!filename || process.env.CONFIRM_DATABASE !== database)
    throw new Error(
      "Restore จะเขียนทับข้อมูล: กำหนด CONFIRM_DATABASE ให้ตรงกับชื่อฐานข้อมูล และระบุไฟล์ SQL",
    );
  await stat(file);
  args.push(database);
}
const child = spawn(executable, args, {
  env: { ...process.env, MYSQL_PWD: decodeURIComponent(url.password) },
  stdio: ["pipe", "inherit", "pipe"],
  windowsHide: true,
});
let errorOutput = "";
child.stderr.on("data", (chunk) => {
  errorOutput += String(chunk);
});
const input = action === "restore" ? createReadStream(file) : null;
input?.on("error", () => child.kill());
child.stdin.on("error", () => {});
if (input) input.pipe(child.stdin);
else child.stdin.end();
await new Promise((done, fail) => {
  child.on("error", () =>
    fail(new Error("เปิด MySQL CLI ไม่ได้ ตรวจ MYSQL_BIN หรือ PATH")),
  );
  child.on("close", (code) =>
    code === 0
      ? done()
      : fail(
          new Error(
            `MySQL ${program} ไม่สำเร็จ (exit ${code}) ${errorOutput.replace(/password[^\n]*/gi, "[redacted]")}`,
          ),
        ),
  );
});
console.log(
  `${action === "backup" ? "สำรองข้อมูล" : "กู้คืนข้อมูล"}สำเร็จ: ${file}`,
);
