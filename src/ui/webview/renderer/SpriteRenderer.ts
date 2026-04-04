import { CreatureData, AgentData, SpriteData, ColorPalette, GraveStone } from '../../../types';
import { MS_PER_DAY, NESTING_THRESHOLD, FUNCTION_LENGTH_THRESHOLD, LINE_COUNT_HEAVY, LINE_COUNT_OBESE, LINE_COUNT_CRITICAL, STALE_DAYS } from '../../../constants';
import { t } from '../i18n';
// Default palette for sprite cache key generation (formerly in PuffSprites.ts)
const DEFAULT_PALETTE: ColorPalette = [
  'transparent', '#1A1A1A', '#333333', '#0D0D0D', '#FFFFFF', '#000000', '#4A4A4A',
];

interface SheetPair {
  sheet: string;
  actions: string;
}

interface SpriteStore {
  creatures: Record<string, SheetPair>;
  agents: Record<string, SheetPair>;
}

export class SpriteRenderer {
  private spriteCanvasCache: Map<string, HTMLCanvasElement> = new Map();
  private imageCache: Map<string, HTMLImageElement> = new Map();
  private loadedImages: Map<string, boolean> = new Map();

  // Healed creature IDs (set by GameRenderer for speech bubble override)
  private healedIds: Set<string> = new Set();

  // Event-driven speech overrides (Feature A: Living words)
  private eventSpeech: Map<string, string> = new Map();

  setHealedIds(ids: Set<string>): void {
    this.healedIds = ids;
  }

  setEventSpeech(overrides: Map<string, string>): void {
    this.eventSpeech = overrides;
  }

  constructor(private readonly ctx: CanvasRenderingContext2D) {
    this.preloadSprites();
  }

  private preloadSprites(): void {
    const sprites = (window as unknown as { __SPRITES__?: SpriteStore }).__SPRITES__;
    if (!sprites) {
      return;
    }

    for (const [species, pair] of Object.entries(sprites.creatures)) {
      this.loadImage(`creature_${species}_sheet`, pair.sheet);
      this.loadImage(`creature_${species}_actions`, pair.actions);
    }

    for (const [index, pair] of Object.entries(sprites.agents)) {
      this.loadImage(`agent_${index}_sheet`, pair.sheet);
      this.loadImage(`agent_${index}_actions`, pair.actions);
    }

  }

  getImage(key: string): HTMLImageElement | null {
    const img = this.imageCache.get(key);
    if (img && this.loadedImages.get(key)) {
      return img;
    }
    return null;
  }

  private loadImage(key: string, url: string): void {
    if (this.imageCache.has(key)) {
      return;
    }
    const img = new Image();
    img.onload = () => { this.loadedImages.set(key, true); };
    img.src = url;
    this.imageCache.set(key, img);
  }

  private drawFromSheet(
    sheetKey: string,
    col: number,
    row: number,
    destX: number,
    destY: number,
    destSize: number,
    flipX: boolean = false
  ): boolean {
    const img = this.imageCache.get(sheetKey);
    if (!img || !this.loadedImages.get(sheetKey)) {
      return false;
    }

    const cellW = img.naturalWidth / 4;
    const cellH = img.naturalHeight / 5;
    const srcX = col * cellW;
    const srcY = row * cellH;

    this.ctx.save();
    if (flipX) {
      this.ctx.translate(destX + destSize / 2, 0);
      this.ctx.scale(-1, 1);
      this.ctx.translate(-(destX + destSize / 2), 0);
    }
    this.ctx.drawImage(
      img,
      srcX, srcY, cellW, cellH,
      destX, destY, destSize, destSize
    );
    this.ctx.restore();
    return true;
  }

