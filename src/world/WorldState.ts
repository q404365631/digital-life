import { WorldData, Weather, TimeOfDay, RealWeather, ISSData, NEOData, EnvironmentObject, Position, GraveStone, Species } from '../types';
import { MAP_COLS, MAP_ROWS, TILE_SIZE } from '../constants';

function generateId(): string {
  return `env_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
}

function createEnvironmentObjects(): EnvironmentObject[] {
  const objects: EnvironmentObject[] = [];

  // Natural tree clusters (small groups, not a border wall)
  const treePositions: Position[] = [
    // Top-left cluster (3 trees)
    { x: 1 * TILE_SIZE, y: 1 * TILE_SIZE },
    { x: 3 * TILE_SIZE, y: 0 * TILE_SIZE },
    { x: 2 * TILE_SIZE, y: 3 * TILE_SIZE },
    // Top-right cluster (2 trees)
    { x: 26 * TILE_SIZE, y: 1 * TILE_SIZE },
    { x: 28 * TILE_SIZE, y: 2 * TILE_SIZE },
    // Along the path (sparse)
    { x: 8 * TILE_SIZE, y: 6 * TILE_SIZE },
    { x: 10 * TILE_SIZE, y: 12 * TILE_SIZE },
    // Near the stream
    { x: 20 * TILE_SIZE, y: 4 * TILE_SIZE },
    { x: 21 * TILE_SIZE, y: 14 * TILE_SIZE },
    // Bottom-right cluster (2 trees)
    { x: 25 * TILE_SIZE, y: 17 * TILE_SIZE },
    { x: 27 * TILE_SIZE, y: 16 * TILE_SIZE },
    // Solitary trees for variety
    { x: 5 * TILE_SIZE, y: 14 * TILE_SIZE },
    { x: 15 * TILE_SIZE, y: 2 * TILE_SIZE },
  ];

  for (const pos of treePositions) {
    objects.push({
      id: generateId(),
      type: 'tree',
      position: pos,
      opacity: 1,
    });
  }

  // Rocks near the stream and path
  const rockPositions: Position[] = [
    { x: 22 * TILE_SIZE, y: 8 * TILE_SIZE },   // near stream
    { x: 23 * TILE_SIZE, y: 12 * TILE_SIZE },  // near stream
    { x: 13 * TILE_SIZE, y: 9 * TILE_SIZE },   // near path
    { x: 7 * TILE_SIZE, y: 16 * TILE_SIZE },   // bottom area
    { x: 18 * TILE_SIZE, y: 18 * TILE_SIZE },  // bottom area
  ];

  for (const pos of rockPositions) {
    objects.push({
      id: generateId(),
      type: 'rock',
      position: pos,
      opacity: 1,
    });
  }

  return objects;
}

export function getTimeOfDay(): TimeOfDay {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 7) return 'dawn';
  if (hour >= 7 && hour < 16) return 'morning';
  if (hour >= 16 && hour < 18) return 'afternoon';
  if (hour >= 18 && hour < 20) return 'dusk';
  return 'night';
}

export function createInitialWorldState(): WorldData {
  return {
    weather: 'sunny',
    timeOfDay: getTimeOfDay(),
    realWeather: null,
    iss: null,
    neo: null,
    environmentObjects: createEnvironmentObjects(),
    tileMap: [],
    graveStones: [],
  };
}

export function updateTimeOfDay(world: WorldData): WorldData {
  const tod = getTimeOfDay();
  if (tod === world.timeOfDay) return world;
  return { ...world, timeOfDay: tod };
}

export function updateRealWeather(world: WorldData, rw: RealWeather): WorldData {
  if (rw === world.realWeather) return world;
  return { ...world, realWeather: rw };
}

export function updateISS(world: WorldData, iss: ISSData | null): WorldData {
  return { ...world, iss };
}

export function updateNEO(world: WorldData, neo: NEOData | null): WorldData {
  return { ...world, neo };
}

export function addGraveStone(
  world: WorldData,
  creatureName: string,
  species: Species,
  bornAt: number,
  sourceFile: string,
  position: Position,
): WorldData {
  const grave: GraveStone = {
    id: generateId(),
    creatureName,
    species,
    bornAt,
    diedAt: Date.now(),
    sourceFile,
    position,
  };
  return {
    ...world,
    graveStones: [...world.graveStones, grave],
  };
}

export function updateWeather(world: WorldData, bugCount: number): WorldData {
  let weather: Weather;
  if (bugCount === 0) {
    weather = 'sunny';
  } else if (bugCount <= 5) {
    weather = 'cloudy';
  } else {
    weather = 'rainy';
  }

  if (weather === world.weather) {
    return world;
  }

  return { ...world, weather };
}

export function setBugsInWorld(world: WorldData, count: number): WorldData {
  const nonBugs = world.environmentObjects.filter(o => o.type !== 'bug');
  const currentBugs = world.environmentObjects.filter(o => o.type === 'bug');

  if (currentBugs.length === count) {
    return world;
  }

  if (currentBugs.length > count) {
    return {
      ...world,
      environmentObjects: [...nonBugs, ...currentBugs.slice(0, count)],
    };
  }

  const newBugs: EnvironmentObject[] = [...currentBugs];
  for (let i = currentBugs.length; i < count; i++) {
    newBugs.push({
      id: generateId(),
      type: 'bug',
      position: {
        x: (2 + Math.floor(Math.random() * (MAP_COLS - 4))) * TILE_SIZE,
        y: (2 + Math.floor(Math.random() * (MAP_ROWS - 4))) * TILE_SIZE,
      },
      opacity: 1,
    });
  }

  return {
    ...world,
    environmentObjects: [...nonBugs, ...newBugs],
  };
}
