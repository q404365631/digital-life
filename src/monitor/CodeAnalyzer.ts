import * as fs from 'fs';
import * as path from 'path';
import { BUG_PATTERNS } from '../constants';
import { FileHealth } from '../types';

export class CodeAnalyzer {
  private customPatterns: RegExp[] = [];

  /** Load custom bug patterns from .digital-life.json in workspace root */
  loadCustomPatterns(workspacePath: string): void {
    try {
      const configPath = path.join(workspacePath, '.digital-life.json');
      const raw = fs.readFileSync(configPath, 'utf-8');
      const config = JSON.parse(raw);
      if (Array.isArray(config.bugPatterns)) {
        this.customPatterns = config.bugPatterns
          .filter((p: unknown) => typeof p === 'object' && p !== null && 'pattern' in p)
          .map((p: { pattern: string }) => new RegExp(p.pattern, 'g'));
      }
    } catch {
      // No config file or invalid JSON — fine, use defaults only
    }
  }

  private getAllPatterns(): RegExp[] {
    return [...BUG_PATTERNS, ...this.customPatterns];
  }

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
      for (const pattern of this.getAllPatterns()) {
        const regex = new RegExp(pattern.source, pattern.flags);
        const matches = content.match(regex);
        if (matches) {
          bugCount += matches.length;
        }
      }

      const stat = fs.statSync(filePath);
      const lastModified = stat.mtimeMs;

      const maxNesting = this.measureMaxNesting(lines);
      const longestFunction = this.measureLongestFunction(lines);

      return { lineCount, bugCount, lastModified, maxNesting, longestFunction };
    } catch {
      return { lineCount: 0, bugCount: 0, lastModified: Date.now(), maxNesting: 0, longestFunction: 0 };
    }
  }

  /** Measure deepest indentation level (proxy for cyclomatic complexity). */
  private measureMaxNesting(lines: string[]): number {
    let maxDepth = 0;
    let depth = 0;
    for (const line of lines) {
      const trimmed = line.trim();
      for (const ch of trimmed) {
        if (ch === '{') depth++;
        if (ch === '}') depth = Math.max(0, depth - 1);
      }
      if (depth > maxDepth) maxDepth = depth;
    }
    return maxDepth;
  }

  /** Measure the longest function/method body in lines. */
  private measureLongestFunction(lines: string[]): number {
    let longest = 0;
    let currentStart = -1;
    let braceDepth = 0;
    const funcPattern = /^\s*(?:export\s+)?(?:async\s+)?(?:function|const\s+\w+\s*=|(?:public|private|protected)\s+)/;

    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim();

      if (funcPattern.test(trimmed) && currentStart === -1) {
        currentStart = i;
      }

      for (const ch of trimmed) {
        if (ch === '{') {
          if (currentStart === -1) currentStart = i;
          braceDepth++;
        }
        if (ch === '}') {
          braceDepth--;
          if (braceDepth <= 0 && currentStart !== -1) {
            const length = i - currentStart + 1;
            if (length > longest) longest = length;
            currentStart = -1;
            braceDepth = 0;
          }
        }
      }
    }
    return longest;
  }

  private countBugs(content: string): number {
    let count = 0;
    for (const pattern of this.getAllPatterns()) {
      const regex = new RegExp(pattern.source, pattern.flags);
      const matches = content.match(regex);
      if (matches) {
        count += matches.length;
      }
    }
    return count;
  }
}
