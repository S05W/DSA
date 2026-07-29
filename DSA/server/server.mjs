import { createServer } from "node:http";
import { closeSync, copyFileSync, createReadStream, existsSync, mkdirSync, openSync, readSync, renameSync, statfsSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { cpus, freemem, hostname, loadavg, totalmem, uptime } from "node:os";
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
const handoutDirectory = resolve(dataDirectory, "uploads", "handouts");
const legacyMapImagePath = resolve(mapDirectory, "current.png");
const sessionLifetimeMs = 30 * 24 * 60 * 60 * 1000;

mkdirSync(dirname(databasePath), { recursive: true });
mkdirSync(mapDirectory, { recursive: true });
mkdirSync(tokenDirectory, { recursive: true });
mkdirSync(monsterTokenDirectory, { recursive: true });
mkdirSync(handoutDirectory, { recursive: true });
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
  CREATE TABLE IF NOT EXISTS handouts (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT 'other',
    recipient_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    original_file_name TEXT NOT NULL DEFAULT '',
    mime_type TEXT NOT NULL DEFAULT '',
    file_size INTEGER NOT NULL DEFAULT 0,
    asset_version INTEGER NOT NULL DEFAULT 0,
    is_published INTEGER NOT NULL DEFAULT 0,
    is_featured INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0,
    revealed_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS handouts_visibility
    ON handouts(is_published, recipient_user_id, is_featured, sort_order);
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
  activeMapRevision: database.prepare("SELECT id, updated_at FROM game_maps WHERE is_active = 1 LIMIT 1"),
  insertMap: database.prepare(`INSERT INTO game_maps (id, name, image_version, fog_data, resource_display, is_active, created_at, updated_at) VALUES (?, ?, 0, '[]', 'bars', ?, ?, ?)`),
  updateMap: database.prepare("UPDATE game_maps SET name = ?, resource_display = ?, updated_at = ? WHERE id = ?"),
  deactivateMaps: database.prepare("UPDATE game_maps SET is_active = 0 WHERE is_active = 1"),
  activateMap: database.prepare("UPDATE game_maps SET is_active = 1, updated_at = ? WHERE id = ?"),
  deleteMap: database.prepare("DELETE FROM game_maps WHERE id = ?"),
  saveMapImageVersion: database.prepare("UPDATE game_maps SET image_version = ?, updated_at = ? WHERE id = ?"),
  saveMapFog: database.prepare("UPDATE game_maps SET fog_data = ?, updated_at = ? WHERE id = ?"),
  touchMap: database.prepare("UPDATE game_maps SET updated_at = ? WHERE id = ?"),
  touchActiveMap: database.prepare("UPDATE game_maps SET updated_at = ? WHERE is_active = 1"),
  activeMapTokens: database.prepare(`
    SELECT
      heroes.hero_id,
      users.username,
      COALESCE(map_hero_tokens.x, 0.5) AS x,
      COALESCE(map_hero_tokens.y, 0.5) AS y,
      json_extract(heroes.data, '$.name') AS hero_name,
      json_extract(heroes.data, '$.initials') AS hero_initials,
      COALESCE(json_extract(heroes.data, '$.mapTokenVersion'), 0) AS token_version,
      COALESCE(json_extract(heroes.data, '$.lifePoints'), 0) AS life_points,
      COALESCE(json_extract(heroes.data, '$.maxLifePoints'), 0) AS max_life_points,
      COALESCE(json_extract(heroes.data, '$.astralPoints'), 0) AS astral_points,
      COALESCE(json_extract(heroes.data, '$.maxAstralPoints'), 0) AS max_astral_points,
      COALESCE(json_array_length(heroes.data, '$.body.statuses'), 0) AS status_count
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
  publicPinsByMap: database.prepare("SELECT id, type, name, description, visibility, x, y FROM map_pins WHERE map_id = ? AND visibility = 'public' ORDER BY created_at"),
  insertPin: database.prepare("INSERT INTO map_pins (id, map_id, type, name, description, visibility, x, y, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"),
  updatePin: database.prepare("UPDATE map_pins SET type = ?, name = ?, description = ?, visibility = ?, x = ?, y = ?, updated_at = ? WHERE map_id = ? AND id = ?"),
  deletePin: database.prepare("DELETE FROM map_pins WHERE map_id = ? AND id = ?"),
  monstersByMap: database.prepare("SELECT * FROM map_monsters WHERE map_id = ? ORDER BY created_at"),
  publicMonstersByMap: database.prepare("SELECT * FROM map_monsters WHERE map_id = ? AND visible = 1 ORDER BY created_at"),
  monsterById: database.prepare("SELECT * FROM map_monsters WHERE id = ?"),
  insertMonster: database.prepare(`INSERT INTO map_monsters (id, map_id, name, initials, life_points, max_life_points, astral_points, max_astral_points, visible, token_version, notes, x, y, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)`),
  updateMonster: database.prepare(`UPDATE map_monsters SET name = ?, initials = ?, life_points = ?, max_life_points = ?, astral_points = ?, max_astral_points = ?, visible = ?, notes = ?, x = ?, y = ?, updated_at = ? WHERE map_id = ? AND id = ?`),
  updateMonsterPosition: database.prepare("UPDATE map_monsters SET x = ?, y = ?, updated_at = ? WHERE map_id = ? AND id = ?"),
  updateMonsterToken: database.prepare("UPDATE map_monsters SET token_version = ?, updated_at = ? WHERE id = ?"),
  deleteMonster: database.prepare("DELETE FROM map_monsters WHERE map_id = ? AND id = ?"),
  handoutsForMaster: database.prepare(`
    SELECT handouts.*, users.username AS recipient_username
    FROM handouts LEFT JOIN users ON users.id = handouts.recipient_user_id
    ORDER BY handouts.is_featured DESC, handouts.sort_order ASC, handouts.created_at DESC
  `),
  handoutsForUser: database.prepare(`
    SELECT handouts.*, users.username AS recipient_username
    FROM handouts LEFT JOIN users ON users.id = handouts.recipient_user_id
    WHERE handouts.is_published = 1
      AND (handouts.recipient_user_id IS NULL OR handouts.recipient_user_id = ?)
      AND handouts.asset_version > 0
    ORDER BY handouts.is_featured DESC, handouts.sort_order ASC, handouts.revealed_at DESC, handouts.created_at DESC
  `),
  handoutById: database.prepare(`
    SELECT handouts.*, users.username AS recipient_username
    FROM handouts LEFT JOIN users ON users.id = handouts.recipient_user_id
    WHERE handouts.id = ?
  `),
  handoutRecipients: database.prepare("SELECT id, username FROM users WHERE role = 'player' ORDER BY username COLLATE NOCASE"),
  handoutRecipientById: database.prepare("SELECT id FROM users WHERE id = ? AND role = 'player'"),
  handoutMaximumOrder: database.prepare("SELECT COALESCE(MAX(sort_order), 0) AS maximum FROM handouts"),
  insertHandout: database.prepare(`
    INSERT INTO handouts (
      id, title, description, category, recipient_user_id, original_file_name,
      mime_type, file_size, asset_version, is_published, is_featured,
      sort_order, revealed_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, '', 0, 0, 0, ?, ?, NULL, ?, ?)
  `),
  updateHandout: database.prepare(`
    UPDATE handouts
    SET title = ?, description = ?, category = ?, recipient_user_id = ?,
        is_published = ?, is_featured = ?, revealed_at = ?, updated_at = ?
    WHERE id = ?
  `),
  updateHandoutAsset: database.prepare(`
    UPDATE handouts
    SET original_file_name = ?, mime_type = ?, file_size = ?, asset_version = ?, updated_at = ?
    WHERE id = ?
  `),
  deleteHandout: database.prepare("DELETE FROM handouts WHERE id = ?"),
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

function imageMimeTypeFromHeader(buffer) {
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return "image/png";
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
  return null;
}

function safeSvg(buffer) {
  const value = buffer.toString("utf8").trim();
  if (!/^<svg[\s>]/i.test(value.replace(/^<\?xml[^>]*>\s*/i, ""))) return false;
  const dangerousMarkup = /<\s*(script|foreignObject|iframe|object|embed|audio|video|canvas|link|meta)\b|<!DOCTYPE|<!ENTITY|<\?xml-stylesheet/i;
  const dangerousAttribute = /\son[a-z]+\s*=|(?:href|xlink:href)\s*=\s*["']\s*(?:javascript:|https?:|\/\/|data:)|url\s*\(\s*["']?\s*(?:https?:|\/\/|data:)|@import/i;
  return !dangerousMarkup.test(value) && !dangerousAttribute.test(value);
}

function handoutMimeType(buffer, declaredType) {
  const rasterType = imageMimeType(buffer);
  if (rasterType) return rasterType;
  return declaredType === "image/svg+xml" && safeSvg(buffer) ? "image/svg+xml" : null;
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

function handoutPathFor(handoutId) {
  return resolve(handoutDirectory, `${createHash("sha256").update(handoutId).digest("hex")}.asset`);
}

function sendImage(response, path, version) {
  if (!existsSync(path)) return json(response, 404, { error: "Bilddatei nicht gefunden." });
  const descriptor = openSync(path, "r");
  const header = Buffer.alloc(16);
  const headerLength = readSync(descriptor, header, 0, header.length, 0);
  closeSync(descriptor);
  const mimeType = imageMimeTypeFromHeader(header.subarray(0, headerLength));
  if (!mimeType) return json(response, 500, { error: "Die gespeicherte Bilddatei ist ungültig." });
  const file = statSync(path);
  response.writeHead(200, {
    "Content-Type": mimeType,
    "Content-Length": file.size,
    "Cache-Control": "private, max-age=31536000, immutable",
    "ETag": `\"${version}\"`,
    "X-Content-Type-Options": "nosniff",
  });
  const stream = createReadStream(path);
  stream.on("error", (error) => {
    console.error("Bild konnte nicht gelesen werden:", error);
    response.destroy(error);
  });
  stream.pipe(response);
}