  renderCreature(creature: CreatureData, isSelected: boolean = false): void {
    const sheetKey = `creature_${creature.species}_sheet`;
    const actionsKey = `creature_${creature.species}_actions`;

    const CREATURE_RENDER_SIZE = 26;
    const renderSize = CREATURE_RENDER_SIZE;

    const lineCount = creature.fileHealth?.lineCount ?? 0;
    let scaleX = 1.0;
    if (lineCount > LINE_COUNT_HEAVY) {
      scaleX = 1.3;
    } else if (lineCount > 100) {
      scaleX = 1.15;
    }

    // Determine sprite cell based on creature animationState / stage
    const frameIndex = Math.floor(Date.now() / 200) % 4;
    let useSheet = sheetKey;
    let col = 0;
    let row = 0;
    let flipX = false;

    // Evolution visual: adult creatures render larger
    const isAdult = creature.stage === 'adult';
    const evolutionScale = isAdult ? 1.2 : 1.0;

    const anim = creature.animationState;
    if (anim === 'walk_down') {
      row = 1;
      col = frameIndex;
    } else if (anim === 'walk_up') {
      row = 2;
      col = frameIndex;
    } else if (anim === 'walk_left') {
      row = 3;
      col = frameIndex;
    } else if (anim === 'walk_right') {
      row = 3;
      col = frameIndex;
      flipX = true;
    } else if (anim === 'eat') {
      useSheet = actionsKey;
      row = 1;
      col = 0;
    } else if (anim === 'happy') {
      useSheet = actionsKey;
      row = 0;
      col = 0;
    } else if (anim === 'sad') {
      useSheet = actionsKey;
      row = 0;
      col = 2;
    } else if (anim === 'sleep') {
      useSheet = actionsKey;
      row = 0;
      col = 1;
    } else if (anim === 'hatch' || creature.stage === 'egg') {
      row = 4;
      col = 0;
    } else {
      // idle
      row = 0;
      col = frameIndex;
    }

    // Combine file-size scale with evolution scale
    const totalScale = scaleX * evolutionScale;

    this.ctx.save();

    if (totalScale !== 1.0) {
      this.ctx.translate(creature.position.x, creature.position.y);
      this.ctx.scale(totalScale, evolutionScale);
      this.ctx.translate(-creature.position.x, -creature.position.y);
    }

    // Adult glow effect
    if (isAdult) {
      this.ctx.shadowColor = '#FFD700';
      this.ctx.shadowBlur = 6;
    }

    const bugCount = creature.fileHealth?.bugCount ?? 0;
    if (bugCount > 0) {
      this.ctx.filter = `saturate(${Math.max(0.3, 1 - bugCount * 0.15)}) brightness(${Math.max(0.7, 1 - bugCount * 0.08)})`;
    }

    const drawn = this.drawFromSheet(
      useSheet,
      col,
      row,
      creature.position.x - renderSize / 2,
      creature.position.y - renderSize / 2,
      renderSize,
      flipX
    );

    this.ctx.restore();

    if (!drawn) {
      return;
    }

    // Level badge (always visible) + name & path (selected only)
    if (creature.stage !== 'egg') {
      const cx = creature.position.x;
      const baseY = creature.position.y - renderSize / 2 - 6;
      const lvColor = isAdult ? '#FFD700' : creature.stage === 'baby' ? '#90CAF9' : '#AAAAAA';

      if (isSelected) {
        // ── Selected: name + Lv + file path ──
        this.ctx.save();

        // Name + Lv line
        const lvText = `Lv.${creature.level}`;
        this.ctx.font = 'bold 9px sans-serif';
        const nameW = this.ctx.measureText(creature.name).width;
        this.ctx.font = 'bold 7px sans-serif';
        const lvW = this.ctx.measureText(lvText).width;
        const rowW = nameW + lvW + 6;

        this.ctx.fillStyle = 'rgba(0,0,0,0.8)';
        this.ctx.beginPath();
        this.ctx.roundRect(cx - rowW / 2 - 4, baseY - 10, rowW + 8, 13, 4);
        this.ctx.fill();

        this.ctx.fillStyle = '#fff';
        this.ctx.font = 'bold 9px sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(creature.name, cx - lvW / 2, baseY);

        this.ctx.fillStyle = lvColor;
        this.ctx.font = 'bold 7px sans-serif';
        this.ctx.textAlign = 'left';
        this.ctx.fillText(lvText, cx + nameW / 2 - lvW / 2 + 3, baseY);

        // File path
        const fullPath = creature.sourceFile;
        const shortPath = fullPath.split('/').slice(-2).join('/');
        this.ctx.font = '7px sans-serif';
        this.ctx.textAlign = 'center';
        const pathW = this.ctx.measureText(shortPath).width;

        this.ctx.fillStyle = 'rgba(0,0,0,0.7)';
        this.ctx.beginPath();
        this.ctx.roundRect(cx - pathW / 2 - 4, baseY - 22, pathW + 8, 11, 3);
        this.ctx.fill();

        this.ctx.fillStyle = '#90CAF9';
        this.ctx.fillText(shortPath, cx, baseY - 13);

        {
          // Selection ring
          this.ctx.strokeStyle = 'rgba(255,215,0,0.6)';
          this.ctx.lineWidth = 1.5;
          this.ctx.beginPath();
          this.ctx.arc(creature.position.x, creature.position.y, renderSize / 2 + 3, 0, Math.PI * 2);
          this.ctx.stroke();
        }


        this.ctx.restore();
      } else {
        // ── Default: tiny Lv badge only ──
        this.ctx.save();
        const lvText = `${creature.level}`;
        this.ctx.font = 'bold 7px sans-serif';
        const lvW = this.ctx.measureText(lvText).width;

        this.ctx.fillStyle = 'rgba(0,0,0,0.6)';
        this.ctx.beginPath();
        this.ctx.roundRect(cx - lvW / 2 - 3, baseY - 8, lvW + 6, 10, 3);
        this.ctx.fill();

        this.ctx.fillStyle = lvColor;
        this.ctx.textAlign = 'center';
        this.ctx.fillText(lvText, cx, baseY);
        this.ctx.restore();
      }
    }

    // Reaction effects
    if (creature.reactionTimer > 0 && creature.reactionType) {
      this.renderReactionEffect(creature, renderSize);
    }

    // File health effects
    this.renderHealthEffects(creature, renderSize);

    // Speech bubble — creatures speak through feelings, not numbers
    this.renderSpeechBubble(creature, renderSize);
  }

