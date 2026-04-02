import * as fs from 'fs';
import { BUG_PATTERNS } from '../constants';

export class CodeAnalyzer {
  analyzeFile(filePath: string): number {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      return this.countBugs(content);
    } catch {
      return 0;
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
