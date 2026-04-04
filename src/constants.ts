export const TILE_SIZE = 16;
export const SPRITE_SIZE = 16;
export const MAP_COLS = 30;
export const MAP_ROWS = 20;
export const CANVAS_WIDTH = MAP_COLS * TILE_SIZE;  // 480
export const CANVAS_HEIGHT = MAP_ROWS * TILE_SIZE; // 320

export const FPS = 60;
export const FRAME_DURATION = 1000 / FPS;

export const ANIMATION_FRAME_DURATION = 200; // ms per sprite frame
export const CREATURE_SPEED = 0.5; // pixels per frame
export const IDLE_DURATION_MIN = 2000;
export const IDLE_DURATION_MAX = 5000;
export const HATCH_DURATION = 5000; // 5 seconds to hatch

export const GIT_POLL_INTERVAL = 5000; // 5 seconds
export const FILE_DEBOUNCE = 300; // ms

export const MAX_CREATURES = 30;

export const HUNGER_DECAY_RATE = 0.5;  // per minute
export const HAPPINESS_DECAY_RATE = 0.3; // per minute

export const FEED_AMOUNT = 30;
export const PET_AMOUNT = 20;

export const EXCLUDED_PATTERNS = [
  '**/node_modules/**',
  '**/.git/**',
  '**/dist/**',
  '**/build/**',
  '**/.next/**',
  '**/.nuxt/**',
  '**/coverage/**',
  '**/*.min.js',
  '**/*.map',
  '**/package-lock.json',
  '**/yarn.lock',
  '**/pnpm-lock.yaml',
];

export const BUG_PATTERNS = [
  /\/\/\s*TODO/gi,
  /\/\/\s*FIXME/gi,
  /\/\/\s*HACK/gi,
  /\/\/\s*XXX/gi,
  /console\.log\s*\(/g,
  /:\s*any\b/g,
  /debugger\b/g,
  /eslint-disable(?!-next-line)/g,
];

export const MS_PER_DAY = 86_400_000;

// Health thresholds — shared between extension and webview
export const NESTING_THRESHOLD = 8;
export const FUNCTION_LENGTH_THRESHOLD = 80;
export const LINE_COUNT_HEAVY = 300;
export const LINE_COUNT_OBESE = 400;
export const LINE_COUNT_CRITICAL = 500;
export const STALE_DAYS = 3;

// Neglect death — creature dies if not fed for this many days
export const NEGLECT_DEATH_DAYS = 3;
export const NEGLECT_WARNING_DAYS = 2;

// Mutation unlock level
export const MUTATION_UNLOCK_LEVEL = 5;

export const STORAGE_KEY = 'digitalLife.state';
