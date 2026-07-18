import { createServer } from "node:http";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { promisify } from "node:util";
import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHash, randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";

const scrypt = promisify(scryptCallback);
const host = process.env.HOST ?? "127.0.0.1";
const port = Number(process.env.PORT ?? 3000);
const databasePath = resolve(process.env.DATABASE_PATH ?? "data/dsa.db");
const sessionLifetimeMs = 30 * 24 * 60 * 60 * 1000;

mkdirSync(dirname(databasePath), { recursive: true });
const database = new DatabaseSync(databasePath);
database.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'player',
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL
  );
`);

const userColumns = database.prepare("PRAGMA table_info(users)").all();
if (!userColumns.some((column) => column.name === "role")) {
  database.exec("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'player'");
}

function createHeroesTable() {
  database.exec(`
    CREATE TABLE IF NOT EXISTS heroes (
      hero_id TEXT NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      data TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (user_id, hero_id)
    );
    CREATE INDEX IF NOT EXISTS heroes_user_updated ON heroes(user_id, updated_at DESC);
  `);
}

const heroColumns = database.prepare("PRAGMA table_info(heroes)").all();
if (!heroColumns.length) {
  createHeroesTable();
} else if (!heroColumns.some((column) => column.name === "hero_id")) {
  database.exec("BEGIN IMMEDIATE");
  try {
    const previousHeroes = database.prepare("SELECT user_id, data, updated_at FROM heroes").all();
    database.exec("ALTER TABLE heroes RENAME TO heroes_legacy");
    createHeroesTable();
    const migrateHero = database.prepare(`
      INSERT INTO heroes (hero_id, user_id, data, active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)
    `);
    for (const row of previousHeroes) {
      const hero = JSON.parse(row.data);
      const heroId = String(hero.id ?? randomUUID());
      const migrated = { ...hero, id: heroId, ownerId: row.user_id };
      migrateHero.run(heroId, row.user_id, JSON.stringify(migrated), migrated.sessionActive ? 1 : 0, row.updated_at, row.updated_at);
    }
    database.exec("DROP TABLE heroes_legacy");
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

const currentHeroColumns = database.prepare("PRAGMA table_info(heroes)").all();
if (!currentHeroColumns.some((column) => column.name === "active")) {
  database.exec("ALTER TABLE heroes ADD COLUMN active INTEGER NOT NULL DEFAULT 0");
}

const queries = {
  userByName: database.prepare("SELECT id, username, password_hash, role FROM users WHERE username = ? COLLATE NOCASE"),
  userBySession: database.prepare(`
    SELECT users.id, users.username, users.role
    FROM sessions JOIN users ON users.id = sessions.user_id
    WHERE sessions.token_hash = ? AND sessions.expires_at > ?
  `),
  insertUser: database.prepare("INSERT INTO users (id, username, password_hash, created_at) VALUES (?, ?, ?, ?)"),
  insertSession: database.prepare("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)"),
  deleteSession: database.prepare("DELETE FROM sessions WHERE token_hash = ?"),
  deleteExpiredSessions: database.prepare("DELETE FROM sessions WHERE expires_at <= ?"),
  heroesByUser: database.prepare("SELECT data FROM heroes WHERE user_id = ? ORDER BY created_at ASC"),
  heroById: database.prepare("SELECT data FROM heroes WHERE user_id = ? AND hero_id = ?"),
  insertHero: database.prepare(`
    INSERT INTO heroes (hero_id, user_id, data, active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)
  `),
  saveHero: database.prepare(`
    UPDATE heroes SET data = ?, active = ?, updated_at = ? WHERE user_id = ? AND hero_id = ?
  `),
  deleteHero: database.prepare("DELETE FROM heroes WHERE user_id = ? AND hero_id = ?"),
  activeHeroesForMaster: database.prepare(`
    SELECT heroes.data, heroes.updated_at, users.username
    FROM heroes JOIN users ON users.id = heroes.user_id
    WHERE heroes.active = 1
    ORDER BY heroes.updated_at DESC
  `),
  heroForMaster: database.prepare(`
    SELECT heroes.data, heroes.updated_at, users.username
    FROM heroes JOIN users ON users.id = heroes.user_id
    WHERE heroes.hero_id = ?
  `),
  saveHeroForMaster: database.prepare("UPDATE heroes SET data = ?, updated_at = ? WHERE hero_id = ?"),
};

function json(response, status, body, extraHeaders = {}) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    ...extraHeaders,
  });
  response.end(JSON.stringify(body));
}

async function readBody(request) {
  let value = "";
  for await (const chunk of request) {
    value += chunk;
    if (value.length > 1_000_000) throw new Error("PAYLOAD_TOO_LARGE");
  }
  if (!value) return {};
  try { return JSON.parse(value); } catch { throw new Error("INVALID_JSON"); }
}

function parseCookies(request) {
  return Object.fromEntries((request.headers.cookie ?? "").split(";").filter(Boolean).map((part) => {
    const index = part.indexOf("=");
    return [part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1))];
  }));
}

function tokenHash(token) {
  return createHash("sha256").update(token).digest("hex");
}

async function passwordHash(password) {
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, 64);
  return `scrypt:${salt.toString("hex")}:${derived.toString("hex")}`;
}

async function passwordMatches(password, stored) {
  const [algorithm, saltHex, hashHex] = stored.split(":");
  if (algorithm !== "scrypt" || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = await scrypt(password, Buffer.from(saltHex, "hex"), expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function sessionCookie(token, maxAge = Math.floor(sessionLifetimeMs / 1000)) {
  const secure = process.env.COOKIE_SECURE === "true" ? "; Secure" : "";
  return `dsa_session=${encodeURIComponent(token)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${secure}`;
}

function createSession(userId) {
  const token = randomBytes(32).toString("base64url");
  queries.insertSession.run(tokenHash(token), userId, Date.now() + sessionLifetimeMs);
  return token;
}

function currentUser(request) {
  const token = parseCookies(request).dsa_session;
  if (!token) return null;
  return queries.userBySession.get(tokenHash(token), Date.now()) ?? null;
}

function requireUser(request, response) {
  const user = currentUser(request);
  if (!user) json(response, 401, { error: "Bitte melde dich erneut an." });
  return user;
}

function requireMaster(request, response) {
  const user = requireUser(request, response);
  if (!user) return null;
  if (user.role !== "master") {
    json(response, 403, { error: "Dieser Bereich ist nur für den Meister zugänglich." });
    return null;
  }
  return user;
}

function validSameOrigin(request) {
  const origin = request.headers.origin;
  if (!origin) return true;
  try { return new URL(origin).host === request.headers.host; } catch { return false; }
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
    if (!url.pathname.startsWith("/api/")) return json(response, 404, { error: "Nicht gefunden." });
    if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method ?? "") && !validSameOrigin(request)) {
      return json(response, 403, { error: "Ungültige Anfragequelle." });
    }

    if (request.method === "GET" && url.pathname === "/api/health") {
      return json(response, 200, { ok: true });
    }
    if (request.method === "GET" && url.pathname === "/api/session") {
      return json(response, 200, { user: currentUser(request) });
    }
    if (request.method === "POST" && url.pathname === "/api/register") {
      const { username, password } = await readBody(request);
      const normalized = typeof username === "string" ? username.trim() : "";
      if (normalized.length < 3 || normalized.length > 40 || typeof password !== "string" || password.length < 8 || password.length > 200) {
        return json(response, 400, { error: "Der Name benötigt 3–40 und das Passwort 8–200 Zeichen." });
      }
      if (queries.userByName.get(normalized)) return json(response, 409, { error: "Dieser Benutzername ist bereits vergeben." });
      const id = randomUUID();
      queries.insertUser.run(id, normalized, await passwordHash(password), new Date().toISOString());
      const token = createSession(id);
      return json(response, 201, { user: { id, username: normalized, role: "player" } }, { "Set-Cookie": sessionCookie(token) });
    }
    if (request.method === "POST" && url.pathname === "/api/login") {
      const { username, password } = await readBody(request);
      const account = typeof username === "string" ? queries.userByName.get(username.trim()) : null;
      if (!account || typeof password !== "string" || !(await passwordMatches(password, account.password_hash))) {
        return json(response, 401, { error: "Benutzername oder Passwort ist nicht korrekt." });
      }
      const token = createSession(account.id);
      return json(response, 200, { user: { id: account.id, username: account.username, role: account.role } }, { "Set-Cookie": sessionCookie(token) });
    }
    if (request.method === "POST" && url.pathname === "/api/logout") {
      const token = parseCookies(request).dsa_session;
      if (token) queries.deleteSession.run(tokenHash(token));
      return json(response, 200, { ok: true }, { "Set-Cookie": sessionCookie("", 0) });
    }
    if (request.method === "GET" && url.pathname === "/api/master/heroes") {
      if (!requireMaster(request, response)) return;
      const heroes = queries.activeHeroesForMaster.all().map((row) => ({ hero: JSON.parse(row.data), username: row.username, updatedAt: row.updated_at }));
      return json(response, 200, { heroes });
    }
    const masterHeroRoute = url.pathname.match(/^\/api\/master\/heroes\/([^/]+)$/);
    if (request.method === "GET" && masterHeroRoute) {
      if (!requireMaster(request, response)) return;
      const row = queries.heroForMaster.get(decodeURIComponent(masterHeroRoute[1]));
      if (!row) return json(response, 404, { error: "Held nicht gefunden." });
      return json(response, 200, { hero: JSON.parse(row.data), username: row.username, updatedAt: row.updated_at });
    }
    const masterStatusRoute = url.pathname.match(/^\/api\/master\/heroes\/([^/]+)\/statuses$/);
    if (request.method === "POST" && masterStatusRoute) {
      if (!requireMaster(request, response)) return;
      const heroId = decodeURIComponent(masterStatusRoute[1]);
      const row = queries.heroForMaster.get(heroId);
      if (!row) return json(response, 404, { error: "Held nicht gefunden." });
      const input = await readBody(request);
      const name = typeof input.name === "string" ? input.name.trim() : "";
      if (!name || name.length > 80) return json(response, 400, { error: "Der Status benötigt einen Namen mit höchstens 80 Zeichen." });
      const hero = JSON.parse(row.data);
      const now = new Date().toISOString();
      const status = {
        id: randomUUID(), name, level: Math.max(1, Math.min(99, Number(input.level) || 1)),
        cause: typeof input.cause === "string" ? input.cause.trim().slice(0, 200) : "",
        duration: typeof input.duration === "string" ? input.duration.trim().slice(0, 200) : "",
        notes: typeof input.notes === "string" ? input.notes.trim().slice(0, 500) : "", source: "master",
      };
      const body = hero.body ?? { parts: [], statuses: [], equipped: {}, history: [] };
      const history = [...(body.history ?? []), { id: randomUUID(), timestamp: now, actor: "master", message: `Status „${status.name}“ (Stufe ${status.level}) vom Meister hinzugefügt.` }].slice(-100);
      const updatedHero = { ...hero, body: { ...body, statuses: [...(body.statuses ?? []), status], history } };
      queries.saveHeroForMaster.run(JSON.stringify(updatedHero), now, heroId);
      return json(response, 201, { hero: updatedHero, status });
    }
    const masterStatusDeleteRoute = url.pathname.match(/^\/api\/master\/heroes\/([^/]+)\/statuses\/([^/]+)$/);
    if (request.method === "DELETE" && masterStatusDeleteRoute) {
      if (!requireMaster(request, response)) return;
      const heroId = decodeURIComponent(masterStatusDeleteRoute[1]);
      const statusId = decodeURIComponent(masterStatusDeleteRoute[2]);
      const row = queries.heroForMaster.get(heroId);
      if (!row) return json(response, 404, { error: "Held nicht gefunden." });
      const hero = JSON.parse(row.data);
      const body = hero.body ?? { parts: [], statuses: [], equipped: {}, history: [] };
      const status = (body.statuses ?? []).find((entry) => entry.id === statusId && entry.source === "master");
      if (!status) return json(response, 404, { error: "Meister-Status nicht gefunden." });
      const now = new Date().toISOString();
      const history = [...(body.history ?? []), { id: randomUUID(), timestamp: now, actor: "master", message: `Status „${status.name}“ vom Meister entfernt.` }].slice(-100);
      const updatedHero = { ...hero, body: { ...body, statuses: body.statuses.filter((entry) => entry.id !== statusId), history } };
      queries.saveHeroForMaster.run(JSON.stringify(updatedHero), now, heroId);
      return json(response, 200, { hero: updatedHero, ok: true });
    }
    if (request.method === "GET" && url.pathname === "/api/heroes") {
      const user = requireUser(request, response);
      if (!user) return;
      const heroes = queries.heroesByUser.all(user.id).map((row) => JSON.parse(row.data));
      return json(response, 200, { heroes });
    }
    if (request.method === "POST" && url.pathname === "/api/heroes") {
      const user = requireUser(request, response);
      if (!user) return;
      const hero = await readBody(request);
      if (!hero || typeof hero !== "object" || Array.isArray(hero)) return json(response, 400, { error: "Ungültige Heldendaten." });
      if (typeof hero.name !== "string" || !hero.name.trim() || hero.name.trim().length > 80) {
        return json(response, 400, { error: "Der Heldenname benötigt 1–80 Zeichen." });
      }
      const heroId = randomUUID();
      const now = new Date().toISOString();
      const safeHero = { ...hero, id: heroId, ownerId: user.id, name: hero.name.trim() };
      queries.insertHero.run(heroId, user.id, JSON.stringify(safeHero), safeHero.sessionActive ? 1 : 0, now, now);
      return json(response, 201, { hero: safeHero });
    }
    const heroRoute = url.pathname.match(/^\/api\/heroes\/([^/]+)$/);
    if (request.method === "PUT" && heroRoute) {
      const user = requireUser(request, response);
      if (!user) return;
      const heroId = decodeURIComponent(heroRoute[1]);
      if (!queries.heroById.get(user.id, heroId)) return json(response, 404, { error: "Held nicht gefunden." });
      const hero = await readBody(request);
      if (!hero || typeof hero !== "object" || Array.isArray(hero)) return json(response, 400, { error: "Ungültige Heldendaten." });
      if (typeof hero.name !== "string" || !hero.name.trim() || hero.name.trim().length > 80) {
        return json(response, 400, { error: "Der Heldenname benötigt 1–80 Zeichen." });
      }
      const safeHero = { ...hero, id: heroId, ownerId: user.id, name: hero.name.trim() };
      queries.saveHero.run(JSON.stringify(safeHero), safeHero.sessionActive ? 1 : 0, new Date().toISOString(), user.id, heroId);
      return json(response, 200, { hero: safeHero });
    }
    if (request.method === "DELETE" && heroRoute) {
      const user = requireUser(request, response);
      if (!user) return;
      const heroId = decodeURIComponent(heroRoute[1]);
      const result = queries.deleteHero.run(user.id, heroId);
      if (result.changes === 0) return json(response, 404, { error: "Held nicht gefunden." });
      return json(response, 200, { ok: true });
    }
    return json(response, 404, { error: "Nicht gefunden." });
  } catch (error) {
    console.error(error);
    if (error instanceof Error && error.message === "PAYLOAD_TOO_LARGE") return json(response, 413, { error: "Die Anfrage ist zu groß." });
    if (error instanceof Error && error.message === "INVALID_JSON") return json(response, 400, { error: "Ungültige JSON-Daten." });
    return json(response, 500, { error: "Interner Serverfehler." });
  }
});

queries.deleteExpiredSessions.run(Date.now());
setInterval(() => queries.deleteExpiredSessions.run(Date.now()), 60 * 60 * 1000).unref();
server.listen(port, host, () => console.log(`DSA API läuft auf http://${host}:${port}`));

function shutdown() {
  server.close(() => { database.close(); process.exit(0); });
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
