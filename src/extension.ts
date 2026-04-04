import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { PanelProvider } from './ui/PanelProvider';
import { MonitorManager } from './monitor/MonitorManager';
import { CreatureManager } from './creature/CreatureManager';
import { CreatureStorage } from './storage/CreatureStorage';
import { createInitialWorldState, updateWeather, setBugsInWorld, addGraveStone, updateTimeOfDay, updateRealWeather } from './world/WorldState';
import { RealWeather } from './types';
import { getSpeciesForFile, loadCustomSpeciesMap } from './creature/SpeciesData';
import { DNAAnalyzer, defaultDNA } from './creature/DNAAnalyzer';
import { WorldData, ExtToWebMessage, WebToExtMessage, AgentType, CodingDNA, FileHealth, CreatureData } from './types';
import { MAX_CREATURES, MS_PER_DAY, NESTING_THRESHOLD, FUNCTION_LENGTH_THRESHOLD, LINE_COUNT_HEAVY, LINE_COUNT_OBESE, STALE_DAYS } from './constants';
import { AgentManager } from './agent/AgentManager';
import { getPersonality, pickSpeech, SpeechEvent } from './ai/SpeechTemplates';
import { analyzeFriendships } from './monitor/ImportAnalyzer';

const TICK_INTERVAL = 200; // ms

const AGENT_NAMES: Record<string, string> = {
  claude: 'Claude',
  cursor: 'Cursor',
  copilot: 'Copilot',
};

const AGENT_TERMINAL_CMDS: Record<string, string> = {
  claude: 'claude',
  cursor: 'echo "Cursor AI is running in the editor"',
  copilot: 'echo "GitHub Copilot is running in the editor"',
};

function agentTerminalName(name: string): string {
  return `\uD83E\uDD16 ${name}`;
}

