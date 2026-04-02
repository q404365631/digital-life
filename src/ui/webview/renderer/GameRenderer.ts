import { CreatureData, AgentData, WorldData } from '../../../types';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../../../constants';
import { SpriteRenderer } from './SpriteRenderer';
import { UIRenderer } from './UIRenderer';
import { t } from '../i18n';

export class GameRenderer {
  private readonly spriteRenderer: SpriteRenderer;
  private readonly uiRenderer: UIRenderer;

  private commitEffectProgress: number = 0;
  private commitEffectStart: number = 0;
  private readonly COMMIT_EFFECT_DURATION = 2000;

  // Feed drop animation
  private feedEffects: { x: number; y: number; startTime: number }[] = [];

  // Background image index
  private currentBgIndex: number = 0;

  // Selected agent for keyboard control
  private selectedAgentId: string | null = null;

  constructor(private readonly ctx: CanvasRenderingContext2D) {
    this.spriteRenderer = new SpriteRenderer(ctx);
    this.uiRenderer = new UIRenderer(ctx);
  }

  setBgIndex(index: number): void {
    this.currentBgIndex = index;
  }

  getBgIndex(): number {
    return this.currentBgIndex;
  }

  setSelectedAgentId(id: string | null): void {
    this.selectedAgentId = id;
  }

  triggerCommitEffect(): void {
    this.commitEffectProgress = 1.0;
    this.commitEffectStart = Date.now();
  }

  triggerFeedEffect(worldX: number, worldY: number): void {
    this.feedEffects.push({ x: worldX, y: worldY, startTime: Date.now() });
  }

  render(
    creatures: readonly CreatureData[],
    world: WorldData,
    bugCount: number,
    zoom: number = 1.0,
    panOffsetX: number = 0,
    panOffsetY: number = 0,
    selectedCreatureId: string | null = null,
    draggingCreatureId: string | null = null,
    agents: readonly AgentData[] = [],
    agentChats: Map<string, { message: string; timestamp: number }> = new Map(),
  ): void {
    // Clear entire canvas (before any transform)
    this.ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // === World layer (affected by zoom & pan) ===
    this.ctx.save();
    this.ctx.translate(panOffsetX, panOffsetY);
    this.ctx.scale(zoom, zoom);

    // White background
    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw gravestones
    for (const grave of world.graveStones) {
      this.spriteRenderer.renderGraveStone(grave);
    }

    // Draw creatures
    for (const creature of creatures) {
      if (creature.id === draggingCreatureId) {
        // Dragging: float up and scale up for "picked up" effect
        this.ctx.save();
        this.ctx.translate(creature.position.x, creature.position.y);
        this.ctx.scale(1.2, 1.2);
        this.ctx.translate(-creature.position.x, -creature.position.y - 4);
        this.spriteRenderer.renderCreature(creature);
        // Draw shadow under dragged creature
        this.ctx.globalAlpha = 0.3;
        this.ctx.fillStyle = '#000000';
        this.ctx.beginPath();
        this.ctx.ellipse(creature.position.x, creature.position.y + 8, 8, 3, 0, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.restore();
      } else {
        this.spriteRenderer.renderCreature(creature);
      }
    }

    // Draw agents
    for (const agent of agents) {
      this.spriteRenderer.renderAgent(agent, agent.id === this.selectedAgentId);
    }

    // Draw chat bubbles
    for (const agent of agents) {
      const chat = agentChats.get(agent.id);
      if (chat && Date.now() - chat.timestamp < 10000) {
        this.renderChatBubble(agent.position.x, agent.position.y - 40, chat.message);
      }
    }

    // Draw feed drop effects
    this.renderFeedEffects();

    // Draw interaction hearts between nearby creatures
    this.renderInteractionHearts(creatures);

    // Draw weather overlay (part of the world)
    this.uiRenderer.renderWeatherOverlay(world.weather);

    this.ctx.restore();

    // === UI layer (fixed on screen, NOT affected by zoom & pan) ===
    this.uiRenderer.renderCreatureCount(creatures.length);
    this.uiRenderer.renderBugCount(bugCount);

    if (selectedCreatureId) {
      const selectedCreature = creatures.find(c => c.id === selectedCreatureId);
      if (selectedCreature && selectedCreature.dna) {
        this.uiRenderer.renderDNAPanel(selectedCreature.dna);
      }
    }

    // Commit effect (UI layer)
    this.updateCommitEffect();
    if (this.commitEffectProgress > 0) {
      this.uiRenderer.renderCommitEffect(this.commitEffectProgress);
    }
  }

  private renderChatBubble(x: number, y: number, message: string): void {
    this.ctx.save();
    const maxWidth = 120;
    this.ctx.font = '9px sans-serif';

    let text = message;
    if (this.ctx.measureText(text).width > maxWidth) {
      while (this.ctx.measureText(text + '...').width > maxWidth && text.length > 0) {
        text = text.slice(0, -1);
      }
      text += '...';
    }

    const textWidth = this.ctx.measureText(text).width;
    const padding = 6;
    const bubbleW = textWidth + padding * 2;
    const bubbleH = 18;
    const bubbleX = x - bubbleW / 2;
    const bubbleY = y - bubbleH;

    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    this.ctx.beginPath();
    this.ctx.roundRect(bubbleX, bubbleY, bubbleW, bubbleH, 6);
    this.ctx.fill();

    this.ctx.beginPath();
    this.ctx.moveTo(x - 4, bubbleY + bubbleH);
    this.ctx.lineTo(x, bubbleY + bubbleH + 5);
    this.ctx.lineTo(x + 4, bubbleY + bubbleH);
    this.ctx.fill();

    this.ctx.fillStyle = '#333333';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(text, x, bubbleY + 13);
    this.ctx.restore();
  }

  private readonly INTERACTION_DISTANCE = 30;

  private renderInteractionHearts(creatures: readonly CreatureData[]): void {
    const rendered = new Set<string>();

    for (let i = 0; i < creatures.length; i++) {
      const a = creatures[i];
      if (a.stage === 'egg' || a.reactionTimer > 0) {
        continue;
      }

      for (let j = i + 1; j < creatures.length; j++) {
        const b = creatures[j];
        if (b.stage === 'egg' || b.reactionTimer > 0) {
          continue;
        }

        const pairKey = `${a.id}_${b.id}`;
        if (rendered.has(pairKey)) {
          continue;
        }

        const dx = a.position.x - b.position.x;
        const dy = a.position.y - b.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < this.INTERACTION_DISTANCE) {
          this.spriteRenderer.renderInteractionHeart(a, b);
          rendered.add(pairKey);
        }
      }
    }
  }

