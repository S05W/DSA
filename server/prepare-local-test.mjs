import { spawn, spawnSync } from "node:child_process";
import { randomBytes, scrypt as scryptCallback } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { promisify } from "node:util";
import { DatabaseSync } from "node:sqlite";

const scrypt = promisify(scryptCallback);
const argumentsList = process.argv.slice(2);
const force = argumentsList.includes("--force");
const sourceArgument = argumentsList.find((argument) => !argument.startsWith("--"));
const sourcePath = resolve(sourceArgument ?? "deploy/helden/alle-helden-neue-struktur.json");
const databasePath = resolve("data/local-test.db");
const password = "NurLokal-2026!";

if (existsSync(databasePath) && !force) {
  console.error("data/local-test.db existiert bereits. Für einen bewussten Neubau --force ergänzen.");
  process.exit(1);
}

mkdirSync(dirname(databasePath), { recursive: true });
for (const suffix of ["", "-wal", "-shm"]) rmSync(`${databasePath}${suffix}`, { force: true });

const port = 32_000 + Math.floor(Math.random() * 5_000);
const server = spawn(process.execPath, [resolve("server/server.mjs")], {
  cwd: process.cwd(),
  env: { ...process.env, HOST: "127.0.0.1", PORT: String(port), DATABASE_PATH: databasePath },
  stdio: ["ignore", "pipe", "pipe"],
});
let output = "";
server.stdout.on("data", (chunk) => { output += chunk; });
server.stderr.on("data", (chunk) => { output += chunk; });

try {
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/health`);
      if (response.ok) { ready = true; break; }
    } catch {
      // Der Testserver legt gerade die Datenbanktabellen an.
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 50));
  }
  if (!ready) throw new Error(`Lokale Datenbank konnte nicht vorbereitet werden.\n${output}`);
} finally {
  server.kill("SIGTERM");
  await new Promise((resolveExit) => {
    if (server.exitCode !== null) resolveExit();
    else server.once("exit", resolveExit);
  });
}

const records = JSON.parse(readFileSync(sourcePath, "utf8"));
const database = new DatabaseSync(databasePath);
const insertUser = database.prepare("INSERT INTO users (id, username, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)");

for (const record of records) {
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, 64);
  const passwordHash = `scrypt:${salt.toString("hex")}:${derived.toString("hex")}`;
  insertUser.run(
    record.hero.ownerId,
    record.username,
    passwordHash,
    record.username === "Test" ? "master" : "player",
    new Date().toISOString(),
  );
}
database.close();

const importResult = spawnSync(process.execPath, [resolve("server/import-heroes.mjs"), sourcePath, "--database", databasePath], {
  cwd: process.cwd(),
  encoding: "utf8",
});
if (importResult.status !== 0) {
  console.error(importResult.stdout);
  console.error(importResult.stderr);
  process.exit(importResult.status ?? 1);
}

console.log("Lokale Testdatenbank wurde erstellt: data/local-test.db");
console.log(`Anmeldung: Lukas, Liras, KaufhausSamurai oder Test / Passwort: ${password}`);
console.log("Das Konto Test darf zusätzlich die Meisteransicht öffnen.");
