import { CreatureData, AgentData, WorldData, TimeOfDay, RealWeather } from '../../../types';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../../../constants';
import { SpriteRenderer } from './SpriteRenderer';
import { UIRenderer } from './UIRenderer';
import { t } from '../i18n';

/** All data needed to render a single frame — "12 params is a code smell" (TJ) */
export interface RenderContext {
  creatures: readonly CreatureData[];
  world: WorldData;
  bugCount: number;
  zoom: number;
  panX: number;
  panY: number;
  selectedCreatureId: string | null;
  draggingCreatureId: string | null;
  agents: readonly AgentData[];
  agentChats: Map<string, { message: string; timestamp: number }>;
  eventSpeechOverrides: Map<string, { text: string; timestamp: number }>;
  friendPairs: readonly { a: string; b: string }[];
}

export class GameRenderer {
  private readonly spriteRenderer: SpriteRenderer;
  private readonly uiRenderer: UIRenderer;

  private commitEffectProgress: number = 0;
  private commitEffectStart: number = 0;
  private readonly COMMIT_EFFECT_DURATION = 2000;

  // Feed drop animation
  private feedEffects: { x: number; y: number; startTime: number }[] = [];

  // Heal recovery effect (green sparkles per creature)
  private healEffects: { x: number; y: number; startTime: number }[] = [];
  private readonly HEAL_EFFECT_DURATION = 2000;

  // Healed creature IDs — SpriteRenderer uses this to override speech bubble
  private healedCreatureIds: Map<string, number> = new Map(); // id → timestamp

  // Worsen effect (red flash per creature)
  private worsenEffects: { x: number; y: number; startTime: number }[] = [];
  private readonly WORSEN_EFFECT_DURATION = 1200;

  // Farewell scene (file deletion)
  private farewellName: string | null = null;
  private farewellStart: number = 0;
  private readonly FAREWELL_DURATION = 3000;

  // Selected agent for keyboard control
  private selectedAgentId: string | null = null;

  constructor(private readonly ctx: CanvasRenderingContext2D) {
    this.spriteRenderer = new SpriteRenderer(ctx);
    this.uiRenderer = new UIRenderer(ctx);
  }

  setSelectedAgentId(id: string | null): void {
    this.selectedAgentId = id;
  }

  /** Update cached health stats — call once per worldUpdate, not every frame */
  updateHealthCache(creatures: readonly CreatureData[]): void {
    this.uiRenderer.updateHealthCache(creatures);
  }

  triggerCommitEffect(): void {
    this.commitEffectProgress = 1.0;
    this.commitEffectStart = Date.now();
  }

  triggerFeedEffect(worldX: number, worldY: number): void {
    this.feedEffects.push({ x: worldX, y: worldY, startTime: Date.now() });
  }

  triggerWorsenEffect(worldX: number, worldY: number): void {
    this.worsenEffects.push({ x: worldX, y: worldY, startTime: Date.now() });
  }

  triggerHealEffect(worldX: number, worldY: number, creatureId?: string): void {
    this.healEffects.push({ x: worldX, y: worldY, startTime: Date.now() });
    if (creatureId) {
      this.healedCreatureIds.set(creatureId, Date.now());
    }
  }

  /** Check if a creature recently healed (for speech bubble override) */
  isRecentlyHealed(creatureId: string): boolean {
    const ts = this.healedCreatureIds.get(creatureId);
    if (!ts) return false;
    if (Date.now() - ts > 4000) {
      this.healedCreatureIds.delete(creatureId);
      return false;
    }
    return true;
  }

  triggerFarewell(name: string): void {
    this.farewellName = name;
    this.farewellStart = Date.now();
  }

