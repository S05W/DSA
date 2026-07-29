import type { Hero } from "../models/Hero";
import type { MasterHeroRecord, SessionUser, ViewRole } from "../models/User";
import type { FogShape, GameMapSnapshot, GameMapSummary, MapMonster, MapPin, ResourceDisplay } from "../models/Map";
import type { ServerStatus } from "../models/ServerStatus";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    credentials: "same-origin",
    ...options,
    headers: {
      ...(options?.body ? { "Content-Type": "application/json" } : {}),
      ...options?.headers,
    },
  });

  const payload = await response.json().catch(() => ({})) as { error?: string } & T;
  if (!response.ok) throw new Error(payload.error ?? "Der Server konnte die Anfrage nicht verarbeiten.");
  return payload;
}

export const storage = {
  async getSession(): Promise<SessionUser | null> {
    const result = await request<{ user: SessionUser | null }>("/session");
    return result.user;
  },

  async logout(): Promise<void> {
    await request<{ ok: true }>("/logout", { method: "POST" });
  },

  async register(username: string, password: string): Promise<SessionUser> {
    const result = await request<{ user: SessionUser }>("/register", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
    return result.user;
  },

  async login(username: string, password: string, viewRole: ViewRole): Promise<SessionUser> {
    const result = await request<{ user: SessionUser }>("/login", {
      method: "POST",
      body: JSON.stringify({ username, password, viewRole }),
    });
    return result.user;
  },

  async getHeroes(): Promise<Hero[]> {
    const result = await request<{ heroes: Hero[] }>("/heroes");
    return result.heroes;
  },

  async createHero(hero: Hero): Promise<Hero> {
    const result = await request<{ hero: Hero }>("/heroes", {
      method: "POST",
      body: JSON.stringify(hero),
    });
    return result.hero;
  },

  async saveHero(hero: Hero): Promise<Hero> {
    const result = await request<{ hero: Hero }>(`/heroes/${encodeURIComponent(hero.id)}`, {
      method: "PUT",
      body: JSON.stringify(hero),
    });
    return result.hero;
  },

  async deleteHero(heroId: string): Promise<void> {
    await request<{ ok: true }>(`/heroes/${encodeURIComponent(heroId)}`, { method: "DELETE" });
  },

  async getActiveMasterHeroes(): Promise<MasterHeroRecord[]> {
    const result = await request<{ heroes: MasterHeroRecord[] }>("/master/heroes");
    return result.heroes;
  },

  async getMasterHero(heroId: string): Promise<MasterHeroRecord> {
    return request<MasterHeroRecord>(`/master/heroes/${encodeURIComponent(heroId)}`);
  },

  async addMasterStatus(heroId: string, status: { name: string; level: number; cause: string; duration: string; notes: string }): Promise<Hero> {
    const result = await request<{ hero: Hero }>(`/master/heroes/${encodeURIComponent(heroId)}/statuses`, { method: "POST", body: JSON.stringify(status) });
    return result.hero;
  },

  async removeMasterStatus(heroId: string, statusId: string): Promise<Hero> {
    const result = await request<{ hero: Hero }>(`/master/heroes/${encodeURIComponent(heroId)}/statuses/${encodeURIComponent(statusId)}`, { method: "DELETE" });
    return result.hero;
  },

  async uploadHeroToken(heroId: string, file: File): Promise<Hero> {
    const result = await request<{ hero: Hero }>(`/heroes/${encodeURIComponent(heroId)}/token`, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
    return result.hero;
  },

  async getGameMap(): Promise<GameMapSnapshot> {
    const result = await request<{ map: GameMapSnapshot }>("/map");
    return result.map;
  },

  async pollGameMap(updatedAt: string): Promise<GameMapSnapshot | null> {
    const response = await fetch(`/api/map?since=${encodeURIComponent(updatedAt)}`, { credentials: "same-origin" });
    if (response.status === 304) return null;
    const payload = await response.json().catch(() => ({})) as { error?: string; map?: GameMapSnapshot };
    if (!response.ok || !payload.map) throw new Error(payload.error ?? "Die Karte konnte nicht aktualisiert werden.");
    return payload.map;
  },

  async getServerStatus(): Promise<ServerStatus> {
    const result = await request<{ status: ServerStatus }>("/master/server-status");
    return result.status;
  },

  async getMasterMaps(): Promise<GameMapSummary[]> {
    const result = await request<{ maps: GameMapSummary[] }>("/master/maps");
    return result.maps;
  },

  async getMasterMap(mapId: string): Promise<GameMapSnapshot> {
    const result = await request<{ map: GameMapSnapshot }>(`/master/maps/${encodeURIComponent(mapId)}`);
    return result.map;
  },

  async createGameMap(name: string): Promise<GameMapSnapshot> {
    const result = await request<{ map: GameMapSnapshot }>("/master/maps", { method: "POST", body: JSON.stringify({ name }) });
    return result.map;
  },

  async updateGameMap(mapId: string, input: { name?: string; resourceDisplay?: ResourceDisplay }): Promise<GameMapSnapshot> {
    const result = await request<{ map: GameMapSnapshot }>(`/master/maps/${encodeURIComponent(mapId)}`, { method: "PUT", body: JSON.stringify(input) });
    return result.map;
  },

  async activateGameMap(mapId: string): Promise<GameMapSnapshot> {
    const result = await request<{ map: GameMapSnapshot }>(`/master/maps/${encodeURIComponent(mapId)}/activate`, { method: "PUT" });
    return result.map;
  },

  async deleteGameMap(mapId: string): Promise<void> {
    await request<{ ok: true }>(`/master/maps/${encodeURIComponent(mapId)}`, { method: "DELETE" });
  },

  async uploadGameMap(mapId: string, file: File): Promise<GameMapSnapshot> {
    const result = await request<{ map: GameMapSnapshot }>(`/master/maps/${encodeURIComponent(mapId)}/image`, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
    return result.map;
  },

  async saveMapFog(mapId: string, fog: FogShape[]): Promise<GameMapSnapshot> {
    const result = await request<{ map: GameMapSnapshot }>(`/master/maps/${encodeURIComponent(mapId)}/fog`, { method: "PUT", body: JSON.stringify({ fog }) });
    return result.map;
  },

  async saveMapEntityPosition(mapId: string, kind: "hero" | "monster", entityId: string, x: number, y: number): Promise<GameMapSnapshot> {
    const result = await request<{ map: GameMapSnapshot }>(`/master/maps/${encodeURIComponent(mapId)}/${kind === "hero" ? "heroes" : "monsters"}/${encodeURIComponent(entityId)}/position`, { method: "PUT", body: JSON.stringify({ x, y }) });
    return result.map;
  },

  async createMapPin(mapId: string, pin: Omit<MapPin, "id">): Promise<GameMapSnapshot> {
    const result = await request<{ map: GameMapSnapshot }>(`/master/maps/${encodeURIComponent(mapId)}/pins`, { method: "POST", body: JSON.stringify(pin) });
    return result.map;
  },

  async updateMapPin(mapId: string, pin: MapPin): Promise<GameMapSnapshot> {
    const result = await request<{ map: GameMapSnapshot }>(`/master/maps/${encodeURIComponent(mapId)}/pins/${encodeURIComponent(pin.id)}`, { method: "PUT", body: JSON.stringify(pin) });
    return result.map;
  },

  async deleteMapPin(mapId: string, pinId: string): Promise<GameMapSnapshot> {
    const result = await request<{ map: GameMapSnapshot }>(`/master/maps/${encodeURIComponent(mapId)}/pins/${encodeURIComponent(pinId)}`, { method: "DELETE" });
    return result.map;
  },

  async createMapMonster(mapId: string, monster: Omit<MapMonster, "id" | "kind" | "tokenVersion">): Promise<GameMapSnapshot> {
    const result = await request<{ map: GameMapSnapshot }>(`/master/maps/${encodeURIComponent(mapId)}/monsters`, { method: "POST", body: JSON.stringify(monster) });
    return result.map;
  },

  async updateMapMonster(mapId: string, monster: MapMonster): Promise<GameMapSnapshot> {
    const result = await request<{ map: GameMapSnapshot }>(`/master/maps/${encodeURIComponent(mapId)}/monsters/${encodeURIComponent(monster.id)}`, { method: "PUT", body: JSON.stringify(monster) });
    return result.map;
  },

  async deleteMapMonster(mapId: string, monsterId: string): Promise<GameMapSnapshot> {
    const result = await request<{ map: GameMapSnapshot }>(`/master/maps/${encodeURIComponent(mapId)}/monsters/${encodeURIComponent(monsterId)}`, { method: "DELETE" });
    return result.map;
  },

  async uploadMonsterToken(monsterId: string, file: File): Promise<GameMapSnapshot> {
    const result = await request<{ map: GameMapSnapshot }>(`/master/monsters/${encodeURIComponent(monsterId)}/token`, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
    return result.map;
  },
};
