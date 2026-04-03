// --- Coding DNA ---

export interface CodingDNA {
  readonly commitFrequency: number; // 0-1
  readonly nightOwl: number;        // 0-1
  readonly polyglot: number;        // 0-1
  readonly velocity: number;        // 0-1
  readonly consistency: number;     // 0-1
}

// --- File Health ---

export interface FileHealth {
  readonly lineCount: number;
  readonly bugCount: number;
  readonly lastModified: number; // epoch ms
}

// --- Creature ---

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
  readonly dna: CodingDNA;
  readonly fileHealth: FileHealth;
}

// --- World ---

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

export interface GraveStone {
  readonly id: string;
  readonly creatureName: string;
  readonly species: Species;
  readonly bornAt: number;
  readonly diedAt: number;
  readonly sourceFile: string;
  readonly position: Position;
}

export interface WorldData {
  readonly weather: Weather;
  readonly environmentObjects: readonly EnvironmentObject[];
  readonly tileMap: readonly (readonly TileType[])[]; // legacy, kept for stored state compat
  readonly graveStones: readonly GraveStone[];
}

// --- Monitor ---

export interface MonitorState {
  readonly fileCount: number;
  readonly bugCount: number;
  readonly lastCommitSha: string;
  readonly lastCommitTime: number;
}

// --- Messages ---

export type ExtToWebMessage =
  | { readonly type: 'worldUpdate'; readonly creatures: readonly CreatureData[]; readonly world: WorldData; readonly bugs: number; readonly agents: readonly AgentData[] }
  | { readonly type: 'creatureBorn'; readonly creature: CreatureData }
  | { readonly type: 'creatureDied'; readonly creatureId: string; readonly creatureName: string }
  | { readonly type: 'commitDetected' }
  | { readonly type: 'bugCountChanged'; readonly count: number }
  | { readonly type: 'agentChat'; readonly agentId: string; readonly message: string }
  | { readonly type: 'aiActionPreview'; readonly creatureId: string; readonly action: string; readonly description: string }
  | { readonly type: 'creatureHealed'; readonly creatureId: string; readonly creatureName: string }
  | { readonly type: 'creatureSpeech'; readonly creatureId: string; readonly text: string }
  | { readonly type: 'creatureSuggestion'; readonly creatureId: string; readonly creatureName: string; readonly action: string; readonly description: string }
  | { readonly type: 'friendships'; readonly pairs: readonly { a: string; b: string }[] }
  | { readonly type: 'diary'; readonly creatureId: string; readonly entry: string }
  | { readonly type: 'firstRun'; readonly files: readonly { path: string; name: string; species: string }[] }
  | { readonly type: 'levelUp'; readonly creatureId: string }
  | { readonly type: 'agentAdded'; readonly agentId: string }
  | { readonly type: 'lineupActive'; readonly active: boolean };

export type WebToExtMessage =
  | { readonly type: 'ready' }
  | { readonly type: 'action'; readonly action: 'pet' | 'feed'; readonly targetId: string }
  | { readonly type: 'heal'; readonly action: 'diet' | 'cure' | 'wake' | 'feed'; readonly targetId: string }
  | { readonly type: 'care'; readonly targetId: string }
  | { readonly type: 'approveAiAction'; readonly creatureId: string; readonly action: string }
  | { readonly type: 'nameCreature'; readonly creatureId: string; readonly name: string }
  | { readonly type: 'moveCreature'; readonly creatureId: string; readonly position: Position }
  | { readonly type: 'addAgent'; readonly agentType: AgentType }
  | { readonly type: 'clickAgent'; readonly agentId: string }
  | { readonly type: 'stopAgent'; readonly agentId: string }
  | { readonly type: 'moveAgent'; readonly agentId: string; readonly position: Position }
  | { readonly type: 'chatAgent'; readonly agentId: string; readonly message: string }
  | { readonly type: 'moveAgentByKey'; readonly agentId: string; readonly dx: number; readonly dy: number }
  | { readonly type: 'selectAgent'; readonly agentId: string }
  | { readonly type: 'sitAgent'; readonly agentId: string; readonly sitting: boolean }
  | { readonly type: 'deleteAgent'; readonly agentId: string }
  | { readonly type: 'clearAllCreatures' }
  | { readonly type: 'revealFile'; readonly creatureId: string }
  | { readonly type: 'spawnFile'; readonly filePath: string; readonly name: string }
  | { readonly type: 'lineup' };

// --- Agent ---

export type AgentType = 'claude' | 'cursor' | 'copilot';
export type AgentStatus = 'idle' | 'running' | 'generating' | 'error' | 'done';

export interface AgentData {
  readonly id: string;
  readonly name: string;
  readonly agentType: AgentType;
  readonly status: AgentStatus;
  readonly position: Position;
  readonly targetPosition: Position | null;
  readonly terminalId: number | null;
  readonly createdAt: number;
  readonly spriteIndex: number;
  readonly isPlayerControlled: boolean;
  readonly isSitting: boolean;
}

// --- Storage ---

export interface StoredState {
  readonly creatures: readonly CreatureData[];
  readonly world: WorldData;
  readonly monitorState: MonitorState;
  readonly agents: readonly AgentData[];
}

// --- Sprite ---

export type SpriteData = readonly (readonly number[])[];
export type ColorPalette = readonly string[];