function safeDownloadName(value, mimeType) {
  const extension = mimeType === "image/svg+xml" ? ".svg" : mimeType === "image/png" ? ".png" : ".jpg";
  const trimmed = String(value ?? "").trim().replace(/[\u0000-\u001f\u007f"\\/]/g, "_").slice(0, 140);
  if (!trimmed) return `handout${extension}`;
  return /\.[a-z0-9]{2,5}$/i.test(trimmed) ? trimmed : `${trimmed}${extension}`;
}

function sendHandoutImage(response, row, download = false) {
  const path = handoutPathFor(row.id);
  if (!row.asset_version || !existsSync(path)) return json(response, 404, { error: "Für dieses Handout wurde noch kein Bild hochgeladen." });
  const file = statSync(path);
  const fileName = safeDownloadName(row.original_file_name || row.title, row.mime_type);
  const asciiName = fileName.replace(/[^\x20-\x7e]/g, "_");
  response.writeHead(200, {
    "Content-Type": row.mime_type,
    "Content-Length": file.size,
    "Cache-Control": "private, max-age=31536000, immutable",
    "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    "Content-Security-Policy": row.mime_type === "image/svg+xml" ? "default-src 'none'; style-src 'unsafe-inline'; sandbox" : "default-src 'none'; sandbox",
    "ETag": `\"${row.asset_version}\"`,
    "X-Content-Type-Options": "nosniff",
  });
  const stream = createReadStream(path);
  stream.on("error", (error) => {
    console.error("Handout konnte nicht gelesen werden:", error);
    response.destroy(error);
  });
  stream.pipe(response);
}

function mapSummary(row) {
  return { id: row.id, name: row.name, imageVersion: Number(row.image_version), isActive: row.is_active === 1, updatedAt: row.updated_at };
}

function handoutFromRow(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    category: row.category,
    recipientUserId: row.recipient_user_id ?? null,
    recipientUsername: row.recipient_username ?? null,
    originalFileName: row.original_file_name,
    mimeType: row.mime_type,
    fileSize: Number(row.file_size),
    assetVersion: Number(row.asset_version),
    isPublished: row.is_published === 1,
    isFeatured: row.is_featured === 1,
    revealedAt: row.revealed_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
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
  const tokens = queries.activeMapTokens.all(state.id).map((row) => ({
    kind: "hero", heroId: row.hero_id, heroName: row.hero_name ?? "Unbenannter Held",
    initials: row.hero_initials || initialsForName(row.hero_name ?? ""), username: row.username, x: row.x, y: row.y,
    tokenVersion: Number(row.token_version), lifePoints: Number(row.life_points), maxLifePoints: Number(row.max_life_points),
    astralPoints: Number(row.astral_points), maxAstralPoints: Number(row.max_astral_points), statusCount: Number(row.status_count),
  }));
  const pins = (master ? queries.pinsByMap : queries.publicPinsByMap).all(state.id);
  const monsters = (master ? queries.monstersByMap : queries.publicMonstersByMap).all(state.id).map(monsterFromRow);
  return { ...mapSummary(state), resourceDisplay: state.resource_display, fog, tokens, pins, monsters };
}

let lastRevisionTime = Date.now();
function nextRevision() {
  lastRevisionTime = Math.max(Date.now(), lastRevisionTime + 1);
  return new Date(lastRevisionTime).toISOString();
}

function touchMap(mapId) {
  queries.touchMap.run(nextRevision(), mapId);
}

function touchActiveMap() {
  queries.touchActiveMap.run(nextRevision());
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

const handoutCategories = new Set(["letter", "clue", "portrait", "document", "illustration", "other"]);

function handoutInput(input) {
  const title = typeof input?.title === "string" ? input.title.trim() : "";
  const description = typeof input?.description === "string" ? input.description.trim() : "";
  const category = handoutCategories.has(input?.category) ? input.category : "other";
  const recipientUserId = typeof input?.recipientUserId === "string" && input.recipientUserId ? input.recipientUserId : null;
  if (!title || title.length > 100) return { error: "Der Titel benötigt 1–100 Zeichen." };
  if (description.length > 2000) return { error: "Die Beschreibung darf höchstens 2.000 Zeichen lang sein." };
  if (recipientUserId && !queries.handoutRecipientById.get(recipientUserId)) return { error: "Der ausgewählte Empfänger ist nicht verfügbar." };
  return {
    value: {
      title,
      description,
      category,
      recipientUserId,
      isPublished: input?.isPublished === true,
      isFeatured: input?.isFeatured === true,
    },
  };
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

function cpuTimes() {
  return cpus().reduce((sum, cpu) => {
    const total = Object.values(cpu.times).reduce((coreSum, value) => coreSum + value, 0);
    return { idle: sum.idle + cpu.times.idle, total: sum.total + total };
  }, { idle: 0, total: 0 });
}

let previousCpuTimes = cpuTimes();
let serverStatusCache = { expiresAt: 0, value: null };

function temperature() {
  for (const path of ["/sys/class/thermal/thermal_zone0/temp", "/sys/class/hwmon/hwmon0/temp1_input"]) {
    try {
      const value = Number(readFileHeader(path, 32).toString("utf8").trim()) / 1000;
      if (Number.isFinite(value) && value > -50 && value < 200) return Math.round(value * 10) / 10;
    } catch {
      // Nicht jedes System stellt einen Temperatursensor bereit.
    }
  }
  return null;
}

function readFileHeader(path, maximumBytes) {
  const descriptor = openSync(path, "r");
  try {
    const buffer = Buffer.alloc(maximumBytes);
    const length = readSync(descriptor, buffer, 0, maximumBytes, 0);
    return buffer.subarray(0, length);
  } finally {
    closeSync(descriptor);
  }
}

function serverStatus() {
  const now = Date.now();
  if (serverStatusCache.value && serverStatusCache.expiresAt > now) return serverStatusCache.value;

  const currentCpuTimes = cpuTimes();
  const totalDelta = currentCpuTimes.total - previousCpuTimes.total;
  const idleDelta = currentCpuTimes.idle - previousCpuTimes.idle;
  previousCpuTimes = currentCpuTimes;
  const cpuUsage = totalDelta > 0 ? Math.max(0, Math.min(100, (1 - idleDelta / totalDelta) * 100)) : 0;

  const totalMemory = totalmem();
  const usedMemory = Math.max(0, totalMemory - freemem());
  const filesystem = statfsSync(dataDirectory, { bigint: true });
  const storageTotal = Number(filesystem.blocks * filesystem.bsize);
  const storageAvailable = Number(filesystem.bavail * filesystem.bsize);
  const storageUsed = Math.max(0, storageTotal - storageAvailable);
  const loads = loadavg();

  const value = {
    sampledAt: new Date(now).toISOString(),
    hostname: hostname(),
    platform: `${process.platform} ${process.arch}`,
    nodeVersion: process.version,
    uptimeSeconds: Math.round(uptime()),
    cpu: {
      usagePercent: Math.round(cpuUsage * 10) / 10,
      coreCount: cpus().length,
      load1: Math.round(loads[0] * 100) / 100,
      load5: Math.round(loads[1] * 100) / 100,
      load15: Math.round(loads[2] * 100) / 100,
    },
    memory: {
      usedBytes: usedMemory,
      totalBytes: totalMemory,
      usagePercent: totalMemory ? Math.round((usedMemory / totalMemory) * 1000) / 10 : 0,
    },
    storage: {
      usedBytes: storageUsed,
      totalBytes: storageTotal,
      usagePercent: storageTotal ? Math.round((storageUsed / storageTotal) * 1000) / 10 : 0,
    },
    process: {
      memoryBytes: process.memoryUsage().rss,
      uptimeSeconds: Math.round(process.uptime()),
    },
    databaseBytes: statSync(databasePath).size,
    temperatureC: temperature(),
  };
  serverStatusCache = { expiresAt: now + 5000, value };
  return value;
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
      const { username, password, viewRole } = await readBody(request);
      const account = typeof username === "string" ? queries.userByName.get(username.trim()) : null;
      if (!account || typeof password !== "string" || !(await passwordMatches(password, account.password_hash))) {
        return json(response, 401, { error: "Benutzername oder Passwort ist nicht korrekt." });
      }
      if (viewRole === "master" && account.role !== "master") {
        return json(response, 403, { error: "Dieses Profil besitzt keine Meisterberechtigung." });
      }
      const token = createSession(account.id);
      return json(response, 200, { user: { id: account.id, username: account.username, role: account.role } }, { "Set-Cookie": sessionCookie(token) });
    }
    if (request.method === "POST" && url.pathname === "/api/logout") {
      const token = parseCookies(request).dsa_session;
      if (token) queries.deleteSession.run(tokenHash(token));
      return json(response, 200, { ok: true }, { "Set-Cookie": sessionCookie("", 0) });
    }
    if (request.method === "GET" && url.pathname === "/api/master/server-status") {
      if (!requireMaster(request, response)) return;
      return json(response, 200, { status: serverStatus() });
    }
    if (request.method === "GET" && url.pathname === "/api/handouts") {
      const user = requireUser(request, response);
      if (!user) return;
      return json(response, 200, { handouts: queries.handoutsForUser.all(user.id).map(handoutFromRow) });
    }
    const handoutImageRoute = url.pathname.match(/^\/api\/handouts\/([^/]+)\/image$/);
    if (request.method === "GET" && handoutImageRoute) {
      const user = requireUser(request, response);
      if (!user) return;
      const row = queries.handoutById.get(decodeURIComponent(handoutImageRoute[1]));
      if (!row) return json(response, 404, { error: "Handout nicht gefunden." });
      const canView = user.role === "master" || (row.is_published === 1 && (!row.recipient_user_id || row.recipient_user_id === user.id));
      if (!canView) return json(response, 403, { error: "Dieses Handout ist nicht für dich freigegeben." });
      return sendHandoutImage(response, row, url.searchParams.get("download") === "1");
    }
    if (request.method === "GET" && url.pathname === "/api/master/handouts") {
      if (!requireMaster(request, response)) return;
      return json(response, 200, {
        handouts: queries.handoutsForMaster.all().map(handoutFromRow),
        recipients: queries.handoutRecipients.all(),
      });
    }
    if (request.method === "POST" && url.pathname === "/api/master/handouts") {
      if (!requireMaster(request, response)) return;
      const parsed = handoutInput(await readBody(request));
      if (parsed.error) return json(response, 400, { error: parsed.error });
      const input = parsed.value;
      const id = randomUUID();
      const now = new Date().toISOString();
      const sortOrder = Number(queries.handoutMaximumOrder.get().maximum) + 10;
      queries.insertHandout.run(id, input.title, input.description, input.category, input.recipientUserId, "", input.isFeatured ? 1 : 0, sortOrder, now, now);
      return json(response, 201, { handout: handoutFromRow(queries.handoutById.get(id)) });
    }
    const masterHandoutFileRoute = url.pathname.match(/^\/api\/master\/handouts\/([^/]+)\/file$/);
    if (request.method === "PUT" && masterHandoutFileRoute) {
      if (!requireMaster(request, response)) return;
      const handoutId = decodeURIComponent(masterHandoutFileRoute[1]);
      if (!queries.handoutById.get(handoutId)) return json(response, 404, { error: "Handout nicht gefunden." });
      const declaredType = String(request.headers["content-type"] ?? "").toLowerCase().split(";", 1)[0];
      if (!["image/png", "image/jpeg", "image/jpg", "image/svg+xml"].includes(declaredType)) {
        return json(response, 415, { error: "Das Handout muss eine PNG-, JPG-, JPEG- oder SVG-Datei sein." });
      }
      const image = await readBinary(request, 12 * 1024 * 1024);
      const mimeType = handoutMimeType(image, declaredType === "image/jpg" ? "image/jpeg" : declaredType);
      if (!mimeType) return json(response, 400, { error: "Die Datei ist kein gültiges oder sicheres PNG-, JPG- oder SVG-Bild." });
      let originalFileName = "";
      try { originalFileName = decodeURIComponent(String(request.headers["x-file-name"] ?? "")); } catch { originalFileName = ""; }
      writeAtomic(handoutPathFor(handoutId), image);
      const now = new Date().toISOString();
      queries.updateHandoutAsset.run(safeDownloadName(originalFileName, mimeType), mimeType, image.length, Date.now(), now, handoutId);
      return json(response, 200, { handout: handoutFromRow(queries.handoutById.get(handoutId)) });
    }
    const masterHandoutRoute = url.pathname.match(/^\/api\/master\/handouts\/([^/]+)$/);
    if (request.method === "PUT" && masterHandoutRoute) {
      if (!requireMaster(request, response)) return;
      const handoutId = decodeURIComponent(masterHandoutRoute[1]);
      const current = queries.handoutById.get(handoutId);
      if (!current) return json(response, 404, { error: "Handout nicht gefunden." });
      const parsed = handoutInput(await readBody(request));
      if (parsed.error) return json(response, 400, { error: parsed.error });
      const input = parsed.value;
      if (input.isPublished && !current.asset_version) return json(response, 409, { error: "Lade zuerst ein Bild hoch, bevor du das Handout freigibst." });
      const now = new Date().toISOString();
      const revealedAt = input.isPublished ? (current.is_published === 1 ? current.revealed_at ?? now : now) : null;
      queries.updateHandout.run(input.title, input.description, input.category, input.recipientUserId, input.isPublished ? 1 : 0, input.isFeatured ? 1 : 0, revealedAt, now, handoutId);
      return json(response, 200, { handout: handoutFromRow(queries.handoutById.get(handoutId)) });
    }
    if (request.method === "DELETE" && masterHandoutRoute) {
      if (!requireMaster(request, response)) return;
      const handoutId = decodeURIComponent(masterHandoutRoute[1]);
      if (queries.deleteHandout.run(handoutId).changes === 0) return json(response, 404, { error: "Handout nicht gefunden." });
      const path = handoutPathFor(handoutId);
      if (existsSync(path)) unlinkSync(path);
      return json(response, 200, { ok: true });
    }
    if (request.method === "GET" && url.pathname === "/api/map") {
      if (!requireUser(request, response)) return;
      const revision = queries.activeMapRevision.get();
      if (!revision) return json(response, 404, { error: "Es ist keine aktive Karte vorhanden." });
      if (url.searchParams.get("since") === revision.updated_at) {
        response.writeHead(304, { "Cache-Control": "no-store" });
        return response.end();
      }
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
      touchActiveMap();
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
      queries.updateMap.run(name, resourceDisplay, nextRevision(), mapId);
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
          queries.activateMap.run(nextRevision(), replacement.id);
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
        queries.activateMap.run(nextRevision(), mapId);
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
      queries.saveMapImageVersion.run(Date.now(), nextRevision(), mapId);
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
      queries.saveMapFog.run(JSON.stringify(fog), nextRevision(), mapId);
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
      touchMap(mapId);
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
      touchMap(mapId);
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
      touchMap(mapId);
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
      touchMap(mapId);
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
      touchMap(mapId);
      return json(response, 200, { map: mapSnapshot(mapId, true) });
    }
    const monsterPositionRoute = url.pathname.match(/^\/api\/master\/maps\/([^/]+)\/monsters\/([^/]+)\/position$/);
    if (request.method === "PUT" && monsterPositionRoute) {
      if (!requireMaster(request, response)) return;
      const mapId = decodeURIComponent(monsterPositionRoute[1]); const monsterId = decodeURIComponent(monsterPositionRoute[2]);
      const input = await readBody(request); const x = safeCoordinate(input.x); const y = safeCoordinate(input.y);
      if (x === null || y === null) return json(response, 400, { error: "Ungültige Tokenposition." });
      if (queries.updateMonsterPosition.run(x, y, new Date().toISOString(), mapId, monsterId).changes === 0) return json(response, 404, { error: "Monster nicht gefunden." });
      touchMap(mapId);
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
      touchMap(monster.map_id);
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
      touchActiveMap();
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
      touchActiveMap();
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
      touchActiveMap();
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
      touchActiveMap();
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
      touchActiveMap();
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
