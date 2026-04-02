import { ExtToWebMessage, WebToExtMessage, CreatureData, WorldData } from '../../types';
import { CANVAS_WIDTH, CANVAS_HEIGHT, FRAME_DURATION } from '../../constants';
import { GameRenderer } from './renderer/GameRenderer';

// VSCode API
interface VSCodeApi {
  postMessage(message: WebToExtMessage): void;
  getState(): unknown;
  setState(state: unknown): void;
}

declare function acquireVsCodeApi(): VSCodeApi;

const vscode = acquireVsCodeApi();

// Game state
let creatures: readonly CreatureData[] = [];
let worldData: WorldData | null = null;
let bugCount = 0;
let selectedCreatureId: string | null = null;

// Canvas setup
const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d');

if (!ctx) {
  throw new Error('Failed to get 2D context');
}

// Disable image smoothing for pixel art
ctx.imageSmoothingEnabled = false;

const renderer = new GameRenderer(ctx);

// ============================================================
// Zoom & Pan State
// ============================================================
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 4.0;

let zoomLevel = 1.0;
let panX = 0;
let panY = 0;
let isPanning = false;
let isDraggingBread = false;
let panStartX = 0;
let panStartY = 0;
let panStartPanX = 0;
let panStartPanY = 0;

/** Convert screen (client) coordinates to world (canvas) coordinates accounting for zoom and pan */
function screenToWorld(clientX: number, clientY: number): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  const scaleX = CANVAS_WIDTH / rect.width;
  const scaleY = CANVAS_HEIGHT / rect.height;
  const canvasX = (clientX - rect.left) * scaleX;
  const canvasY = (clientY - rect.top) * scaleY;
  return {
    x: (canvasX - panX) / zoomLevel,
    y: (canvasY - panY) / zoomLevel,
  };
}

/** Clamp pan so the world doesn't go too far off-screen */
function clampPan(): void {
  const maxPanX = CANVAS_WIDTH * (zoomLevel - 1) * 0.5 + CANVAS_WIDTH * 0.3;
  const maxPanY = CANVAS_HEIGHT * (zoomLevel - 1) * 0.5 + CANVAS_HEIGHT * 0.3;
  panX = Math.max(-maxPanX, Math.min(maxPanX, panX));
  panY = Math.max(-maxPanY, Math.min(maxPanY, panY));
}

function updateCanvasCursor(): void {
  canvas.classList.toggle('panning', isPanning);
  canvas.classList.toggle('zoomed', !isPanning && zoomLevel > 1.0);
}

// Wheel: trackpad pinch (ctrlKey) = zoom, trackpad 2-finger scroll = pan, mouse wheel = zoom
canvas.addEventListener('wheel', (event: WheelEvent) => {
  event.preventDefault();

  const rect = canvas.getBoundingClientRect();
  const scaleX = CANVAS_WIDTH / rect.width;
  const scaleY = CANVAS_HEIGHT / rect.height;

  if (event.ctrlKey) {
    // Pinch-to-zoom (trackpad) or Ctrl+wheel (mouse)
    const mouseCanvasX = (event.clientX - rect.left) * scaleX;
    const mouseCanvasY = (event.clientY - rect.top) * scaleY;

    const oldZoom = zoomLevel;
    // deltaY is negative for pinch-out (zoom in), positive for pinch-in (zoom out)
    const zoomDelta = -event.deltaY * 0.01;
    zoomLevel = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoomLevel * (1 + zoomDelta)));

    // Adjust pan so the point under the cursor stays fixed
    const zoomRatio = zoomLevel / oldZoom;
    panX = mouseCanvasX - (mouseCanvasX - panX) * zoomRatio;
    panY = mouseCanvasY - (mouseCanvasY - panY) * zoomRatio;
  } else {
    // 2-finger scroll on trackpad or mouse wheel without ctrl
    // If zoomed in, use as pan; otherwise zoom
    if (zoomLevel > 1.01) {
      panX -= event.deltaX * scaleX;
      panY -= event.deltaY * scaleY;
    } else {
      // Mouse wheel zoom (no trackpad)
      const mouseCanvasX = (event.clientX - rect.left) * scaleX;
      const mouseCanvasY = (event.clientY - rect.top) * scaleY;

      const oldZoom = zoomLevel;
      const zoomDelta = event.deltaY > 0 ? -0.1 : 0.1;
      zoomLevel = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoomLevel + zoomDelta));

      const zoomRatio = zoomLevel / oldZoom;
      panX = mouseCanvasX - (mouseCanvasX - panX) * zoomRatio;
      panY = mouseCanvasY - (mouseCanvasY - panY) * zoomRatio;
    }
  }

  clampPan();
  updateCanvasCursor();
}, { passive: false });

