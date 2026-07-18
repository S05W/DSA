import { createServer } from "node:http";
import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { promisify } from "node:util";
import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHash, randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";

const scrypt = promisify(scryptCallback);
const host = process.env.HOST ?? "127.0.0.1";
const port = Number(process.env.PORT ?? 3000);
const databasePath = resolve(process.env.DATABASE_PATH ?? "data/dsa.db");
const dataDirectory = dirname(databasePath);
const mapDirectory = resolve(dataDirectory, "uploads", "maps");
const tokenDirectory = resolve(dataDirectory, "uploads", "tokens");
const monsterTokenDirectory = resolve(dataDirectory, "uploads", "monster-tokens");
const legacyMapImagePath = resolve(mapDirectory, "current.png");
const sessionLifetimeMs = 30 * 24 * 60 * 60 * 1000;

mkdirSync(dirname(databasePath), { recursive: true });
mkdirSync(mapDirectory, { recursive: true });
mkdirSync(tokenDirectory, { recursive: true });
mkdirSync(monsterTokenDirectory, { recursive: true });
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

database.exec(`
  CREATE TABLE IF NOT EXISTS game_maps (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    image_version INTEGER NOT NULL DEFAULT 0,
    fog_data TEXT NOT NULL DEFAULT '[]',
    resource_display TEXT NOT NULL DEFAULT 'bars',
    is_active INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE UNIQUE INDEX IF NOT EXISTS one_active_game_map ON game_maps(is_active) WHERE is_active = 1;
  CREATE TABLE IF NOT EXISTS map_hero_tokens (
    map_id TEXT NOT NULL REFERENCES game_maps(id) ON DELETE CASCADE,
    hero_id TEXT NOT NULL,
    x REAL NOT NULL DEFAULT 0.5,
    y REAL NOT NULL DEFAULT 0.5,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (map_id, hero_id)
  );
  CREATE TABLE IF NOT EXISTS map_pins (
    id TEXT PRIMARY KEY,
    map_id TEXT NOT NULL REFERENCES game_maps(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    visibility TEXT NOT NULL DEFAULT 'public',
    x REAL NOT NULL,
    y REAL NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS map_monsters (
    id TEXT PRIMARY KEY,
    map_id TEXT NOT NULL REFERENCES game_maps(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    initials TEXT NOT NULL,
    life_points INTEGER NOT NULL,
    max_life_points INTEGER NOT NULL,
    astral_points INTEGER NOT NULL DEFAULT 0,
    max_astral_points INTEGER NOT NULL DEFAULT 0,
    visible INTEGER NOT NULL DEFAULT 1,
    token_version INTEGER NOT NULL DEFAULT 0,
    notes TEXT NOT NULL DEFAULT '',
    x REAL NOT NULL DEFAULT 0.5,
    y REAL NOT NULL DEFAULT 0.5,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`);

database.exec(`
  CREATE TABLE IF NOT EXISTS map_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    image_version INTEGER NOT NULL DEFAULT 0,
    revealed_data TEXT NOT NULL DEFAULT '[]',
    updated_at TEXT NOT NULL
  );
  INSERT OR IGNORE INTO map_state (id, image_version, revealed_data, updated_at)
  VALUES (1, 0, '[]', '1970-01-01T00:00:00.000Z');
  CREATE TABLE IF NOT EXISTS map_tokens (
    hero_id TEXT PRIMARY KEY,
    x REAL NOT NULL DEFAULT 0.5,
    y REAL NOT NULL DEFAULT 0.5,
    updated_at TEXT NOT NULL
  );
`);

