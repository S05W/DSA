import type {
  BodyPartId,
  BodyState,
  CharacterTrait,
  EquipmentItem,
  EquipmentItemType,
  EquipmentSlotId,
  Hero,
  NamedFeature,
  TraditionalArtifact,
} from "../models/Hero";
import { createId } from "../utils/id";
import { createDefaultTalents, talentCheckFor } from "./talents";

export const bodyPartDefinitions: { id: BodyPartId; label: string; maxDamage: number }[] = [
  { id: "head", label: "Kopf", maxDamage: 4 },
  { id: "torso", label: "Oberkörper", maxDamage: 6 },
  { id: "leftArm", label: "Linker Arm", maxDamage: 4 },
  { id: "rightArm", label: "Rechter Arm", maxDamage: 4 },
  { id: "leftLeg", label: "Linkes Bein", maxDamage: 5 },
  { id: "rightLeg", label: "Rechtes Bein", maxDamage: 5 },
  { id: "leftFoot", label: "Linker Fuß", maxDamage: 3 },
  { id: "rightFoot", label: "Rechter Fuß", maxDamage: 3 },
];

export const equipmentSlots: { id: EquipmentSlotId; label: string; multiple?: boolean }[] = [
  { id: "head", label: "Kopf" },
  { id: "torso", label: "Torso" },
  { id: "leftArm", label: "Linker Arm" },
  { id: "rightArm", label: "Rechter Arm" },
  { id: "leftHand", label: "Linke Hand" },
  { id: "rightHand", label: "Rechte Hand" },
  { id: "belt", label: "Gürtel", multiple: true },
  { id: "back", label: "Rücken", multiple: true },
  { id: "leftLeg", label: "Linkes Bein" },
  { id: "rightLeg", label: "Rechtes Bein" },
  { id: "leftFoot", label: "Linker Fuß" },
  { id: "rightFoot", label: "Rechter Fuß" },
];

export const commonStatuses = [
  "Betäubung",
  "Belastung",
  "Entrückung",
  "Furcht",
  "Paralyse",
  "Schmerz",
  "Verwirrung",
  "Vergiftet",
  "Brennend",
  "Liegend",
];

export function createDefaultBody(): BodyState {
  return {
    equipmentVisibilityVersion: 1,
    parts: bodyPartDefinitions.map((part) => ({
      id: part.id,
      label: part.label,
      damage: 0,
      maxDamage: part.maxDamage,
      notes: "",
    })),
    statuses: [],
    equipped: {},
    history: [],
  };
}