  /**
   * Creatures periodically say how they feel.
   * Each creature has its own rhythm — cycle length, show duration, and
   * phase offset are all derived from the creature's id so no two speak
   * in lockstep.
   */
  private renderSpeechBubble(creature: CreatureData, renderSize: number): void {
    if (creature.stage === 'egg') return;
    if (creature.reactionTimer > 0) return; // reaction effect takes priority

    // Two-byte hash from creature id → different personality timing
    const h0 = creature.id.charCodeAt(creature.id.length - 1) ?? 0;
    const h1 = creature.id.charCodeAt(creature.id.length - 2) ?? 0;
    const cycle = 6000 + (h0 % 7) * 1000;           // 6 – 12 s per creature
    const showDuration = 1500 + (h1 % 5) * 250;     // 1.5 – 2.5 s visible
    const phase = (Date.now() + h0 * 307 + h1 * 521) % cycle;
    if (phase > showDuration) return;

    const msg = this.getCreatureMood(creature);
    if (!msg) return;

    const fadeIn = 300;
    const fadeOut = 300;
    const alpha = phase < fadeIn ? phase / fadeIn :
                  phase > showDuration - fadeOut ? (showDuration - phase) / fadeOut : 1;

    this.ctx.save();
    this.ctx.globalAlpha = alpha * 0.9;

    const bx = creature.position.x;
    const by = creature.position.y - renderSize / 2 - 22;

    this.ctx.font = '8px sans-serif';
    const tw = this.ctx.measureText(msg).width;
    const pad = 4;

    // Bubble background
    this.ctx.fillStyle = 'rgba(255,255,255,0.92)';
    this.ctx.beginPath();
    this.ctx.roundRect(bx - tw / 2 - pad, by - 10, tw + pad * 2, 14, 4);
    this.ctx.fill();

    // Tiny triangle
    this.ctx.beginPath();
    this.ctx.moveTo(bx - 3, by + 4);
    this.ctx.lineTo(bx, by + 8);
    this.ctx.lineTo(bx + 3, by + 4);
    this.ctx.fill();

    // Text
    this.ctx.fillStyle = '#333';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(msg, bx, by);

    this.ctx.restore();
  }

