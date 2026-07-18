export interface FogRect {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface MapToken {
  heroId: string;
  heroName: string;
  initials: string;
  username: string;
  x: number;
  y: number;
  tokenVersion: number;
}

export interface GameMapSnapshot {
  imageVersion: number;
  updatedAt: string;
  revealed: FogRect[];
  tokens: MapToken[];
}
