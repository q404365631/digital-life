import * as fs from 'fs';
import { BUG_PATTERNS } from '../constants';
import { FileHealth } from '../types';

export class CodeAnalyzer {
  analyzeFile(filePath: string): number {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      return this.countBugs(content);
    } catch {
      return 0;
    }
  }

  analyzeFileDetailed(filePath: string): FileHealth {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');
      const lineCount = lines.length;

      let bugCount = 0;
      for (const pattern of BUG_PATTERNS) {
        const regex = new RegExp(pattern.source, pattern.flags);
        const matches = content.match(regex);
        if (matches) {
          bugCount += matches.length;
        }
      }

      const stat = fs.statSync(filePath);
      const lastModified = stat.mtimeMs;

      return { lineCount, bugCount, lastModified };
    } catch {
      return { lineCount: 0, bugCount: 0, lastModified: Date.now() };
    }
  }

  private countBugs(content: string): number {
    let count = 0;
    for (const pattern of BUG_PATTERNS) {
      const regex = new RegExp(pattern.source, pattern.flags);
      const matches = content.match(regex);
      if (matches) {
        count += matches.length;
      }
    }
    return count;
  }
}
