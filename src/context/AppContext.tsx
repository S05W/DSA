import { useMemo, useState, type ReactNode } from "react";
import type { Hero } from "../models/Hero";
import type { SessionUser } from "../models/User";
import { storage } from "../services/storage";
import { AppContext, type AppContextValue } from "./app-context";

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(() => storage.getSession());
  const [hero, setHero] = useState<Hero | null>(() => {
    const session = storage.getSession();
    return session ? storage.getHero(session.id) : null;
  });

  const value = useMemo<AppContextValue>(() => ({
    user,
    hero,
    async login(username, password) {
      const session = await storage.login(username, password);
      setUser(session);
      setHero(storage.getHero(session.id));
    },
    async register(username, password) {
      const session = await storage.register(username, password);
      setUser(session);
      setHero(storage.getHero(session.id));
    },
    logout() {
      storage.logout();
      setUser(null);
      setHero(null);
    },
    updateHero(updater) {
      setHero((current) => {
        if (!current) return current;
        const updated = updater(current);
        storage.saveHero(updated);
        return updated;
      });
    },
  }), [hero, user]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
