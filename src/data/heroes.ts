import type { Hero } from "../models/Hero";
import { createId } from "../utils/id";
import { createDefaultTalents } from "./talents";

type HeroIdentity = Pick<Hero, "name" | "profession" | "species" | "culture" | "experienceLevel">;

function initialsFor(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "?";
}

export function createDefaultHero(ownerId: string, identity: Partial<HeroIdentity> = {}): Hero {
  const name = identity.name?.trim() || "Neuer Held";
  return {
    id: createId(),
    ownerId,
    name,
    title: "",
    profession: identity.profession?.trim() || "Noch nicht festgelegt",
    species: identity.species?.trim() || "Mensch",
    culture: identity.culture?.trim() || "Noch nicht festgelegt",
    experienceLevel: identity.experienceLevel?.trim() || "Erfahren",
    adventurePoints: 1200,
    spentAdventurePoints: 1184,
    lifePoints: 25,
    maxLifePoints: 25,
    astralPoints: 36,
    maxAstralPoints: 36,
    fatePoints: 3,
    maxFatePoints: 3,
    description:
      "Hier kannst du die Geschichte, Ziele und Besonderheiten dieses Helden festhalten.",
    quote: "Das Abenteuer beginnt.",
    initials: initialsFor(name),
    accent: "emerald",
    attributes: [
      { short: "MU", name: "Mut", value: 14 },
      { short: "KL", name: "Klugheit", value: 15 },
      { short: "IN", name: "Intuition", value: 13 },
      { short: "CH", name: "Charisma", value: 14 },
      { short: "FF", name: "Fingerfertigkeit", value: 12 },
      { short: "GE", name: "Gewandtheit", value: 11 },
      { short: "KO", name: "Konstitution", value: 12 },
      { short: "KK", name: "Körperkraft", value: 10 },
    ],
    talents: createDefaultTalents(),
    spells: [],
    equipment: [],
  };
}
