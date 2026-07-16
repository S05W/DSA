import type { Hero } from "../models/Hero";
import type { SessionUser, UserAccount } from "../models/User";
import { createDefaultHero } from "../data/heroes";

const USERS_KEY = "dsa-users-v1";
const SESSION_KEY = "dsa-session-v1";
const heroKey = (userId: string) => `dsa-hero-v1-${userId}`;

function readJson<T>(key: string, fallback: T): T {
  const value = localStorage.getItem(key);
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

async function hashPassword(password: string): Promise<string> {
  const bytes = new TextEncoder().encode(password);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export const storage = {
  getSession(): SessionUser | null {
    return readJson<SessionUser | null>(SESSION_KEY, null);
  },

  logout(): void {
    localStorage.removeItem(SESSION_KEY);
  },

  async register(username: string, password: string): Promise<SessionUser> {
    const normalized = username.trim();
    const users = readJson<UserAccount[]>(USERS_KEY, []);
    if (users.some((user) => user.username.toLowerCase() === normalized.toLowerCase())) {
      throw new Error("Dieser Benutzername ist bereits vergeben.");
    }

    const account: UserAccount = {
      id: crypto.randomUUID(),
      username: normalized,
      passwordHash: await hashPassword(password),
    };
    const session = { id: account.id, username: account.username };
    localStorage.setItem(USERS_KEY, JSON.stringify([...users, account]));
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    localStorage.setItem(heroKey(account.id), JSON.stringify(createDefaultHero(account.id)));
    return session;
  },

  async login(username: string, password: string): Promise<SessionUser> {
    const users = readJson<UserAccount[]>(USERS_KEY, []);
    const passwordHash = await hashPassword(password);
    const account = users.find(
      (user) => user.username.toLowerCase() === username.trim().toLowerCase() && user.passwordHash === passwordHash,
    );
    if (!account) throw new Error("Benutzername oder Passwort ist nicht korrekt.");
    const session = { id: account.id, username: account.username };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return session;
  },

  getHero(userId: string): Hero {
    const existing = readJson<Hero | null>(heroKey(userId), null);
    if (existing) return existing;
    const hero = createDefaultHero(userId);
    localStorage.setItem(heroKey(userId), JSON.stringify(hero));
    return hero;
  },

  saveHero(hero: Hero): void {
    localStorage.setItem(heroKey(hero.ownerId), JSON.stringify(hero));
  },
};
