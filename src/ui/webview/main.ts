import { ExtToWebMessage, WebToExtMessage, CreatureData, AgentData, AgentType, WorldData } from '../../types';
import { CANVAS_WIDTH, CANVAS_HEIGHT, FRAME_DURATION } from '../../constants';
import { GameRenderer } from './renderer/GameRenderer';
import { SoundEngine } from './audio/SoundEngine';
import { setLanguage, getLanguage, Language, t } from './i18n';

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
let agents: readonly AgentData[] = [];
let selectedCreatureId: string | null = null;
const agentChats: Map<string, { message: string; timestamp: number }> = new Map();

// Agent keyboard control
let selectedAgentId: string | null = null;
const keysPressed: Set<string> = new Set();

// Smooth position interpolation
const smoothPositions: Map<string, { x: number; y: number }> = new Map();

function lerpPosition(current: { x: number; y: number }, target: { x: number; y: number }, factor: number): { x: number; y: number } {
  return {
    x: current.x + (target.x - current.x) * factor,
    y: current.y + (target.y - current.y) * factor,
  };
}

// Canvas setup
const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d');

if (!ctx) {
  throw new Error('Failed to get 2D context');
}

// Disable image smoothing for pixel art
ctx.imageSmoothingEnabled = false;

const renderer = new GameRenderer(ctx);
const soundEngine = new SoundEngine();

// ============================================================
// Zoom & Pan State
// ============================================================
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 4.0;

let zoomLevel = 1.0;
let panX = 0;
let panY = 0;
let isPanning = false;
type ActionMode = 'none' | 'feed' | 'diet' | 'cure' | 'wake';
let actionMode: ActionMode = 'none';
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

