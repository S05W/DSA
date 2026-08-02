import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertStatus(result, expected, label) {
  assert(result.status === expected, `${label}: HTTP ${result.status} statt ${expected} (${JSON.stringify(result.payload)})`);
}

class ApiClient {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.cookie = "";
  }

  async request(path, { method = "GET", body } = {}) {
    const headers = { Accept: "application/json" };
    if (this.cookie) headers.Cookie = this.cookie;
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) headers.Origin = this.baseUrl;
    const response = await fetch(`${this.baseUrl}/api${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const setCookie = response.headers.get("set-cookie");
    if (setCookie) this.cookie = setCookie.split(";", 1)[0];
    const payload = await response.json().catch(() => ({}));
    return { status: response.status, payload };
  }
}

const temporaryDirectory = mkdtempSync(resolve(tmpdir(), "dsa-smoke-"));
const databasePath = resolve(temporaryDirectory, "dsa.db");
const port = 31_000 + Math.floor(Math.random() * 10_000);
const baseUrl = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, [resolve("server/server.mjs")], {
  cwd: process.cwd(),
  env: { ...process.env, HOST: "127.0.0.1", PORT: String(port), DATABASE_PATH: databasePath },
  stdio: ["ignore", "pipe", "pipe"],
});
let serverOutput = "";
server.stdout.on("data", (chunk) => { serverOutput += chunk; });
server.stderr.on("data", (chunk) => { serverOutput += chunk; });

async function waitForServer() {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) return;
    } catch {
      // Der Prozess benötigt beim ersten Start kurz zum Anlegen der SQLite-Tabellen.
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 50));
  }
  throw new Error(`Testserver ist nicht gestartet.\n${serverOutput}`);
}

const suffix = `${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
const playerName = `Spieler-${suffix}`;
const secondPlayerName = `Mitspieler-${suffix}`;
const password = "Sicheres-Testpasswort-123";

try {
  await waitForServer();
  const anonymous = new ApiClient(baseUrl);
  const playerDeviceOne = new ApiClient(baseUrl);
  const playerDeviceTwo = new ApiClient(baseUrl);
  const secondPlayer = new ApiClient(baseUrl);

  assertStatus(await anonymous.request("/health"), 200, "Healthcheck");
  assertStatus(await anonymous.request("/heroes"), 401, "Helden ohne Anmeldung gesperrt");
  assertStatus(await anonymous.request("/register", { method: "POST", body: { username: "ab", password: "zu-kurz" } }), 400, "Ungültige Registrierung abgewiesen");

  const registration = await playerDeviceOne.request("/register", { method: "POST", body: { username: playerName, password } });
  assertStatus(registration, 201, "Spieler registrieren");
  assert(registration.payload.user.role === "player", "Neue Konten müssen immer Spieler sein.");
  const playerId = registration.payload.user.id;

  const duplicate = await anonymous.request("/register", { method: "POST", body: { username: playerName.toUpperCase(), password } });
  assertStatus(duplicate, 409, "Benutzername ohne Beachtung der Großschreibung eindeutig");
  assertStatus(await playerDeviceOne.request("/session"), 200, "Sitzung nach Registrierung");
  const emptyHeroes = await playerDeviceOne.request("/heroes");
  assertStatus(emptyHeroes, 200, "Leeres Heldenarchiv laden");
  assert(Array.isArray(emptyHeroes.payload.heroes) && emptyHeroes.payload.heroes.length === 0, "Neuer Spieler darf keine fremden Helden sehen.");

  const heroDraft = {
    id: "wird-serverseitig-ersetzt",
    ownerId: "fremde-id",
    sessionActive: true,
    name: "  Testheld  ",
    resistances: [{ id: "test-weakness", name: "Sonnenlicht", protection: 0, immune: false, weak: true, notes: "Erschwernis bei direktem Sonnenlicht" }],
  };
  const creation = await playerDeviceOne.request("/heroes", { method: "POST", body: heroDraft });
  assertStatus(creation, 201, "Held anlegen");
  assert(creation.payload.hero.name === "Testheld", "Heldenname wird bereinigt.");
  assert(creation.payload.hero.ownerId === playerId, "Der Server muss den Besitzer selbst festlegen.");
  assert(creation.payload.hero.id !== heroDraft.id, "Der Server muss die Helden-ID selbst vergeben.");
  assert(creation.payload.hero.resistances[0].weak === true, "Schwäche muss gespeichert werden.");
  const heroId = creation.payload.hero.id;

  const secondRegistration = await secondPlayer.request("/register", { method: "POST", body: { username: secondPlayerName, password } });
  assertStatus(secondRegistration, 201, "Zweiten Spieler registrieren");
  const secondPlayerId = secondRegistration.payload.user.id;
  const secondPlayerHeroes = await secondPlayer.request("/heroes");
  assertStatus(secondPlayerHeroes, 200, "Heldenarchiv des zweiten Spielers");
  assert(secondPlayerHeroes.payload.heroes.length === 0, "Spielertrennung ist fehlerhaft.");
  assertStatus(await secondPlayer.request(`/heroes/${encodeURIComponent(heroId)}`, { method: "PUT", body: { ...creation.payload.hero, name: "Gestohlen" } }), 404, "Fremden Helden ändern gesperrt");
  assertStatus(await secondPlayer.request(`/heroes/${encodeURIComponent(heroId)}`, { method: "DELETE" }), 404, "Fremden Helden löschen gesperrt");
  assertStatus(await secondPlayer.request("/master/server-status"), 403, "Meisterbereich für Spieler gesperrt");
  assertStatus(await secondPlayer.request("/login", { method: "POST", body: { username: secondPlayerName, password, viewRole: "master" } }), 403, "Spieler kann Meisteransicht nicht wählen");

  const secondDeviceLogin = await playerDeviceTwo.request("/login", { method: "POST", body: { username: playerName, password, viewRole: "player" } });
  assertStatus(secondDeviceLogin, 200, "Anmeldung auf zweitem Gerät");
  const changedHero = { ...creation.payload.hero, name: "Testheld vom zweiten Gerät", resistances: [...creation.payload.hero.resistances, { id: "test-resistance", name: "Feuer", protection: 2, immune: false, weak: false, notes: "Test" }] };
  assertStatus(await playerDeviceTwo.request(`/heroes/${encodeURIComponent(heroId)}`, { method: "PUT", body: changedHero }), 200, "Held auf zweitem Gerät speichern");
  const synchronized = await playerDeviceOne.request("/heroes");
  assertStatus(synchronized, 200, "Änderung auf erstem Gerät laden");
  assert(synchronized.payload.heroes[0].name === changedHero.name, "Änderungen zwischen Geräten wurden nicht synchronisiert.");

  assertStatus(await playerDeviceOne.request("/logout", { method: "POST" }), 200, "Abmelden");
  const loggedOutSession = await playerDeviceOne.request("/session");
  assertStatus(loggedOutSession, 200, "Sitzung nach Abmeldung prüfen");
  assert(loggedOutSession.payload.user === null, "Abmeldung hat die Sitzung nicht beendet.");
  assertStatus(await playerDeviceOne.request("/login", { method: "POST", body: { username: playerName, password: "Falsches-Passwort", viewRole: "player" } }), 401, "Falsches Passwort abweisen");

  const roleResult = spawnSync(process.execPath, [resolve("server/set-role.mjs"), playerName, "master"], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_PATH: databasePath },
    encoding: "utf8",
  });
  assert(roleResult.status === 0, `Meisterrolle konnte nicht gesetzt werden: ${roleResult.stderr}`);
  const masterLogin = await playerDeviceOne.request("/login", { method: "POST", body: { username: playerName, password, viewRole: "master" } });
  assertStatus(masterLogin, 200, "Freigeschalteten Meister anmelden");
  assert(masterLogin.payload.user.role === "master", "Meisterrolle wird nach erneuter Anmeldung nicht erkannt.");
  assertStatus(await playerDeviceOne.request("/master/server-status"), 200, "Meister-Serverstatus");
  const activeHeroes = await playerDeviceOne.request("/master/heroes");
  assertStatus(activeHeroes, 200, "Aktive Helden für Meister laden");
  assert(activeHeroes.payload.heroes.some((record) => record.hero.id === heroId), "Aktiver Held fehlt in der Meisteransicht.");

  const masterStatus = await playerDeviceOne.request(`/master/heroes/${encodeURIComponent(heroId)}/statuses`, {
    method: "POST",
    body: { name: "Vergiftet", level: 1, cause: "Smoketest", duration: "1 Stunde", notes: "Testeffekt" },
  });
  assertStatus(masterStatus, 201, "Meisterstatus setzen");
  assert(masterStatus.payload.hero.body.statuses.some((status) => status.source === "master"), "Meisterstatus wurde nicht gespeichert.");
  const statusId = masterStatus.payload.status.id;
  assertStatus(await playerDeviceOne.request(`/master/heroes/${encodeURIComponent(heroId)}/statuses/${encodeURIComponent(statusId)}`, { method: "DELETE" }), 200, "Meisterstatus entfernen");

  const masterHandouts = await playerDeviceOne.request("/master/handouts");
  assertStatus(masterHandouts, 200, "Handout-Verwaltung laden");
  assert(masterHandouts.payload.recipients.some((recipient) => recipient.id === secondPlayerId), "Spieler fehlt in der Handout-Empfängerliste.");
  const handoutCreation = await playerDeviceOne.request("/master/handouts", {
    method: "POST",
    body: { title: "Geheimer Hinweis", description: "Nur für den Mitspieler", category: "clue", recipientUserId: secondPlayerId, isPublished: false, isFeatured: true },
  });
  assertStatus(handoutCreation, 201, "Handout anlegen");
  const handoutId = handoutCreation.payload.handout.id;
  const safeSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="black"/></svg>';
  const handoutUploadResponse = await fetch(`${baseUrl}/api/master/handouts/${encodeURIComponent(handoutId)}/file`, {
    method: "PUT",
    headers: {
      Cookie: playerDeviceOne.cookie,
      Origin: baseUrl,
      "Content-Type": "image/svg+xml",
      "X-File-Name": encodeURIComponent("Hinweis.svg"),
    },
    body: safeSvg,
  });
  const handoutUploadPayload = await handoutUploadResponse.json().catch(() => ({}));
  assertStatus({ status: handoutUploadResponse.status, payload: handoutUploadPayload }, 200, "Handout-Bild hochladen");
  const publishedHandout = await playerDeviceOne.request(`/master/handouts/${encodeURIComponent(handoutId)}`, {
    method: "PUT",
    body: { title: "Geheimer Hinweis", description: "Nur für den Mitspieler", category: "clue", recipientUserId: secondPlayerId, isPublished: true, isFeatured: true },
  });
  assertStatus(publishedHandout, 200, "Handout freigeben");
  const visibleHandouts = await secondPlayer.request("/handouts");
  assertStatus(visibleHandouts, 200, "Freigegebene Handouts als Spieler laden");
  assert(visibleHandouts.payload.handouts.some((handout) => handout.id === handoutId), "Persönliches Handout ist beim Empfänger nicht sichtbar.");
  const handoutImageResponse = await fetch(`${baseUrl}/api/handouts/${encodeURIComponent(handoutId)}/image`, { headers: { Cookie: secondPlayer.cookie } });
  assert(handoutImageResponse.status === 200 && handoutImageResponse.headers.get("content-type") === "image/svg+xml", "Handout-Bild kann vom Empfänger nicht geöffnet werden.");
  assertStatus(await playerDeviceOne.request(`/master/handouts/${encodeURIComponent(handoutId)}`, { method: "DELETE" }), 200, "Handout löschen");

  const mapList = await playerDeviceOne.request("/master/maps");
  assertStatus(mapList, 200, "Kartenverwaltung laden");
  assert(mapList.payload.maps.length >= 1, "Die automatisch angelegte Startkarte fehlt.");
  const mapCreation = await playerDeviceOne.request("/master/maps", { method: "POST", body: { name: "Smoketest-Karte" } });
  assertStatus(mapCreation, 201, "Karte anlegen");
  const mapId = mapCreation.payload.map.id;
  assertStatus(await playerDeviceOne.request(`/master/maps/${encodeURIComponent(mapId)}`, { method: "PUT", body: { name: "Smoketest-Karte geändert", resourceDisplay: "numbers" } }), 200, "Karteneinstellungen speichern");
  assertStatus(await playerDeviceOne.request(`/master/maps/${encodeURIComponent(mapId)}/fog`, { method: "PUT", body: { fog: [{ id: "fog-test", shape: "rect", mode: "reveal", x: 0.1, y: 0.1, width: 0.2, height: 0.2 }] } }), 200, "Kartennebel speichern");
  const pinCreation = await playerDeviceOne.request(`/master/maps/${encodeURIComponent(mapId)}/pins`, { method: "POST", body: { name: "Taverne", type: "tavern", visibility: "public", description: "Smoketest", x: 0.3, y: 0.4 } });
  assertStatus(pinCreation, 201, "Karten-Pin anlegen");
  const pinId = pinCreation.payload.map.pins.find((pin) => pin.name === "Taverne")?.id;
  assert(pinId, "Neu angelegter Karten-Pin fehlt im Kartenstand.");
  const monsterCreation = await playerDeviceOne.request(`/master/maps/${encodeURIComponent(mapId)}/monsters`, { method: "POST", body: { name: "Goblin", lifePoints: 12, maxLifePoints: 12, astralPoints: 0, maxAstralPoints: 0, visible: true, notes: "Smoketest", x: 0.6, y: 0.5 } });
  assertStatus(monsterCreation, 201, "Monster anlegen");
  const monsterId = monsterCreation.payload.map.monsters.find((monster) => monster.name === "Goblin")?.id;
  assert(monsterId, "Neu angelegtes Monster fehlt im Kartenstand.");
  assertStatus(await playerDeviceOne.request(`/master/maps/${encodeURIComponent(mapId)}/heroes/${encodeURIComponent(heroId)}/position`, { method: "PUT", body: { x: 0.45, y: 0.55 } }), 200, "Held auf Karte positionieren");
  assertStatus(await playerDeviceOne.request(`/master/maps/${encodeURIComponent(mapId)}/monsters/${encodeURIComponent(monsterId)}/position`, { method: "PUT", body: { x: 0.7, y: 0.6 } }), 200, "Monster verschieben");
  assertStatus(await playerDeviceOne.request(`/master/maps/${encodeURIComponent(mapId)}/activate`, { method: "PUT" }), 200, "Karte aktivieren");
  const playerMap = await secondPlayer.request("/map");
  assertStatus(playerMap, 200, "Aktive Karte als Spieler laden");
  assert(playerMap.payload.map.id === mapId, "Spieler erhält nicht die aktivierte Karte.");
  assert(playerMap.payload.map.pins.some((pin) => pin.id === pinId), "Öffentlicher Karten-Pin ist für Spieler nicht sichtbar.");
  assert(playerMap.payload.map.monsters.some((monster) => monster.id === monsterId), "Sichtbares Monster ist für Spieler nicht sichtbar.");
  assertStatus(await playerDeviceOne.request(`/master/maps/${encodeURIComponent(mapId)}/pins/${encodeURIComponent(pinId)}`, { method: "DELETE" }), 200, "Karten-Pin löschen");
  assertStatus(await playerDeviceOne.request(`/master/maps/${encodeURIComponent(mapId)}/monsters/${encodeURIComponent(monsterId)}`, { method: "DELETE" }), 200, "Monster löschen");
  assertStatus(await playerDeviceOne.request(`/master/maps/${encodeURIComponent(mapId)}`, { method: "DELETE" }), 200, "Karte löschen");

  const simonClient = new ApiClient(baseUrl);
  assertStatus(await simonClient.request("/register", { method: "POST", body: { username: "Simon", password } }), 201, "Simon-Profil für gebündelten Helden registrieren");
  const simonHeroesFirstLoad = await simonClient.request("/heroes");
  assertStatus(simonHeroesFirstLoad, 200, "Gebündelten Helden laden");
  assert(simonHeroesFirstLoad.payload.heroes.length === 1 && simonHeroesFirstLoad.payload.heroes[0].name === "Konohiko", "Konohiko wurde für Simon nicht korrekt angelegt.");
  assert(Array.isArray(simonHeroesFirstLoad.payload.heroes[0].talents) && simonHeroesFirstLoad.payload.heroes[0].talents.length > 0, "Konohikos Talente fehlen.");
  assert(Array.isArray(simonHeroesFirstLoad.payload.heroes[0].specialAbilities), "Konohikos allgemeine Sonderfertigkeiten fehlen.");
  const simonHeroesSecondLoad = await simonClient.request("/heroes");
  assertStatus(simonHeroesSecondLoad, 200, "Gebündelten Helden erneut laden");
  assert(simonHeroesSecondLoad.payload.heroes.length === 1, "Konohiko wurde beim zweiten Laden doppelt angelegt.");

  assertStatus(await playerDeviceTwo.request(`/heroes/${encodeURIComponent(heroId)}`, { method: "DELETE" }), 200, "Eigenen Helden löschen");
  const afterDeletion = await playerDeviceTwo.request("/heroes");
  assertStatus(afterDeletion, 200, "Heldenarchiv nach Löschung");
  assert(afterDeletion.payload.heroes.length === 0, "Gelöschter Held ist noch vorhanden.");

  console.log("Smoketest bestanden: Registrierung, Rollen, Mehrgerätebetrieb, Helden, Handouts, Karten und Meisterfunktionen funktionieren.");
} finally {
  server.kill("SIGTERM");
  await new Promise((resolveExit) => {
    if (server.exitCode !== null) resolveExit();
    else server.once("exit", resolveExit);
  });
  rmSync(temporaryDirectory, { recursive: true, force: true });
}