  private readonly FEED_EFFECT_DURATION = 1200;

  private renderFeedEffects(): void {
    const now = Date.now();
    this.feedEffects = this.feedEffects.filter(e => now - e.startTime < this.FEED_EFFECT_DURATION);

    for (const effect of this.feedEffects) {
      const elapsed = now - effect.startTime;
      const progress = elapsed / this.FEED_EFFECT_DURATION;

      this.ctx.save();

      if (progress < 0.3) {
        // Phase 1: Bread falls from above (0-0.3)
        const fallProgress = progress / 0.3;
        const breadY = effect.y - 30 + fallProgress * 30;
        const breadSize = 10;
        this.ctx.font = `${breadSize}px monospace`;
        this.ctx.textAlign = 'center';
        this.ctx.globalAlpha = 1;
        this.ctx.fillText('\u{1F35E}', effect.x, breadY);
      } else if (progress < 0.5) {
        // Phase 2: Bread lands, bounce (0.3-0.5)
        const bounceProgress = (progress - 0.3) / 0.2;
        const bounceY = effect.y - Math.sin(bounceProgress * Math.PI) * 6;
        this.ctx.font = '10px monospace';
        this.ctx.textAlign = 'center';
        this.ctx.globalAlpha = 1;
        this.ctx.fillText('\u{1F35E}', effect.x, bounceY);
      } else if (progress < 0.8) {
        // Phase 3: Nom nom nom - bread shrinks, sparkles appear (0.5-0.8)
        const eatProgress = (progress - 0.5) / 0.3;
        const breadScale = 1 - eatProgress;

        if (breadScale > 0.1) {
          this.ctx.font = `${Math.floor(10 * breadScale)}px monospace`;
          this.ctx.textAlign = 'center';
          this.ctx.globalAlpha = breadScale;
          this.ctx.fillText('\u{1F35E}', effect.x, effect.y);
        }

        // Crumb particles
        this.ctx.globalAlpha = 1 - eatProgress;
        this.ctx.fillStyle = '#DEB887';
        for (let i = 0; i < 5; i++) {
          const angle = (i / 5) * Math.PI * 2 + elapsed * 0.005;
          const radius = 6 + eatProgress * 12;
          const px = effect.x + Math.cos(angle) * radius;
          const py = effect.y + Math.sin(angle) * radius - 4;
          this.ctx.beginPath();
          this.ctx.arc(px, py, 1, 0, Math.PI * 2);
          this.ctx.fill();
        }

        // "nom nom" text
        if (Math.floor(elapsed / 150) % 2 === 0) {
          this.ctx.globalAlpha = 0.8;
          this.ctx.fillStyle = '#FFFFFF';
          this.ctx.strokeStyle = '#000000';
          this.ctx.lineWidth = 1.5;
          this.ctx.font = 'bold 6px monospace';
          this.ctx.textAlign = 'center';
          this.ctx.strokeText(t('nom'), effect.x, effect.y - 14);
          this.ctx.fillText(t('nom'), effect.x, effect.y - 14);
        }
      } else {
        // Phase 4: Satisfaction sparkle (0.8-1.0)
        const sparkleProgress = (progress - 0.8) / 0.2;
        this.ctx.globalAlpha = 1 - sparkleProgress;
        this.ctx.fillStyle = '#FFD700';
        for (let i = 0; i < 6; i++) {
          const angle = (i / 6) * Math.PI * 2 + elapsed * 0.01;
          const radius = 8 + sparkleProgress * 16;
          const px = effect.x + Math.cos(angle) * radius;
          const py = effect.y - 4 + Math.sin(angle) * radius * 0.6;
          this.ctx.beginPath();
          this.ctx.arc(px, py, 1.5 - sparkleProgress, 0, Math.PI * 2);
          this.ctx.fill();
        }
      }

      this.ctx.restore();
    }
  }

  private updateCommitEffect(): void {
    if (this.commitEffectProgress <= 0) return;

    const elapsed = Date.now() - this.commitEffectStart;
    this.commitEffectProgress = Math.max(0, 1 - elapsed / this.COMMIT_EFFECT_DURATION);
  }
}
