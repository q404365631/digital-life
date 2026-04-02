import { WorldData, Weather, EnvironmentObject, EnvironmentObjectType, Position } from '../types';
import { MAP_COLS, MAP_ROWS, TILE_SIZE } from '../constants';
import { createTileMap } from './TileMap';

function generateId(): string {
  return `env_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
}

function createEnvironmentObjects(): EnvironmentObject[] {
  const objects: EnvironmentObject[] = [];

  // Trees around the border
  const treePositions: Position[] = [
    { x: 1 * TILE_SIZE, y: 1 * TILE_SIZE },
    { x: 3 * TILE_SIZE, y: 0 * TILE_SIZE },
    { x: 6 * TILE_SIZE, y: 1 * TILE_SIZE },
    { x: 10 * TILE_SIZE, y: 0 * TILE_SIZE },
    { x: 14 * TILE_SIZE, y: 1 * TILE_SIZE },
    { x: 18 * TILE_SIZE, y: 0 * TILE_SIZE },
    { x: 22 * TILE_SIZE, y: 1 * TILE_SIZE },
    { x: 26 * TILE_SIZE, y: 0 * TILE_SIZE },
    { x: 28 * TILE_SIZE, y: 1 * TILE_SIZE },
    { x: 0 * TILE_SIZE, y: 5 * TILE_SIZE },
    { x: 0 * TILE_SIZE, y: 10 * TILE_SIZE },
    { x: 0 * TILE_SIZE, y: 15 * TILE_SIZE },
    { x: 29 * TILE_SIZE, y: 5 * TILE_SIZE },
    { x: 29 * TILE_SIZE, y: 12 * TILE_SIZE },
    { x: 29 * TILE_SIZE, y: 17 * TILE_SIZE },
    { x: 2 * TILE_SIZE, y: 18 * TILE_SIZE },
    { x: 8 * TILE_SIZE, y: 19 * TILE_SIZE },
    { x: 20 * TILE_SIZE, y: 18 * TILE_SIZE },
    { x: 25 * TILE_SIZE, y: 19 * TILE_SIZE },
  ];

  for (const pos of treePositions) {
    objects.push({
      id: generateId(),
      type: 'tree',
      position: pos,
      opacity: 1,
    });
  }

  // Rocks
  const rockPositions: Position[] = [
    { x: 12 * TILE_SIZE, y: 14 * TILE_SIZE },
    { x: 20 * TILE_SIZE, y: 6 * TILE_SIZE },
    { x: 24 * TILE_SIZE, y: 16 * TILE_SIZE },
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

export function createInitialWorldState(): WorldData {
  return {
    weather: 'sunny',
    environmentObjects: createEnvironmentObjects(),
    tileMap: createTileMap(),
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

export function addBugToWorld(world: WorldData): WorldData {
  const bugObj: EnvironmentObject = {
    id: generateId(),
    type: 'bug',
    position: {
      x: (2 + Math.floor(Math.random() * (MAP_COLS - 4))) * TILE_SIZE,
      y: (2 + Math.floor(Math.random() * (MAP_ROWS - 4))) * TILE_SIZE,
    },
    opacity: 1,
  };

  return {
    ...world,
    environmentObjects: [...world.environmentObjects, bugObj],
  };
}

export function removeBugsFromWorld(world: WorldData, targetCount: number): WorldData {
  const bugs = world.environmentObjects.filter(o => o.type === 'bug');
  const nonBugs = world.environmentObjects.filter(o => o.type !== 'bug');

  const bugsToKeep = bugs.slice(0, targetCount);

  return {
    ...world,
    environmentObjects: [...nonBugs, ...bugsToKeep],
  };
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
