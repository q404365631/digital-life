import { CreatureData, WorldData, Weather } from '../../../types';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../../../constants';
import { TileRenderer } from './TileRenderer';
import { SpriteRenderer } from './SpriteRenderer';
import { UIRenderer } from './UIRenderer';

export class GameRenderer {
  private readonly tileRenderer: TileRenderer;
  private readonly spriteRenderer: SpriteRenderer;
  private readonly uiRenderer: UIRenderer;

  private tileMapCacheCanvas: HTMLCanvasElement | null = null;
  private lastTileMapKey: string = '';

  private commitEffectProgress: number = 0;
  private commitEffectStart: number = 0;
  private readonly COMMIT_EFFECT_DURATION = 2000;

  constructor(private readonly ctx: CanvasRenderingContext2D) {
    this.tileRenderer = new TileRenderer(ctx);
    this.spriteRenderer = new SpriteRenderer(ctx);
    this.uiRenderer = new UIRenderer(ctx);
  }

  triggerCommitEffect(): void {
    this.commitEffectProgress = 1.0;
    this.commitEffectStart = Date.now();
  }

  render(
    creatures: readonly CreatureData[],
    world: WorldData,
    bugCount: number,
    zoom: number = 1.0,
    panOffsetX: number = 0,
    panOffsetY: number = 0,
  ): void {
    // Clear entire canvas (before any transform)
    this.ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // === World layer (affected by zoom & pan) ===
    this.ctx.save();
    this.ctx.translate(panOffsetX, panOffsetY);
    this.ctx.scale(zoom, zoom);

    // Draw tile map (cached)
    this.renderTileMapCached(world);

    // Draw environment objects (trees, rocks, bugs)
    for (const obj of world.environmentObjects) {
      this.spriteRenderer.renderEnvironmentObject(obj);
    }

    // Draw creatures
    for (const creature of creatures) {
      this.spriteRenderer.renderCreature(creature);
    }

    // Draw weather overlay (part of the world)
    this.uiRenderer.renderWeatherOverlay(world.weather);

    this.ctx.restore();

    // === UI layer (fixed on screen, NOT affected by zoom & pan) ===
    this.uiRenderer.renderCreatureCount(creatures.length);
    this.uiRenderer.renderBugCount(bugCount);
    this.uiRenderer.renderGoalText();

    // Commit effect (UI layer)
    this.updateCommitEffect();
    if (this.commitEffectProgress > 0) {
      this.uiRenderer.renderCommitEffect(this.commitEffectProgress);
    }
  }

  private renderTileMapCached(world: WorldData): void {
    const key = world.tileMap.length > 0
      ? `${world.tileMap[0][0]}_${world.tileMap[0].length}_${world.tileMap.length}`
      : 'empty';

    if (this.tileMapCacheCanvas && this.lastTileMapKey === key) {
      this.ctx.drawImage(this.tileMapCacheCanvas, 0, 0);
      return;
    }

    // Render to offscreen canvas
    const offscreen = document.createElement('canvas');
    offscreen.width = CANVAS_WIDTH;
    offscreen.height = CANVAS_HEIGHT;
    const offCtx = offscreen.getContext('2d');
    if (!offCtx) return;

    const tempTileRenderer = new TileRenderer(offCtx);
    tempTileRenderer.renderTileMap(world.tileMap);

    this.tileMapCacheCanvas = offscreen;
    this.lastTileMapKey = key;
    this.ctx.drawImage(offscreen, 0, 0);
  }

  private updateCommitEffect(): void {
    if (this.commitEffectProgress <= 0) return;

    const elapsed = Date.now() - this.commitEffectStart;
    this.commitEffectProgress = Math.max(0, 1 - elapsed / this.COMMIT_EFFECT_DURATION);
  }
}