// Double-click to reset zoom
canvas.addEventListener('dblclick', () => {
  zoomLevel = 1.0;
  panX = 0;
  panY = 0;
  updateCanvasCursor();
});

// Left-click drag on canvas to pan (when zoomed in)
canvas.addEventListener('pointerdown', (event: PointerEvent) => {
  // Any mouse button can pan when zoomed in, but only if not dragging bread
  if (event.button === 0 && zoomLevel > 1.01 && !isDraggingBread) {
    isPanning = true;
    panStartX = event.clientX;
    panStartY = event.clientY;
    panStartPanX = panX;
    panStartPanY = panY;
    canvas.setPointerCapture(event.pointerId);
    updateCanvasCursor();
  } else if (event.button === 1 || event.button === 2) {
    event.preventDefault();
    isPanning = true;
    panStartX = event.clientX;
    panStartY = event.clientY;
    panStartPanX = panX;
    panStartPanY = panY;
    canvas.setPointerCapture(event.pointerId);
    updateCanvasCursor();
  }
});

let panMoved = false;

canvas.addEventListener('pointermove', (event: PointerEvent) => {
  if (!isPanning) {
    return;
  }
  const dx = event.clientX - panStartX;
  const dy = event.clientY - panStartY;
  if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
    panMoved = true;
  }
  const rect = canvas.getBoundingClientRect();
  const scaleX = CANVAS_WIDTH / rect.width;
  const scaleY = CANVAS_HEIGHT / rect.height;
  panX = panStartPanX + dx * scaleX;
  panY = panStartPanY + dy * scaleY;
  clampPan();
});

canvas.addEventListener('pointerup', (event: PointerEvent) => {
  if (isPanning) {
    isPanning = false;
    canvas.releasePointerCapture(event.pointerId);
    updateCanvasCursor();
  }
});

// Prevent context menu on right-click so it can be used for panning
canvas.addEventListener('contextmenu', (event: Event) => {
  event.preventDefault();
});

// UI elements
const creatureCountEl = document.getElementById('creature-count');
const btnPet = document.getElementById('btn-pet');
const breadSource = document.getElementById('bread-source');
const breadDrag = document.getElementById('bread-drag');
const breadEffect = document.getElementById('bread-effect');
const gameContainer = document.getElementById('game-container');

// Message handling
window.addEventListener('message', (event: MessageEvent<ExtToWebMessage>) => {
  const message = event.data;

  switch (message.type) {
    case 'worldUpdate':
      creatures = message.creatures;
      worldData = message.world;
      bugCount = message.bugs;
      if (creatureCountEl) {
        creatureCountEl.textContent = String(creatures.length);
      }
      // Auto-select first creature if none selected
      if (!selectedCreatureId && creatures.length > 0) {
        selectedCreatureId = creatures[0].id;
      }
      break;

    case 'creatureBorn':
      // Will be handled via next worldUpdate
      break;

    case 'creatureDied':
      if (selectedCreatureId === message.creatureId) {
        selectedCreatureId = creatures.length > 0 ? creatures[0].id : null;
      }
      break;

    case 'commitDetected':
      renderer.triggerCommitEffect();
      break;

    case 'bugCountChanged':
      bugCount = message.count;
      break;
  }
});

// Click handling on canvas for creature selection
canvas.addEventListener('click', (event: MouseEvent) => {
  // Skip if we were panning (drag, not click)
  if (panMoved) {
    panMoved = false;
    return;
  }
  panMoved = false;

  const worldPos = screenToWorld(event.clientX, event.clientY);

  // Find closest creature to click (in world coordinates)
  let closestId: string | null = null;
  let closestDist = 32;

  for (const creature of creatures) {
    const dx = creature.position.x - worldPos.x;
    const dy = creature.position.y - worldPos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < closestDist) {
      closestDist = dist;
      closestId = creature.id;
    }
  }

  if (closestId) {
    selectedCreatureId = closestId;
    updateActionPanel();
  }
});

