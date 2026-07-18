import type { Hero } from "./Hero";

export type UserRole = "player" | "master";

export interface SessionUser {
  id: string;
  username: string;
  role: UserRole;
}

export interface MasterHeroRecord {
  hero: Hero;
  username: string;
  updatedAt: string;
}
