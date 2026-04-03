import { Weather, CodingDNA, CreatureData } from '../../../types';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../../../constants';
import { CLOUD_PALETTE, CLOUD_SPRITE } from '../sprites/EnvironmentSprites';
import { t } from '../i18n';

export class UIRenderer {
  constructor(private readonly ctx: CanvasRenderingContext2D) {}

  renderCreatureCount(count: number): void {
    this.ctx.save();
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    this.ctx.beginPath();
    this.ctx.roundRect(8, 8, 80, 24, 6);
    this.ctx.fill();

    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.font = 'bold 12px monospace';
    this.ctx.textAlign = 'left';
    this.ctx.fillText(`${t('lives')}: ${count}`, 16, 24);
    this.ctx.restore();
  }

  renderWeatherOverlay(weather: Weather): void {
    if (weather === 'sunny') {
      return;
    }

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

      // Rain drops
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

  renderBugCount(count: number): void {
    if (count === 0) {
      return;
    }

    this.ctx.save();
    this.ctx.fillStyle = 'rgba(211, 47, 47, 0.7)';
    this.ctx.beginPath();
    this.ctx.roundRect(CANVAS_WIDTH - 88, 8, 80, 24, 6);
    this.ctx.fill();

    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.font = 'bold 10px monospace';
    this.ctx.textAlign = 'right';
    this.ctx.fillText(`${t('bugs')}: ${count}`, CANVAS_WIDTH - 16, 24);
    this.ctx.restore();
  }

  renderCommitEffect(progress: number): void {
    if (progress <= 0) {
      return;
    }

    this.ctx.save();
    this.ctx.globalAlpha = progress;

    // Golden sparkle effect
    this.ctx.fillStyle = '#FDD835';
    const sparkles = 12;
    const time = Date.now() / 200;
    for (let i = 0; i < sparkles; i++) {
      const angle = (i / sparkles) * Math.PI * 2 + time;
      const radius = 30 + Math.sin(time + i) * 20;
      const sx = CANVAS_WIDTH / 2 + Math.cos(angle) * radius;
      const sy = CANVAS_HEIGHT / 2 + Math.sin(angle) * radius;
      this.ctx.beginPath();
      this.ctx.arc(sx, sy, 2, 0, Math.PI * 2);
      this.ctx.fill();
    }

    // "Commit!" text
    this.ctx.fillStyle = '#FDD835';
    this.ctx.strokeStyle = '#F9A825';
    this.ctx.lineWidth = 2;
    this.ctx.font = 'bold 16px monospace';
    this.ctx.textAlign = 'center';
    this.ctx.strokeText(t('committed'), CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 20);
    this.ctx.fillText(t('committed'), CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 20);

    this.ctx.restore();
  }

  renderDNAPanel(dna: CodingDNA): void {
    const panelX = 8;
    const panelY = CANVAS_HEIGHT - 100;
    const panelW = 150;
    const panelH = 90;
    const barMaxW = 40;
    const barH = 8;
    const lineHeight = 14;

    // Background
    this.ctx.save();
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    this.ctx.beginPath();
    this.ctx.roundRect(panelX, panelY, panelW, panelH, 8);
    this.ctx.fill();

    // Title
    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.font = 'bold 10px sans-serif';
    this.ctx.textAlign = 'left';
    this.ctx.fillText(t('dna'), panelX + 6, panelY + 13);

    const entries: { label: string; value: number; color: string }[] = [
      { label: t('freq'), value: dna.commitFrequency, color: '#4CAF50' },
      { label: t('night'), value: dna.nightOwl, color: '#7E57C2' },
      { label: t('poly'), value: dna.polyglot, color: '#29B6F6' },
      { label: t('speed'), value: dna.velocity, color: '#FFA726' },
      { label: t('consist'), value: dna.consistency, color: '#EF5350' },
    ];

    const startY = panelY + 22;
    const labelX = panelX + 6;
    const barX = panelX + panelW - barMaxW - 8;

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const y = startY + i * lineHeight;

      // Label
      this.ctx.fillStyle = '#FFFFFF';
      this.ctx.font = '9px sans-serif';
      this.ctx.textAlign = 'left';
      this.ctx.fillText(entry.label, labelX, y + barH - 1);

      // Bar background
      this.ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
      this.ctx.beginPath();
      this.ctx.roundRect(barX, y, barMaxW, barH, 3);
      this.ctx.fill();

      // Bar fill
      this.ctx.fillStyle = entry.color;
      this.ctx.beginPath();
      this.ctx.roundRect(barX, y, barMaxW * entry.value, barH, 3);
      this.ctx.fill();
    }

    this.ctx.restore();
  }

