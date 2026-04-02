// ============================================================
// Digital Life - Type Definitions
// ============================================================

// --- Creature Types ---

export type Species = 'puff' | 'blob' | 'pip' | 'wisp' | 'chomp' | 'dot';
export type CreatureStage = 'egg' | 'baby' | 'adult';

export type CreatureMood = 'happy' | 'neutral' | 'sad';

export type AnimationState =
  | 'idle'
  | 'walk_down'
  | 'walk_up'
  | 'walk_left'
  | 'walk_right'
  | 'eat'
  | 'sleep'
  | 'happy'
  | 'sad'
  | 'hatch';

export interface Position {
  readonly x: number;
  readonly y: number;
}

export type ReactionType = 'feed' | 'pet' | null;

export interface CreatureData {
  readonly id: string;
  readonly name: string;
  readonly stage: CreatureStage;
  readonly mood: CreatureMood;
  readonly hunger: number;       // 0-100
  readonly happiness: number;    // 0-100
  readonly position: Position;
  readonly targetPosition: Position | null;
  readonly animationState: AnimationState;
  readonly animationFrame: number;
  readonly sourceFile: string;
  readonly bornAt: number;
  readonly hatchProgress: number; // 0-100, egg only
  readonly lastFed: number;
  readonly lastPetted: number;
  readonly reactionType: ReactionType;
  readonly reactionTimer: number; // ms remaining
  readonly species: Species;
  readonly exp: number;
  readonly level: number;
}

// --- World Types ---

export type Weather = 'sunny' | 'cloudy' | 'rainy';

export type TileType =
  | 'grass_light'
  | 'grass_medium'
  | 'grass_dark'
  | 'dirt'
  | 'water'
  | 'flower_red'
  | 'flower_yellow';

export type EnvironmentObjectType = 'tree' | 'rock' | 'bug';

export interface EnvironmentObject {
  readonly id: string;
  readonly type: EnvironmentObjectType;
  readonly position: Position;
  readonly opacity: number;
}

export interface WorldData {
  readonly weather: Weather;
  readonly environmentObjects: readonly EnvironmentObject[];
  readonly tileMap: readonly (readonly TileType[])[];
}

// --- Monitor Types ---

export interface MonitorState {
  readonly fileCount: number;
  readonly bugCount: number;
  readonly lastCommitSha: string;
  readonly lastCommitTime: number;
}

// --- Message Types ---

export type ExtToWebMessage =
  | { readonly type: 'worldUpdate'; readonly creatures: readonly CreatureData[]; readonly world: WorldData; readonly bugs: number }
  | { readonly type: 'creatureBorn'; readonly creature: CreatureData }
  | { readonly type: 'creatureDied'; readonly creatureId: string }
  | { readonly type: 'commitDetected' }
  | { readonly type: 'bugCountChanged'; readonly count: number };

export type WebToExtMessage =
  | { readonly type: 'ready' }
  | { readonly type: 'action'; readonly action: 'pet' | 'feed'; readonly targetId: string }
  | { readonly type: 'nameCreature'; readonly creatureId: string; readonly name: string };

// --- Storage Types ---

export interface StoredState {
  readonly creatures: readonly CreatureData[];
  readonly world: WorldData;
  readonly monitorState: MonitorState;
}

// --- Sprite Types ---

export type SpriteData = readonly (readonly number[])[];

export interface SpriteAnimation {
  readonly frames: readonly SpriteData[];
}

export interface SpriteSheet {
  readonly [key: string]: SpriteAnimation;
}

export type ColorPalette = readonly string[];
