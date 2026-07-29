import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Hero } from "../models/Hero";
import type { SessionUser, ViewRole } from "../models/User";
import { storage } from "../services/storage";
import { normalizeHero } from "../data/body";
import { AppContext, type AppContextValue } from "./app-context";

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [viewRole, setViewRoleState] = useState<ViewRole>("player");
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
          setViewRoleState(session.role === "master" && window.localStorage.getItem("dsa_view_role") === "master" ? "master" : "player");
          setHeroes(loadedHeroes);
        }
      })
      .catch(() => undefined)
      .finally(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!user) return;
    let active = true;
    let refreshing = false;
    async function refreshHeroes() {
      if (refreshing) return;
      refreshing = true;
      try {
        await saveQueue.current;
        const loadedHeroes = (await storage.getHeroes()).map(normalizeHero);
        if (active) setHeroes(loadedHeroes);
      } catch {
        // Bei einem kurzen Netzwerkausfall bleibt der letzte lokale Stand sichtbar.
      } finally {
        refreshing = false;
      }
    }
    const interval = window.setInterval(() => { void refreshHeroes(); }, 5000);
    return () => { active = false; window.clearInterval(interval); };
  }, [user]);

  const value = useMemo<AppContextValue>(() => ({
    user,
    viewRole,
    heroes,
    async login(username, password, requestedViewRole) {
      const session = await storage.login(username, password, requestedViewRole);
      const loadedHeroes = (await storage.getHeroes()).map(normalizeHero);
      const safeViewRole = session.role === "master" ? requestedViewRole : "player";
      window.localStorage.setItem("dsa_view_role", safeViewRole);
      setHeroes(loadedHeroes);
      setViewRoleState(safeViewRole);
      setUser(session);
    },
    async register(username, password) {
      const session = await storage.register(username, password);
      const loadedHeroes = (await storage.getHeroes()).map(normalizeHero);
      window.localStorage.setItem("dsa_view_role", "player");
      setHeroes(loadedHeroes);
      setViewRoleState("player");
      setUser(session);
    },
    setViewRole(role) {
      const safeRole = user?.role === "master" ? role : "player";
      window.localStorage.setItem("dsa_view_role", safeRole);
      setViewRoleState(safeRole);
    },
    async logout() {
      await storage.logout();
      setUser(null);
      setViewRoleState("player");
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
  }), [heroes, user, viewRole]);

  if (!ready) return null;
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
