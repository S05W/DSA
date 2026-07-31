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

export interface CombatTechnique {
  id: string;
  name: string;
  kind: "melee" | "ranged";
  skill: number;
  attack: number;
  parry: number | null;
  primaryAttribute: string;
  improvementCost: string;
  damage?: string;
  notes: string;
}

export interface CombatState {
  attack: number;
  parry: number;
  dodge: number;
  initiative: number;
  speed: number;
  armor: number;
  techniques: CombatTechnique[];
}

export interface LanguageKnowledge {
  id: string;
  name: string;
  level: number;
  script: string;
  notes: string;
}

export interface MoneyPouch {
  ducats: number;
  silver: number;
  heller: number;
}

export interface NamedFeature {
  id: string;
  name: string;
  description: string;
}

export interface CharacterTrait {
  id: string;
  name: string;
  level: number;
  apValue: number;
  description: string;
  requirements: string;
}

export interface ResistanceEntry {
  id: string;
  name: string;
  protection: number;
  immune: boolean;
  notes: string;
}

export type EquipmentItemType = "general" | "weapon" | "armor" | "shield";
export type WeaponKind = "melee" | "ranged";

export interface EquipmentItem {
  id: string;
  name: string;
  quantity: number;
  notes: string;
  itemType?: EquipmentItemType;
  description?: string;
  category?: string;
  weight?: string;
  armor?: number;
  encumbrance?: number;
  additionalPenalties?: string;
  weaponKind?: WeaponKind;
  combatTechnique?: string;
  damage?: string;
  damageThreshold?: string;
  attackModifier?: number;
  parryModifier?: number;
  reach?: string;
  range?: string;
  reloadTime?: string;
  ammunition?: number;
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
  sessionActive: boolean;
  mapTokenVersion?: number;
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
  combat: CombatState;
  languages: LanguageKnowledge[];
  money: MoneyPouch;
  advantages: CharacterTrait[];
  disadvantages: CharacterTrait[];
  specialAbilities: NamedFeature[];
  magicalSpecialAbilities: NamedFeature[];
  cantrips: NamedFeature[];
  resistances: ResistanceEntry[];
  equipment: EquipmentItem[];
  body: BodyState;
}
