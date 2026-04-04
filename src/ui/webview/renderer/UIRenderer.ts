import { Weather, CodingDNA, CreatureData } from '../../../types';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../../../constants';
import { CLOUD_PALETTE, CLOUD_SPRITE } from '../sprites/EnvironmentSprites';
import { t } from '../i18n';

/*
 * UIRenderer — screen-space overlays (not affected by zoom/pan).
 *
 * Design: every label a non-engineer sees must describe a *feeling*,
 * never a metric. Numbers exist only to give scale to the feeling.
 */

// ── Cached health snapshot (computed once per worldUpdate) ──

interface HealthSnapshot {
  total:     number;
  happy:     number;
  sick:      number;
  heavy:     number;
  sleepy:    number;
  tangled:   number;
  score:     number;   // 0-100 "vibe check"
  avgLevel:  number;
}

export class UIRenderer {
  private snap: HealthSnapshot | null = null;

  constructor(private readonly ctx: CanvasRenderingContext2D) {}

  // ── Health cache (call once per worldUpdate, not per frame) ──

  updateHealthCache(creatures: readonly CreatureData[]): void {
    const active = creatures.filter(c => c.stage !== 'egg');
    if (active.length === 0) { this.snap = null; return; }

    let happy = 0, sick = 0, heavy = 0, sleepy = 0, tangled = 0, lvSum = 0;

    for (const c of active) {
      const h = c.fileHealth;
      lvSum += c.level;
      const stale = (Date.now() - h.lastModified) / 864e5; // days

      if (h.bugCount > 0)                          { sick++;    }
      else if (h.lineCount > 300)                   { heavy++;   }
      else if ((h.maxNesting ?? 0) > 8 || (h.longestFunction ?? 0) > 80) { tangled++; }
      else if (stale > 3)                           { sleepy++;  }
      else                                          { happy++;   }
    }

    const n = active.length;
    // Score: percentage of friends that are happy
    const score = Math.round((happy / n) * 100);

    this.snap = {
      total: creatures.length,
      happy, sick, heavy, sleepy, tangled,
      score,
      avgLevel: Math.round(lvSum / n * 10) / 10,
    };
  }

  // ── Top-left: friend count ──

  renderCreatureCount(count: number): void {
    this.ctx.save();
    this.ctx.fillStyle = 'rgba(0,0,0,0.5)';
    this.roundPill(8, 8, 80, 22);
    this.ctx.fillStyle = '#fff';
    this.ctx.font = 'bold 11px sans-serif';
    this.ctx.textAlign = 'left';
    this.ctx.fillText(`${t('lives')}: ${count}`, 16, 23);
    this.ctx.restore();
  }

  // ── Top-right: bug count as "feeling sick" indicator ──

  renderBugCount(count: number): void {
    if (count === 0) return;
    this.ctx.save();
    this.ctx.fillStyle = 'rgba(180,40,40,0.7)';
    this.roundPill(CANVAS_WIDTH - 88, 8, 80, 22);
    this.ctx.fillStyle = '#fff';
    this.ctx.font = 'bold 10px sans-serif';
    this.ctx.textAlign = 'right';
    this.ctx.fillText(`${t('hr_sick')}: ${count}`, CANVAS_WIDTH - 16, 23);
    this.ctx.restore();
  }

  // ── Health report panel (emotional, not technical) ──

  renderHealthReport(): void {
    const s = this.snap;
    if (!s) return;

    const hasTangled = s.tangled > 0;
    const W = 120, H = hasTangled ? 70 : 58;
    const px = CANVAS_WIDTH - W - 8;
    const py = 36;

    this.ctx.save();
    this.ctx.fillStyle = 'rgba(0,0,0,0.65)';
    this.roundPill(px, py, W, H, 6);

    // Title
    this.ctx.fillStyle = '#ccc';
    this.ctx.font = 'bold 9px sans-serif';
    this.ctx.textAlign = 'left';
    this.ctx.fillText(t('hr_title'), px + 6, py + 12);

    // Score bar — the only number, presented as a mood gradient
    const barX = px + 6, barY = py + 17, barW = W - 12, barH = 6;
    this.ctx.fillStyle = 'rgba(255,255,255,0.15)';
    this.roundPill(barX, barY, barW, barH, 3);

    const hue = s.score * 1.2; // 0=red, 120=green
    this.ctx.fillStyle = `hsl(${hue},70%,55%)`;
    this.roundPill(barX, barY, Math.max(barH, barW * s.score / 100), barH, 3);

    // Mood indicators as compact text rows
    const row = (x: number, y: number, label: string, n: number, color: string) => {
      if (n === 0) return;
      this.ctx.fillStyle = color;
      this.ctx.font = '8px sans-serif';
      this.ctx.textAlign = 'left';
      this.ctx.fillText(`${label} ${n}`, x, y);
    };

    const ry = py + 33;
    row(px + 6,  ry,      t('hr_great'),  s.happy,   '#8bc34a');
    row(px + 64, ry,      t('hr_sick'),   s.sick,    '#ef5350');
    row(px + 6,  ry + 12, t('hr_heavy'),  s.heavy,   '#ffa726');
    row(px + 64, ry + 12, t('hr_sleepy'), s.sleepy,  '#90a4ae');
    if (hasTangled) {
      row(px + 6, ry + 24, t('hr_tangled'), s.tangled, '#ab47bc');
    }

    this.ctx.restore();
  }

