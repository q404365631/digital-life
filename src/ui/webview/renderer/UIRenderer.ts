import { Weather } from '../../../types';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../../../constants';
import { CLOUD_PALETTE, CLOUD_SPRITE } from '../sprites/EnvironmentSprites';

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
    this.ctx.fillText(`Lives: ${count}`, 16, 24);
    this.ctx.restore();
  }

  renderGoalText(): void {
    this.ctx.save();
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    this.ctx.beginPath();
    this.ctx.roundRect(CANVAS_WIDTH / 2 - 80, CANVAS_HEIGHT - 28, 160, 20, 6);
    this.ctx.fill();

    this.ctx.fillStyle = '#FDD835';
    this.ctx.font = 'bold 10px monospace';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('GOAL: CARE FOR THEM', CANVAS_WIDTH / 2, CANVAS_HEIGHT - 14);
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
    this.ctx.fillText(`Bugs: ${count}`, CANVAS_WIDTH - 16, 24);
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
    this.ctx.strokeText('Committed!', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 20);
    this.ctx.fillText('Committed!', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 20);

    this.ctx.restore();
  }

  private drawCloud(x: number, y: number): void {
    const sprite = CLOUD_SPRITE;
    const palette = CLOUD_PALETTE;

    for (let row = 0; row < sprite.length; row++) {
      for (let col = 0; col < sprite[row].length; col++) {
        const paletteIndex = sprite[row][col];
        if (paletteIndex === 0) continue;
        const color = palette[paletteIndex];
        if (!color || color === 'transparent') continue;
        this.ctx.fillStyle = color;
        this.ctx.fillRect(x + col, y + row, 1, 1);
      }
    }
  }
}
