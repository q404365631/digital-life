import { TileType, SpriteData } from '../../../types';
import { TILE_SIZE } from '../../../constants';
import { TILE_PALETTE, getTileSprite } from '../sprites/TileSprites';

export class TileRenderer {
  private tileCache: Map<string, ImageData> = new Map();

  constructor(private readonly ctx: CanvasRenderingContext2D) {}

  renderTileMap(tileMap: readonly (readonly TileType[])[]): void {
    for (let row = 0; row < tileMap.length; row++) {
      for (let col = 0; col < tileMap[row].length; col++) {
        const tileType = tileMap[row][col];
        this.renderTile(col * TILE_SIZE, row * TILE_SIZE, tileType);
      }
    }
  }

  private renderTile(x: number, y: number, tileType: TileType): void {
    const cached = this.tileCache.get(tileType);
    if (cached) {
      this.ctx.putImageData(cached, x, y);
      return;
    }

    const sprite = getTileSprite(tileType);
    const imageData = this.spriteToImageData(sprite, TILE_PALETTE, TILE_SIZE);
    this.tileCache.set(tileType, imageData);
    this.ctx.putImageData(imageData, x, y);
  }

  private spriteToImageData(sprite: SpriteData, palette: readonly string[], size: number): ImageData {
    const imageData = this.ctx.createImageData(size, size);
    const data = imageData.data;

    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) {
        const paletteIndex = sprite[row]?.[col] ?? 0;
        const color = palette[paletteIndex] ?? 'transparent';
        const pixelIndex = (row * size + col) * 4;

        if (color === 'transparent' || paletteIndex === 0) {
          data[pixelIndex] = 0;
          data[pixelIndex + 1] = 0;
          data[pixelIndex + 2] = 0;
          data[pixelIndex + 3] = 0;
        } else {
          const rgb = hexToRgb(color);
          data[pixelIndex] = rgb.r;
          data[pixelIndex + 1] = rgb.g;
          data[pixelIndex + 2] = rgb.b;
          data[pixelIndex + 3] = 255;
        }
      }
    }

    return imageData;
  }
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) {
    return { r: 0, g: 0, b: 0 };
  }
  return {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  };
}
