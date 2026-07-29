import { resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

const [username, role = "master"] = process.argv.slice(2);
if (!username || !["player", "master"].includes(role)) {
  console.error("Verwendung: npm run set-role -- <Benutzername> <master|player>");
  process.exit(1);
}

const databasePath = resolve(process.env.DATABASE_PATH ?? "data/dsa.db");
const database = new DatabaseSync(databasePath);
try {
  const columns = database.prepare("PRAGMA table_info(users)").all();
  if (!columns.some((column) => column.name === "role")) database.exec("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'player'");
  const result = database.prepare("UPDATE users SET role = ? WHERE username = ? COLLATE NOCASE").run(role, username.trim());
  if (result.changes === 0) {
    console.error(`Benutzer „${username}“ wurde nicht gefunden.`);
    process.exitCode = 1;
  } else {
    console.log(`Benutzer „${username}“ hat jetzt die Rolle „${role}“.`);
  }
} finally {
  database.close();
}