if (database.prepare("SELECT COUNT(*) AS count FROM game_maps").get().count === 0) {
  const legacyState = database.prepare("SELECT image_version, revealed_data, updated_at FROM map_state WHERE id = 1").get();
  const mapId = randomUUID();
  const now = new Date().toISOString();
  const legacyFog = (() => {
    try {
      const items = JSON.parse(legacyState?.revealed_data ?? "[]");
      return JSON.stringify(Array.isArray(items) ? items.map((item) => ({ ...item, shape: "rect", mode: "reveal" })) : []);
    } catch { return "[]"; }
  })();
  database.prepare(`
    INSERT INTO game_maps (id, name, image_version, fog_data, resource_display, is_active, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'bars', 1, ?, ?)
  `).run(mapId, "Karte 1", Number(legacyState?.image_version ?? 0), legacyFog, now, legacyState?.updated_at ?? now);
  const migratePosition = database.prepare("INSERT INTO map_hero_tokens (map_id, hero_id, x, y, updated_at) VALUES (?, ?, ?, ?, ?)");
  for (const position of database.prepare("SELECT hero_id, x, y, updated_at FROM map_tokens").all()) {
    migratePosition.run(mapId, position.hero_id, position.x, position.y, position.updated_at);
  }
  if (existsSync(legacyMapImagePath)) copyFileSync(legacyMapImagePath, resolve(mapDirectory, `${createHash("sha256").update(mapId).digest("hex")}.image`));
}

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
  heroForToken: database.prepare("SELECT data, user_id, active FROM heroes WHERE hero_id = ?"),
  maps: database.prepare("SELECT id, name, image_version, is_active, updated_at FROM game_maps ORDER BY is_active DESC, created_at ASC"),
  mapById: database.prepare("SELECT * FROM game_maps WHERE id = ?"),
  activeMap: database.prepare("SELECT * FROM game_maps WHERE is_active = 1 LIMIT 1"),
  insertMap: database.prepare(`INSERT INTO game_maps (id, name, image_version, fog_data, resource_display, is_active, created_at, updated_at) VALUES (?, ?, 0, '[]', 'bars', ?, ?, ?)`),
  updateMap: database.prepare("UPDATE game_maps SET name = ?, resource_display = ?, updated_at = ? WHERE id = ?"),
  deactivateMaps: database.prepare("UPDATE game_maps SET is_active = 0 WHERE is_active = 1"),
  activateMap: database.prepare("UPDATE game_maps SET is_active = 1, updated_at = ? WHERE id = ?"),
  deleteMap: database.prepare("DELETE FROM game_maps WHERE id = ?"),
  saveMapImageVersion: database.prepare("UPDATE game_maps SET image_version = ?, updated_at = ? WHERE id = ?"),
  saveMapFog: database.prepare("UPDATE game_maps SET fog_data = ?, updated_at = ? WHERE id = ?"),
  activeMapTokens: database.prepare(`
    SELECT heroes.hero_id, heroes.data, users.username, COALESCE(map_hero_tokens.x, 0.5) AS x, COALESCE(map_hero_tokens.y, 0.5) AS y
    FROM heroes JOIN users ON users.id = heroes.user_id
    LEFT JOIN map_hero_tokens ON map_hero_tokens.hero_id = heroes.hero_id AND map_hero_tokens.map_id = ?
    WHERE heroes.active = 1
    ORDER BY users.username, heroes.created_at
  `),
  saveMapTokenPosition: database.prepare(`
    INSERT INTO map_hero_tokens (map_id, hero_id, x, y, updated_at) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(map_id, hero_id) DO UPDATE SET x = excluded.x, y = excluded.y, updated_at = excluded.updated_at
  `),
  deleteMapTokenPositions: database.prepare("DELETE FROM map_hero_tokens WHERE hero_id = ?"),
  pinsByMap: database.prepare("SELECT id, type, name, description, visibility, x, y FROM map_pins WHERE map_id = ? ORDER BY created_at"),
  insertPin: database.prepare("INSERT INTO map_pins (id, map_id, type, name, description, visibility, x, y, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"),
  updatePin: database.prepare("UPDATE map_pins SET type = ?, name = ?, description = ?, visibility = ?, x = ?, y = ?, updated_at = ? WHERE map_id = ? AND id = ?"),
  deletePin: database.prepare("DELETE FROM map_pins WHERE map_id = ? AND id = ?"),
  monstersByMap: database.prepare("SELECT * FROM map_monsters WHERE map_id = ? ORDER BY created_at"),
  monsterById: database.prepare("SELECT * FROM map_monsters WHERE id = ?"),
  insertMonster: database.prepare(`INSERT INTO map_monsters (id, map_id, name, initials, life_points, max_life_points, astral_points, max_astral_points, visible, token_version, notes, x, y, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)`),
  updateMonster: database.prepare(`UPDATE map_monsters SET name = ?, initials = ?, life_points = ?, max_life_points = ?, astral_points = ?, max_astral_points = ?, visible = ?, notes = ?, x = ?, y = ?, updated_at = ? WHERE map_id = ? AND id = ?`),
  updateMonsterPosition: database.prepare("UPDATE map_monsters SET x = ?, y = ?, updated_at = ? WHERE map_id = ? AND id = ?"),
  updateMonsterToken: database.prepare("UPDATE map_monsters SET token_version = ?, updated_at = ? WHERE id = ?"),
  deleteMonster: database.prepare("DELETE FROM map_monsters WHERE map_id = ? AND id = ?"),
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

