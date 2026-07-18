import type { Hero } from "../models/Hero";
import type { MasterHeroRecord, SessionUser } from "../models/User";
import type { FogRect, GameMapSnapshot } from "../models/Map";

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

  async login(username: string, password: string): Promise<SessionUser> {
    const result = await request<{ user: SessionUser }>("/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
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

  async uploadGameMap(file: File): Promise<GameMapSnapshot> {
    const result = await request<{ map: GameMapSnapshot }>("/master/map/image", { method: "PUT", headers: { "Content-Type": file.type }, body: file });
    return result.map;
  },

  async saveMapFog(revealed: FogRect[]): Promise<GameMapSnapshot> {
    const result = await request<{ map: GameMapSnapshot }>("/master/map/fog", { method: "PUT", body: JSON.stringify({ revealed }) });
    return result.map;
  },

  async saveMapTokenPosition(heroId: string, x: number, y: number): Promise<GameMapSnapshot> {
    const result = await request<{ map: GameMapSnapshot }>(`/master/map/tokens/${encodeURIComponent(heroId)}`, { method: "PUT", body: JSON.stringify({ x, y }) });
    return result.map;
  },
};
