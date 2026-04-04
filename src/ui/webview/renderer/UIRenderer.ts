import { Weather, CodingDNA, CreatureData, RealWeather, TimeOfDay } from '../../../types';
import { CANVAS_WIDTH, CANVAS_HEIGHT, MS_PER_DAY, NESTING_THRESHOLD, FUNCTION_LENGTH_THRESHOLD, LINE_COUNT_HEAVY, STALE_DAYS } from '../../../constants';
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
      const stale = (Date.now() - h.lastModified) / MS_PER_DAY;

      if (h.bugCount > 0)                          { sick++;    }
      else if (h.lineCount > LINE_COUNT_HEAVY)        { heavy++;   }
      else if ((h.maxNesting ?? 0) > NESTING_THRESHOLD || (h.longestFunction ?? 0) > FUNCTION_LENGTH_THRESHOLD) { tangled++; }
      else if (stale > STALE_DAYS)                   { sleepy++;  }
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

  renderCommitEffect(progress: number, streak: number = 0, combo: number = 0): void {
    if (progress <= 0) return;

    const cx = CANVAS_WIDTH / 2;
    const cy = CANVAS_HEIGHT / 2;

    this.ctx.save();

    // Phase 1 (1.0→0.7): Flash + title
    if (progress > 0.7) {
      const flashAlpha = (progress - 0.7) / 0.3;
      this.ctx.globalAlpha = flashAlpha * 0.15;
      this.ctx.fillStyle = '#FFD700';
      this.ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    }

    // Title: "Treat time!" with glow
    this.ctx.globalAlpha = Math.min(1, progress * 2);
    this.ctx.textAlign = 'center';

    this.ctx.shadowColor = '#FFD700';
    this.ctx.shadowBlur = 12;
    this.ctx.fillStyle = '#FDD835';
    this.ctx.strokeStyle = '#F9A825';
    this.ctx.lineWidth = 2;
    this.ctx.font = 'bold 16px sans-serif';
    this.ctx.strokeText(t('committed'), cx, cy - 30);
    this.ctx.fillText(t('committed'), cx, cy - 30);
    this.ctx.shadowBlur = 0;

    // Combo badge (2+ commits in session)
    if (combo >= 2) {
      this.ctx.globalAlpha = Math.min(1, progress * 2);
      const comboScale = 1 + Math.sin(Date.now() / 100) * 0.1; // pulse
      const fontSize = Math.min(24, 14 + combo * 2);
      this.ctx.font = `bold ${fontSize}px sans-serif`;
      const comboColor = combo >= 10 ? '#FF4500' : combo >= 5 ? '#FF6B6B' : '#FFD700';
      this.ctx.shadowColor = comboColor;
      this.ctx.shadowBlur = 16 * comboScale;
      this.ctx.fillStyle = comboColor;
      this.ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      this.ctx.lineWidth = 3;
      const comboText = `${combo} COMBO!`;
      this.ctx.strokeText(comboText, cx, cy - 10);
      this.ctx.fillText(comboText, cx, cy - 10);
      this.ctx.shadowBlur = 0;
    }

    // Streak badge (if any)
    if (streak >= 7) {
      this.ctx.globalAlpha = Math.min(1, progress * 2);
      const tierColor = streak >= 100 ? '#FF4500' : streak >= 30 ? '#FFD700' : '#C0C0C0';
      const tierLabel = streak >= 100 ? '\u{1F525} LEGEND' : streak >= 30 ? '\u{1F3C6} GOLD' : '\u2B50 SILVER';
      this.ctx.font = 'bold 11px sans-serif';
      this.ctx.fillStyle = tierColor;
      const streakY = combo >= 2 ? cy + 8 : cy - 12;
      this.ctx.fillText(`${tierLabel} \u2014 ${streak}-day streak`, cx, streakY);
    }

    // Phase 2 (0.7→0.0): Expanding ring burst
    if (progress < 0.7) {
      const burstProgress = 1 - progress / 0.7;
      const ringRadius = 20 + burstProgress * 80;
      this.ctx.globalAlpha = (1 - burstProgress) * 0.6;
      this.ctx.strokeStyle = '#FFD700';
      this.ctx.lineWidth = 3 - burstProgress * 2.5;
      this.ctx.beginPath();
      this.ctx.arc(cx, cy, ringRadius, 0, Math.PI * 2);
      this.ctx.stroke();

      // Second ring (delayed)
      if (burstProgress > 0.2) {
        const ring2 = (burstProgress - 0.2) / 0.8;
        const r2 = 15 + ring2 * 90;
        this.ctx.globalAlpha = (1 - ring2) * 0.3;
        this.ctx.strokeStyle = '#FF8A65';
        this.ctx.lineWidth = 2 - ring2 * 1.5;
        this.ctx.beginPath();
        this.ctx.arc(cx, cy, r2, 0, Math.PI * 2);
        this.ctx.stroke();
      }
    }

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

  // ── Weather + time indicator (top center) ──

  renderWeatherIndicator(realWeather: RealWeather, timeOfDay: TimeOfDay): void {
    const weatherIcon: Record<string, string> = {
      clear: '\u2600\uFE0F',   // ☀️
      cloudy: '\u2601\uFE0F',  // ☁️
      rain: '\uD83C\uDF27\uFE0F',    // 🌧️
      snow: '\u2744\uFE0F',    // ❄️
      fog: '\uD83C\uDF2B\uFE0F',     // 🌫️
    };
    const todIcon: Record<string, string> = {
      dawn: '\uD83C\uDF05',     // 🌅
      morning: '\u2600\uFE0F',  // ☀️
      afternoon: '\uD83C\uDF24\uFE0F', // 🌤️
      dusk: '\uD83C\uDF07',     // 🌇
      night: '\uD83C\uDF19',    // 🌙
    };

    const icon = realWeather ? weatherIcon[realWeather] ?? todIcon[timeOfDay] ?? '' : todIcon[timeOfDay] ?? '';
    const label = realWeather ?? timeOfDay;

    const text = `${icon} ${label}`;
    this.ctx.save();
    this.ctx.font = '10px sans-serif';
    const tw = this.ctx.measureText(text).width;
    const pw = tw + 12;
    const px = (CANVAS_WIDTH - pw) / 2;

    this.ctx.fillStyle = 'rgba(0,0,0,0.4)';
    this.roundPill(px, 8, pw, 20, 10);
    this.ctx.fillStyle = '#fff';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(text, CANVAS_WIDTH / 2, 22);
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
