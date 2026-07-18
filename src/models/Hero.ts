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
  check: string;
}

export interface SpellValue {
  name: string;
  check: string;
  value: number;
  cost: string;
  effect?: string;
  range?: string;
  duration?: string;
  castingTime?: string;
  notes?: string;
}

export interface EquipmentItem {
  id: string;
  name: string;
  quantity: number;
  notes: string;
  description?: string;
  category?: string;
  weight?: string;
  armor?: number;
  value?: string;
  showOnBody?: boolean;
  allowedSlots?: EquipmentSlotId[];
}

export type BodyPartId = "head" | "torso" | "leftArm" | "rightArm" | "leftLeg" | "rightLeg" | "leftFoot" | "rightFoot";
export type EquipmentSlotId = "head" | "neck" | "torso" | "back" | "rightHand" | "leftHand" | "belt" | "legs" | "feet";

export interface BodyPartState {
  id: BodyPartId;
  label: string;
  damage: number;
  maxDamage: number;
  notes: string;
}

export interface StatusEffect {
  id: string;
  name: string;
  level: number;
  notes: string;
  cause: string;
  duration: string;
  source: "player" | "master";
}

export interface BodyHistoryEntry {
  id: string;
  timestamp: string;
  actor: "player" | "master" | "system";
  message: string;
}

export interface BodyState {
  equipmentVisibilityVersion: number;
  parts: BodyPartState[];
  statuses: StatusEffect[];
  equipped: Partial<Record<EquipmentSlotId, string>>;
  history: BodyHistoryEntry[];
}

export interface Hero {
  id: string;
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
  body: BodyState;
}
