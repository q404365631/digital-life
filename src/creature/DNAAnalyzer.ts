import simpleGit from 'simple-git';
import { CodingDNA } from '../types';

export function defaultDNA(): CodingDNA {
  return {
    commitFrequency: 0.5,
    nightOwl: 0.5,
    polyglot: 0.5,
    velocity: 0.5,
    consistency: 0.5,
  };
}

export class DNAAnalyzer {
  private git;

  constructor(workspacePath: string) {
    this.git = simpleGit(workspacePath);
  }

  async analyze(): Promise<CodingDNA> {
    try {
      const isRepo = await this.git.checkIsRepo();
      if (!isRepo) {
        return defaultDNA();
      }

      const log = await this.git.log({ maxCount: 100 });

      if (log.total === 0) {
        return defaultDNA();
      }

      // Normalize recent commit count (last 7 days) to 0-1
      const now = Date.now();
      const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
      const recentCommits = log.all.filter(c => new Date(c.date).getTime() > weekAgo);
      const commitFrequency = Math.min(1, recentCommits.length / 30);

      // Ratio of commits between 18:00-06:00
      const nightCommits = log.all.filter(c => {
        const hour = new Date(c.date).getHours();
        return hour >= 18 || hour < 6;
      });
      const nightOwl = log.total > 0 ? nightCommits.length / log.total : 0.5;

      // Average interval between commits (shorter = faster)
      let avgInterval = 0;
      if (log.all.length > 1) {
        const intervals: number[] = [];
        for (let i = 0; i < log.all.length - 1; i++) {
          const diff = new Date(log.all[i].date).getTime() - new Date(log.all[i + 1].date).getTime();
          intervals.push(diff);
        }
        avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      }
      const velocity = Math.min(1, Math.max(0, 1 - (avgInterval / (24 * 60 * 60 * 1000))));

      // Lower hour variance = more consistent schedule
      const hours = log.all.map(c => new Date(c.date).getHours());
      const avgHour = hours.reduce((a, b) => a + b, 0) / hours.length;
      const variance = hours.reduce((sum, h) => sum + Math.pow(h - avgHour, 2), 0) / hours.length;
      const consistency = Math.min(1, Math.max(0, 1 - (variance / 72)));

      // Default value (can be updated via workspace scan later)
      const polyglot = 0.5;

      return { commitFrequency, nightOwl, polyglot, velocity, consistency };
    } catch {
      return defaultDNA();
    }
  }
}
