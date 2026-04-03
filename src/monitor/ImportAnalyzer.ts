/**
 * ImportAnalyzer — discovers file-to-file dependencies.
 *
 * Scans source files for import/require/from patterns,
 * resolves them to absolute paths, and returns pairs of
 * related files. Used to build creature friendship graphs.
 *
 * Lightweight: regex-based, no AST parsing.
 * Handles: ES imports, CommonJS require, re-exports.
 */

import * as fs from 'fs';
import * as path from 'path';

// Matches: import ... from '...' / require('...') / export ... from '...'
const IMPORT_PATTERNS = [
  /from\s+['"]([^'"]+)['"]/g,
  /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
];

const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rs', '.java', '.vue', '.svelte'];

/**
 * Analyze a single file and return absolute paths of its local imports.
 * Ignores node_modules / package imports.
 */
function getLocalImports(filePath: string): string[] {
  let content: string;
  try {
    content = fs.readFileSync(filePath, 'utf-8');
  } catch {
    return [];
  }

  const dir = path.dirname(filePath);
  const imports: string[] = [];

  for (const pattern of IMPORT_PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match: RegExpExecArray | null;
    while ((match = regex.exec(content)) !== null) {
      const specifier = match[1];
      // Skip package imports (no relative path prefix)
      if (!specifier.startsWith('.') && !specifier.startsWith('/')) continue;

      const resolved = resolveImport(dir, specifier);
      if (resolved) imports.push(resolved);
    }
  }

  return imports;
}

/** Resolve a relative import specifier to an absolute file path. */
function resolveImport(fromDir: string, specifier: string): string | null {
  const base = path.resolve(fromDir, specifier);

  // Try exact path first (with extension)
  if (fs.existsSync(base) && fs.statSync(base).isFile()) return base;

  // Try adding common extensions
  for (const ext of SOURCE_EXTENSIONS) {
    const withExt = base + ext;
    if (fs.existsSync(withExt)) return withExt;
  }

  // Try index file in directory
  for (const ext of SOURCE_EXTENSIONS) {
    const indexFile = path.join(base, `index${ext}`);
    if (fs.existsSync(indexFile)) return indexFile;
  }

  return null;
}

export interface FriendPair {
  readonly fileA: string;
  readonly fileB: string;
}

/**
 * Analyze all tracked files and return friendship pairs.
 * A friendship = file A imports file B (or vice versa).
 * Deduplicated: each pair appears once.
 */
export function analyzeFriendships(filePaths: string[]): FriendPair[] {
  const pathSet = new Set(filePaths);
  const pairSet = new Set<string>();
  const pairs: FriendPair[] = [];

  for (const filePath of filePaths) {
    const imports = getLocalImports(filePath);
    for (const imported of imports) {
      if (!pathSet.has(imported)) continue;
      if (imported === filePath) continue;

      // Deduplicate: sorted key
      const key = [filePath, imported].sort().join('\0');
      if (pairSet.has(key)) continue;
      pairSet.add(key);
      pairs.push({ fileA: filePath, fileB: imported });
    }
  }

  return pairs;
}
