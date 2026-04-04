import { ExtToWebMessage, WebToExtMessage, CreatureData, AgentData, AgentType, WorldData } from '../../types';
import { CANVAS_WIDTH, CANVAS_HEIGHT, FRAME_DURATION } from '../../constants';
import { GameRenderer } from './renderer/GameRenderer';
import { SoundEngine } from './audio/SoundEngine';
import { setLanguage, getLanguage, nextLanguage, langLabel, Language, t } from './i18n';

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
type ActionMode = 'none' | 'feed' | 'care';
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
    const worldPos = screenToWorld(event.clientX, event.clientY);

    // Find nearest creature AND agent — pick whichever is closest
    const { id: creatureHit, dist: creatureDist } = findCreatureAtCanvasPosWithDist(worldPos.x, worldPos.y);
    const { id: agentHit, dist: agentDist } = findAgentAtCanvasPosWithDist(worldPos.x, worldPos.y);
    console.log(`[DL-WV] pointerdown: agentHit=${agentHit} (${agentDist.toFixed(1)}), creatureHit=${creatureHit} (${creatureDist.toFixed(1)}), agents.length=${agents.length}`);

    // Agent wins tie (larger sprite, harder to miss)
    if (agentHit && agentDist <= creatureDist) {
      draggingAgentId = agentHit;
      dragStartX = event.clientX;
      dragStartY = event.clientY;
      dragMoved = false;
      dragOverridePositions.set(agentHit, { x: worldPos.x, y: worldPos.y });
      canvas.classList.add('dragging-creature');
      canvas.setPointerCapture(event.pointerId);
      return;
    }

    if (creatureHit) {
      draggingCreatureId = creatureHit;
      dragStartX = event.clientX;
      dragStartY = event.clientY;
      dragMoved = false;
      dragOverridePositions.set(creatureHit, { x: worldPos.x, y: worldPos.y });
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
let tapHandledByPointerUp = false; // suppress click after pointerup tap
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
  // Handle creature drop — or tap-to-select if not dragged
  if (draggingCreatureId) {
    const creatureId = draggingCreatureId;
    const override = dragOverridePositions.get(creatureId);
    if (override && dragMoved) {
      vscode.postMessage({ type: 'moveCreature', creatureId, position: override });
    } else if (!dragMoved) {
      // Tap (no drag): select creature + reveal file
      selectedCreatureId = creatureId;
      soundEngine.playSelectCreature();
      vscode.postMessage({ type: 'revealFile', creatureId });
      tapHandledByPointerUp = true; // suppress duplicate click event
    }
    dragOverridePositions.delete(creatureId);
    draggingCreatureId = null;
    dragMoved = false;
    canvas.classList.remove('dragging-creature');
    canvas.releasePointerCapture(event.pointerId);
    return;
  }

  // Handle agent drop — or tap-to-select if not dragged
  if (draggingAgentId) {
    const agentId = draggingAgentId;
    const override = dragOverridePositions.get(agentId);
    const wasDragged = dragMoved;

    // Clean up pointer capture FIRST — before any postMessage
    dragOverridePositions.delete(agentId);
    draggingAgentId = null;
    dragMoved = false;
    canvas.classList.remove('dragging-creature');
    canvas.releasePointerCapture(event.pointerId);

    if (override && wasDragged) {
      vscode.postMessage({ type: 'moveAgent', agentId, position: override });
    } else if (!wasDragged) {
      // Tap (no drag): select agent + switch terminal
      selectedAgentId = agentId;
      renderer.setSelectedAgentId(agentId);
      soundEngine.playSelectAgent();
      tapHandledByPointerUp = true;
      // Defer postMessage to break out of pointer event context
      setTimeout(() => {
        vscode.postMessage({ type: 'selectAgent', agentId });
      }, 0);
    }
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
const btnCare = document.getElementById('btn-care');
const btnMute = document.getElementById('btn-mute');
const btnLang = document.getElementById('btn-lang');
const feedIndicator = document.getElementById('feed-mode-indicator');
const eduMessage = document.getElementById('edu-message');

// AI Action preview state
let pendingAiAction: { creatureId: string; action: string; description: string } | null = null;

// Feature A: Event-driven speech overrides (creature id → text + timestamp)
const eventSpeechOverrides: Map<string, { text: string; timestamp: number }> = new Map();

// Feature D: Friendship pairs (creature ID pairs from import analysis)
let friendshipPairs: readonly { a: string; b: string }[] = [];

// ── Lineup (点呼) ───────────────────────────────────────────
let lineupActive = false;

const btnLineup = document.getElementById('btn-lineup');
btnLineup?.addEventListener('click', () => {
  vscode.postMessage({ type: 'lineup' });
});

// ── Guide flow ───────────────────────────────────────────────
// A gentle first-time tutorial: Feed → Care, taught through experience
type GuidePhase = 'none' | 'waitFeed' | 'waitCare' | 'done';
let guidePhase: GuidePhase = 'none';

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
      // Update health report cache (once per update, not every frame)
      renderer.updateHealthCache(creatures);
      break;

    case 'creatureBorn':
      soundEngine.playHatch();
      // Will be handled via next worldUpdate
      break;

    case 'creatureDied': {
      soundEngine.playDeath();
      // Farewell scene — a moment of quiet respect
      renderer.triggerFarewell(t('farewell', { name: message.creatureName }));
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

    case 'levelUp': {
      // Level-up celebration — sparkle effect on the creature
      const lvCreature = creatures.find(c => c.id === message.creatureId);
      if (lvCreature) {
        renderer.triggerFeedEffect(lvCreature.position.x, lvCreature.position.y);
        soundEngine.playLevelUp();
      }
      break;
    }

    case 'creatureHealed': {
      // Recovery effect — creature-specific green sparkles + healing bubble
      const healedCreature = creatures.find(c => c.id === message.creatureId);
      if (healedCreature) {
        renderer.triggerHealEffect(healedCreature.position.x, healedCreature.position.y, message.creatureId);
        soundEngine.playHeal();
      }
      break;
    }

    case 'creatureSpeech': {
      // Feature A: Living words — event-driven speech override
      eventSpeechOverrides.set(message.creatureId, { text: message.text, timestamp: Date.now() });
      soundEngine.playSpeech();
      soundEngine.speak(message.text);
      break;
    }

    case 'creatureSuggestion': {
      // Feature E: Proactive creature care suggestion
      pendingAiAction = {
        creatureId: message.creatureId,
        action: message.action,
        description: message.description,
      };
      selectedCreatureId = message.creatureId;
      showAiApproval(`${message.creatureName}: ${message.description}`);
      soundEngine.playSuggestion();
      btnCare?.classList.add('guide-pulse');
      break;
    }

    case 'friendships': {
      // Feature D: Store friendship pairs for rendering
      friendshipPairs = message.pairs;
      break;
    }

    case 'diary': {
      // Feature C: Morning Briefing — show as speech on the creature + TTS
      eventSpeechOverrides.set(message.creatureId, { text: message.entry, timestamp: Date.now() });
      soundEngine.playMorning();
      soundEngine.speak(message.entry);
      break;
    }

    case 'bugCountChanged':
      bugCount = message.count;
      break;

    case 'agentAdded': {
      soundEngine.playAgentSpawn();
      // Auto-select the newly added agent
      selectedAgentId = message.agentId;
      renderer.setSelectedAgentId(message.agentId);
      break;
    }

    case 'lineupActive': {
      lineupActive = message.active;
      break;
    }

    case 'agentChat': {
      agentChats.set(message.agentId, { message: message.message, timestamp: Date.now() });
      break;
    }

    case 'aiActionPreview': {
      pendingAiAction = {
        creatureId: message.creatureId,
        action: message.action,
        description: message.description,
      };
      showAiApproval(message.description);
      break;
    }

    case 'firstRun': {
      // Ceremony: files already exist → spawn them as creatures one by one
      soundEngine.playFirstRun();
      beginFirstRunCeremony(message.files as { path: string; name: string; species: string }[]);
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
  // Skip if pointerup already handled this tap (prevents double-fire)
  if (tapHandledByPointerUp) {
    tapHandledByPointerUp = false;
    return;
  }
  panMoved = false;

  const worldPos = screenToWorld(event.clientX, event.clientY);

  // Action mode: only targets creatures
  if (actionMode !== 'none') {
    const targetId = findCreatureAtCanvasPos(worldPos.x, worldPos.y);
    if (targetId) {
      const creature = creatures.find(c => c.id === targetId);
      if (creature) {
        handleAction(actionMode, creature);
      }
    }
    setActionMode('none');
    return;
  }

  // Find nearest creature AND agent — pick whichever is closest
  const { id: creatureHit, dist: creatureDist } = findCreatureAtCanvasPosWithDist(worldPos.x, worldPos.y);
  const { id: agentHit, dist: agentDist } = findAgentAtCanvasPosWithDist(worldPos.x, worldPos.y);

  // Agent wins tie
  if (agentHit && agentDist <= creatureDist) {
    selectedAgentId = agentHit;
    renderer.setSelectedAgentId(agentHit);
    soundEngine.playSelectAgent();
    setTimeout(() => {
      vscode.postMessage({ type: 'selectAgent', agentId: agentHit });
    }, 0);
    return;
  }

  if (creatureHit) {
    selectedCreatureId = creatureHit;
    soundEngine.playSelectCreature();
    vscode.postMessage({ type: 'revealFile', creatureId: creatureHit });
    return;
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
btnCare?.addEventListener('click', () => setActionMode(actionMode === 'care' ? 'none' : 'care'));

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

// Switch agent button — cycles through agents and switches terminal
const btnSwitchAgent = document.getElementById('btn-switch-agent');
btnSwitchAgent?.addEventListener('click', () => {
  if (agents.length === 0) return;
  // Find next agent after currently selected
  const currentIdx = agents.findIndex(a => a.id === selectedAgentId);
  const nextIdx = (currentIdx + 1) % agents.length;
  const agent = agents[nextIdx];
  selectedAgentId = agent.id;
  renderer.setSelectedAgentId(agent.id);
  soundEngine.playSelectAgent();
  vscode.postMessage({ type: 'selectAgent', agentId: agent.id });
});

// Delete agent: long-press on selected agent (or via command palette)
// Clear all: available through command palette "digitalLife.resetAll"

btnLang?.addEventListener('click', () => {
  const newLang = nextLanguage();
  setLanguage(newLang);
  applyToolbarLabels();
  vscode.setState({ ...(vscode.getState() as object ?? {}), language: newLang });
});

/** Refresh all toolbar labels/tooltips for current language */
function applyToolbarLabels(): void {
  const lang = getLanguage();
  if (btnLang)    { btnLang.textContent = langLabel(lang); btnLang.title = t('tt_lang'); }
  if (btnFeed)    { btnFeed.textContent = t('tt_feed'); btnFeed.title = t('tt_feed'); }
  if (btnCare)    { btnCare.textContent = t('tt_care'); btnCare.title = t('tt_care'); }
  if (btnMute)    { const m = soundEngine.isMuted(); btnMute.textContent = m ? t('tt_unmute') : t('tt_mute'); btnMute.title = m ? t('tt_unmute') : t('tt_mute'); }
  const addAgent = document.getElementById('btn-add-agent');
  if (addAgent)   { addAgent.textContent = '+ ' + t('tt_add_agent'); addAgent.title = t('tt_add_agent'); }
  if (btnLineup)  { btnLineup.textContent = t('tt_lineup'); btnLineup.title = t('tt_lineup'); }
}

// ============================================================
// Action Mode (click action button -> click creature to act)
// ============================================================

function findCreatureAtCanvasPos(worldX: number, worldY: number): string | null {
  return findCreatureAtCanvasPosWithDist(worldX, worldY).id;
}

function findCreatureAtCanvasPosWithDist(worldX: number, worldY: number): { id: string | null; dist: number } {
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

  return { id: closestId, dist: closestDist };
}

function findAgentAtCanvasPos(worldX: number, worldY: number): string | null {
  return findAgentAtCanvasPosWithDist(worldX, worldY).id;
}

function findAgentAtCanvasPosWithDist(worldX: number, worldY: number): { id: string | null; dist: number } {
  let closestId: string | null = null;
  let closestDist = 40; // larger hit radius for 48px agent sprites

  for (const agent of agents) {
    const dx = agent.position.x - worldX;
    const dy = agent.position.y - worldY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < closestDist) {
      closestDist = dist;
      closestId = agent.id;
    }
  }

  return { id: closestId, dist: closestDist };
}

function setActionMode(mode: ActionMode): void {
  actionMode = mode;
  // Reset active class on all buttons
  btnFeed?.classList.toggle('active', mode === 'feed');
  btnCare?.classList.toggle('active', mode === 'care');
  canvas.classList.toggle('feed-mode', mode === 'feed');
  canvas.classList.toggle('care-mode', mode === 'care');

  if (feedIndicator) {
    feedIndicator.classList.toggle('hidden', mode === 'none');
    if (mode === 'feed') {
      feedIndicator.textContent = t('click_feed');
    } else if (mode === 'care') {
      feedIndicator.textContent = t('click_care');
    }
  }

  // Clear education message and pending approval
  hideEduMessage();
  hideAiApproval();
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
  switch (mode) {
    case 'feed':
      vscode.postMessage({ type: 'action', action: 'feed', targetId: creature.id });
      soundEngine.playFeed();
      renderer.triggerFeedEffect(creature.position.x, creature.position.y);
      showEduMessage(t('feed_msg'));

      // Guide: feeding completed — celebrate and hint at Care
      if (guidePhase === 'waitFeed') {
        advanceGuide('waitCare');
      }
      break;

    case 'care':
      // Send care request — extension will auto-diagnose and send back aiActionPreview
      vscode.postMessage({ type: 'care', targetId: creature.id });
      soundEngine.playPet();
      showEduMessage(t('care_diagnosing'));

      // Guide: care completed — tutorial done
      if (guidePhase === 'waitCare') {
        advanceGuide('done');
      }
      break;
  }

  selectedCreatureId = creature.id;
}

// AI Action approval UI
function showAiApproval(description: string): void {
  if (eduMessage) {
    eduMessage.textContent = `🩺 ${description}`;
    eduMessage.classList.remove('hidden', 'wrong');

    // Create approve/cancel buttons if not exist
    let approveBtn = document.getElementById('btn-approve-ai');
    let cancelBtn = document.getElementById('btn-cancel-ai');

    if (!approveBtn) {
      approveBtn = document.createElement('button');
      approveBtn.id = 'btn-approve-ai';
      approveBtn.className = 'tool-btn';
      approveBtn.style.cssText = 'margin-left:8px;color:#4CAF50;border-color:#4CAF50;font-size:11px;padding:2px 8px;';
      approveBtn.textContent = t('approve');
      approveBtn.addEventListener('click', () => {
        if (pendingAiAction) {
          vscode.postMessage({
            type: 'approveAiAction',
            creatureId: pendingAiAction.creatureId,
            action: pendingAiAction.action,
          });
          soundEngine.playApprove();
          const creature = creatures.find(c => c.id === pendingAiAction!.creatureId);
          if (creature) {
            renderer.triggerFeedEffect(creature.position.x, creature.position.y);
          }
          showEduMessage(t('care_approved'));
          pendingAiAction = null;
        }
        hideAiApproval();
      });
      eduMessage.parentElement?.appendChild(approveBtn);
    }

    if (!cancelBtn) {
      cancelBtn = document.createElement('button');
      cancelBtn.id = 'btn-cancel-ai';
      cancelBtn.className = 'tool-btn';
      cancelBtn.style.cssText = 'margin-left:4px;color:#EF5350;border-color:#EF5350;font-size:11px;padding:2px 8px;';
      cancelBtn.textContent = t('cancel');
      cancelBtn.addEventListener('click', () => {
        pendingAiAction = null;
        soundEngine.playCancel();
        hideAiApproval();
        hideEduMessage();
      });
      eduMessage.parentElement?.appendChild(cancelBtn);
    }

    approveBtn.classList.remove('hidden');
    cancelBtn.classList.remove('hidden');
  }
}

function hideAiApproval(): void {
  const approveBtn = document.getElementById('btn-approve-ai');
  const cancelBtn = document.getElementById('btn-cancel-ai');
  approveBtn?.classList.add('hidden');
  cancelBtn?.classList.add('hidden');
  btnCare?.classList.remove('guide-pulse'); // clear suggestion glow
}

// ── Guide flow state machine ───────────────────────────────
// Teaches Feed and Care through a natural first experience.

function startGuide(): void {
  guidePhase = 'waitFeed';
  showEduMessage(t('guide_feed'));
  btnFeed?.classList.add('guide-pulse');
}

function advanceGuide(to: GuidePhase): void {
  // Clean up previous phase
  btnFeed?.classList.remove('guide-pulse');
  btnCare?.classList.remove('guide-pulse');

  guidePhase = to;

  if (to === 'waitCare') {
    showEduMessage(t('guide_fed'));
    // After a beat, hint at Care
    setTimeout(() => {
      if (guidePhase !== 'waitCare') return;
      showEduMessage(t('guide_care'));
      btnCare?.classList.add('guide-pulse');
      // Auto-complete guide after a few seconds (don't force the user)
      setTimeout(() => {
        if (guidePhase === 'waitCare') {
          advanceGuide('done');
        }
      }, 6000);
    }, 3000);
  } else if (to === 'done') {
    btnCare?.classList.remove('guide-pulse');
    hideEduMessage();
    guidePhase = 'done';
  }
}

// ── First-run ceremony ─────────────────────────────────────
// Files already exist in the workspace. They ARE the creatures.
// The first file (most recently edited) gets a special introduction.
// The rest appear gradually — they were always here, waiting.

function beginFirstRunCeremony(files: { path: string; name: string; species: string }[]): void {
  if (files.length === 0) return;

  // First friend: spawn immediately as egg (it will hatch via normal hatch logic)
  const first = files[0];
  vscode.postMessage({ type: 'spawnFile', filePath: first.path, name: first.name });

  // Show naming prompt in the edu-message area after a short delay (hatch time)
  setTimeout(() => {
    showNamingPrompt(first.name);
  }, 2500);

  // Remaining files: appear in small batches, staggered
  // They were always here — quiet arrival, no fanfare
  const rest = files.slice(1);
  const BATCH = 3;
  const INTERVAL = 1800;

  for (let i = 0; i < rest.length; i++) {
    const delay = 5000 + Math.floor(i / BATCH) * INTERVAL;
    const file = rest[i];
    setTimeout(() => {
      vscode.postMessage({ type: 'spawnFile', filePath: file.path, name: file.name });
    }, delay);
  }
}

/** Inline naming prompt — no VS Code modal, lives inside the panel */
function showNamingPrompt(defaultName: string): void {
  const toolbar = document.getElementById('toolbar-right');
  if (!toolbar) return;

  // Create inline input
  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'display:flex;align-items:center;gap:4px;';

  const label = document.createElement('span');
  label.style.cssText = 'font-size:11px;color:#a0c4ff;';
  label.textContent = t('bubble_evolve');

  const input = document.createElement('input');
  input.type = 'text';
  input.value = defaultName;
  input.style.cssText = 'width:80px;padding:2px 6px;border:1px solid #0f3460;border-radius:4px;background:#16213e;color:#e0e0e0;font-size:11px;outline:none;';
  input.placeholder = defaultName;

  const confirmBtn = document.createElement('button');
  confirmBtn.className = 'tool-btn';
  confirmBtn.style.cssText = 'font-size:10px;padding:2px 8px;';
  confirmBtn.textContent = t('approve');

  const commit = () => {
    const name = input.value.trim() || defaultName;
    // Rename the first creature
    if (creatures.length > 0) {
      vscode.postMessage({ type: 'nameCreature', creatureId: creatures[0].id, name });
      selectedCreatureId = creatures[0].id;
    }
    wrapper.remove();
    // Begin the gentle tutorial — creature is already hungry
    setTimeout(() => startGuide(), 1500);
  };

  confirmBtn.addEventListener('click', commit);
  input.addEventListener('keydown', (e: KeyboardEvent) => { if (e.key === 'Enter') commit(); });

  wrapper.appendChild(label);
  wrapper.appendChild(input);
  wrapper.appendChild(confirmBtn);
  toolbar.appendChild(wrapper);

  // Auto-focus
  setTimeout(() => input.focus(), 100);
}

// Restore saved language preference
const savedLangState = vscode.getState() as { language?: Language } | null;
if (savedLangState?.language) {
  setLanguage(savedLangState.language);
}
applyToolbarLabels();

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

      renderer.render({
        creatures: smoothCreatures, world: worldData, bugCount,
        zoom: zoomLevel, panX, panY,
        selectedCreatureId, draggingCreatureId,
        agents: smoothAgents, agentChats, eventSpeechOverrides, friendPairs: friendshipPairs, lineupActive,
      });
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
