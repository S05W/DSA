import type { Hero } from "../models/Hero";
import { createId } from "../utils/id";
import { createDefaultTalents } from "./talents";

export function createDefaultHero(ownerId: string): Hero {
  return {
    id: 1,
    ownerId,
    name: "Aurelius von Gareth",
    title: "Adept der Kampfmagie",
    profession: "Gildenmagier · Feldmagier",
    species: "Mensch",
    culture: "Mittelreich",
    experienceLevel: "Erfahren",
    adventurePoints: 1200,
    spentAdventurePoints: 1184,
    lifePoints: 25,
    maxLifePoints: 25,
    astralPoints: 36,
    maxAstralPoints: 36,
    fatePoints: 3,
    maxFatePoints: 3,
    description:
      "Ein disziplinierter Feldmagier aus Gareth, der offensive Zauberei mit Heilkunst und alchemistischem Wissen verbindet. Sein hölzerner Stab trägt einen eingelassenen Smaragd und begleitet ihn seit seiner Akademiezeit.",
    quote: "Wissen schützt. Vorbereitung entscheidet.",
    initials: "AvG",
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
    spells: [
      { name: "Ignifaxius", check: "MU / KL / CH", value: 10, cost: "8 AsP" },
      { name: "Fulminictus", check: "MU / IN / KO", value: 10, cost: "8 AsP" },
      { name: "Balsam Salabunde", check: "KL / IN / FF", value: 9, cost: "variabel" },
      { name: "Blitz dich find", check: "MU / IN / CH", value: 8, cost: "4 AsP" },
    ],
    equipment: [
      { id: createId(), name: "Magierstab", quantity: 1, notes: "Holzstab mit Smaragd" },
      { id: createId(), name: "Zauberbuch", quantity: 1, notes: "" },
      { id: createId(), name: "Alchimistenbesteck", quantity: 1, notes: "" },
      { id: createId(), name: "Robuste Reisekleidung", quantity: 1, notes: "" },
    ],
  };
}