  private getCreatureMood(creature: CreatureData): string | null {
    // Feature A: Event-driven speech override (highest priority)
    const eventText = this.eventSpeech.get(creature.id);
    if (eventText) return eventText;

    // Recently healed — override with recovery message
    if (this.healedIds.has(creature.id)) return t('bubble_healed');

    const h = creature.fileHealth;
    const stale = (Date.now() - h.lastModified) / MS_PER_DAY;

    // Feature B: Richer emotional vocabulary based on specific conditions
    if (creature.hunger < 10)   return t('bubble_starving');
    if (creature.hunger < 20)   return t('bubble_hungry');
    if (h.bugCount > 5)         return t('bubble_very_sick');
    if (h.bugCount > 2)         return t('bubble_sick');
    if (h.lineCount > LINE_COUNT_CRITICAL)  return t('bubble_very_heavy');
    if (h.lineCount > LINE_COUNT_OBESE)    return t('bubble_heavy');
    if ((h.maxNesting ?? 0) > NESTING_THRESHOLD) return t('bubble_tangled');
    if ((h.longestFunction ?? 0) > FUNCTION_LENGTH_THRESHOLD) return t('bubble_bloated');
    if (stale > 10)             return t('bubble_abandoned');
    if (stale > 5)              return t('bubble_sleepy');
    if (creature.happiness > 80 && h.bugCount === 0 && h.lineCount < 200) return t('bubble_perfect');
    if (creature.happiness > 70 && h.bugCount === 0) return t('bubble_happy');
    return null;
  }

