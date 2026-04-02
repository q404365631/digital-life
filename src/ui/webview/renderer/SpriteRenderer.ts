import { CreatureData, SpriteData, ColorPalette, EnvironmentObject } from '../../../types';
import { SPRITE_SIZE } from '../../../constants';
import { PUFF_PALETTE, PUFF_SPRITES, EGG_SPRITES, ADULT_SPRITES } from '../sprites/PuffSprites';
import { ENV_PALETTE, TREE_SPRITE, ROCK_SPRITE, BUG_SPRITE, BUG_PALETTE } from '../sprites/EnvironmentSprites';

const SPECIES_PALETTES: Record<string, ColorPalette> = {
  puff: ['transparent', '#FFB6C1', '#FFD1DC', '#E8909C', '#FFFFFF', '#000000', '#FFC0CB'],
  blob: ['transparent', '#87CEEB', '#B0E0E6', '#5F9EA0', '#FFFFFF', '#000000', '#ADD8E6'],
  pip: ['transparent', '#FFD700', '#FFEC8B', '#DAA520', '#FFFFFF', '#000000', '#FFA500'],
  wisp: ['transparent', '#DDA0DD', '#E6E6FA', '#9370DB', '#FFFFFF', '#000000', '#D8BFD8'],
  chomp: ['transparent', '#90EE90', '#98FB98', '#3CB371', '#FFFFFF', '#000000', '#7CFC00'],
  dot: ['transparent', '#1A1A1A', '#333333', '#0D0D0D', '#FFFFFF', '#000000', '#4A4A4A'],
};

export class SpriteRenderer {
  private spriteCanvasCache: Map<string, HTMLCanvasElement> = new Map();

  constructor(private readonly ctx: CanvasRenderingContext2D) {}

  renderCreature(creature: CreatureData): void {
    const spriteSheet = creature.stage === 'egg'
      ? EGG_SPRITES
      : creature.stage === 'adult'
        ? ADULT_SPRITES
        : PUFF_SPRITES;
    const animation = spriteSheet[creature.animationState] ?? spriteSheet['idle'];
    if (!animation) {
      return;
    }

    const frameIndex = Math.floor(creature.animationFrame / 2) % animation.frames.length;
    const frame = animation.frames[frameIndex];

    const flipX = creature.animationState === 'walk_left';
    const palette = SPECIES_PALETTES[creature.species] ?? PUFF_PALETTE;

    this.drawSprite(
      frame,
      palette,
      creature.position.x - SPRITE_SIZE / 2,
      creature.position.y - SPRITE_SIZE / 2,
      SPRITE_SIZE,
      flipX,
      1.0
    );

    // Draw name above creature
    if (creature.stage !== 'egg') {
      this.ctx.save();
      this.ctx.fillStyle = '#FFFFFF';
      this.ctx.strokeStyle = '#000000';
      this.ctx.lineWidth = 2;
      this.ctx.font = '8px monospace';
      this.ctx.textAlign = 'center';
      const nameX = creature.position.x;
      const nameY = creature.position.y - SPRITE_SIZE / 2 - 4;
      this.ctx.strokeText(creature.name, nameX, nameY);
      this.ctx.fillText(creature.name, nameX, nameY);
      this.ctx.restore();
    }

    // Draw reaction effects
    if (creature.reactionTimer > 0 && creature.reactionType) {
      this.renderReactionEffect(creature);
    }
  }

  renderEnvironmentObject(obj: EnvironmentObject): void {
    let sprite: SpriteData;
    let palette: ColorPalette;
    let size: number;

    switch (obj.type) {
      case 'tree':
        sprite = TREE_SPRITE;
        palette = ENV_PALETTE;
        size = 32;
        break;
      case 'rock':
        sprite = ROCK_SPRITE;
        palette = ENV_PALETTE;
        size = 16;
        break;
      case 'bug':
        sprite = BUG_SPRITE;
        palette = BUG_PALETTE;
        size = 16;
        break;
      default:
        return;
    }

    this.drawSprite(sprite, palette, obj.position.x, obj.position.y, size, false, obj.opacity);
  }

