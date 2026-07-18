import { createContext, useContext } from "react";
import type { Hero } from "../models/Hero";
import type { SessionUser } from "../models/User";

export interface AppContextValue {
  user: SessionUser | null;
  heroes: Hero[];
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  createHero: (hero: Hero) => Promise<Hero>;
  deleteHero: (heroId: string) => Promise<void>;
  updateHero: (heroId: string, updater: (hero: Hero) => Hero) => void;
}

export const AppContext = createContext<AppContextValue | null>(null);

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp muss innerhalb des AppProvider verwendet werden.");
  return context;
}