  render(rc: RenderContext): void {
    const {
      creatures, world, bugCount, zoom, panX: panOffsetX, panY: panOffsetY,
      selectedCreatureId, draggingCreatureId, agents, agentChats,
      eventSpeechOverrides, friendPairs,
    } = rc;

    // Clear entire canvas (before any transform)
    this.ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Time-of-day background — the world breathes with you
    const bgColor = this.getTimeOfDayBackground(world.timeOfDay);
    this.ctx.fillStyle = bgColor;
    this.ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // === World layer (affected by zoom & pan) ===
    this.ctx.save();
    this.ctx.translate(panOffsetX, panOffsetY);
    this.ctx.scale(zoom, zoom);

    this.ctx.fillStyle = bgColor;
    this.ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw gravestones
    for (const grave of world.graveStones) {
      this.spriteRenderer.renderGraveStone(grave);
    }

    // Pass healed state + event speech to sprite renderer for bubble overrides
    const activeHealed = new Set<string>();
    for (const [id, ts] of this.healedCreatureIds) {
      if (Date.now() - ts < 4000) { activeHealed.add(id); }
      else { this.healedCreatureIds.delete(id); }
    }
    this.spriteRenderer.setHealedIds(activeHealed);

    // Event speech overrides (Feature A): active for 6 seconds
    const activeSpeech = new Map<string, string>();
    for (const [id, { text, timestamp }] of eventSpeechOverrides) {
      if (Date.now() - timestamp < 6000) { activeSpeech.set(id, text); }
      else { eventSpeechOverrides.delete(id); }
    }
    this.spriteRenderer.setEventSpeech(activeSpeech);

    // Draw creatures
    for (const creature of creatures) {
      const selected = creature.id === selectedCreatureId;
      if (creature.id === draggingCreatureId) {
        this.ctx.save();
        this.ctx.translate(creature.position.x, creature.position.y);
        this.ctx.scale(1.2, 1.2);
        this.ctx.translate(-creature.position.x, -creature.position.y - 4);
        this.spriteRenderer.renderCreature(creature, true);
        this.ctx.globalAlpha = 0.3;
        this.ctx.fillStyle = '#000000';
        this.ctx.beginPath();
        this.ctx.ellipse(creature.position.x, creature.position.y + 8, 8, 3, 0, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.restore();
      } else {
        this.spriteRenderer.renderCreature(creature, selected);
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

    // Draw heal recovery effects
    this.renderHealEffects();

    // Draw worsen effects (red flash)
    this.renderWorsenEffects();

    // Draw interaction hearts between nearby creatures
    this.renderInteractionHearts(creatures);

    // Draw friendship indicators (Feature D: import-based relationships)
    this.renderFriendshipLinks(creatures, friendPairs);

    // Draw weather overlay (bug-based)
    this.uiRenderer.renderWeatherOverlay(world.weather);

    // Real weather overlay (from Open-Meteo — actual weather outside)
    if (world.realWeather) {
      this.renderRealWeatherOverlay(world.realWeather);
    }

    this.ctx.restore();

    // Time-of-day tint (screen-space, over the world but under UI)
    this.renderTimeOfDayTint(world.timeOfDay);

    // === UI layer (fixed on screen, NOT affected by zoom & pan) ===
    this.uiRenderer.renderCreatureCount(creatures.length);
    this.uiRenderer.renderBugCount(bugCount);

    if (selectedCreatureId) {
      const selectedCreature = creatures.find(c => c.id === selectedCreatureId);
      if (selectedCreature && selectedCreature.dna) {
        this.uiRenderer.renderPersonality(selectedCreature.dna);
      }
    }

    // Code health report (uses cached stats)
    this.uiRenderer.renderHealthReport();

    // Commit effect (UI layer)
    this.updateCommitEffect();
    if (this.commitEffectProgress > 0) {
      this.uiRenderer.renderCommitEffect(this.commitEffectProgress);
    }

    // Farewell overlay (UI layer — screen dims, name floats away)
    this.renderFarewell();
  }

  /** Background color palette — shifts with the real-world clock */
  private getTimeOfDayBackground(tod: TimeOfDay): string {
    switch (tod) {
      case 'dawn':      return '#F0E6D8'; // warm peach
      case 'morning':   return '#F5F0E8'; // bright cream (original)
      case 'afternoon': return '#F2EDE3'; // slightly warm
      case 'dusk':      return '#E8DDD0'; // amber warmth
      case 'night':     return '#2A2A3A'; // deep blue-grey
      default:          return '#F5F0E8';
    }
  }

  /** Subtle color tint over the entire scene — time-of-day atmosphere */
  private renderTimeOfDayTint(tod: TimeOfDay): void {
    if (tod === 'morning' || tod === 'afternoon') return; // no tint during day

    this.ctx.save();
    switch (tod) {
      case 'dawn':
        this.ctx.fillStyle = 'rgba(255, 180, 100, 0.06)'; // golden sunrise
        break;
      case 'dusk':
        this.ctx.fillStyle = 'rgba(255, 120, 50, 0.08)'; // orange sunset
        break;
      case 'night':
        this.ctx.fillStyle = 'rgba(20, 20, 60, 0.15)'; // blue moonlight
        break;
    }
    this.ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Night: add subtle stars
    if (tod === 'night') {
      this.ctx.fillStyle = '#FFFFFF';
      const time = Date.now() / 2000;
      for (let i = 0; i < 12; i++) {
        const sx = (i * 41 + 13) % CANVAS_WIDTH;
        const sy = (i * 29 + 7) % (CANVAS_HEIGHT * 0.4);
        const twinkle = 0.2 + Math.sin(time + i * 1.7) * 0.15;
        this.ctx.globalAlpha = twinkle;
        this.ctx.beginPath();
        this.ctx.arc(sx, sy, 0.8, 0, Math.PI * 2);
        this.ctx.fill();
      }
    }

    this.ctx.restore();
  }

  /** Real weather effects from Open-Meteo — blended with the code-health weather */
  private renderRealWeatherOverlay(rw: RealWeather): void {
    if (!rw || rw === 'clear') return;
    const time = Date.now();

    this.ctx.save();

    if (rw === 'snow') {
      // Gentle snowflakes
      this.ctx.fillStyle = '#FFFFFF';
      this.ctx.globalAlpha = 0.6;
      for (let i = 0; i < 20; i++) {
        const x = (i * 27 + time * 0.02) % CANVAS_WIDTH;
        const y = (i * 19 + time * 0.03) % CANVAS_HEIGHT;
        const size = 1 + (i % 3) * 0.5;
        this.ctx.beginPath();
        this.ctx.arc(x, y, size, 0, Math.PI * 2);
        this.ctx.fill();
      }
    } else if (rw === 'fog') {
      // Soft fog bands
      this.ctx.globalAlpha = 0.08;
      this.ctx.fillStyle = '#CCCCCC';
      const drift = Math.sin(time / 5000) * 20;
      this.ctx.fillRect(0, CANVAS_HEIGHT * 0.3 + drift, CANVAS_WIDTH, 40);
      this.ctx.fillRect(0, CANVAS_HEIGHT * 0.6 - drift, CANVAS_WIDTH, 30);
    }
    // rain and cloudy are already handled by the bug-based weather system

    this.ctx.restore();
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

  /** Feature D: Draw subtle dotted lines between creatures that share import dependencies */
  private renderFriendshipLinks(
    creatures: readonly CreatureData[],
    pairs: readonly { a: string; b: string }[],
  ): void {
    if (pairs.length === 0) return;
    const lookup = new Map(creatures.map(c => [c.id, c]));

    this.ctx.save();
    this.ctx.strokeStyle = 'rgba(255, 182, 193, 0.3)'; // soft pink
    this.ctx.lineWidth = 0.5;
    this.ctx.setLineDash([2, 4]);

    for (const { a, b } of pairs) {
      const ca = lookup.get(a);
      const cb = lookup.get(b);
      if (!ca || !cb || ca.stage === 'egg' || cb.stage === 'egg') continue;

      this.ctx.beginPath();
      this.ctx.moveTo(ca.position.x, ca.position.y);
      this.ctx.lineTo(cb.position.x, cb.position.y);
      this.ctx.stroke();

      // Tiny star at midpoint
      const mx = (ca.position.x + cb.position.x) / 2;
      const my = (ca.position.y + cb.position.y) / 2;
      const pulse = 0.4 + Math.sin(Date.now() / 500) * 0.3;
      this.ctx.globalAlpha = pulse;
      this.ctx.fillStyle = '#FFB6C1';
      this.ctx.beginPath();
      this.ctx.arc(mx, my, 2, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.globalAlpha = 1;
    }

    this.ctx.setLineDash([]);
    this.ctx.restore();
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

  private renderHealEffects(): void {
    const now = Date.now();
    this.healEffects = this.healEffects.filter(e => now - e.startTime < this.HEAL_EFFECT_DURATION);

    for (const effect of this.healEffects) {
      const elapsed = now - effect.startTime;
      const progress = elapsed / this.HEAL_EFFECT_DURATION;

      this.ctx.save();

      // Phase 1: Green ring expands outward (0-0.4)
      if (progress < 0.4) {
        const ringProgress = progress / 0.4;
        const radius = 8 + ringProgress * 20;
        this.ctx.globalAlpha = 1 - ringProgress * 0.5;
        this.ctx.strokeStyle = '#66BB6A';
        this.ctx.lineWidth = 2 - ringProgress;
        this.ctx.beginPath();
        this.ctx.arc(effect.x, effect.y, radius, 0, Math.PI * 2);
        this.ctx.stroke();
      }

      // Phase 2: Leaf-green sparkles float upward (0.1-0.9)
      if (progress > 0.1 && progress < 0.9) {
        const sparkleAlpha = progress < 0.3 ? (progress - 0.1) / 0.2 : (0.9 - progress) / 0.6;
        this.ctx.globalAlpha = sparkleAlpha * 0.8;
        this.ctx.fillStyle = '#A5D6A7';
        for (let i = 0; i < 8; i++) {
          const angle = (i / 8) * Math.PI * 2 + elapsed * 0.003;
          const r = 10 + progress * 18;
          const rise = progress * 12;
          const px = effect.x + Math.cos(angle) * r;
          const py = effect.y - rise + Math.sin(angle) * r * 0.5;
          this.ctx.beginPath();
          this.ctx.arc(px, py, 1.5 - progress * 0.8, 0, Math.PI * 2);
          this.ctx.fill();
        }
      }

      // Phase 3: Soft glow dissipates (0.5-1.0)
      if (progress > 0.5) {
        const glowAlpha = (1 - progress) * 0.3;
        this.ctx.globalAlpha = glowAlpha;
        const gradient = this.ctx.createRadialGradient(effect.x, effect.y, 0, effect.x, effect.y, 24);
        gradient.addColorStop(0, '#C8E6C9');
        gradient.addColorStop(1, 'transparent');
        this.ctx.fillStyle = gradient;
        this.ctx.beginPath();
        this.ctx.arc(effect.x, effect.y, 24, 0, Math.PI * 2);
        this.ctx.fill();
      }

      this.ctx.restore();
    }
  }

  private renderWorsenEffects(): void {
    const now = Date.now();
    this.worsenEffects = this.worsenEffects.filter(e => now - e.startTime < this.WORSEN_EFFECT_DURATION);

    for (const effect of this.worsenEffects) {
      const elapsed = now - effect.startTime;
      const progress = elapsed / this.WORSEN_EFFECT_DURATION;

      this.ctx.save();

      // Phase 1: Red flash ring (0-0.3)
      if (progress < 0.3) {
        const p = progress / 0.3;
        const radius = 6 + p * 16;
        this.ctx.globalAlpha = (1 - p) * 0.8;
        this.ctx.strokeStyle = '#EF5350';
        this.ctx.lineWidth = 2.5 - p * 2;
        this.ctx.beginPath();
        this.ctx.arc(effect.x, effect.y, radius, 0, Math.PI * 2);
        this.ctx.stroke();
      }

      // Phase 2: Red particles scatter outward (0.1-0.8)
      if (progress > 0.1 && progress < 0.8) {
        const sparkAlpha = progress < 0.3 ? (progress - 0.1) / 0.2 : (0.8 - progress) / 0.5;
        this.ctx.globalAlpha = sparkAlpha * 0.7;
        this.ctx.fillStyle = '#EF9A9A';
        for (let i = 0; i < 6; i++) {
          const angle = (i / 6) * Math.PI * 2 + elapsed * 0.004;
          const r = 8 + progress * 22;
          const px = effect.x + Math.cos(angle) * r;
          const py = effect.y + Math.sin(angle) * r * 0.6;
          this.ctx.beginPath();
          this.ctx.arc(px, py, 1.5, 0, Math.PI * 2);
          this.ctx.fill();
        }
      }

      // Phase 3: Dim red glow (0.3-1.0)
      if (progress > 0.3) {
        const glowAlpha = (1 - progress) * 0.2;
        this.ctx.globalAlpha = glowAlpha;
        const gradient = this.ctx.createRadialGradient(effect.x, effect.y, 0, effect.x, effect.y, 20);
        gradient.addColorStop(0, '#FFCDD2');
        gradient.addColorStop(1, 'transparent');
        this.ctx.fillStyle = gradient;
        this.ctx.beginPath();
        this.ctx.arc(effect.x, effect.y, 20, 0, Math.PI * 2);
        this.ctx.fill();
      }

      this.ctx.restore();
    }
  }

  private renderFarewell(): void {
    if (!this.farewellName) return;
    const elapsed = Date.now() - this.farewellStart;
    if (elapsed > this.FAREWELL_DURATION) {
      this.farewellName = null;
      return;
    }

    const progress = elapsed / this.FAREWELL_DURATION;

    this.ctx.save();

    // Dim overlay — peaks at 0.3, then fades
    const dimAlpha = progress < 0.2 ? progress / 0.2 * 0.4 :
                     progress < 0.6 ? 0.4 :
                     0.4 * (1 - (progress - 0.6) / 0.4);
    this.ctx.fillStyle = `rgba(10, 10, 30, ${dimAlpha})`;
    this.ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Name floats upward from center and fades
    const textAlpha = progress < 0.15 ? progress / 0.15 :
                      progress > 0.7 ? (1 - progress) / 0.3 : 1;
    const floatY = CANVAS_HEIGHT / 2 - progress * 30;

    this.ctx.globalAlpha = textAlpha;
    this.ctx.textAlign = 'center';

    // Name
    this.ctx.font = 'bold 14px sans-serif';
    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.fillText(this.farewellName, CANVAS_WIDTH / 2, floatY);

    // Subtle dotted line below (like a gentle wave goodbye)
    if (progress > 0.2 && progress < 0.8) {
      const lineAlpha = textAlpha * 0.4;
      this.ctx.globalAlpha = lineAlpha;
      this.ctx.strokeStyle = '#FFFFFF';
      this.ctx.lineWidth = 0.5;
      this.ctx.setLineDash([2, 4]);
      this.ctx.beginPath();
      const lineW = 40;
      this.ctx.moveTo(CANVAS_WIDTH / 2 - lineW, floatY + 8);
      this.ctx.lineTo(CANVAS_WIDTH / 2 + lineW, floatY + 8);
      this.ctx.stroke();
      this.ctx.setLineDash([]);
    }

    this.ctx.restore();
  }

  private updateCommitEffect(): void {
    if (this.commitEffectProgress <= 0) {return;}

    const elapsed = Date.now() - this.commitEffectStart;
    this.commitEffectProgress = Math.max(0, 1 - elapsed / this.COMMIT_EFFECT_DURATION);
  }
}