  // ── Personality panel (replaces DNA — uses feelings, not metrics) ──

  renderPersonality(dna: CodingDNA): void {
    const px = 8, py = CANVAS_HEIGHT - 90, W = 130, H = 82;

    this.ctx.save();
    this.ctx.fillStyle = 'rgba(0,0,0,0.7)';
    this.roundPill(px, py, W, H, 8);

    this.ctx.fillStyle = '#fff';
    this.ctx.font = 'bold 9px sans-serif';
    this.ctx.textAlign = 'left';
    this.ctx.fillText(t('personality'), px + 6, py + 13);

    const traits: [string, number, string][] = [
      [t('trait_active'),    dna.commitFrequency, '#8bc34a'],
      [t('trait_nocturnal'), dna.nightOwl,        '#7e57c2'],
      [t('trait_curious'),   dna.polyglot,        '#29b6f6'],
      [t('trait_swift'),     dna.velocity,        '#ffa726'],
      [t('trait_steady'),    dna.consistency,      '#ef5350'],
    ];

    const startY = py + 22;
    const barMax = 38;

    for (let i = 0; i < traits.length; i++) {
      const [label, value, color] = traits[i];
      const y = startY + i * 13;

      this.ctx.fillStyle = '#ccc';
      this.ctx.font = '8px sans-serif';
      this.ctx.textAlign = 'left';
      this.ctx.fillText(label, px + 6, y + 7);

      const bx = px + W - barMax - 8;
      this.ctx.fillStyle = 'rgba(255,255,255,0.15)';
      this.roundPill(bx, y, barMax, 7, 3);
      this.ctx.fillStyle = color;
      this.roundPill(bx, y, Math.max(7, barMax * value), 7, 3);
    }

    this.ctx.restore();
  }

  // ── Commit celebration ──

  renderCommitEffect(progress: number): void {
    if (progress <= 0) return;

    this.ctx.save();
    this.ctx.globalAlpha = progress;

    const time = Date.now() / 200;
    this.ctx.fillStyle = '#FDD835';
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + time;
      const r = 30 + Math.sin(time + i) * 20;
      this.ctx.beginPath();
      this.ctx.arc(CANVAS_WIDTH / 2 + Math.cos(a) * r, CANVAS_HEIGHT / 2 + Math.sin(a) * r, 2, 0, Math.PI * 2);
      this.ctx.fill();
    }

    this.ctx.fillStyle = '#FDD835';
    this.ctx.strokeStyle = '#F9A825';
    this.ctx.lineWidth = 2;
    this.ctx.font = 'bold 14px sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.strokeText(t('committed'), CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 20);
    this.ctx.fillText(t('committed'), CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 20);

    this.ctx.restore();
  }

  // ── Weather overlay ──

  renderWeatherOverlay(weather: Weather): void {
    if (weather === 'sunny') return;

    this.ctx.save();
    if (weather === 'cloudy') {
      this.ctx.globalAlpha = 0.3;
      this.drawCloud(50, 10);
      this.drawCloud(200, 5);
      this.drawCloud(350, 15);
    } else if (weather === 'rainy') {
      this.ctx.globalAlpha = 0.5;
      this.drawCloud(30, 5);
      this.drawCloud(150, 0);
      this.drawCloud(280, 8);
      this.drawCloud(400, 3);

      this.ctx.globalAlpha = 0.3;
      this.ctx.strokeStyle = '#4FC3F7';
      this.ctx.lineWidth = 1;
      const time = Date.now() / 100;
      for (let i = 0; i < 30; i++) {
        const rx = (i * 17 + time * 2) % CANVAS_WIDTH;
        const ry = (i * 23 + time * 3) % CANVAS_HEIGHT;
        this.ctx.beginPath();
        this.ctx.moveTo(rx, ry);
        this.ctx.lineTo(rx - 2, ry + 6);
        this.ctx.stroke();
      }
    }
    this.ctx.restore();
  }

  // ── Helpers ──

  private roundPill(x: number, y: number, w: number, h: number, r = 6): void {
    this.ctx.beginPath();
    this.ctx.roundRect(x, y, w, h, r);
    this.ctx.fill();
  }

  private drawCloud(x: number, y: number): void {
    for (let row = 0; row < CLOUD_SPRITE.length; row++) {
      for (let col = 0; col < CLOUD_SPRITE[row].length; col++) {
        const idx = CLOUD_SPRITE[row][col];
        if (idx === 0) continue;
        const c = CLOUD_PALETTE[idx];
        if (!c || c === 'transparent') continue;
        this.ctx.fillStyle = c;
        this.ctx.fillRect(x + col, y + row, 1, 1);
      }
    }
  }
}
