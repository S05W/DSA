import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Hero } from "../models/Hero";
import type { SessionUser } from "../models/User";
import { storage } from "../services/storage";
import { normalizeHero } from "../data/body";
import { AppContext, type AppContextValue } from "./app-context";

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [heroes, setHeroes] = useState<Hero[]>([]);
  const [ready, setReady] = useState(false);
  const saveQueue = useRef(Promise.resolve());

  useEffect(() => {
    let active = true;
    void storage.getSession()
      .then(async (session) => {
        if (!active || !session) return;
        const loadedHeroes = (await storage.getHeroes()).map(normalizeHero);
        if (active) {
          setUser(session);
          setHeroes(loadedHeroes);
        }
      })
      .catch(() => undefined)
      .finally(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, []);

  const value = useMemo<AppContextValue>(() => ({
    user,
    heroes,
    async login(username, password) {
      const session = await storage.login(username, password);
      const loadedHeroes = (await storage.getHeroes()).map(normalizeHero);
      setHeroes(loadedHeroes);
      setUser(session);
    },
    async register(username, password) {
      const session = await storage.register(username, password);
      const loadedHeroes = (await storage.getHeroes()).map(normalizeHero);
      setHeroes(loadedHeroes);
      setUser(session);
    },
    async logout() {
      await storage.logout();
      setUser(null);
      setHeroes([]);
    },
    async createHero(hero) {
      const created = await storage.createHero(hero);
      setHeroes((current) => [...current, created]);
      return created;
    },
    async deleteHero(heroId) {
      await saveQueue.current;
      await storage.deleteHero(heroId);
      setHeroes((current) => current.filter((hero) => hero.id !== heroId));
    },
    updateHero(heroId, updater) {
      setHeroes((current) => current.map((hero) => {
        if (hero.id !== heroId) return hero;
        const updated = updater(hero);
        saveQueue.current = saveQueue.current
          .then(() => storage.saveHero(updated))
          .then(() => undefined)
          .catch((error) => { console.error("Held konnte nicht gespeichert werden:", error); });
        return updated;
      }));
    },
  }), [heroes, user]);

  if (!ready) return null;
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