function finiteNumber(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalizeNamedFeature(entry: NamedFeature): NamedFeature {
  return {
    id: typeof entry.id === "string" && entry.id ? entry.id : createId(),
    name: typeof entry.name === "string" ? entry.name : "",
    description: typeof entry.description === "string" ? entry.description : "",
  };
}

function normalizeTraditionalArtifact(entry: TraditionalArtifact): TraditionalArtifact {
  return {
    id: typeof entry.id === "string" && entry.id ? entry.id : createId(),
    name: typeof entry.name === "string" ? entry.name : "",
    type: typeof entry.type === "string" ? entry.type : "",
    description: typeof entry.description === "string" ? entry.description : "",
    improvements: typeof entry.improvements === "string" ? entry.improvements : "",
  };
}

function migrateSlot(slot: unknown): EquipmentSlotId[] {
  if (equipmentSlots.some((definition) => definition.id === slot)) return [slot as EquipmentSlotId];
  if (slot === "neck") return ["head"];
  if (slot === "legs") return ["leftLeg", "rightLeg"];
  if (slot === "feet") return ["leftFoot", "rightFoot"];
  return [];
}

function normalizeTrait(entry: CharacterTrait): CharacterTrait {
  return {
    id: typeof entry.id === "string" && entry.id ? entry.id : createId(),
    name: typeof entry.name === "string" ? entry.name : "",
    level: Math.max(1, Math.round(finiteNumber(entry.level, 1))),
    apValue: Math.max(0, Math.round(finiteNumber(entry.apValue))),
    description: typeof entry.description === "string" ? entry.description : "",
    requirements: typeof entry.requirements === "string" ? entry.requirements : "",
  };
}

function normalizeEquipment(item: EquipmentItem): EquipmentItem {
  const allowedSlots = Array.isArray(item.allowedSlots)
    ? [...new Set(item.allowedSlots.flatMap(migrateSlot))]
    : [];
  const validTypes: EquipmentItemType[] = ["general", "weapon", "armor", "shield"];
  const category = typeof item.category === "string" ? item.category.toLowerCase() : "";
  const inferredType: EquipmentItemType = category.includes("schild")
    ? "shield"
    : category.includes("waffe")
      ? "weapon"
      : category.includes("rüstung") || finiteNumber(item.armor) > 0
        ? "armor"
        : "general";
  const itemType = validTypes.includes(item.itemType as EquipmentItemType)
    ? item.itemType as EquipmentItemType
    : inferredType;
  return {
    ...item,
    id: typeof item.id === "string" && item.id ? item.id : createId(),
    name: typeof item.name === "string" ? item.name : "Unbenannter Gegenstand",
    quantity: Math.max(0, Math.round(finiteNumber(item.quantity, 1))),
    notes: typeof item.notes === "string" ? item.notes : "",
    itemType,
    armor: Math.max(0, Math.round(finiteNumber(item.armor))),
    encumbrance: Math.max(0, Math.round(finiteNumber(item.encumbrance))),
    attackModifier: Math.round(finiteNumber(item.attackModifier)),
    parryModifier: Math.round(finiteNumber(item.parryModifier)),
    ammunition: Math.max(0, Math.round(finiteNumber(item.ammunition))),
    weaponKind: item.weaponKind === "ranged" ? "ranged" : "melee",
    showOnBody: Boolean(item.showOnBody),
    allowedSlots,
  };
}

export function normalizeHero(hero: Hero): Hero {
  const equipment = (Array.isArray(hero.equipment) ? hero.equipment : []).map(normalizeEquipment);
  const existingParts = Array.isArray(hero.body?.parts) ? hero.body.parts : [];
  const equipped: BodyState["equipped"] = {};

  const legacyEquipped = hero.body?.equipped as Record<string, unknown> | undefined;
  for (const slot of equipmentSlots) {
    const raw = legacyEquipped?.[slot.id];
    const ids = (Array.isArray(raw) ? raw : typeof raw === "string" ? [raw] : [])
      .filter((itemId): itemId is string => typeof itemId === "string" && equipment.some((item) => item.id === itemId));
    if (ids.length) equipped[slot.id] = slot.multiple ? [...new Set(ids)] : [ids[0]];
  }

  const legacySlotTargets: Record<string, EquipmentSlotId[]> = { neck: ["head"], legs: ["leftLeg", "rightLeg"], feet: ["leftFoot", "rightFoot"] };
  for (const [legacySlot, targets] of Object.entries(legacySlotTargets)) {
    const raw = legacyEquipped?.[legacySlot];
    const ids = (Array.isArray(raw) ? raw : typeof raw === "string" ? [raw] : [])
      .filter((itemId): itemId is string => typeof itemId === "string" && equipment.some((item) => item.id === itemId));
    for (const target of targets) if (ids.length && !equipped[target]?.length) equipped[target] = [ids[0]];
  }

  const body: BodyState = {
    equipmentVisibilityVersion: Math.max(1, Math.round(finiteNumber(hero.body?.equipmentVisibilityVersion, 1))),
    parts: bodyPartDefinitions.map((definition) => {
      const current = existingParts.find((part) => part.id === definition.id);
      return {
        id: definition.id,
        label: definition.label,
        damage: Math.max(0, Math.round(finiteNumber(current?.damage))),
        maxDamage: Math.max(1, Math.round(finiteNumber(current?.maxDamage, definition.maxDamage))),
        notes: typeof current?.notes === "string" ? current.notes : "",
      };
    }),
    statuses: (Array.isArray(hero.body?.statuses) ? hero.body.statuses : []).map((status) => ({
      id: typeof status.id === "string" && status.id ? status.id : createId(),
      name: typeof status.name === "string" ? status.name : "Unbekannter Status",
      level: Math.max(1, Math.round(finiteNumber(status.level, 1))),
      notes: typeof status.notes === "string" ? status.notes : "",
      cause: typeof status.cause === "string" ? status.cause : "",
      duration: typeof status.duration === "string" ? status.duration : "",
      source: status.source === "master" ? "master" : "player",
    })),
    equipped,
    history: (Array.isArray(hero.body?.history) ? hero.body.history : []).map((entry) => ({
      id: typeof entry.id === "string" && entry.id ? entry.id : createId(),
      timestamp: typeof entry.timestamp === "string" ? entry.timestamp : new Date().toISOString(),
      actor: (entry.actor === "master" || entry.actor === "system" ? entry.actor : "player") as BodyState["history"][number]["actor"],
      message: typeof entry.message === "string" ? entry.message : "",
    })).slice(-100),
  };

  const storedTalents = Array.isArray(hero.talents) ? hero.talents : [];
  const defaultTalents = createDefaultTalents().map((talent) => {
    const stored = storedTalents.find((entry) => entry.name === talent.name);
    return stored
      ? {
          ...talent,
          ...stored,
          category: talent.category,
          value: Math.max(0, finiteNumber(stored.value)),
          check: typeof stored.check === "string" && stored.check ? stored.check : talent.check,
        }
      : { ...talent, value: 0 };
  });
  const knownTalentNames = new Set(defaultTalents.map((talent) => talent.name));
  const customTalents = storedTalents
    .filter((talent) => !knownTalentNames.has(talent.name))
    .map((talent) => ({
      ...talent,
      value: Math.max(0, finiteNumber(talent.value)),
      check: typeof talent.check === "string" && talent.check ? talent.check : talentCheckFor(talent.name),
    }));

  return {
    ...hero,
    sessionActive: Boolean(hero.sessionActive),
    tradition: hero.tradition && typeof hero.tradition === "object" ? normalizeNamedFeature(hero.tradition) : null,
    imprints: (Array.isArray(hero.imprints) ? hero.imprints : []).map(normalizeNamedFeature),
    talents: [...defaultTalents, ...customTalents],
    spells: (Array.isArray(hero.spells) ? hero.spells : []).map((spell) => ({
      ...spell,
      id: typeof spell.id === "string" && spell.id ? spell.id : createId(),
    })),
    combat: {
      soulpower: finiteNumber(hero.combat?.soulpower),
      tenacity: finiteNumber(hero.combat?.tenacity),
      dodge: finiteNumber(hero.combat?.dodge),
      initiative: finiteNumber(hero.combat?.initiative),
      speed: finiteNumber(hero.combat?.speed, 8),
      armor: finiteNumber(hero.combat?.armor),
      techniques: (Array.isArray(hero.combat?.techniques) ? hero.combat.techniques : []).map((entry) => ({
        ...entry,
        id: typeof entry.id === "string" && entry.id ? entry.id : createId(),
        name: typeof entry.name === "string" ? entry.name : "",
        kind: entry.kind === "ranged" ? "ranged" : "melee",
        skill: Math.max(0, finiteNumber(entry.skill)),
        attack: Math.max(0, finiteNumber(entry.attack)),
        parry: entry.kind === "ranged" ? null : Math.max(0, finiteNumber(entry.parry)),
        primaryAttribute: typeof entry.primaryAttribute === "string" ? entry.primaryAttribute : "",
        improvementCost: typeof entry.improvementCost === "string" ? entry.improvementCost : "",
        notes: typeof entry.notes === "string" ? entry.notes : "",
      })),
    },
    languages: Array.isArray(hero.languages) ? hero.languages : [],
    money: {
      ducats: finiteNumber(hero.money?.ducats),
      silver: finiteNumber(hero.money?.silver),
      heller: finiteNumber(hero.money?.heller),
    },
    advantages: (Array.isArray(hero.advantages) ? hero.advantages : []).map(normalizeTrait),
    disadvantages: (Array.isArray(hero.disadvantages) ? hero.disadvantages : []).map(normalizeTrait),
    specialAbilities: (Array.isArray(hero.specialAbilities) ? hero.specialAbilities : []).map(normalizeNamedFeature),
    magicalSpecialAbilities: (Array.isArray(hero.magicalSpecialAbilities) ? hero.magicalSpecialAbilities : []).map(normalizeNamedFeature),
    cantrips: (Array.isArray(hero.cantrips) ? hero.cantrips : []).map(normalizeNamedFeature),
    traditionalArtifacts: (Array.isArray(hero.traditionalArtifacts) ? hero.traditionalArtifacts : []).map(normalizeTraditionalArtifact),
    resistances: (Array.isArray(hero.resistances) ? hero.resistances : []).map((entry) => ({
      ...entry,
      protection: Math.max(0, finiteNumber(entry.protection)),
      immune: Boolean(entry.immune),
      weak: Boolean(entry.weak) && !entry.immune,
      notes: typeof entry.notes === "string" ? entry.notes : "",
    })),
    equipment,
    body,
  };
}
