import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const sourcePath = resolve(process.argv[2] ?? "deploy/helden/alle-helden-neue-struktur.json");
const records = JSON.parse(readFileSync(sourcePath, "utf8"));
const temporaryDirectory = mkdtempSync(resolve(tmpdir(), "dsa-hero-import-"));
const databasePath = resolve(temporaryDirectory, "dsa.db");

try {
  const database = new DatabaseSync(databasePath);
  database.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'player',
      created_at TEXT NOT NULL
    );
    CREATE TABLE heroes (
      hero_id TEXT NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      data TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (user_id, hero_id)
    );
  `);
  const insertUser = database.prepare("INSERT INTO users (id, username, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)");
  const insertHero = database.prepare("INSERT INTO heroes (hero_id, user_id, data, active, created_at, updated_at) VALUES (?, ?, ?, 0, ?, ?)");
  for (const record of records) {
    const userId = record.hero.ownerId;
    insertUser.run(userId, record.username, `unverändert-${record.username}`, record.username === "Test" ? "master" : "player", "2026-01-01T00:00:00.000Z");
    insertHero.run(record.heroId, userId, JSON.stringify({ id: record.heroId, ownerId: userId, name: "Alter Teststand" }), "2026-01-01T00:00:00.000Z", "2026-01-01T00:00:00.000Z");
  }
  database.close();

  const result = spawnSync(process.execPath, [resolve("server/import-heroes.mjs"), sourcePath, "--database", databasePath], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  assert(result.status === 0, `${result.stdout}\n${result.stderr}`);

  const verification = new DatabaseSync(databasePath);
  const imported = verification.prepare(`
    SELECT users.username, users.password_hash, users.role, heroes.hero_id, heroes.data, heroes.active, heroes.updated_at
    FROM heroes JOIN users ON users.id = heroes.user_id
    ORDER BY users.username
  `).all();
  assert(imported.length === records.length, "Nicht alle Helden wurden importiert.");
  for (const row of imported) {
    const expected = records.find((record) => record.username.toLocaleLowerCase("de-DE") === row.username.toLocaleLowerCase("de-DE"));
    assert(expected, `Unerwarteter Benutzer ${row.username}.`);
    const hero = JSON.parse(row.data);
    assert(row.hero_id === expected.heroId && hero.id === expected.heroId, `Helden-ID ging bei ${row.username} verloren.`);
    assert(hero.ownerId === expected.hero.ownerId, `Besitzer ging bei ${row.username} verloren.`);
    assert(hero.name === expected.hero.name, `Heldenname stimmt bei ${row.username} nicht.`);
    assert(row.password_hash === `unverändert-${recordUsername(expected)}`, `Passwortdaten wurden bei ${row.username} verändert.`);
    assert(row.role === (row.username === "Test" ? "master" : "player"), `Rolle wurde bei ${row.username} verändert.`);
    assert(row.updated_at === expected.updatedAt, `Zeitstempel stimmt bei ${row.username} nicht.`);
    assert(Array.isArray(hero.imprints) && Array.isArray(hero.traditionalArtifacts), `Neue Magiefelder fehlen bei ${row.username}.`);
    assert(Array.isArray(hero.spells) && hero.spells.every((spell) => spell.id), `Zauber-IDs fehlen bei ${row.username}.`);
    assert(Object.values(hero.body.equipped).every(Array.isArray), `Körperbelegung ist bei ${row.username} ungültig.`);
  }
  verification.close();
  console.log(`Importtest bestanden: ${imported.length} Helden, IDs, Konten, Rollen und Passwortdaten unverändert.`);
} finally {
  rmSync(temporaryDirectory, { recursive: true, force: true });
}

function recordUsername(record) {
  return record.username;
}
