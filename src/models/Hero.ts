export interface AttributeValue {
  short: string;
  name: string;
  value: number;
}

export interface TalentValue {
  name: string;
  category: string;
  value: number;
}

export interface SpellValue {
  name: string;
  check: string;
  value: number;
  cost: string;
}

export interface Hero {
  id: number;
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
  equipment: string[];
}