  renderHealthReport(creatures: readonly CreatureData[]): void {
    if (creatures.length === 0) { return; }

    // Aggregate health metrics
    let totalLines = 0;
    let totalBugs = 0;
    let healthyFiles = 0;
    let fatFiles = 0;
    let abandonedFiles = 0;
    let totalLevel = 0;

    for (const c of creatures) {
      if (c.stage === 'egg') { continue; }
      const h = c.fileHealth;
      totalLines += h.lineCount;
      totalBugs += h.bugCount;
      totalLevel += c.level;
      if (h.bugCount === 0 && h.lineCount > 0 && h.lineCount <= 100) { healthyFiles++; }
      if (h.lineCount > 300) { fatFiles++; }
      const daysSince = (Date.now() - h.lastModified) / (1000 * 60 * 60 * 24);
      if (daysSince > 3) { abandonedFiles++; }
    }

    const activeCreatures = creatures.filter(c => c.stage !== 'egg').length;
    const avgLevel = activeCreatures > 0 ? Math.round(totalLevel / activeCreatures * 10) / 10 : 0;

    // Health score: 0-100
    let score = 100;
    if (activeCreatures > 0) {
      score -= Math.min(30, totalBugs * 5);
      score -= Math.min(20, fatFiles * 10);
      score -= Math.min(20, abandonedFiles * 10);
      score += Math.min(20, healthyFiles * 5);
      score = Math.max(0, Math.min(100, score));
    }

    // Render panel at top-right area
    const panelW = 130;
    const panelH = 72;
    const panelX = CANVAS_WIDTH - panelW - 8;
    const panelY = 38;

    this.ctx.save();
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    this.ctx.beginPath();
    this.ctx.roundRect(panelX, panelY, panelW, panelH, 6);
    this.ctx.fill();

    // Title
    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.font = 'bold 9px sans-serif';
    this.ctx.textAlign = 'left';
    this.ctx.fillText(t('health_report'), panelX + 6, panelY + 12);

    // Health score bar
    const barX = panelX + 6;
    const barY = panelY + 18;
    const barW = panelW - 12;
    const barH = 8;

    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    this.ctx.beginPath();
    this.ctx.roundRect(barX, barY, barW, barH, 3);
    this.ctx.fill();

    const scoreColor = score >= 70 ? '#4CAF50' : score >= 40 ? '#FFA726' : '#EF5350';
    this.ctx.fillStyle = scoreColor;
    this.ctx.beginPath();
    this.ctx.roundRect(barX, barY, barW * (score / 100), barH, 3);
    this.ctx.fill();

    // Score label
    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.font = 'bold 8px sans-serif';
    this.ctx.textAlign = 'right';
    this.ctx.fillText(`${Math.round(score)}%`, panelX + panelW - 6, barY + 7);

    // Stats
    this.ctx.font = '8px sans-serif';
    this.ctx.textAlign = 'left';
    const statsY = barY + 16;
    const lineH = 11;

    this.ctx.fillStyle = '#90CAF9';
    this.ctx.fillText(`${t('total_lines')}: ${totalLines}`, barX, statsY);

    this.ctx.fillStyle = totalBugs > 0 ? '#EF5350' : '#4CAF50';
    this.ctx.fillText(`${t('bugs')}: ${totalBugs}`, barX, statsY + lineH);

    this.ctx.fillStyle = '#FFD700';
    this.ctx.fillText(`${t('avg_level')}: ${avgLevel}`, barX + 65, statsY);

    this.ctx.fillStyle = healthyFiles > 0 ? '#4CAF50' : '#90A4AE';
    this.ctx.fillText(`${t('healthy')}: ${healthyFiles}`, barX + 65, statsY + lineH);

    // Warning indicators
    const warningY = statsY + lineH * 2;
    if (fatFiles > 0) {
      this.ctx.fillStyle = '#FFA726';
      this.ctx.fillText(`${t('fat_files')}: ${fatFiles}`, barX, warningY);
    }
    if (abandonedFiles > 0) {
      this.ctx.fillStyle = '#90A4AE';
      this.ctx.fillText(`${t('abandoned')}: ${abandonedFiles}`, barX + 65, warningY);
    }

    this.ctx.restore();
  }

  private drawCloud(x: number, y: number): void {
    const sprite = CLOUD_SPRITE;
    const palette = CLOUD_PALETTE;

    for (let row = 0; row < sprite.length; row++) {
      for (let col = 0; col < sprite[row].length; col++) {
        const paletteIndex = sprite[row][col];
        if (paletteIndex === 0) {continue;}
        const color = palette[paletteIndex];
        if (!color || color === 'transparent') {continue;}
        this.ctx.fillStyle = color;
        this.ctx.fillRect(x + col, y + row, 1, 1);
      }
    }
  }
}