async function readBinary(request, maximumBytes) {
  const declaredLength = Number(request.headers["content-length"] ?? 0);
  if (declaredLength > maximumBytes) throw new Error("PAYLOAD_TOO_LARGE");
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.from(chunk);
    size += buffer.length;
    if (size > maximumBytes) throw new Error("PAYLOAD_TOO_LARGE");
    chunks.push(buffer);
  }
  return Buffer.concat(chunks);
}

function imageMimeType(buffer) {
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    return "image/png";
  }
  if (buffer.length >= 4 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer.at(-2) === 0xff && buffer.at(-1) === 0xd9) {
    return "image/jpeg";
  }
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP") {
    return "image/webp";
  }
  return null;
}

function writeAtomic(path, buffer) {
  const temporaryPath = `${path}.${process.pid}.tmp`;
  writeFileSync(temporaryPath, buffer, { mode: 0o600 });
  renameSync(temporaryPath, path);
}

function tokenPathFor(heroId) {
  const fileName = `${createHash("sha256").update(heroId).digest("hex")}.png`;
  return resolve(tokenDirectory, fileName);
}

function mapImagePathFor(mapId) {
  return resolve(mapDirectory, `${createHash("sha256").update(mapId).digest("hex")}.image`);
}

function monsterTokenPathFor(monsterId) {
  return resolve(monsterTokenDirectory, `${createHash("sha256").update(monsterId).digest("hex")}.image`);
}

function sendImage(response, path, version) {
  if (!existsSync(path)) return json(response, 404, { error: "Bilddatei nicht gefunden." });
  const data = readFileSync(path);
  const mimeType = imageMimeType(data);
  if (!mimeType) return json(response, 500, { error: "Die gespeicherte Bilddatei ist ungültig." });
  response.writeHead(200, {
    "Content-Type": mimeType,
    "Content-Length": data.length,
    "Cache-Control": "private, max-age=31536000, immutable",
    "ETag": `\"${version}\"`,
    "X-Content-Type-Options": "nosniff",
  });
  response.end(data);
}

function mapSummary(row) {
  return { id: row.id, name: row.name, imageVersion: Number(row.image_version), isActive: row.is_active === 1, updatedAt: row.updated_at };
}

function monsterFromRow(row) {
  return {
    kind: "monster", id: row.id, name: row.name, initials: row.initials,
    x: row.x, y: row.y, lifePoints: row.life_points, maxLifePoints: row.max_life_points,
    astralPoints: row.astral_points, maxAstralPoints: row.max_astral_points,
    visible: row.visible === 1, tokenVersion: Number(row.token_version), notes: row.notes,
  };
}

function mapSnapshot(mapId, master = false) {
  const state = mapId ? queries.mapById.get(mapId) : queries.activeMap.get();
  if (!state) return null;
  let fog = [];
  try { fog = JSON.parse(state.fog_data); } catch { fog = []; }
  const tokens = queries.activeMapTokens.all(state.id).map((row) => {
    const hero = JSON.parse(row.data);
    return {
      kind: "hero", heroId: row.hero_id, heroName: hero.name, initials: hero.initials, username: row.username, x: row.x, y: row.y,
      tokenVersion: Number(hero.mapTokenVersion ?? 0),
      lifePoints: Number(hero.lifePoints ?? 0), maxLifePoints: Number(hero.maxLifePoints ?? 0),
      astralPoints: Number(hero.astralPoints ?? 0), maxAstralPoints: Number(hero.maxAstralPoints ?? 0),
      statusCount: Array.isArray(hero.body?.statuses) ? hero.body.statuses.length : 0,
    };
  });
  const pins = queries.pinsByMap.all(state.id).filter((pin) => master || pin.visibility === "public");
  const monsters = queries.monstersByMap.all(state.id).filter((monster) => master || monster.visible === 1).map(monsterFromRow);
  return { ...mapSummary(state), resourceDisplay: state.resource_display, fog, tokens, pins, monsters };
}

