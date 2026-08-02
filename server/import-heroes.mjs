import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

function fail(message) {
  console.error(`Import abgebrochen: ${message}`);
  process.exitCode = 1;
}

function parseArguments(argv) {
  const options = {
    sourcePath: null,
    databasePath: resolve(process.env.DATABASE_PATH ?? "data/dsa.db"),
    dryRun: false,
    force: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--database") {
      const path = argv[index + 1];
      if (!path) throw new Error("Nach --database fehlt ein Pfad.");
      options.databasePath = resolve(path);
      index += 1;
    } else if (value === "--dry-run") {
      options.dryRun = true;
    } else if (value === "--force") {
      options.force = true;
    } else if (value.startsWith("--")) {
      throw new Error(`Unbekannte Option: ${value}`);
    } else if (!options.sourcePath) {
      options.sourcePath = resolve(value);
    } else {
      throw new Error(`Unerwartetes Argument: ${value}`);
    }
  }

  if (!options.sourcePath) {
    options.sourcePath = resolve("deploy/helden/alle-helden-neue-struktur.json");
  }
  return options;
}

function requireObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} muss ein Objekt sein.`);
  }
}

function validateRecord(record, index) {
  requireObject(record, `Datensatz ${index + 1}`);
  requireObject(record.hero, `Held in Datensatz ${index + 1}`);

  if (typeof record.username !== "string" || !record.username.trim()) {
    throw new Error(`Benutzername in Datensatz ${index + 1} fehlt.`);
  }
  if (typeof record.heroId !== "string" || !record.heroId) {
    throw new Error(`Helden-ID bei ${record.username} fehlt.`);
  }
  if (record.hero.id !== record.heroId) {
    throw new Error(`Helden-ID bei ${record.username} stimmt nicht mit hero.id überein.`);
  }
  if (typeof record.hero.name !== "string" || !record.hero.name.trim()) {
    throw new Error(`Heldenname bei ${record.username} fehlt.`);
  }
  if (typeof record.updatedAt !== "string" || !Number.isFinite(Date.parse(record.updatedAt))) {
    throw new Error(`updatedAt bei ${record.username} ist ungültig.`);
  }
  if (!("tradition" in record.hero) || !Array.isArray(record.hero.imprints) || !Array.isArray(record.hero.traditionalArtifacts)) {
    throw new Error(`Neue Felder für Tradition, Prägungen oder Traditionsgegenstände fehlen bei ${record.username}.`);
  }
  if (!record.hero.combat || !Number.isFinite(Number(record.hero.combat.soulpower)) || !Number.isFinite(Number(record.hero.combat.tenacity))) {
    throw new Error(`Seelenkraft oder Zähigkeit fehlt bei ${record.username}.`);
  }
  if (!record.hero.body || !record.hero.body.equipped || typeof record.hero.body.equipped !== "object") {
    throw new Error(`Neue Körperbelegung fehlt bei ${record.username}.`);
  }
  if (Object.values(record.hero.body.equipped).some((entry) => !Array.isArray(entry))) {
    throw new Error(`Körperplätze sind bei ${record.username} nicht als Listen gespeichert.`);
  }
}

function timestamp(value) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

let options;
try {
  options = parseArguments(process.argv.slice(2));
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}

if (!process.exitCode) {
  try {
    if (!existsSync(options.sourcePath)) throw new Error(`Heldendatei nicht gefunden: ${options.sourcePath}`);
    if (!existsSync(options.databasePath)) throw new Error(`Datenbank nicht gefunden: ${options.databasePath}`);

    const records = JSON.parse(readFileSync(options.sourcePath, "utf8"));
    if (!Array.isArray(records) || records.length === 0) throw new Error("Die Heldendatei enthält keine Datensätze.");
    records.forEach(validateRecord);

    const duplicateKeys = new Set();
    for (const record of records) {
      const key = `${record.username.toLocaleLowerCase("de-DE")}\u0000${record.heroId}`;
      if (duplicateKeys.has(key)) throw new Error(`Doppelter Datensatz für ${record.username}/${record.heroId}.`);
      duplicateKeys.add(key);
    }

    const database = new DatabaseSync(options.databasePath);
    try {
      database.exec("PRAGMA foreign_keys = ON");
      const heroesTable = database.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'heroes'").get();
      const usersTable = database.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'users'").get();
      if (!heroesTable || !usersTable) throw new Error("Die Datenbank besitzt noch keine Benutzer- oder Heldentabelle.");

      const userByName = database.prepare("SELECT id, username FROM users WHERE username = ? COLLATE NOCASE");
      const heroOwners = database.prepare("SELECT user_id, updated_at FROM heroes WHERE hero_id = ?");
      const existingHero = database.prepare("SELECT created_at, updated_at FROM heroes WHERE user_id = ? AND hero_id = ?");
      const upsertHero = database.prepare(`
        INSERT INTO heroes (hero_id, user_id, data, active, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id, hero_id) DO UPDATE SET
          data = excluded.data,
          active = excluded.active,
          updated_at = excluded.updated_at
      `);

      const prepared = records.map((record) => {
        const user = userByName.get(record.username);
        if (!user) throw new Error(`Das Spielerkonto „${record.username}“ existiert nicht in der Datenbank.`);

        const owners = heroOwners.all(record.heroId);
        if (owners.some((owner) => owner.user_id !== user.id)) {
          throw new Error(`Die Helden-ID ${record.heroId} gehört bereits einem anderen Spielerkonto.`);
        }

        const existing = existingHero.get(user.id, record.heroId);
        if (existing && timestamp(existing.updated_at) > timestamp(record.updatedAt) && !options.force) {
          throw new Error(
            `Der Held „${record.hero.name}“ von ${record.username} wurde nach dem Export noch geändert. ` +
            "Erneut exportieren oder den Import bewusst mit --force starten.",
          );
        }

        const hero = { ...record.hero, id: record.heroId, ownerId: user.id, name: record.hero.name.trim() };
        return {
          username: user.username,
          hero,
          active: hero.sessionActive ? 1 : 0,
          createdAt: existing?.created_at ?? record.updatedAt,
          updatedAt: record.updatedAt,
          action: existing ? "aktualisiert" : "neu angelegt",
        };
      });

      database.exec("BEGIN IMMEDIATE");
      try {
        for (const entry of prepared) {
          upsertHero.run(
            entry.hero.id,
            entry.hero.ownerId,
            JSON.stringify(entry.hero),
            entry.active,
            entry.createdAt,
            entry.updatedAt,
          );
        }

        if (options.dryRun) database.exec("ROLLBACK");
        else database.exec("COMMIT");
      } catch (error) {
        database.exec("ROLLBACK");
        throw error;
      }

      const mode = options.dryRun ? "Trockenlauf bestanden" : "Import abgeschlossen";
      console.log(`${mode}: ${prepared.length} Helden.`);
      for (const entry of prepared) console.log(`- ${entry.username}: ${entry.hero.name} (${entry.action})`);
    } finally {
      database.close();
    }
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
  }
}
