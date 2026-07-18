export type FogMode = "reveal" | "hide";

export interface FogPoint {
  x: number;
  y: number;
}

export interface FogRect {
  id: string;
  shape: "rect";
  mode: FogMode;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FogBrush {
  id: string;
  shape: "brush";
  mode: FogMode;
  radiusX: number;
  radiusY: number;
  points: FogPoint[];
}

export type FogShape = FogRect | FogBrush;
export type ResourceDisplay = "numbers" | "bars" | "hidden";
export type MapPinType = "shop" | "tavern" | "place" | "npc" | "quest" | "treasure" | "door" | "trap";

export interface MapToken {
  kind: "hero";
  heroId: string;
  heroName: string;
  initials: string;
  username: string;
  x: number;
  y: number;
  tokenVersion: number;
  lifePoints: number;
  maxLifePoints: number;
  astralPoints: number;
  maxAstralPoints: number;
  statusCount: number;
}

export interface MapMonster {
  kind: "monster";
  id: string;
  name: string;
  initials: string;
  x: number;
  y: number;
  lifePoints: number;
  maxLifePoints: number;
  astralPoints: number;
  maxAstralPoints: number;
  visible: boolean;
  tokenVersion: number;
  notes: string;
}

export interface MapPin {
  id: string;
  type: MapPinType;
  name: string;
  description: string;
  visibility: "public" | "master";
  x: number;
  y: number;
}

export interface GameMapSummary {
  id: string;
  name: string;
  imageVersion: number;
  isActive: boolean;
  updatedAt: string;
}

export interface GameMapSnapshot extends GameMapSummary {
  resourceDisplay: ResourceDisplay;
  fog: FogShape[];
  tokens: MapToken[];
  monsters: MapMonster[];
  pins: MapPin[];
}

export interface MapImageMetrics {
  naturalWidth: number;
  naturalHeight: number;
  viewportWidth: number;
  viewportHeight: number;
}