export function activate(context: vscode.ExtensionContext): void {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    return;
  }

  const workspacePath = workspaceFolders[0].uri.fsPath;
  const storage = new CreatureStorage(context.globalState);
  const creatureManager = new CreatureManager();
  const agentManager = new AgentManager();

  // Load custom config from .digital-life.json
  try {
    const configRaw = fs.readFileSync(path.join(workspacePath, '.digital-life.json'), 'utf-8');
    const config = JSON.parse(configRaw) as Record<string, unknown>;
    if (config.speciesMap) { loadCustomSpeciesMap(config.speciesMap as Record<string, string>); }
  } catch { /* no config file or invalid JSON — use defaults */ }

  // Direct terminal references — the ONLY source of truth for agent→terminal mapping
  const agentTerminals: Map<string, vscode.Terminal> = new Map();
  const outputChannel = vscode.window.createOutputChannel('Digital Life');
  outputChannel.appendLine(`[Digital Life] Extension activated at ${new Date().toISOString()}`);
  outputChannel.show(true);
  let worldState: WorldData;

  // Restore state
  const savedState = storage.load();
  let isFirstRun = false;
  if (savedState) {
    creatureManager.loadCreatures(savedState.creatures);
    worldState = savedState.world;
    // Don't restore saved agents - start fresh each session
  } else {
    worldState = createInitialWorldState();
    isFirstRun = true;
  }

  // Status bar item — always visible feedback
  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 50);
  statusBarItem.command = 'digitalLife.adoptFiles';
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  function updateStatusBar(): void {
    const all = creatureManager.getAll();
    const count = all.length;

    if (count === 0) {
      statusBarItem.text = '\u{1F331} Digital Life';
      statusBarItem.tooltip = 'Click to adopt files as friends';
      return;
    }

    const active = all.filter(c => c.stage !== 'egg');

    // Find the creature that needs the most attention
    let urgentName = '';
    let urgentMsg = '';
    let urgentPriority = 0;

    for (const c of active) {
      const h = c.fileHealth;
      if (c.hunger < 15 && urgentPriority < 5) {
        urgentPriority = 5;
        urgentName = c.name;
        urgentMsg = '\u{1F4A8} starving...';
      } else if (c.hunger < 30 && urgentPriority < 4) {
        urgentPriority = 4;
        urgentName = c.name;
        urgentMsg = '\u{1F37D}\uFE0F hungry';
      } else if (h.bugCount > 3 && urgentPriority < 3) {
        urgentPriority = 3;
        urgentName = c.name;
        urgentMsg = '\u{1F912} very sick';
      } else if (h.bugCount > 0 && urgentPriority < 2) {
        urgentPriority = 2;
        urgentName = c.name;
        urgentMsg = '\u{1F915} not well';
      } else if ((h.maxNesting ?? 0) > NESTING_THRESHOLD && urgentPriority < 1) {
        urgentPriority = 1;
        urgentName = c.name;
        urgentMsg = '\u{1F635} tangled';
      }
    }

    if (urgentName) {
      statusBarItem.text = `\u{1F33F} ${urgentName} ${urgentMsg}`;
      const happy = active.filter(c => c.hunger >= 30 && c.fileHealth.bugCount === 0).length;
      statusBarItem.tooltip = `Digital Life: ${count} friends \u2014 ${happy} happy, ${count - happy} need care`;
    } else {
      statusBarItem.text = `\u{1F33F} ${count} friends \u2014 all good \u2728`;
      statusBarItem.tooltip = `Digital Life: ${count} friends \u2014 everyone is happy!`;
    }
  }

  updateStatusBar();

  // DNA Analyzer
  const dnaAnalyzer = new DNAAnalyzer(workspacePath);
  let currentDNA: CodingDNA = defaultDNA();

  void dnaAnalyzer.analyze().then(dna => { currentDNA = dna; });

  // Panel provider
  const panelProvider = new PanelProvider(context.extensionUri);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('digitalLife.mainView', panelProvider, {
      webviewOptions: { retainContextWhenHidden: true },
    })
  );

  // Spawn suppression flag — prevents existing files from spawning creatures on startup/reset
  let spawnEnabled = true;

  // First-run guide: make the very first creature hungry so the tutorial works
  let firstRunCreatureCount = 0;

  // ── Feature A: Living words — event-driven creature speech ──
  // Detects language from VS Code locale (simplified: ja or en)
  const speechLang = vscode.env.language.startsWith('ja') ? 'ja' : 'en';

  /** Broadcast event-driven speech to a random subset of creatures */
  function broadcastSpeech(event: SpeechEvent, specificCreatureId?: string): void {
    const all = creatureManager.getAll().filter(c => c.stage !== 'egg');
    if (all.length === 0) return;

    if (specificCreatureId) {
      // Targeted speech to one creature
      const creature = creatureManager.getById(specificCreatureId);
      if (creature) {
        const personality = getPersonality(creature.dna);
        const text = pickSpeech(event, personality, speechLang);
        if (text) {
          panelProvider.postMessage({ type: 'creatureSpeech', creatureId: creature.id, text });
        }
      }
      return;
    }

    // Pick 1-2 random creatures to speak
    const speakers = all.sort(() => Math.random() - 0.5).slice(0, Math.min(2, all.length));
    for (const creature of speakers) {
      const personality = getPersonality(creature.dna);
      const text = pickSpeech(event, personality, speechLang);
      if (text) {
        panelProvider.postMessage({ type: 'creatureSpeech', creatureId: creature.id, text });
      }
    }
  }

  /** Return the appropriate speech event for the current time of day */
  function getTimeOfDaySpeechEvent(): SpeechEvent {
    const hour = new Date().getHours();
    if (hour >= 22 || hour < 5) return 'lateNight';
    if (hour < 12) return 'morning';
    if (hour < 18) return 'afternoon';
    return 'evening';
  }

  /** Periodically broadcast time-of-day speech (every 30 minutes) */
  let lastTimeSlot = '';
  function startTimeOfDayTimer(): void {
    setInterval(() => {
      const event = getTimeOfDaySpeechEvent();
      if (event !== lastTimeSlot) {
        lastTimeSlot = event;
        broadcastSpeech(event);
      }
    }, 30 * 60 * 1000); // check every 30 minutes
    lastTimeSlot = getTimeOfDaySpeechEvent();
  }

  // ── Feature D: Friendship graph from import dependencies ────
  let friendshipPairs: { a: string; b: string }[] = [];
  let lastFriendshipScan = 0;
  const FRIENDSHIP_SCAN_INTERVAL = 60000; // rescan every 60s

  function updateFriendships(): void {
    const now = Date.now();
    if (now - lastFriendshipScan < FRIENDSHIP_SCAN_INTERVAL) return;
    lastFriendshipScan = now;

    const filePaths = creatureManager.getAll().map(c => c.sourceFile);
    if (filePaths.length < 2) return;

    try {
      const raw = analyzeFriendships(filePaths);
      // Convert file pairs to creature ID pairs
      friendshipPairs = [];
      for (const { fileA, fileB } of raw) {
        const idA = creatureManager.getByFile(fileA);
        const idB = creatureManager.getByFile(fileB);
        if (idA && idB) {
          friendshipPairs.push({ a: idA, b: idB });
        }
      }
      panelProvider.postMessage({ type: 'friendships', pairs: friendshipPairs });
    } catch {
      // Import analysis failed silently
    }
  }

  // ── Feature E: Proactive creature suggestions ───────────────
  let lastSuggestionTime = 0;
  const SUGGESTION_INTERVAL = 120000; // at most one suggestion every 2 min

  function checkProactiveSuggestions(): void {
    const now = Date.now();
    if (now - lastSuggestionTime < SUGGESTION_INTERVAL) return;

    const candidates = creatureManager.getAll().filter(c => {
      if (c.stage === 'egg') return false;
      const h = c.fileHealth;
      const daysSince = (now - h.lastModified) / MS_PER_DAY;
      return h.bugCount >= 3 || h.lineCount > LINE_COUNT_OBESE || daysSince > STALE_DAYS + 2;
    });

    if (candidates.length === 0) return;

    // Pick the worst-off creature
    const worst = candidates.sort((a, b) => {
      const scoreA = a.fileHealth.bugCount * 10 + (a.fileHealth.lineCount > LINE_COUNT_OBESE ? 5 : 0);
      const scoreB = b.fileHealth.bugCount * 10 + (b.fileHealth.lineCount > LINE_COUNT_OBESE ? 5 : 0);
      return scoreB - scoreA;
    })[0];

    const personality = getPersonality(worst.dna);
    const text = pickSpeech('suggest', personality, speechLang);

    const h = worst.fileHealth;
    let action: string;
    let description: string;
    if (h.bugCount >= 3) {
      action = 'cure';
      description = speechLang === 'ja'
        ? `バグが${h.bugCount}個...お薬をあげますか？`
        : `${h.bugCount} bugs making them sick... give medicine?`;
    } else if (h.lineCount > LINE_COUNT_OBESE) {
      action = 'diet';
      description = speechLang === 'ja'
        ? `${h.lineCount}行もあって重そう...ダイエットさせますか？`
        : `${h.lineCount} lines — feeling heavy... put on a diet?`;
    } else {
      action = 'wake';
      description = speechLang === 'ja'
        ? 'しばらく触ってもらえてなくて寂しそう...起こしますか？'
        : 'hasn\'t been touched in a while... feeling lonely. Wake them up?';
    }

    panelProvider.postMessage({
      type: 'creatureSuggestion',
      creatureId: worst.id,
      creatureName: worst.name,
      action,
      description,
    });

    // Also show as speech
    if (text) {
      panelProvider.postMessage({ type: 'creatureSpeech', creatureId: worst.id, text });
    }

    lastSuggestionTime = now;
  }

  // ── Feature C: Morning Wake-up (creature-driven, no AI narrator) ──
  let morningSent = false;

  function sendMorningWakeUp(): void {
    if (morningSent) return;
    morningSent = true;

    const all = creatureManager.getAll().filter(c => c.stage !== 'egg');
    if (all.length === 0) return;

    // Find the creature that needs the most help (worst health first)
    let worstCreature: CreatureData | null = null;
    let worstScore = Infinity;

    for (const c of all) {
      const h = c.fileHealth;
      const daysSince = (Date.now() - h.lastModified) / MS_PER_DAY;
      // Lower score = worse health
      let score = 100;
      if (h.bugCount > 0) score -= h.bugCount * 20;
      if (h.lineCount > LINE_COUNT_HEAVY) score -= 30;
      if ((h.maxNesting ?? 0) > NESTING_THRESHOLD) score -= 25;
      if ((h.longestFunction ?? 0) > FUNCTION_LENGTH_THRESHOLD) score -= 20;
      if (daysSince > STALE_DAYS) score -= 20;
      score -= (100 - c.hunger) * 0.3;

      if (score < worstScore) {
        worstScore = score;
        worstCreature = c;
      }
    }

    // Let creatures speak for themselves via their existing mood bubbles.
    // If there's a creature in trouble, nudge the user toward it.
    if (worstCreature && worstScore < 70) {
      panelProvider.postMessage({
        type: 'nudgeCreature',
        creatureId: worstCreature.id,
      });
    }
  }

  // Monitor manager
  const monitorManager = new MonitorManager(workspacePath, {
    onFileCreated: (filePath: string) => {
      if (!spawnEnabled) {
        return;
      }
      const fileName = path.basename(filePath);
      const species = getSpeciesForFile(filePath);
      // Silent auto-spawn — no InputBox interruption
      const name = fileName.replace(/\.[^.]+$/, '');
      const creature = creatureManager.spawnCreature(filePath, name, species, currentDNA);
      if (creature) {
        panelProvider.postMessage({ type: 'creatureBorn', creature });
        saveState();
      }
    },
    onFileChanged: (filePath: string) => {
      // Feature A: living words on file save — speak to the affected creature
      const savedCreatureId = creatureManager.getByFile(filePath);
      if (savedCreatureId) {
        broadcastSpeech('save', savedCreatureId);
      }
      // Bug count is updated via onBugCountChanged
      // If any agent is running, briefly show generating status
      for (const agent of agentManager.getAll()) {
        if (agent.status === 'running') {
          const agentId = agent.id;
          agentManager.updateStatus(agentId, 'generating');
          setTimeout(() => {
            const current = agentManager.getById(agentId);
            if (current && current.status === 'generating') {
              agentManager.updateStatus(agentId, 'running');
              sendWorldUpdate();
            }
          }, 2000);
        }
      }
      sendWorldUpdate();
    },
    onFileDeleted: (filePath: string) => {
      const creature = creatureManager.removeCreature(filePath);
      if (creature) {
        worldState = addGraveStone(
          worldState,
          creature.name,
          creature.species,
          creature.bornAt,
          creature.sourceFile,
          creature.position,
        );
        panelProvider.postMessage({ type: 'creatureDied', creatureId: creature.id, creatureName: creature.name });
        syncAndSave();
      }
    },
    onCommitDetected: (_sha: string) => {
      creatureManager.feedAll();
      const leveledUp = creatureManager.commitBonus();
      worldState = updateWeather(worldState, 0);
      panelProvider.postMessage({ type: 'commitDetected' });
      for (const id of leveledUp) {
        panelProvider.postMessage({ type: 'levelUp', creatureId: id });
        broadcastSpeech('levelUp', id); // Feature A: living words on level up
      }
      broadcastSpeech('commit'); // Feature A: living words on commit
      syncAndSave();
      void dnaAnalyzer.analyze().then(dna => { currentDNA = dna; });
    },
    onBugCountChanged: (count: number) => {
      worldState = setBugsInWorld(worldState, Math.min(count, 20));
      worldState = updateWeather(worldState, count);
      creatureManager.updateBugEffect(count > 0);
      panelProvider.postMessage({ type: 'bugCountChanged', count });
      syncAndSave();
    },
    onFileHealthChanged: (filePath: string, health: FileHealth) => {
      const result = creatureManager.updateFileHealth(filePath, health);
      const creatureId = creatureManager.getByFile(filePath);
      const creature = creatureId ? creatureManager.getById(creatureId) : undefined;

      if (result?.improved && creature) {
        panelProvider.postMessage({
          type: 'creatureHealed',
          creatureId: creature.id,
          creatureName: creature.name,
        });
        broadcastSpeech('heal', creature.id);
        updateStatusBar();
      } else if (result?.worsened && creature) {
        panelProvider.postMessage({
          type: 'creatureWorsened',
          creatureId: creature.id,
        });
      }
      syncAndSave();
    },
  });

  // Handle messages from webview
  // ── Message handlers — grouped by domain ────────────────────
  //
  // "20 cases in one switch is a code smell." — TJ Holowaychuk
  // Three groups: creatures, agents, lifecycle.

  function handleCreatureMessage(message: WebToExtMessage): boolean {
    switch (message.type) {
      case 'action':
        if (message.action === 'feed') {
          creatureManager.feed(message.targetId);
        } else if (message.action === 'pet') {
          creatureManager.pet(message.targetId);
        }
        syncAndSave();
        return true;
      case 'care': {
        const careCreature = creatureManager.getById(message.targetId);
        if (careCreature) {
          const health = careCreature.fileHealth;
          const daysSince = (Date.now() - health.lastModified) / MS_PER_DAY;

          let action: string;
          let description: string;
          if (health.bugCount > 0) {
            action = 'cure';
            description = `${health.bugCount}件のバグを修正します (TODO, console.log, any型)`;
          } else if (health.lineCount > LINE_COUNT_HEAVY) {
            action = 'diet';
            description = `${health.lineCount}行 → 200行以下にリファクタリングします`;
          } else if ((health.maxNesting ?? 0) > NESTING_THRESHOLD) {
            action = 'untangle';
            description = `ネスト${health.maxNesting}段 → 早期リターンで浅くします`;
          } else if ((health.longestFunction ?? 0) > FUNCTION_LENGTH_THRESHOLD) {
            action = 'split';
            description = `${health.longestFunction}行の関数 → 小さく分割します`;
          } else if (daysSince > STALE_DAYS) {
            action = 'wake';
            description = `${Math.floor(daysSince)}日間放置 → レビューして最新化します`;
          } else {
            action = 'feed';
            description = 'コードを最適化して可読性を向上させます';
          }
          panelProvider.postMessage({
            type: 'aiActionPreview',
            creatureId: careCreature.id,
            action,
            description,
          });
        }
        return true;
      }
      case 'approveAiAction': {
        const approvedCreature = creatureManager.getById(message.creatureId);
        if (approvedCreature) {
          const aiTerminal = findOrCreateClaudeTerminal();
          if (aiTerminal.isNew) {
            setTimeout(() => sendHealCommand(aiTerminal.terminal, message.action, approvedCreature), 3000);
          } else {
            aiTerminal.terminal.show();
            sendHealCommand(aiTerminal.terminal, message.action, approvedCreature);
          }
          creatureManager.feed(message.creatureId);
          syncAndSave();
        }
        return true;
      }
      case 'heal': {
        const healCreature = creatureManager.getById(message.targetId);
        if (healCreature) {
          const aiTerminal = findOrCreateClaudeTerminal();
          if (aiTerminal.isNew) {
            setTimeout(() => sendHealCommand(aiTerminal.terminal, message.action, healCreature), 3000);
          } else {
            aiTerminal.terminal.show();
            sendHealCommand(aiTerminal.terminal, message.action, healCreature);
          }
        }
        creatureManager.feed(message.targetId);
        syncAndSave();
        return true;
      }
      case 'nameCreature':
        creatureManager.renameCreature(message.creatureId, message.name);
        syncAndSave();
        return true;
      case 'moveCreature':
        creatureManager.moveCreature(message.creatureId, message.position);
        syncAndSave();
        return true;
      case 'revealFile': {
        const revealCreature = creatureManager.getById(message.creatureId);
        if (revealCreature) {
          const uri = vscode.Uri.file(revealCreature.sourceFile);
          void vscode.commands.executeCommand('vscode.open', uri, { preview: true });
        }
        return true;
      }
      case 'clearAllCreatures':
        creatureManager.loadCreatures([]);
        syncAndSave();
        return true;
      default:
        return false;
    }
  }

  function handleAgentMessage(message: WebToExtMessage): boolean {
    switch (message.type) {
      case 'addAgent': {
        void (async () => {
          const pick = await vscode.window.showQuickPick([
            { label: '\u26A1 Claude Code', description: 'Anthropic Claude', value: 'claude' as AgentType },
            { label: '\uD83D\uDDB1\uFE0F Cursor AI', description: 'Cursor Editor AI', value: 'cursor' as AgentType },
            { label: '\uD83E\uDD16 GitHub Copilot', description: 'GitHub Copilot', value: 'copilot' as AgentType },
          ], { placeHolder: 'Select AI Agent to add' });
          if (!pick) { return; }
          const agentType = pick.value;
          const agent = agentManager.addAgent(agentType, AGENT_NAMES[agentType] ?? 'Agent');
          const terminal = createAgentTerminal(agent.id, agent.name, agentType);
          terminal.show();
          agentManager.updateStatus(agent.id, 'running');
          panelProvider.postMessage({ type: 'agentAdded', agentId: agent.id });
          syncAndSave();
        })();
        return true;
      }
      case 'clickAgent':
        // Alias — handled same as selectAgent
        return handleAgentMessage({ ...message, type: 'selectAgent' });
      case 'deleteAgent': {
        // Close the terminal too — terminal and agent are one unit
        const delTerminal = agentTerminals.get(message.agentId);
        if (delTerminal) {
          agentTerminals.delete(message.agentId);
          delTerminal.dispose();
        }
        agentManager.removeAgent(message.agentId);
        syncAndSave();
        return true;
      }
      case 'stopAgent': {
        // Stop = close terminal = agent leaves
        const stopTerminal = agentTerminals.get(message.agentId);
        if (stopTerminal) {
          agentTerminals.delete(message.agentId);
          stopTerminal.dispose();
        }
        agentManager.removeAgent(message.agentId);
        syncAndSave();
        return true;
      }
      case 'moveAgent':
        agentManager.moveAgent(message.agentId, message.position);
        saveState();
        return true;
      case 'moveAgentByKey':
        agentManager.moveByKey(message.agentId, message.dx, message.dy);
        sendWorldUpdate();
        return true;
      case 'selectAgent': {
        const selTerminal = agentTerminals.get(message.agentId);
        agentManager.selectAgent(message.agentId);
        if (selTerminal && !selTerminal.exitStatus) {
          selTerminal.show(false);
        }
        sendWorldUpdate();
        return true;
      }
      case 'sitAgent':
        agentManager.toggleSit(message.agentId);
        syncAndSave();
        return true;
      case 'chatAgent':
        // Chat agent messages are handled by the terminal directly
        return true;
      default:
        return false;
    }
  }


  function handleLifecycleMessage(message: WebToExtMessage): boolean {
    switch (message.type) {
      case 'ready':
        sendWorldUpdate();
        if (!isFirstRun) {
          setTimeout(() => sendMorningWakeUp(), 2000);
          broadcastSpeech(getTimeOfDaySpeechEvent());
        }
        setTimeout(() => updateFriendships(), 3000);
        startTimeOfDayTimer();
        return true;
      case 'spawnFile': {
        if (!creatureManager.hasCreatureForFile(message.filePath) && creatureManager.getCount() < MAX_CREATURES) {
          const species = getSpeciesForFile(message.filePath);
          const creature = creatureManager.spawnCreature(message.filePath, message.name, species, currentDNA);
          if (creature) {
            if (isFirstRun && firstRunCreatureCount === 0) {
              creatureManager.setHunger(creature.id, 15);
            }
            firstRunCreatureCount++;
            panelProvider.postMessage({ type: 'creatureBorn', creature });
            saveState();
            sendWorldUpdate();
          }
        }
        return true;
      }
      default:
        return false;
    }
  }

  panelProvider.onMessage((message) => {
    handleCreatureMessage(message)
      || handleAgentMessage(message)
      || handleLifecycleMessage(message);
  });

  // Terminal close handler for agents — terminal closed = agent leaves the plaza
  context.subscriptions.push(
    vscode.window.onDidCloseTerminal((closedTerminal) => {
      for (const [agentId, storedTerminal] of agentTerminals) {
        if (storedTerminal === closedTerminal) {
          agentTerminals.delete(agentId);
          agentManager.removeAgent(agentId);
          syncAndSave();
          return;
        }
      }
    })
  );

  // ── Real weather from Open-Meteo (free, no API key) ──
  let lastWeatherFetch = 0;
  const WEATHER_FETCH_INTERVAL = 30 * 60 * 1000; // 30 minutes

  async function fetchRealWeather(): Promise<void> {
    const now = Date.now();
    if (now - lastWeatherFetch < WEATHER_FETCH_INTERVAL) return;
    lastWeatherFetch = now;

    try {
      // Use ipinfo.io to get approximate location (city-level, no GPS needed)
      const geoRes = await fetch('https://ipinfo.io/json');
      const geo = await geoRes.json() as { loc?: string };
      if (!geo.loc) return;
      const [lat, lon] = geo.loc.split(',');

      // Fetch current weather from Open-Meteo
      const weatherRes = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`
      );
      const data = await weatherRes.json() as { current_weather?: { weathercode: number } };
      const code = data.current_weather?.weathercode ?? -1;

      // WMO weather codes → our simplified weather types
      let rw: RealWeather;
      if (code <= 1) rw = 'clear';
      else if (code <= 3) rw = 'cloudy';
      else if (code <= 49) rw = 'fog';
      else if (code <= 69) rw = 'rain';
      else if (code <= 79) rw = 'snow';
      else if (code <= 99) rw = 'rain'; // thunderstorm → rain
      else rw = null;

      worldState = updateRealWeather(worldState, rw);
      outputChannel.appendLine(`[Digital Life] Real weather: ${rw} (code ${code})`);
    } catch {
      // Network error — silently continue with null weather
    }
  }

  // ── Late-night coding awareness ──
  let lateNightWarned = false;

  function checkLateNight(): void {
    const hour = new Date().getHours();
    const isLateNight = hour >= 23 || hour < 5;

    if (isLateNight && !lateNightWarned) {
      lateNightWarned = true;
      // Creatures get sleepy — broadcast sleep speech
      broadcastSpeech('lateNight');
      // Set all non-egg creatures to sleep animation via a gentle nudge
      const all = creatureManager.getAll().filter(c => c.stage !== 'egg');
      if (all.length > 0) {
        const sleepiest = all[Math.floor(Math.random() * all.length)];
        panelProvider.postMessage({ type: 'nudgeCreature', creatureId: sleepiest.id });
      }
    } else if (!isLateNight) {
      lateNightWarned = false;
    }
  }

  // Slow-tick counter for periodic checks (friendship, proactive care)
  let slowTickCounter = 0;

  function tickAll(): void {
    creatureManager.tick(TICK_INTERVAL);
    agentManager.tick();

    // Update time of day every tick (cheap — just compares hours)
    worldState = updateTimeOfDay(worldState);

    sendWorldUpdate();
    throttledStatusBarUpdate();

    // Slow tick: run expensive checks every ~10 seconds
    slowTickCounter++;
    if (slowTickCounter >= 50) {
      slowTickCounter = 0;
      updateFriendships();       // Feature D
      checkProactiveSuggestions(); // Feature E
      checkLateNight();
      void fetchRealWeather();
    }
  }

  // Game loop (paused when panel is not visible)
  let tickTimer: ReturnType<typeof setInterval> | null = setInterval(tickAll, TICK_INTERVAL);

  function startTickTimer(): void {
    if (tickTimer !== null) {
      return;
    }
    tickTimer = setInterval(tickAll, TICK_INTERVAL);
  }

  function stopTickTimer(): void {
    if (tickTimer !== null) {
      clearInterval(tickTimer);
      tickTimer = null;
    }
  }

  // Pause tick when webview is hidden, resume when visible
  panelProvider.onVisibilityChange((visible: boolean) => {
    if (visible) {
      startTickTimer();
      sendWorldUpdate();
    } else {
      stopTickTimer();
    }
  });

  // Periodic save
  const saveTimer = setInterval(() => {
    saveState();
  }, 30000);

  // Start monitoring
  void monitorManager.start();

  // First run: scan existing files and send to webview for ceremony
  if (isFirstRun) {
    void scanExistingFiles();
  }

  async function scanExistingFiles(): Promise<void> {
    const files = await vscode.workspace.findFiles(
      '**/*.{ts,tsx,js,jsx,py,go,rs,java,rb,php,swift,kt,cs,c,cpp,h,vue,svelte}',
      '{**/node_modules/**,**/.git/**,**/dist/**,**/build/**,**/.next/**}'
    );

    if (files.length === 0) { return; }

    // Sort by modification time (most recent first) — that file becomes the "first friend"
    const withStats = await Promise.all(
      files.slice(0, MAX_CREATURES).map(async f => {
        try {
          const stat = await vscode.workspace.fs.stat(f);
          return { uri: f, mtime: stat.mtime };
        } catch { return { uri: f, mtime: 0 }; }
      })
    );
    withStats.sort((a, b) => b.mtime - a.mtime);

    const fileList = withStats.map(f => ({
      path: f.uri.fsPath,
      name: path.basename(f.uri.fsPath).replace(/\.[^.]+$/, ''),
      species: getSpeciesForFile(f.uri.fsPath),
    }));

    // Send to webview — it will orchestrate the ceremony
    panelProvider.postMessage({ type: 'firstRun', files: fileList });
  }

  // Cleanup
  context.subscriptions.push({
    dispose: () => {
      stopTickTimer();
      clearInterval(saveTimer);
      monitorManager.stop();
      saveState();
    },
  });

  // Commands
  context.subscriptions.push(
    vscode.commands.registerCommand('digitalLife.resetAll', () => {
      storage.clear();
      creatureManager.loadCreatures([]);
      agentManager.loadAgents([]);
      worldState = createInitialWorldState();

      // Suppress spawn for 3 seconds to ignore existing file events
      spawnEnabled = false;
      monitorManager.stop();
      void monitorManager.start();
      setTimeout(() => { spawnEnabled = true; }, 3000);

      saveState();

      // Force reload webview to clear all visual state
      panelProvider.reload();

      // Send fresh empty state after reload
      setTimeout(() => {
        sendWorldUpdate();
      }, 500);

      void vscode.window.showInformationMessage('Digital Life: Reset complete.');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('digitalLife.adoptFiles', async () => {
      // Scan workspace and spawn creatures for any files not yet represented
      const files = await vscode.workspace.findFiles(
        '**/*.{ts,tsx,js,jsx,py,go,rs,java,rb,php,swift,kt,cs,c,cpp,h,vue,svelte}',
        '{**/node_modules/**,**/.git/**,**/dist/**,**/build/**,**/.next/**}'
      );

      let count = 0;
      for (const f of files) {
        if (creatureManager.getCount() >= MAX_CREATURES) { break; }
        if (creatureManager.hasCreatureForFile(f.fsPath)) { continue; }
        const species = getSpeciesForFile(f.fsPath);
        const name = path.basename(f.fsPath).replace(/\.[^.]+$/, '');
        const creature = creatureManager.spawnCreature(f.fsPath, name, species, currentDNA);
        if (creature) {
          panelProvider.postMessage({ type: 'creatureBorn', creature });
          count++;
        }
      }

      if (count > 0) {
        syncAndSave();
      }
    })
  );

  /** Create a terminal for a new agent and store the direct reference */
  let agentTerminalCounter = 0;
  function createAgentTerminal(agentId: string, name: string, agentType: AgentType): vscode.Terminal {
    agentTerminalCounter++;
    const suffix = agentTerminalCounter > 1 ? ` #${agentTerminalCounter}` : '';
    const terminal = vscode.window.createTerminal({
      name: `${agentTerminalName(name)}${suffix}`,
      location: vscode.TerminalLocation.Panel, // Force bottom panel — show() only works here
    });
    agentTerminals.set(agentId, terminal);
    const cmd = AGENT_TERMINAL_CMDS[agentType];
    if (cmd) { terminal.sendText(cmd); }
    return terminal;
  }

  /** Get the terminal for an agent — reuse existing or create new */
  function getAgentTerminal(agentId: string, name: string, agentType: AgentType): vscode.Terminal {
    // 1. Direct reference (most reliable)
    const stored = agentTerminals.get(agentId);
    if (stored && !stored.exitStatus) {
      return stored;
    }
    // 2. Terminal was closed or lost — recreate
    return createAgentTerminal(agentId, name, agentType);
  }

  function findOrCreateClaudeTerminal(): { terminal: vscode.Terminal; isNew: boolean } {
    // Check agent terminal map first (direct reference)
    for (const [agentId, terminal] of agentTerminals) {
      const agent = agentManager.getById(agentId);
      if (agent?.agentType === 'claude' && !terminal.exitStatus) {
        return { terminal, isNew: false };
      }
    }
    // Fallback: search all terminals by name
    const existing = vscode.window.terminals.find(t =>
      t.name.toLowerCase().includes('claude') || t.name.includes('\uD83E\uDD16')
    );
    if (existing) {
      return { terminal: existing, isNew: false };
    }
    const terminal = vscode.window.createTerminal({ name: agentTerminalName('Claude') });
    terminal.sendText('claude');
    return { terminal, isNew: true };
  }

  function sendHealCommand(terminal: vscode.Terminal, action: string, creature: CreatureData): void {
    const filePath = creature.sourceFile;
    const fileName = path.basename(filePath);
    const relativePath = vscode.workspace.asRelativePath(filePath);
    const health = creature.fileHealth;

    switch (action) {
      case 'feed':
        // Feed = AI auto-prompt: optimize and improve the file
        terminal.sendText(
          `${relativePath}を分析して、パフォーマンスの改善点があれば最適化してください。` +
          `変数名や関数名でわかりにくいものがあれば改善し、コードの可読性を向上させてください。` +
          `変更は最小限に、既存の動作を壊さないようにしてください。`
        );
        break;
      case 'diet':
        terminal.sendText(
          `${relativePath}は現在${health.lineCount}行あります。200行以下になるようにリファクタリングしてください。` +
          `関数を小さなモジュールに分割して、各ファイルは1つの責務だけを持つようにしてください。` +
          `分割先のファイル名は意味のある名前にしてください。`
        );
        break;
      case 'cure':
        terminal.sendText(
          `${relativePath}のコード品質を改善してください。` +
          `具体的には：console.logを全て削除、any型を適切な型に置き換え、TODOコメントを実装で解決してください。` +
          `現在${health.bugCount}件の問題が検出されています。`
        );
        break;
      case 'wake':
        terminal.sendText(
          `${relativePath}をレビューしてください。このファイルは長期間更新されていません。` +
          `不要なコードがあれば削除し、古いパターンがあれば最新のベストプラクティスに更新してください。` +
          `deprecatedなAPIがあれば最新版に移行してください。`
        );
        break;
      case 'untangle':
        terminal.sendText(
          `${relativePath}のネストが深すぎます（最大${health.maxNesting}段）。` +
          `早期リターン（guard clause）パターンを使ってネストを浅くしてください。` +
          `条件を反転してreturnし、ネストを最大3段までに抑えてください。`
        );
        break;
      case 'split':
        terminal.sendText(
          `${relativePath}に${health.longestFunction}行の長い関数があります。` +
          `この関数を20-30行の小さな関数に分割してください。` +
          `各関数は1つの責務だけを持つようにし、適切な名前をつけてください。`
        );
        break;
    }

    // Award heal EXP bonus
    creatureManager.healBonus(filePath);
    saveState();
  }

  function sendWorldUpdate(): void {
    if (!panelProvider.isVisible) {
      return;
    }
    const msg: ExtToWebMessage = {
      type: 'worldUpdate',
      creatures: creatureManager.getAll(),
      world: worldState,
      bugs: monitorManager.getBugCount(),
      agents: agentManager.getAll(),
    };
    panelProvider.postMessage(msg);
  }

  /** Convenience: broadcast current state and persist — the most common two-liner */
  function syncAndSave(): void {
    sendWorldUpdate();
    saveState();
  }

  // Throttled status bar updates (every 5 seconds max)
  let lastStatusBarUpdate = 0;
  function throttledStatusBarUpdate(): void {
    const now = Date.now();
    if (now - lastStatusBarUpdate > 5000) {
      lastStatusBarUpdate = now;
      updateStatusBar();
    }
  }

  function saveState(): void {
    storage.save(
      creatureManager.getAll(),
      worldState,
      monitorManager.getState(),
      agentManager.getAll()
    );
  }

}

export function deactivate(): void {
  // Cleanup handled by subscriptions
}
