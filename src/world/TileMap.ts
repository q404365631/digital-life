import { TileType } from '../types';
import { MAP_COLS, MAP_ROWS } from '../constants';

function generateTileMap(): TileType[][] {
  const map: TileType[][] = [];

  for (let row = 0; row < MAP_ROWS; row++) {
    const rowData: TileType[] = [];
    for (let col = 0; col < MAP_COLS; col++) {
      rowData.push(getBaseTile(row, col));
    }
    map.push(rowData);
  }

  // Add dirt path (horizontal through middle)
  const pathRow = Math.floor(MAP_ROWS / 2);
  for (let col = 3; col < MAP_COLS - 3; col++) {
    map[pathRow][col] = 'dirt';
  }

  // Add vertical dirt path
  const pathCol = Math.floor(MAP_COLS / 2);
  for (let row = 3; row < MAP_ROWS - 3; row++) {
    map[row][pathCol] = 'dirt';
  }

  // Scatter flowers
  const flowerPositions = [
    [2, 12], [3, 20], [6, 25], [8, 8], [10, 3],
    [12, 18], [14, 22], [16, 10], [4, 15], [7, 27],
    [11, 6], [15, 14], [17, 20], [9, 22], [5, 17],
  ];

  for (const [row, col] of flowerPositions) {
    if (row < MAP_ROWS && col < MAP_COLS && map[row][col] !== 'dirt') {
      map[row][col] = Math.random() > 0.5 ? 'flower_red' : 'flower_yellow';
    }
  }

  return map;
}

function getBaseTile(_row: number, _col: number): TileType {
  const rand = Math.random();
  if (rand < 0.5) return 'grass_medium';
  if (rand < 0.8) return 'grass_light';
  return 'grass_dark';
}

export function createTileMap(): readonly (readonly TileType[])[] {
  return generateTileMap();
}
