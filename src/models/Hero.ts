export type TalentCategory =
  | "Körpertalente"
  | "Gesellschaftstalente"
  | "Naturtalente"
  | "Wissenstalente"
  | "Handwerkstalente";

export interface AttributeValue {
  short: string;
  name: string;
  value: number;
}

export interface TalentValue {
  name: string;
  category: TalentCategory;
  value: number;
}

export interface SpellValue {
  name: string;
  check: string;
  value: number;
  cost: string;
}

export interface EquipmentItem {
  id: string;
  name: string;
  quantity: number;
  notes: string;
}

export interface Hero {
  id: number;
  ownerId: string;
  name: string;
  title?: string;
  profession: string;
  species: string;
  culture: string;
  experienceLevel: string;
  adventurePoints: number;
  spentAdventurePoints: number;
  lifePoints: number;
  maxLifePoints: number;
  astralPoints: number;
  maxAstralPoints: number;
  fatePoints: number;
  maxFatePoints: number;
  description: string;
  quote: string;
  initials: string;
  accent: "emerald" | "ruby" | "gold";
  attributes: AttributeValue[];
  talents: TalentValue[];
  spells: SpellValue[];
  equipment: EquipmentItem[];
}