  private drawSprite(
    sprite: SpriteData,
    palette: ColorPalette,
    x: number,
    y: number,
    size: number,
    flipX: boolean,
    opacity: number
  ): void {
    const cacheKey = this.getSpriteKey(sprite, size, flipX, palette);
    let cached = this.spriteCanvasCache.get(cacheKey);

    if (!cached) {
      cached = document.createElement('canvas');
      cached.width = size;
      cached.height = size;
      const offCtx = cached.getContext('2d');
      if (!offCtx) return;

      const imageData = offCtx.createImageData(size, size);
      const data = imageData.data;

      for (let row = 0; row < size; row++) {
        for (let col = 0; col < size; col++) {
          const srcCol = flipX ? (size - 1 - col) : col;
          const paletteIndex = sprite[row]?.[srcCol] ?? 0;
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

      offCtx.putImageData(imageData, 0, 0);
      this.spriteCanvasCache.set(cacheKey, cached);
    }

    this.ctx.save();
    if (opacity < 1) {
      this.ctx.globalAlpha = opacity;
    }
    this.ctx.drawImage(cached, Math.floor(x), Math.floor(y));
    this.ctx.restore();
  }

  private renderReactionEffect(creature: CreatureData): void {
    const cx = creature.position.x;
    const cy = creature.position.y;
    const progress = creature.reactionTimer / 1500; // 0..1
    const time = Date.now() / 150;

    this.ctx.save();
    this.ctx.globalAlpha = Math.min(1, progress * 2);

    if (creature.reactionType === 'feed') {
      // Floating sparkles / stars around creature
      this.ctx.fillStyle = '#FFD700';
      for (let i = 0; i < 5; i++) {
        const angle = (i / 5) * Math.PI * 2 + time * 0.5;
        const radius = 12 + Math.sin(time + i * 2) * 4;
        const rise = (1 - progress) * 16;
        const sx = cx + Math.cos(angle) * radius;
        const sy = cy - rise + Math.sin(angle) * radius * 0.5 - 4;
        // Draw small star
        this.ctx.beginPath();
        this.ctx.arc(sx, sy, 1.5, 0, Math.PI * 2);
        this.ctx.fill();
      }
      // Musical note emoji-style
      this.ctx.font = '8px monospace';
      this.ctx.textAlign = 'center';
      const noteY = cy - SPRITE_SIZE / 2 - 8 - (1 - progress) * 10;
      this.ctx.fillText('♪', cx + 8, noteY);
    } else if (creature.reactionType === 'pet') {
      // Floating hearts
      this.ctx.fillStyle = '#FF6B9D';
      for (let i = 0; i < 3; i++) {
        const rise = (1 - progress) * 20;
        const offsetX = (i - 1) * 8 + Math.sin(time + i * 3) * 2;
        const hx = cx + offsetX;
        const hy = cy - SPRITE_SIZE / 2 - 6 - rise - i * 4;
        this.drawHeart(hx, hy, 2.5);
      }
    }

    this.ctx.restore();
  }

  private drawHeart(x: number, y: number, size: number): void {
    this.ctx.beginPath();
    this.ctx.moveTo(x, y + size * 0.3);
    this.ctx.bezierCurveTo(x, y, x - size, y, x - size, y + size * 0.3);
    this.ctx.bezierCurveTo(x - size, y + size * 0.7, x, y + size, x, y + size * 1.2);
    this.ctx.bezierCurveTo(x, y + size, x + size, y + size * 0.7, x + size, y + size * 0.3);
    this.ctx.bezierCurveTo(x + size, y, x, y, x, y + size * 0.3);
    this.ctx.fill();
  }

  private getSpriteKey(sprite: SpriteData, size: number, flipX: boolean, palette: ColorPalette = PUFF_PALETTE): string {
    // Sample from multiple rows including center where sprites differ
    const mid = Math.floor(size / 2);
    const q1 = Math.floor(size / 4);
    const q3 = Math.floor(size * 3 / 4);
    const s = (r: number, c: number) => sprite[r]?.[c] ?? 0;
    const paletteKey = palette[1] ?? 'default';
    const sample = `${s(q1,q1)}_${s(mid,mid)}_${s(q3,q3)}_${s(mid,q1)}_${s(q1,mid)}_${s(q3,mid)}_${size}_${flipX}_${paletteKey}`;
    return sample;
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