// Left-click drag on canvas: creature drag or pan
canvas.addEventListener('pointerdown', (event: PointerEvent) => {
  if (event.button === 0 && actionMode === 'none') {
    // Check if clicking on a creature (for drag)
    const worldPos = screenToWorld(event.clientX, event.clientY);
    const targetId = findCreatureAtCanvasPos(worldPos.x, worldPos.y);

    if (targetId) {
      // Start dragging creature
      draggingCreatureId = targetId;
      dragStartX = event.clientX;
      dragStartY = event.clientY;
      dragMoved = false;
      dragOverridePositions.set(targetId, { x: worldPos.x, y: worldPos.y });
      canvas.classList.add('dragging-creature');
      canvas.setPointerCapture(event.pointerId);
      return;
    }

    // Check if clicking on an agent (for drag)
    const agentId = findAgentAtCanvasPos(worldPos.x, worldPos.y);
    if (agentId) {
      draggingAgentId = agentId;
      dragStartX = event.clientX;
      dragStartY = event.clientY;
      dragMoved = false;
      dragOverridePositions.set(agentId, { x: worldPos.x, y: worldPos.y });
      canvas.classList.add('dragging-creature');
      canvas.setPointerCapture(event.pointerId);
      return;
    }

    // No creature or agent found: pan if zoomed in
    if (zoomLevel > 1.01) {
      isPanning = true;
      panStartX = event.clientX;
      panStartY = event.clientY;
      panStartPanX = panX;
      panStartPanY = panY;
      canvas.setPointerCapture(event.pointerId);
      updateCanvasCursor();
    }
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

// ============================================================
// Drag & Drop State (creatures + agents)
// ============================================================
let draggingCreatureId: string | null = null;
let draggingAgentId: string | null = null;
let dragStartX = 0;
let dragStartY = 0;
let dragMoved = false;
const dragOverridePositions: Map<string, { x: number; y: number }> = new Map();

canvas.addEventListener('pointermove', (event: PointerEvent) => {
  // Handle creature dragging
  if (draggingCreatureId) {
    const worldPos = screenToWorld(event.clientX, event.clientY);
    dragOverridePositions.set(draggingCreatureId, { x: worldPos.x, y: worldPos.y });
    const dx = event.clientX - dragStartX;
    const dy = event.clientY - dragStartY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      dragMoved = true;
    }
    return;
  }

  // Handle agent dragging
  if (draggingAgentId) {
    const worldPos = screenToWorld(event.clientX, event.clientY);
    dragOverridePositions.set(draggingAgentId, { x: worldPos.x, y: worldPos.y });
    const dx = event.clientX - dragStartX;
    const dy = event.clientY - dragStartY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      dragMoved = true;
    }
    return;
  }

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
  // Handle creature drop
  if (draggingCreatureId) {
    const override = dragOverridePositions.get(draggingCreatureId);
    if (override && dragMoved) {
      vscode.postMessage({ type: 'moveCreature', creatureId: draggingCreatureId, position: override });
    }
    dragOverridePositions.delete(draggingCreatureId);
    draggingCreatureId = null;
    dragMoved = false;
    canvas.classList.remove('dragging-creature');
    canvas.releasePointerCapture(event.pointerId);
    return;
  }

  // Handle agent drop
  if (draggingAgentId) {
    const override = dragOverridePositions.get(draggingAgentId);
    if (override && dragMoved) {
      vscode.postMessage({ type: 'moveAgent', agentId: draggingAgentId, position: override });
    }
    dragOverridePositions.delete(draggingAgentId);
    draggingAgentId = null;
    dragMoved = false;
    canvas.classList.remove('dragging-creature');
    canvas.releasePointerCapture(event.pointerId);
    return;
  }

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

// UI elements (toolbar - separate from canvas, no event interference)
const statusText = document.getElementById('status-text');
const btnFeed = document.getElementById('btn-feed');
const btnDiet = document.getElementById('btn-diet');
const btnCure = document.getElementById('btn-cure');
const btnWake = document.getElementById('btn-wake');
const btnMute = document.getElementById('btn-mute');
const btnLang = document.getElementById('btn-lang');
const feedIndicator = document.getElementById('feed-mode-indicator');
const eduMessage = document.getElementById('edu-message');

// Message handling
window.addEventListener('message', (event: MessageEvent<ExtToWebMessage>) => {
  const message = event.data;

  switch (message.type) {
    case 'worldUpdate':
      creatures = message.creatures;
      worldData = message.world;
      bugCount = message.bugs;
      agents = message.agents ?? [];
      if (statusText) {
        statusText.textContent = `Lives: ${creatures.length}`;
      }
      // Auto-select first creature if none selected
      if (!selectedCreatureId && creatures.length > 0) {
        selectedCreatureId = creatures[0].id;
      }
      break;

    case 'creatureBorn':
      soundEngine.playHatch();
      // Will be handled via next worldUpdate
      break;

    case 'creatureDied': {
      soundEngine.playDeath();
      if (selectedCreatureId === message.creatureId) {
        const alive = creatures.filter(c => c.id !== message.creatureId);
        selectedCreatureId = alive.length > 0 ? alive[0].id : null;
      }
      break;
    }

    case 'commitDetected':
      renderer.triggerCommitEffect();
      soundEngine.playCommit();
      break;

    case 'bugCountChanged':
      bugCount = message.count;
      break;

    case 'agentChat': {
      agentChats.set(message.agentId, { message: message.message, timestamp: Date.now() });
      break;
    }
  }
});

// Click handling on canvas for creature selection and feed mode
canvas.addEventListener('click', (event: MouseEvent) => {
  // Skip if we were panning (drag, not click)
  if (panMoved) {
    panMoved = false;
    return;
  }
  // Skip if we just finished dragging a creature
  if (dragMoved) {
    dragMoved = false;
    return;
  }
  panMoved = false;

  const worldPos = screenToWorld(event.clientX, event.clientY);

  // Find closest creature to click (in world coordinates)
  const targetId = findCreatureAtCanvasPos(worldPos.x, worldPos.y);

  if (actionMode !== 'none') {
    if (targetId) {
      const creature = creatures.find(c => c.id === targetId);
      if (creature) {
        handleAction(actionMode, creature);
      }
    }
    setActionMode('none');
    return;
  }

  if (targetId) {
    selectedCreatureId = targetId;
    return;
  }

  // Check agents (click = select + stop + open terminal)
  for (const agent of agents) {
    const dx = agent.position.x - worldPos.x;
    const dy = agent.position.y - worldPos.y;
    if (Math.sqrt(dx * dx + dy * dy) < 32) {
      selectedAgentId = agent.id;
      renderer.setSelectedAgentId(agent.id);
      vscode.postMessage({ type: 'selectAgent', agentId: agent.id });
      vscode.postMessage({ type: 'stopAgent', agentId: agent.id });
      vscode.postMessage({ type: 'clickAgent', agentId: agent.id });
      return;
    }
  }
});

// Keyboard controls
document.addEventListener('keydown', (event: KeyboardEvent) => {
  keysPressed.add(event.key);

  // ESC key to cancel action mode or deselect agent
  if (event.key === 'Escape') {
    if (actionMode !== 'none') {
      setActionMode('none');
    } else if (selectedAgentId) {
      selectedAgentId = null;
      renderer.setSelectedAgentId(null);
    }
  }

  // Space key to toggle sit/stand
  if (event.key === ' ' && selectedAgentId) {
    event.preventDefault();
    const agent = agents.find(a => a.id === selectedAgentId);
    vscode.postMessage({ type: 'sitAgent', agentId: selectedAgentId, sitting: !(agent?.isSitting ?? false) });
  }
});

document.addEventListener('keyup', (event: KeyboardEvent) => {
  keysPressed.delete(event.key);
});

// Button handlers (toolbar buttons - completely outside canvas, no event interference)
btnFeed?.addEventListener('click', () => setActionMode(actionMode === 'feed' ? 'none' : 'feed'));
btnDiet?.addEventListener('click', () => setActionMode(actionMode === 'diet' ? 'none' : 'diet'));
btnCure?.addEventListener('click', () => setActionMode(actionMode === 'cure' ? 'none' : 'cure'));
btnWake?.addEventListener('click', () => setActionMode(actionMode === 'wake' ? 'none' : 'wake'));

btnMute?.addEventListener('click', () => {
  const newMuted = !soundEngine.isMuted();
  soundEngine.setMuted(newMuted);
  if (btnMute) {
    btnMute.textContent = newMuted ? '\u{1F507}' : '\u{1F50A}';
    btnMute.title = newMuted ? t('unmute') : t('mute');
  }
});

const btnAddAgent = document.getElementById('btn-add-agent');
btnAddAgent?.addEventListener('click', () => {
  const types: AgentType[] = ['claude', 'cursor', 'copilot'];
  const nextType = types[agents.length % types.length];
  vscode.postMessage({ type: 'addAgent', agentType: nextType });
});

const btnDelete = document.getElementById('btn-delete');
btnDelete?.addEventListener('click', () => {
  if (selectedAgentId) {
    vscode.postMessage({ type: 'deleteAgent', agentId: selectedAgentId });
    selectedAgentId = null;
    renderer.setSelectedAgentId(null);
  }
});

const btnClearAll = document.getElementById('btn-clear-all');
btnClearAll?.addEventListener('click', () => {
  vscode.postMessage({ type: 'clearAllCreatures' });
  selectedCreatureId = null;
});

btnLang?.addEventListener('click', () => {
  const newLang: Language = getLanguage() === 'en' ? 'ja' : 'en';
  setLanguage(newLang);
  if (btnLang) {
    btnLang.textContent = newLang === 'en' ? '\u{1F310} EN' : '\u{1F310} JP';
  }
  // Update toolbar button labels for new language
  const btnFeedEl = document.getElementById('btn-feed');
  const btnDietEl = document.getElementById('btn-diet');
  const btnCureEl = document.getElementById('btn-cure');
  const btnWakeEl = document.getElementById('btn-wake');
  const btnAddAgentEl = document.getElementById('btn-add-agent');
  if (btnFeedEl) { btnFeedEl.textContent = `\u{1F35E} ${t('feed_label')}`; }
  if (btnDietEl) { btnDietEl.textContent = `\u{1F52A} ${t('diet_label')}`; }
  if (btnCureEl) { btnCureEl.textContent = `\u{1F48A} ${t('cure_label')}`; }
  if (btnWakeEl) { btnWakeEl.textContent = `\u{23F0} ${t('wake_label')}`; }
  if (btnAddAgentEl) { btnAddAgentEl.textContent = t('add_agent'); }
  vscode.setState({ ...(vscode.getState() as object ?? {}), language: newLang });
});

// ============================================================
// Action Mode (click action button -> click creature to act)
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

function findAgentAtCanvasPos(worldX: number, worldY: number): string | null {
  let closestId: string | null = null;
  let closestDist = 32;

  for (const agent of agents) {
    const dx = agent.position.x - worldX;
    const dy = agent.position.y - worldY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < closestDist) {
      closestDist = dist;
      closestId = agent.id;
    }
  }

  return closestId;
}

function setActionMode(mode: ActionMode): void {
  actionMode = mode;
  // Reset active class on all buttons
  btnFeed?.classList.toggle('active', mode === 'feed');
  btnDiet?.classList.toggle('active', mode === 'diet');
  btnCure?.classList.toggle('active', mode === 'cure');
  btnWake?.classList.toggle('active', mode === 'wake');
  canvas.classList.toggle('feed-mode', mode !== 'none');

  if (feedIndicator) {
    feedIndicator.classList.toggle('hidden', mode === 'none');
    if (mode === 'feed') {
      feedIndicator.textContent = t('click_feed');
    } else if (mode === 'diet') {
      feedIndicator.textContent = t('click_diet');
    } else if (mode === 'cure') {
      feedIndicator.textContent = t('click_cure');
    } else if (mode === 'wake') {
      feedIndicator.textContent = t('click_wake');
    }
  }

  // Clear education message
  hideEduMessage();
}

let eduMessageTimerId: ReturnType<typeof setTimeout> | null = null;

function showEduMessage(msg: string, isWrong: boolean = false): void {
  if (eduMessage) {
    if (eduMessageTimerId !== null) {
      clearTimeout(eduMessageTimerId);
    }
    eduMessage.textContent = msg;
    eduMessage.classList.remove('hidden', 'wrong');
    if (isWrong) {
      eduMessage.classList.add('wrong');
    }
    // Auto-hide after 5 seconds
    eduMessageTimerId = setTimeout(() => {
      hideEduMessage();
      eduMessageTimerId = null;
    }, 5000);
  }
}

function hideEduMessage(): void {
  if (eduMessage) {
    eduMessage.classList.add('hidden');
  }
}

function handleAction(mode: ActionMode, creature: CreatureData): void {
  const health = creature.fileHealth ?? { lineCount: 0, bugCount: 0, lastModified: Date.now() };
  const daysSince = Math.floor((Date.now() - health.lastModified) / (1000 * 60 * 60 * 24));

  switch (mode) {
    case 'feed':
      vscode.postMessage({ type: 'action', action: 'feed', targetId: creature.id });
      soundEngine.playFeed();
      renderer.triggerFeedEffect(creature.position.x, creature.position.y);
      showEduMessage(t('feed_msg'));
      break;

    case 'diet':
      if (health.lineCount > 300) {
        vscode.postMessage({ type: 'heal', action: 'diet', targetId: creature.id });
        soundEngine.playFeed();
        renderer.triggerFeedEffect(creature.position.x, creature.position.y);
        showEduMessage(t('diet_msg', { lines: health.lineCount }));
      } else {
        showEduMessage(t('diet_wrong', { lines: health.lineCount }), true);
        soundEngine.playPet();
      }
      break;

    case 'cure':
      if (health.bugCount > 0) {
        vscode.postMessage({ type: 'heal', action: 'cure', targetId: creature.id });
        soundEngine.playFeed();
        renderer.triggerFeedEffect(creature.position.x, creature.position.y);
        showEduMessage(t('cure_msg', { bugs: health.bugCount }));
      } else {
        showEduMessage(t('cure_wrong'), true);
        soundEngine.playPet();
      }
      break;

    case 'wake':
      if (daysSince >= 3) {
        vscode.postMessage({ type: 'heal', action: 'wake', targetId: creature.id });
        soundEngine.playFeed();
        renderer.triggerFeedEffect(creature.position.x, creature.position.y);
        showEduMessage(t('wake_msg', { days: daysSince }));
      } else {
        showEduMessage(t('wake_wrong'), true);
        soundEngine.playPet();
      }
      break;
  }

  selectedCreatureId = creature.id;
}

// Restore saved language preference
const savedLangState = vscode.getState() as { language?: Language } | null;
if (savedLangState?.language) {
  setLanguage(savedLangState.language);
  if (btnLang) {
    btnLang.textContent = savedLangState.language === 'en' ? '\u{1F310} EN' : '\u{1F310} JP';
  }
}

// Game loop
let lastTime = 0;
let animationFrameId: number = 0;

function gameLoop(timestamp: number): void {
  const delta = timestamp - lastTime;

  if (delta >= FRAME_DURATION) {
    lastTime = timestamp;

    // Process keyboard input for agent movement
    if (selectedAgentId) {
      let kdx = 0;
      let kdy = 0;
      const MOVE_SPEED = 2;

      if (keysPressed.has('ArrowLeft') || keysPressed.has('a') || keysPressed.has('A')) { kdx -= MOVE_SPEED; }
      if (keysPressed.has('ArrowRight') || keysPressed.has('d') || keysPressed.has('D')) { kdx += MOVE_SPEED; }
      if (keysPressed.has('ArrowUp') || keysPressed.has('w') || keysPressed.has('W')) { kdy -= MOVE_SPEED; }
      if (keysPressed.has('ArrowDown') || keysPressed.has('s') || keysPressed.has('S')) { kdy += MOVE_SPEED; }

      if (kdx !== 0 || kdy !== 0) {
        vscode.postMessage({ type: 'moveAgentByKey', agentId: selectedAgentId, dx: kdx, dy: kdy });
      }
    }

    if (worldData) {
      // Clean up stale smooth positions
      const activeIds = new Set([...creatures.map(c => c.id), ...agents.map(a => a.id)]);
      for (const key of smoothPositions.keys()) {
        if (!activeIds.has(key)) { smoothPositions.delete(key); }
      }
      for (const key of dragOverridePositions.keys()) {
        if (!activeIds.has(key)) { dragOverridePositions.delete(key); }
      }

      // Smooth interpolation (factor 0.15 = smooth following)
      const LERP_FACTOR = 0.15;

      const smoothCreatures = creatures.map(c => {
        const override = dragOverridePositions.get(c.id);
        if (override) {
          smoothPositions.set(c.id, override); // Instant follow during drag
          return { ...c, position: override, targetPosition: null };
        }
        const current = smoothPositions.get(c.id) ?? { x: c.position.x, y: c.position.y };
        const smoothed = lerpPosition(current, c.position, LERP_FACTOR);
        smoothPositions.set(c.id, smoothed);
        return { ...c, position: smoothed };
      });

      const smoothAgents = agents.map(a => {
        const override = dragOverridePositions.get(a.id);
        if (override) {
          smoothPositions.set(a.id, override); // Instant follow during drag
          return { ...a, position: override, targetPosition: null };
        }
        const current = smoothPositions.get(a.id) ?? { x: a.position.x, y: a.position.y };
        const smoothed = lerpPosition(current, a.position, LERP_FACTOR);
        smoothPositions.set(a.id, smoothed);
        return { ...a, position: smoothed };
      });

      renderer.render(smoothCreatures, worldData, bugCount, zoomLevel, panX, panY, selectedCreatureId, draggingCreatureId, smoothAgents, agentChats);
    }
  }

  animationFrameId = requestAnimationFrame(gameLoop);
}

// Pause rAF when tab is hidden, resume when visible
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    cancelAnimationFrame(animationFrameId);
  } else {
    lastTime = 0;
    animationFrameId = requestAnimationFrame(gameLoop);
  }
});

// Initialize
vscode.postMessage({ type: 'ready' });
animationFrameId = requestAnimationFrame(gameLoop);