  private renderHealthEffects(creature: CreatureData, renderSize: number): void {
    const fileBugCount = creature.fileHealth?.bugCount ?? 0;
    const lineCount = creature.fileHealth?.lineCount ?? 0;

    // Sweat mark (bug count >= 2)
    if (fileBugCount >= 2) {
      this.ctx.save();
      this.ctx.font = '8px sans-serif';
      this.ctx.fillStyle = '#64B5F6';
      const sweatX = creature.position.x + renderSize / 2 + 2;
      const sweatY = creature.position.y - renderSize / 2 + 4;
      this.ctx.fillText('\u{1F4A7}', sweatX, sweatY);
      this.ctx.restore();
    }

    // Sparkle (bug 0, line count <= 100 = healthy slim file)
    if (fileBugCount === 0 && lineCount > 0 && lineCount <= 100) {
      this.ctx.save();
      const time = Date.now() / 300;
      this.ctx.globalAlpha = 0.5 + Math.sin(time) * 0.3;
      this.ctx.fillStyle = '#FFD700';
      for (let i = 0; i < 3; i++) {
        const angle = (i / 3) * Math.PI * 2 + time;
        const radius = renderSize / 2 + 4;
        const sx = creature.position.x + Math.cos(angle) * radius;
        const sy = creature.position.y + Math.sin(angle) * radius;
        this.ctx.beginPath();
        this.ctx.arc(sx, sy, 1.5, 0, Math.PI * 2);
        this.ctx.fill();
      }
      this.ctx.restore();
    }

    // Abandoned detection
    const lastMod = creature.fileHealth?.lastModified ?? Date.now();
    const daysSinceModified = (Date.now() - lastMod) / (1000 * 60 * 60 * 24);

    // 3+ days abandoned -> ZZZ
    if (daysSinceModified > 3) {
      this.ctx.save();
      this.ctx.font = 'bold 8px sans-serif';
      this.ctx.fillStyle = '#90A4AE';
      const zzX = creature.position.x + renderSize / 2;
      const zzY = creature.position.y - renderSize / 2 - 10;
      const time = Date.now() / 500;
      const floatY = Math.sin(time) * 2;
      this.ctx.fillText('zzz', zzX, zzY + floatY);
      this.ctx.restore();
    }

    // 7+ days abandoned -> grey filter (Husk premonition)
    if (daysSinceModified > 7) {
      this.ctx.save();
      this.ctx.globalAlpha = 0.3;
      this.ctx.fillStyle = '#9E9E9E';
      this.ctx.beginPath();
      this.ctx.arc(creature.position.x, creature.position.y, renderSize / 2, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.restore();
    }
  }

  renderGraveStone(grave: GraveStone): void {
    const size = 16;
    this.drawSprite(
      GRAVE_SPRITE,
      GRAVE_PALETTE,
      grave.position.x - size / 2,
      grave.position.y - size / 2,
      size,
      false,
      1.0,
    );

    this.ctx.save();
    this.ctx.fillStyle = '#AAAAAA';
    this.ctx.strokeStyle = '#000000';
    this.ctx.lineWidth = 1.5;
    this.ctx.font = '7px monospace';
    this.ctx.textAlign = 'center';
    const nameX = grave.position.x;
    const nameY = grave.position.y - size / 2 - 3;
    this.ctx.strokeText(grave.creatureName, nameX, nameY);
    this.ctx.fillText(grave.creatureName, nameX, nameY);
    this.ctx.restore();
  }

  renderAgent(agent: AgentData, isSelected: boolean = false): void {
    const AGENT_RENDER_SIZE = 48;
    const renderSize = AGENT_RENDER_SIZE;
    const isMoving = agent.targetPosition !== null;

    const sheetKey = `agent_${agent.spriteIndex}_sheet`;
    const actionsKey = `agent_${agent.spriteIndex}_actions`;

    // Determine sprite cell
    let useSheet = sheetKey;
    let col = 0;
    let row = 0;

    if (agent.isSitting) {
      row = 3;
      col = 3;
    } else if (agent.status === 'generating') {
      useSheet = actionsKey;
      row = 0;
      col = 0;
    } else if (agent.status === 'error') {
      useSheet = actionsKey;
      row = 1;
      col = 2;
    } else if (agent.status === 'done') {
      useSheet = actionsKey;
      row = 1;
      col = 0;
    } else if (isMoving) {
      const frameIdx = Math.floor(Date.now() / 200) % 4;
      row = 1;
      col = frameIdx;
    } else {
      // idle - slow animation
      const idleFrame = Math.floor(Date.now() / 600) % 2;
      row = 0;
      col = idleFrame;
    }

    // Bottom-center anchor: position.y = feet, sprite extends upward
    const drawX = agent.position.x - renderSize / 2;
    const drawY = agent.position.y - renderSize;

    if (isSelected) {
      this.ctx.save();
      this.ctx.strokeStyle = '#FFD700';
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.arc(agent.position.x, agent.position.y - renderSize / 2, renderSize / 2 + 4, 0, Math.PI * 2);
      this.ctx.stroke();
      this.ctx.restore();
    }

    // Agent glow — blue light circle at feet (Bret Victor: "機械的な光の輪")
    const pulse = 0.25 + Math.sin(Date.now() / 800) * 0.1;
    this.ctx.save();
    const grad = this.ctx.createRadialGradient(
      agent.position.x, agent.position.y, 2,
      agent.position.x, agent.position.y, renderSize / 2 + 4,
    );
    grad.addColorStop(0, `rgba(100, 180, 255, ${pulse})`);
    grad.addColorStop(1, 'transparent');
    this.ctx.fillStyle = grad;
    this.ctx.beginPath();
    this.ctx.ellipse(agent.position.x, agent.position.y, renderSize / 2 + 4, 6, 0, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.restore();

    const time = Date.now() / 250;
    const bounce = agent.isSitting ? 0 : (isMoving ? Math.sin(time * 2) * 2 : Math.sin(time) * 0.5);

    const isMovingLeft = agent.targetPosition !== null && agent.targetPosition.x < agent.position.x;

    this.ctx.save();

    if (isMovingLeft) {
      this.ctx.translate(agent.position.x, agent.position.y);
      this.ctx.scale(-1, 1);
      this.ctx.translate(-agent.position.x, -agent.position.y);
    }

    this.drawFromSheet(
      useSheet,
      col,
      row,
      drawX,
      drawY + bounce,
      renderSize
    );

    this.ctx.restore();

    this.ctx.save();
    this.ctx.font = 'bold 9px sans-serif';
    this.ctx.textAlign = 'center';
    const nameX = agent.position.x;
    const nameY = drawY - 4 + bounce;
    const nameWidth = this.ctx.measureText(agent.name).width;
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    this.ctx.beginPath();
    this.ctx.roundRect(nameX - nameWidth / 2 - 4, nameY - 9, nameWidth + 8, 12, 4);
    this.ctx.fill();
    this.ctx.fillStyle = '#FFD700';
    this.ctx.fillText(agent.name, nameX, nameY);
    this.ctx.restore();

    this.renderAgentStatus(agent, renderSize);
  }

  private renderAgentStatus(agent: AgentData, renderSize: number): void {
    const cx = agent.position.x;
    const cy = agent.position.y - renderSize / 2; // visual center (bottom-center anchor)
    const time = Date.now() / 200;

    this.ctx.save();
    switch (agent.status) {
      case 'running':
        if (Math.floor(time) % 2 === 0) {
          this.ctx.font = '10px sans-serif';
          this.ctx.fillText('\u{26A1}', cx + renderSize / 2, cy - renderSize / 2);
        }
        break;
      case 'generating':
        this.ctx.fillStyle = '#E040FB';
        for (let i = 0; i < 4; i++) {
          const angle = (i / 4) * Math.PI * 2 + time * 0.5;
          const radius = renderSize / 2 + 6;
          const sx = cx + Math.cos(angle) * radius;
          const sy = cy + Math.sin(angle) * radius;
          this.ctx.beginPath();
          this.ctx.arc(sx, sy, 2, 0, Math.PI * 2);
          this.ctx.fill();
        }
        break;
      case 'error':
        this.ctx.font = '10px sans-serif';
        this.ctx.fillText('\u{1F4A2}', cx + renderSize / 2, cy - renderSize / 2);
        break;
      case 'done':
        this.ctx.globalAlpha = 0.5 + Math.sin(time) * 0.3;
        this.ctx.fillStyle = '#FFD700';
        for (let i = 0; i < 5; i++) {
          const angle = (i / 5) * Math.PI * 2 + time * 0.3;
          const radius = renderSize / 2 + 4;
          this.ctx.beginPath();
          this.ctx.arc(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius, 1.5, 0, Math.PI * 2);
          this.ctx.fill();
        }
        break;
      case 'idle':
        this.ctx.fillStyle = '#90A4AE';
        this.ctx.font = '8px sans-serif';
        this.ctx.textAlign = 'center';
        {
          const dots = '.'.repeat((Math.floor(time / 3) % 3) + 1);
          this.ctx.fillText(dots, cx, cy - renderSize / 2 - 2);
        }
        break;
    }
    this.ctx.restore();
  }

  private drawSprite(
    sprite: SpriteData,
    palette: ColorPalette,
    x: number,
    y: number,
    size: number,
    flipX: boolean,
    opacity: number,
  ): void {
    const cacheKey = this.getSpriteKey(sprite, size, flipX, palette);
    let cached = this.spriteCanvasCache.get(cacheKey);

    if (!cached) {
      cached = document.createElement('canvas');
      cached.width = size;
      cached.height = size;
      const offCtx = cached.getContext('2d');
      if (!offCtx) {
        return;
      }

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
    this.ctx.drawImage(cached, Math.floor(x), Math.floor(y), size, size);
    this.ctx.restore();
  }

  private renderReactionEffect(creature: CreatureData, renderSize: number): void {
    const cx = creature.position.x;
    const cy = creature.position.y;
    const progress = creature.reactionTimer / 1500; // 0..1
    const time = Date.now() / 150;

    this.ctx.save();
    this.ctx.globalAlpha = Math.min(1, progress * 2);

    if (creature.reactionType === 'feed') {
      this.ctx.fillStyle = '#FFD700';
      for (let i = 0; i < 5; i++) {
        const angle = (i / 5) * Math.PI * 2 + time * 0.5;
        const radius = 12 + Math.sin(time + i * 2) * 4;
        const rise = (1 - progress) * 16;
        const sx = cx + Math.cos(angle) * radius;
        const sy = cy - rise + Math.sin(angle) * radius * 0.5 - 4;
        this.ctx.beginPath();
        this.ctx.arc(sx, sy, 1.5, 0, Math.PI * 2);
        this.ctx.fill();
      }
      this.ctx.font = '8px monospace';
      this.ctx.textAlign = 'center';
      const noteY = cy - renderSize / 2 - 8 - (1 - progress) * 10;
      this.ctx.fillText('\u266A', cx + 8, noteY);
    } else if (creature.reactionType === 'pet') {
      this.ctx.fillStyle = '#FF6B9D';
      for (let i = 0; i < 3; i++) {
        const rise = (1 - progress) * 20;
        const offsetX = (i - 1) * 8 + Math.sin(time + i * 3) * 2;
        const hx = cx + offsetX;
        const hy = cy - renderSize / 2 - 6 - rise - i * 4;
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

  renderInteractionHeart(
    creatureA: CreatureData,
    creatureB: CreatureData
  ): void {
    const visible = Math.floor(Date.now() / 500) % 2 === 0;
    if (!visible) {
      return;
    }

    const midX = (creatureA.position.x + creatureB.position.x) / 2;
    const midY = (creatureA.position.y + creatureB.position.y) / 2;

    this.ctx.save();
    this.ctx.fillStyle = '#FF69B4';
    this.ctx.globalAlpha = 0.8;
    this.drawHeart(midX, midY - 8, 3);
    this.ctx.restore();
  }

  private getSpriteKey(sprite: SpriteData, size: number, flipX: boolean, palette: ColorPalette = DEFAULT_PALETTE): string {
    const mid = Math.floor(size / 2);
    const q1 = Math.floor(size / 4);
    const q3 = Math.floor(size * 3 / 4);
    const s = (r: number, c: number): number => sprite[r]?.[c] ?? 0;
    const paletteKey = palette[1] ?? 'default';
    const sample = `${s(q1,q1)}_${s(mid,mid)}_${s(q3,q3)}_${s(mid,q1)}_${s(q1,mid)}_${s(q3,mid)}_${size}_${String(flipX)}_${paletteKey}`;
    return sample;
  }
}

// Gravestone sprite: 16x16
const GRAVE_PALETTE: ColorPalette = [
  'transparent', '#808080', '#A0A0A0', '#606060', '#505050',
];

const GRAVE_SPRITE: SpriteData = [
  [0,0,0,0,0,0,0,2,2,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,2,2,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,2,2,0,0,0,0,0,0,0],
  [0,0,0,0,0,2,2,2,2,2,2,0,0,0,0,0],
  [0,0,0,0,0,0,0,2,2,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,2,2,0,0,0,0,0,0,0],
  [0,0,0,0,0,1,1,1,1,1,1,0,0,0,0,0],
  [0,0,0,0,1,1,2,2,2,2,1,1,0,0,0,0],
  [0,0,0,1,1,2,2,2,2,2,2,1,1,0,0,0],
  [0,0,0,1,1,2,2,2,2,2,2,1,1,0,0,0],
  [0,0,0,1,1,2,2,2,2,2,2,1,1,0,0,0],
  [0,0,0,1,1,2,2,2,2,2,2,1,1,0,0,0],
  [0,0,0,1,1,1,1,1,1,1,1,1,1,0,0,0],
  [0,0,0,3,3,3,3,3,3,3,3,3,3,0,0,0],
  [0,0,4,4,4,4,4,4,4,4,4,4,4,4,0,0],
  [0,0,0,4,4,4,4,4,4,4,4,4,4,0,0,0],
];

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