function safeCoordinate(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(1, number)) : null;
}

function safeFogShape(item) {
  if (!item || typeof item !== "object") return null;
  const id = typeof item.id === "string" ? item.id.slice(0, 80) : randomUUID();
  const mode = item.mode === "hide" ? "hide" : "reveal";
  if (item.shape === "brush") {
    const radiusX = Number(item.radiusX);
    const radiusY = Number(item.radiusY);
    if (!Number.isFinite(radiusX) || !Number.isFinite(radiusY) || radiusX < 0.0005 || radiusX > 0.5 || radiusY < 0.0005 || radiusY > 0.5 || !Array.isArray(item.points) || !item.points.length || item.points.length > 1200) return null;
    const points = item.points.map((point) => ({ x: safeCoordinate(point?.x), y: safeCoordinate(point?.y) }));
    if (points.some((point) => point.x === null || point.y === null)) return null;
    return { id, shape: "brush", mode, radiusX, radiusY, points };
  }
  const x = safeCoordinate(item.x);
  const y = safeCoordinate(item.y);
  const width = Math.max(0, Math.min(1 - (x ?? 0), Number(item.width)));
  const height = Math.max(0, Math.min(1 - (y ?? 0), Number(item.height)));
  if (x === null || y === null || !Number.isFinite(width) || !Number.isFinite(height) || width < 0.002 || height < 0.002) return null;
  return { id, shape: "rect", mode, x, y, width, height };
}

function initialsForName(name) {
  return name.split(/\s+/).filter(Boolean).slice(0, 3).map((part) => part[0]?.toUpperCase()).join("") || "?";
}

