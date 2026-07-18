import type { Hero } from "../models/Hero";
import type { SessionUser } from "../models/User";

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
};
