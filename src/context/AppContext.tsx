import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Hero } from "../models/Hero";
import type { SessionUser } from "../models/User";
import { createDefaultHero } from "../data/heroes";
import { storage } from "../services/storage";
import { AppContext, type AppContextValue } from "./app-context";

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [hero, setHero] = useState<Hero | null>(null);
  const [ready, setReady] = useState(false);
  const saveQueue = useRef(Promise.resolve());

  async function loadHero(session: SessionUser): Promise<Hero> {
    const existing = await storage.getHero();
    if (existing) return existing;
    return storage.saveHero(createDefaultHero(session.id));
  }

  useEffect(() => {
    let active = true;
    void storage.getSession()
      .then(async (session) => {
        if (!active || !session) return;
        const loadedHero = await loadHero(session);
        if (active) {
          setUser(session);
          setHero(loadedHero);
        }
      })
      .catch(() => undefined)
      .finally(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, []);

  const value = useMemo<AppContextValue>(() => ({
    user,
    hero,
    async login(username, password) {
      const session = await storage.login(username, password);
      const loadedHero = await loadHero(session);
      setHero(loadedHero);
      setUser(session);
    },
    async register(username, password) {
      const session = await storage.register(username, password);
      const loadedHero = await loadHero(session);
      setHero(loadedHero);
      setUser(session);
    },
    async logout() {
      await storage.logout();
      setUser(null);
      setHero(null);
    },
    updateHero(updater) {
      setHero((current) => {
        if (!current) return current;
        const updated = updater(current);
        saveQueue.current = saveQueue.current
          .then(() => storage.saveHero(updated))
          .then(() => undefined)
          .catch((error) => { console.error("Held konnte nicht gespeichert werden:", error); });
        return updated;
      });
    },
  }), [hero, user]);

  if (!ready) return null;
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