function safeInteger(value, minimum, maximum, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(minimum, Math.min(maximum, Math.round(number))) : fallback;
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
    if (request.method === "GET" && url.pathname === "/api/map") {
      if (!requireUser(request, response)) return;
      const map = mapSnapshot(null, false);
      return map ? json(response, 200, { map }) : json(response, 404, { error: "Es ist keine aktive Karte vorhanden." });
    }
    if (request.method === "GET" && url.pathname === "/api/map/image") {
      if (!requireUser(request, response)) return;
      const state = queries.activeMap.get();
      return state ? sendImage(response, mapImagePathFor(state.id), state.image_version) : json(response, 404, { error: "Es ist keine aktive Karte vorhanden." });
    }
    const mapImageRoute = url.pathname.match(/^\/api\/maps\/([^/]+)\/image$/);
    if (request.method === "GET" && mapImageRoute) {
      const user = requireUser(request, response);
      if (!user) return;
      const state = queries.mapById.get(decodeURIComponent(mapImageRoute[1]));
      if (!state) return json(response, 404, { error: "Karte nicht gefunden." });
      if (state.is_active !== 1 && user.role !== "master") return json(response, 403, { error: "Diese Karte ist nicht für Spieler freigegeben." });
      return sendImage(response, mapImagePathFor(state.id), state.image_version);
    }
    const heroTokenRoute = url.pathname.match(/^\/api\/heroes\/([^/]+)\/token$/);
    if (request.method === "GET" && heroTokenRoute) {
      const user = requireUser(request, response);
      if (!user) return;
      const heroId = decodeURIComponent(heroTokenRoute[1]);
      const row = queries.heroForToken.get(heroId);
      if (!row) return json(response, 404, { error: "Held nicht gefunden." });
      if (row.user_id !== user.id && user.role !== "master" && row.active !== 1) return json(response, 403, { error: "Token ist nicht zugänglich." });
      const hero = JSON.parse(row.data);
      if (!hero.mapTokenVersion) return json(response, 404, { error: "Für diesen Helden wurde noch kein Token hochgeladen." });
      return sendImage(response, tokenPathFor(heroId), hero.mapTokenVersion);
    }
    if (request.method === "PUT" && heroTokenRoute) {
      const user = requireUser(request, response);
      if (!user) return;
      const heroId = decodeURIComponent(heroTokenRoute[1]);
      const row = queries.heroById.get(user.id, heroId);
      if (!row) return json(response, 404, { error: "Held nicht gefunden." });
      const declaredType = String(request.headers["content-type"] ?? "").toLowerCase().split(";", 1)[0];
      if (!["image/png", "image/jpeg", "image/jpg", "image/webp"].includes(declaredType)) return json(response, 415, { error: "Das Heldentoken muss eine PNG-, JPG- oder WebP-Datei sein." });
      const image = await readBinary(request, 2 * 1024 * 1024);
      if (!imageMimeType(image)) return json(response, 400, { error: "Die Datei ist kein gültiges PNG, JPG oder WebP." });
      writeAtomic(tokenPathFor(heroId), image);
      const hero = JSON.parse(row.data);
      const updatedHero = { ...hero, mapTokenVersion: Date.now() };
      queries.saveHero.run(JSON.stringify(updatedHero), updatedHero.sessionActive ? 1 : 0, new Date().toISOString(), user.id, heroId);
      return json(response, 200, { hero: updatedHero });
    }
    const monsterTokenRoute = url.pathname.match(/^\/api\/monsters\/([^/]+)\/token$/);
    if (request.method === "GET" && monsterTokenRoute) {
      const user = requireUser(request, response);
      if (!user) return;
      const monster = queries.monsterById.get(decodeURIComponent(monsterTokenRoute[1]));
      if (!monster) return json(response, 404, { error: "Monster nicht gefunden." });
      const monsterMap = queries.mapById.get(monster.map_id);
      if (user.role !== "master" && (monster.visible !== 1 || monsterMap?.is_active !== 1)) return json(response, 403, { error: "Dieses Monster ist nicht sichtbar." });
      if (!monster.token_version) return json(response, 404, { error: "Für dieses Monster wurde noch kein Token hochgeladen." });
      return sendImage(response, monsterTokenPathFor(monster.id), monster.token_version);
    }
    if (request.method === "GET" && url.pathname === "/api/master/maps") {
      if (!requireMaster(request, response)) return;
      return json(response, 200, { maps: queries.maps.all().map(mapSummary) });
    }
    if (request.method === "POST" && url.pathname === "/api/master/maps") {
      if (!requireMaster(request, response)) return;
      const input = await readBody(request);
      const name = typeof input.name === "string" ? input.name.trim() : "";
      if (!name || name.length > 80) return json(response, 400, { error: "Der Kartenname benötigt 1–80 Zeichen." });
      const id = randomUUID();
      const now = new Date().toISOString();
      const isFirst = queries.maps.all().length === 0 ? 1 : 0;
      queries.insertMap.run(id, name, isFirst, now, now);
      return json(response, 201, { map: mapSnapshot(id, true) });
    }
    const masterMapRoute = url.pathname.match(/^\/api\/master\/maps\/([^/]+)$/);
    if (request.method === "GET" && masterMapRoute) {
      if (!requireMaster(request, response)) return;
      const map = mapSnapshot(decodeURIComponent(masterMapRoute[1]), true);
      return map ? json(response, 200, { map }) : json(response, 404, { error: "Karte nicht gefunden." });
    }
    if (request.method === "PUT" && masterMapRoute) {
      if (!requireMaster(request, response)) return;
      const mapId = decodeURIComponent(masterMapRoute[1]);
      const current = queries.mapById.get(mapId);
      if (!current) return json(response, 404, { error: "Karte nicht gefunden." });
      const input = await readBody(request);
      const name = typeof input.name === "string" ? input.name.trim() : current.name;
      const resourceDisplay = ["numbers", "bars", "hidden"].includes(input.resourceDisplay) ? input.resourceDisplay : current.resource_display;
      if (!name || name.length > 80) return json(response, 400, { error: "Der Kartenname benötigt 1–80 Zeichen." });
      queries.updateMap.run(name, resourceDisplay, new Date().toISOString(), mapId);
      return json(response, 200, { map: mapSnapshot(mapId, true) });
    }
    if (request.method === "DELETE" && masterMapRoute) {
      if (!requireMaster(request, response)) return;
      const mapId = decodeURIComponent(masterMapRoute[1]);
      const current = queries.mapById.get(mapId);
      if (!current) return json(response, 404, { error: "Karte nicht gefunden." });
      const maps = queries.maps.all();
      if (maps.length <= 1) return json(response, 409, { error: "Die letzte Karte kann nicht gelöscht werden." });
      const replacement = maps.find((map) => map.id !== mapId);
      const monsters = queries.monstersByMap.all(mapId);
      database.exec("BEGIN IMMEDIATE");
      try {
        if (current.is_active === 1) {
          queries.deactivateMaps.run();
          queries.activateMap.run(new Date().toISOString(), replacement.id);
        }
        queries.deleteMap.run(mapId);
        database.exec("COMMIT");
      } catch (error) { database.exec("ROLLBACK"); throw error; }
      const imagePath = mapImagePathFor(mapId);
      if (existsSync(imagePath)) unlinkSync(imagePath);
      for (const monster of monsters) {
        const tokenPath = monsterTokenPathFor(monster.id);
        if (existsSync(tokenPath)) unlinkSync(tokenPath);
      }
      return json(response, 200, { ok: true });
    }
    const activateMapRoute = url.pathname.match(/^\/api\/master\/maps\/([^/]+)\/activate$/);
    if (request.method === "PUT" && activateMapRoute) {
      if (!requireMaster(request, response)) return;
      const mapId = decodeURIComponent(activateMapRoute[1]);
      if (!queries.mapById.get(mapId)) return json(response, 404, { error: "Karte nicht gefunden." });
      database.exec("BEGIN IMMEDIATE");
      try {
        queries.deactivateMaps.run();
        queries.activateMap.run(new Date().toISOString(), mapId);
        database.exec("COMMIT");
      } catch (error) { database.exec("ROLLBACK"); throw error; }
      return json(response, 200, { map: mapSnapshot(mapId, true) });
    }
    const masterMapImageRoute = url.pathname.match(/^\/api\/master\/maps\/([^/]+)\/image$/);
    if (request.method === "PUT" && masterMapImageRoute) {
      if (!requireMaster(request, response)) return;
      const mapId = decodeURIComponent(masterMapImageRoute[1]);
      if (!queries.mapById.get(mapId)) return json(response, 404, { error: "Karte nicht gefunden." });
      const declaredType = String(request.headers["content-type"] ?? "").toLowerCase().split(";", 1)[0];
      if (!["image/png", "image/jpeg", "image/jpg", "image/webp"].includes(declaredType)) return json(response, 415, { error: "Die Karte muss eine PNG-, JPG- oder WebP-Datei sein." });
      const image = await readBinary(request, 20 * 1024 * 1024);
      if (!imageMimeType(image)) return json(response, 400, { error: "Die Datei ist kein gültiges PNG, JPG oder WebP." });
      writeAtomic(mapImagePathFor(mapId), image);
      queries.saveMapImageVersion.run(Date.now(), new Date().toISOString(), mapId);
      return json(response, 200, { map: mapSnapshot(mapId, true) });
    }
    const masterMapFogRoute = url.pathname.match(/^\/api\/master\/maps\/([^/]+)\/fog$/);
    if (request.method === "PUT" && masterMapFogRoute) {
      if (!requireMaster(request, response)) return;
      const mapId = decodeURIComponent(masterMapFogRoute[1]);
      if (!queries.mapById.get(mapId)) return json(response, 404, { error: "Karte nicht gefunden." });
      const input = await readBody(request);
      if (!Array.isArray(input?.fog) || input.fog.length > 1000) return json(response, 400, { error: "Die Nebelmaske ist ungültig oder zu groß." });
      const fog = input.fog.map(safeFogShape).filter(Boolean);
      const pointCount = fog.reduce((sum, shape) => sum + (shape.shape === "brush" ? shape.points.length : 0), 0);
      if (fog.length !== input.fog.length || pointCount > 12000) return json(response, 400, { error: "Mindestens ein Nebelbereich ist ungültig oder die Maske ist zu groß." });
      queries.saveMapFog.run(JSON.stringify(fog), new Date().toISOString(), mapId);
      return json(response, 200, { map: mapSnapshot(mapId, true) });
    }
    const heroPositionRoute = url.pathname.match(/^\/api\/master\/maps\/([^/]+)\/heroes\/([^/]+)\/position$/);
    if (request.method === "PUT" && heroPositionRoute) {
      if (!requireMaster(request, response)) return;
      const mapId = decodeURIComponent(heroPositionRoute[1]);
      const heroId = decodeURIComponent(heroPositionRoute[2]);
      if (!queries.mapById.get(mapId)) return json(response, 404, { error: "Karte nicht gefunden." });
      if (!queries.heroForToken.get(heroId)) return json(response, 404, { error: "Held nicht gefunden." });
      const input = await readBody(request);
      const x = safeCoordinate(input?.x); const y = safeCoordinate(input?.y);
      if (x === null || y === null) return json(response, 400, { error: "Ungültige Tokenposition." });
      queries.saveMapTokenPosition.run(mapId, heroId, x, y, new Date().toISOString());
      return json(response, 200, { map: mapSnapshot(mapId, true) });
    }
    const pinCollectionRoute = url.pathname.match(/^\/api\/master\/maps\/([^/]+)\/pins$/);
    if (request.method === "POST" && pinCollectionRoute) {
      if (!requireMaster(request, response)) return;
      const mapId = decodeURIComponent(pinCollectionRoute[1]);
      if (!queries.mapById.get(mapId)) return json(response, 404, { error: "Karte nicht gefunden." });
      const input = await readBody(request);
      const name = typeof input.name === "string" ? input.name.trim() : "";
      const type = ["shop", "tavern", "place", "npc", "quest", "treasure", "door", "trap"].includes(input.type) ? input.type : "place";
      const visibility = input.visibility === "master" ? "master" : "public";
      const x = safeCoordinate(input.x); const y = safeCoordinate(input.y);
      if (!name || name.length > 80 || x === null || y === null) return json(response, 400, { error: "Der Pin benötigt einen Namen und eine gültige Position." });
      const now = new Date().toISOString();
      queries.insertPin.run(randomUUID(), mapId, type, name, typeof input.description === "string" ? input.description.trim().slice(0, 1000) : "", visibility, x, y, now, now);
      return json(response, 201, { map: mapSnapshot(mapId, true) });
    }
    const pinRoute = url.pathname.match(/^\/api\/master\/maps\/([^/]+)\/pins\/([^/]+)$/);
    if (["PUT", "DELETE"].includes(request.method ?? "") && pinRoute) {
      if (!requireMaster(request, response)) return;
      const mapId = decodeURIComponent(pinRoute[1]); const pinId = decodeURIComponent(pinRoute[2]);
      if (request.method === "DELETE") {
        if (queries.deletePin.run(mapId, pinId).changes === 0) return json(response, 404, { error: "Pin nicht gefunden." });
      } else {
        const input = await readBody(request);
        const name = typeof input.name === "string" ? input.name.trim() : "";
        const type = ["shop", "tavern", "place", "npc", "quest", "treasure", "door", "trap"].includes(input.type) ? input.type : "place";
        const visibility = input.visibility === "master" ? "master" : "public";
        const x = safeCoordinate(input.x); const y = safeCoordinate(input.y);
        if (!name || name.length > 80 || x === null || y === null) return json(response, 400, { error: "Der Pin benötigt einen Namen und eine gültige Position." });
        if (queries.updatePin.run(type, name, typeof input.description === "string" ? input.description.trim().slice(0, 1000) : "", visibility, x, y, new Date().toISOString(), mapId, pinId).changes === 0) return json(response, 404, { error: "Pin nicht gefunden." });
      }
      return json(response, 200, { map: mapSnapshot(mapId, true) });
    }
    const monsterCollectionRoute = url.pathname.match(/^\/api\/master\/maps\/([^/]+)\/monsters$/);
    if (request.method === "POST" && monsterCollectionRoute) {
      if (!requireMaster(request, response)) return;
      const mapId = decodeURIComponent(monsterCollectionRoute[1]);
      if (!queries.mapById.get(mapId)) return json(response, 404, { error: "Karte nicht gefunden." });
      const input = await readBody(request);
      const name = typeof input.name === "string" ? input.name.trim() : "";
      if (!name || name.length > 80) return json(response, 400, { error: "Das Monster benötigt einen Namen mit höchstens 80 Zeichen." });
      const maxLife = safeInteger(input.maxLifePoints, 1, 9999, 10); const maxAstral = safeInteger(input.maxAstralPoints, 0, 9999, 0);
      const life = safeInteger(input.lifePoints, 0, maxLife, maxLife); const astral = safeInteger(input.astralPoints, 0, maxAstral, maxAstral);
      const x = safeCoordinate(input.x) ?? 0.5; const y = safeCoordinate(input.y) ?? 0.5;
      const now = new Date().toISOString();
      queries.insertMonster.run(randomUUID(), mapId, name, initialsForName(name), life, maxLife, astral, maxAstral, input.visible === false ? 0 : 1, typeof input.notes === "string" ? input.notes.trim().slice(0, 1000) : "", x, y, now, now);
      return json(response, 201, { map: mapSnapshot(mapId, true) });
    }
    const monsterRoute = url.pathname.match(/^\/api\/master\/maps\/([^/]+)\/monsters\/([^/]+)$/);
    if (["PUT", "DELETE"].includes(request.method ?? "") && monsterRoute) {
      if (!requireMaster(request, response)) return;
      const mapId = decodeURIComponent(monsterRoute[1]); const monsterId = decodeURIComponent(monsterRoute[2]);
      const current = queries.monsterById.get(monsterId);
      if (!current || current.map_id !== mapId) return json(response, 404, { error: "Monster nicht gefunden." });
      if (request.method === "DELETE") {
        queries.deleteMonster.run(mapId, monsterId);
        const tokenPath = monsterTokenPathFor(monsterId); if (existsSync(tokenPath)) unlinkSync(tokenPath);
      } else {
        const input = await readBody(request);
        const name = typeof input.name === "string" ? input.name.trim() : "";
        if (!name || name.length > 80) return json(response, 400, { error: "Das Monster benötigt einen Namen mit höchstens 80 Zeichen." });
        const maxLife = safeInteger(input.maxLifePoints, 1, 9999, current.max_life_points); const maxAstral = safeInteger(input.maxAstralPoints, 0, 9999, current.max_astral_points);
        const life = safeInteger(input.lifePoints, 0, maxLife, current.life_points); const astral = safeInteger(input.astralPoints, 0, maxAstral, current.astral_points);
        const x = safeCoordinate(input.x) ?? current.x; const y = safeCoordinate(input.y) ?? current.y;
        queries.updateMonster.run(name, initialsForName(name), life, maxLife, astral, maxAstral, input.visible === false ? 0 : 1, typeof input.notes === "string" ? input.notes.trim().slice(0, 1000) : "", x, y, new Date().toISOString(), mapId, monsterId);
      }
      return json(response, 200, { map: mapSnapshot(mapId, true) });
    }
    const monsterPositionRoute = url.pathname.match(/^\/api\/master\/maps\/([^/]+)\/monsters\/([^/]+)\/position$/);
    if (request.method === "PUT" && monsterPositionRoute) {
      if (!requireMaster(request, response)) return;
      const mapId = decodeURIComponent(monsterPositionRoute[1]); const monsterId = decodeURIComponent(monsterPositionRoute[2]);
      const input = await readBody(request); const x = safeCoordinate(input.x); const y = safeCoordinate(input.y);
      if (x === null || y === null) return json(response, 400, { error: "Ungültige Tokenposition." });
      if (queries.updateMonsterPosition.run(x, y, new Date().toISOString(), mapId, monsterId).changes === 0) return json(response, 404, { error: "Monster nicht gefunden." });
      return json(response, 200, { map: mapSnapshot(mapId, true) });
    }
    const monsterTokenUploadRoute = url.pathname.match(/^\/api\/master\/monsters\/([^/]+)\/token$/);
    if (request.method === "PUT" && monsterTokenUploadRoute) {
      if (!requireMaster(request, response)) return;
      const monsterId = decodeURIComponent(monsterTokenUploadRoute[1]);
      const monster = queries.monsterById.get(monsterId);
      if (!monster) return json(response, 404, { error: "Monster nicht gefunden." });
      const declaredType = String(request.headers["content-type"] ?? "").toLowerCase().split(";", 1)[0];
      if (!["image/png", "image/jpeg", "image/jpg", "image/webp"].includes(declaredType)) return json(response, 415, { error: "Das Monstertoken muss eine PNG-, JPG- oder WebP-Datei sein." });
      const image = await readBinary(request, 2 * 1024 * 1024);
      if (!imageMimeType(image)) return json(response, 400, { error: "Die Datei ist kein gültiges PNG, JPG oder WebP." });
      writeAtomic(monsterTokenPathFor(monsterId), image);
      queries.updateMonsterToken.run(Date.now(), new Date().toISOString(), monsterId);
      return json(response, 200, { map: mapSnapshot(monster.map_id, true) });
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
      queries.deleteMapTokenPositions.run(heroId);
      const tokenPath = tokenPathFor(heroId);
      if (existsSync(tokenPath)) unlinkSync(tokenPath);
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