// Button handlers
btnPet?.addEventListener('click', () => {
  if (selectedCreatureId) {
    vscode.postMessage({ type: 'action', action: 'pet', targetId: selectedCreatureId });
  }
});

function updateActionPanel(): void {
  const panel = document.getElementById('action-panel');
  if (panel) {
    panel.style.opacity = selectedCreatureId ? '1' : '0.5';
  }
}

// ============================================================
// Bread Drag & Drop (using mouse events for VSCode Webview compatibility)
// ============================================================

function findCreatureAtCanvasPos(worldX: number, worldY: number): string | null {
  let closestId: string | null = null;
  let closestDist = 32;

  for (const creature of creatures) {
    const dx = creature.position.x - worldX;
    const dy = creature.position.y - worldY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < closestDist) {
      closestDist = dist;
      closestId = creature.id;
    }
  }

  return closestId;
}

function showBreadEffect(clientX: number, clientY: number): void {
  if (!breadEffect || !gameContainer) {
    return;
  }
  const containerRect = gameContainer.getBoundingClientRect();
  const localX = clientX - containerRect.left;
  const localY = clientY - containerRect.top;

  breadEffect.style.left = `${localX}px`;
  breadEffect.style.top = `${localY}px`;
  breadEffect.classList.remove('animate');
  void breadEffect.offsetWidth;
  breadEffect.classList.add('animate');

  setTimeout(() => {
    breadEffect.classList.remove('animate');
  }, 500);
}

function onBreadMouseDown(event: MouseEvent): void {
  event.preventDefault();
  event.stopPropagation();
  isDraggingBread = true;

  if (breadSource) {
    breadSource.classList.add('dragging-active');
  }
  if (breadDrag && gameContainer) {
    const containerRect = gameContainer.getBoundingClientRect();
    breadDrag.style.left = `${event.clientX - containerRect.left}px`;
    breadDrag.style.top = `${event.clientY - containerRect.top}px`;
    breadDrag.classList.add('visible');
  }

  document.addEventListener('mousemove', onBreadMouseMove, true);
  document.addEventListener('mouseup', onBreadMouseUp, true);
}

function onBreadMouseMove(event: MouseEvent): void {
  if (!isDraggingBread || !breadDrag || !gameContainer) {
    return;
  }
  event.preventDefault();
  const containerRect = gameContainer.getBoundingClientRect();
  breadDrag.style.left = `${event.clientX - containerRect.left}px`;
  breadDrag.style.top = `${event.clientY - containerRect.top}px`;
}

function onBreadMouseUp(event: MouseEvent): void {
  if (!isDraggingBread) {
    return;
  }
  isDraggingBread = false;

  if (breadSource) {
    breadSource.classList.remove('dragging-active');
  }
  if (breadDrag) {
    breadDrag.classList.remove('visible');
  }

  document.removeEventListener('mousemove', onBreadMouseMove, true);
  document.removeEventListener('mouseup', onBreadMouseUp, true);

  // Check if dropped on a creature
  const worldPos = screenToWorld(event.clientX, event.clientY);
  const targetId = findCreatureAtCanvasPos(worldPos.x, worldPos.y);

  if (targetId) {
    vscode.postMessage({ type: 'action', action: 'feed', targetId });
    selectedCreatureId = targetId;
    updateActionPanel();
    showBreadEffect(event.clientX, event.clientY);
  }
}

// Also support click on bread to feed selected creature (fallback)
function onBreadClick(event: MouseEvent): void {
  event.stopPropagation();
  if (selectedCreatureId) {
    vscode.postMessage({ type: 'action', action: 'feed', targetId: selectedCreatureId });
    showBreadEffect(event.clientX, event.clientY);
  }
}

breadSource?.addEventListener('mousedown', onBreadMouseDown);
breadSource?.addEventListener('click', onBreadClick);

// Game loop
let lastTime = 0;

function gameLoop(timestamp: number): void {
  const delta = timestamp - lastTime;

  if (delta >= FRAME_DURATION) {
    lastTime = timestamp;

    if (worldData) {
      renderer.render(creatures, worldData, bugCount, zoomLevel, panX, panY);
    }
  }

  requestAnimationFrame(gameLoop);
}

// Initialize
vscode.postMessage({ type: 'ready' });
requestAnimationFrame(gameLoop);
