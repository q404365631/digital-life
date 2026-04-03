import * as vscode from 'vscode';
import * as path from 'path';
import { PanelProvider } from './ui/PanelProvider';
import { MonitorManager } from './monitor/MonitorManager';
import { CreatureManager } from './creature/CreatureManager';
import { CreatureStorage } from './storage/CreatureStorage';
import { createInitialWorldState, updateWeather, setBugsInWorld, addGraveStone } from './world/WorldState';
import { getSpeciesForFile } from './creature/SpeciesData';
import { DNAAnalyzer, defaultDNA } from './creature/DNAAnalyzer';
import { WorldData, ExtToWebMessage, WebToExtMessage, AgentType, CodingDNA, FileHealth, CreatureData } from './types';
import { MAX_CREATURES, CANVAS_WIDTH, CANVAS_HEIGHT } from './constants';
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
    const hungry = all.filter(c => c.stage !== 'egg' && c.hunger < 30).length;
    const sick = all.filter(c => c.fileHealth.bugCount > 0).length;

    if (count === 0) {
      statusBarItem.text = 'Digital Life';
      statusBarItem.tooltip = 'Click to adopt files as friends';
      return;
    }

    // Emotional status — the most urgent feeling wins
    if (hungry > 0) {
      statusBarItem.text = `${count} friends -- ${hungry} hungry`;
    } else if (sick > 0) {
      statusBarItem.text = `${count} friends -- ${sick} not well`;
    } else {
      statusBarItem.text = `${count} friends -- all good`;
    }
    statusBarItem.tooltip = `Digital Life: ${count} friends`;
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
      const daysSince = (now - h.lastModified) / 864e5;
      return h.bugCount >= 3 || h.lineCount > 400 || daysSince > 5;
    });

    if (candidates.length === 0) return;

    // Pick the worst-off creature
    const worst = candidates.sort((a, b) => {
      const scoreA = a.fileHealth.bugCount * 10 + (a.fileHealth.lineCount > 400 ? 5 : 0);
      const scoreB = b.fileHealth.bugCount * 10 + (b.fileHealth.lineCount > 400 ? 5 : 0);
      return scoreB - scoreA;
    })[0];

    const personality = getPersonality(worst.dna);
    const text = pickSpeech('suggest', personality, speechLang);

    const h = worst.fileHealth;
    let action: string;
    let description: string;
    if (h.bugCount >= 3) {
      action = 'cure';
      description = `${h.bugCount} bugs found`;
    } else if (h.lineCount > 400) {
      action = 'diet';
      description = `${h.lineCount} lines — too heavy`;
    } else {
      action = 'wake';
      description = 'hasn\'t been touched in a while';
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

  // ── Feature C: Morning diary ────────────────────────────────
  let morningSent = false;

  function sendMorningDiary(): void {
    if (morningSent) return;
    morningSent = true;

    const all = creatureManager.getAll().filter(c => c.stage !== 'egg');
    if (all.length === 0) return;

    // Pick the first creature and generate a diary-like summary
    const creature = all[0];
    const h = creature.fileHealth;
    const daysSince = Math.floor((Date.now() - h.lastModified) / 864e5);

    let entry: string;
    if (speechLang === 'ja') {
      if (h.bugCount > 0) {
        entry = `きのうから${h.bugCount}このバグがある...がんばらなきゃ`;
      } else if (daysSince > 3) {
        entry = `${daysSince}にちもさわってもらえてない...さみしいな`;
      } else if (h.lineCount > 300) {
        entry = `${h.lineCount}ぎょう...ちょっとおもたいかも`;
      } else {
        entry = 'きょうもいちにちがんばろう！';
      }
    } else {
      if (h.bugCount > 0) {
        entry = `Still have ${h.bugCount} bugs since yesterday... gotta push through`;
      } else if (daysSince > 3) {
        entry = `No one touched me for ${daysSince} days... lonely`;
      } else if (h.lineCount > 300) {
        entry = `${h.lineCount} lines... feeling a bit heavy`;
      } else {
        entry = 'Ready for a new day!';
      }
    }

    panelProvider.postMessage({ type: 'diary', creatureId: creature.id, entry });
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
        sendWorldUpdate();
        saveState();
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
      sendWorldUpdate();
      saveState();
      void dnaAnalyzer.analyze().then(dna => { currentDNA = dna; });
    },
    onBugCountChanged: (count: number) => {
      worldState = setBugsInWorld(worldState, Math.min(count, 20));
      worldState = updateWeather(worldState, count);
      creatureManager.updateBugEffect(count > 0);
      panelProvider.postMessage({ type: 'bugCountChanged', count });
      sendWorldUpdate();
      saveState();
    },
    onFileHealthChanged: (filePath: string, health: FileHealth) => {
      const result = creatureManager.updateFileHealth(filePath, health);
      if (result?.improved) {
        // File got healthier! Trigger creature-specific recovery effect
        const healedId = creatureManager.getByFile(filePath);
        const healedCreature = healedId ? creatureManager.getById(healedId) : undefined;
        if (healedCreature) {
          panelProvider.postMessage({
            type: 'creatureHealed',
            creatureId: healedCreature.id,
            creatureName: healedCreature.name,
          });
          broadcastSpeech('heal', healedCreature.id); // Feature A: living words on heal
        }
        updateStatusBar();
      }
      sendWorldUpdate();
      saveState();
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
        sendWorldUpdate();
        saveState();
        return true;
      case 'care': {
        const careCreature = creatureManager.getById(message.targetId);
        if (careCreature) {
          const health = careCreature.fileHealth;
          const daysSince = (Date.now() - health.lastModified) / (1000 * 60 * 60 * 24);

          let action: string;
          let description: string;
          if (health.bugCount > 0) {
            action = 'cure';
            description = `${health.bugCount}件のバグを修正します (TODO, console.log, any型)`;
          } else if (health.lineCount > 300) {
            action = 'diet';
            description = `${health.lineCount}行 → 200行以下にリファクタリングします`;
          } else if (daysSince > 3) {
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
          sendWorldUpdate();
          saveState();
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
        sendWorldUpdate();
        saveState();
        return true;
      }
      case 'nameCreature':
        creatureManager.renameCreature(message.creatureId, message.name);
        sendWorldUpdate();
        saveState();
        return true;
      case 'moveCreature':
        creatureManager.moveCreature(message.creatureId, message.position);
        sendWorldUpdate();
        saveState();
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
        sendWorldUpdate();
        saveState();
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
          const terminal = vscode.window.createTerminal({ name: agentTerminalName(agent.name) });
          terminal.show();
          void terminal.processId.then(pid => {
            if (pid !== undefined) {
              agentManager.setTerminalId(agent.id, pid);
            }
          });
          const cmd = AGENT_TERMINAL_CMDS[agentType];
          if (cmd) {
            terminal.sendText(cmd);
          }
          agentManager.updateStatus(agent.id, 'running');
          panelProvider.postMessage({ type: 'agentAdded', agentId: agent.id });
          sendWorldUpdate();
          saveState();
        })();
        return true;
      }
      case 'clickAgent': {
        const agent = agentManager.getById(message.agentId);
        if (agent) {
          const termName = agentTerminalName(agent.name);
          const existing = vscode.window.terminals.find(t =>
            t.name === termName || t.name.toLowerCase().includes(agent.name.toLowerCase())
          );
          if (existing) {
            existing.show();
          } else {
            const terminal = vscode.window.createTerminal({ name: termName });
            terminal.show();
            const cmd = AGENT_TERMINAL_CMDS[agent.agentType];
            if (cmd) { terminal.sendText(cmd); }
          }
          agentManager.updateStatus(agent.id, 'running');
          sendWorldUpdate();
        }
        return true;
      }
      case 'deleteAgent':
        agentManager.removeAgent(message.agentId);
        sendWorldUpdate();
        saveState();
        return true;
      case 'stopAgent':
        agentManager.stopAgent(message.agentId);
        sendWorldUpdate();
        return true;
      case 'moveAgent':
        agentManager.moveAgent(message.agentId, message.position);
        saveState();
        return true;
      case 'moveAgentByKey':
        agentManager.moveByKey(message.agentId, message.dx, message.dy);
        sendWorldUpdate();
        return true;
      case 'selectAgent':
        agentManager.selectAgent(message.agentId);
        sendWorldUpdate();
        return true;
      case 'sitAgent':
        agentManager.toggleSit(message.agentId);
        sendWorldUpdate();
        saveState();
        return true;
      case 'chatAgent':
        // eslint-disable-next-line no-console -- placeholder
        console.debug(`[Digital Life] chatAgent: ${message.agentId}`);
        return true;
      default:
        return false;
    }
  }

  // ── Lineup (点呼) ─────────────────────────────────────────
  let lineupTimer: ReturnType<typeof setTimeout> | null = null;

  function performLineup(): void {
    // Cancel any active lineup timer
    if (lineupTimer) { clearTimeout(lineupTimer); }

    const allCreatures = creatureManager.getAll().filter(c => c.stage !== 'egg');
    const allAgents = agentManager.getAll();

    // Grid layout: creatures in upper rows, agents in lower row
    const cols = Math.max(4, Math.ceil(Math.sqrt(allCreatures.length + allAgents.length)));
    const cellW = CANVAS_WIDTH / (cols + 1);
    const cellH = 50;
    const startY = 50;

    // Place creatures in grid
    allCreatures.forEach((c, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      creatureManager.setTargetPosition(c.id, {
        x: cellW * (col + 1),
        y: startY + cellH * row,
      });
    });

    // Place agents in bottom row
    const agentY = CANVAS_HEIGHT - 60;
    const agentCellW = CANVAS_WIDTH / (allAgents.length + 1);
    allAgents.forEach((a, i) => {
      agentManager.setTargetPosition(a.id, {
        x: agentCellW * (i + 1),
        y: agentY,
      });
    });

    panelProvider.postMessage({ type: 'lineupActive', active: true });
    sendWorldUpdate();

    // Auto-dismiss after 5 seconds
    lineupTimer = setTimeout(() => {
      creatureManager.clearAllTargets();
      agentManager.clearAllTargets();
      panelProvider.postMessage({ type: 'lineupActive', active: false });
      sendWorldUpdate();
      lineupTimer = null;
    }, 5000);
  }

  function handleLifecycleMessage(message: WebToExtMessage): boolean {
    switch (message.type) {
      case 'ready':
        sendWorldUpdate();
        if (!isFirstRun) {
          setTimeout(() => sendMorningDiary(), 2000);
          broadcastSpeech('morning');
        }
        setTimeout(() => updateFriendships(), 3000);
        return true;
      case 'lineup':
        performLineup();
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

  // Terminal close handler for agents
  context.subscriptions.push(
    vscode.window.onDidCloseTerminal((terminal) => {
      void terminal.processId.then(closedPid => {
        for (const agent of agentManager.getAll()) {
          let matched = false;
          // Prefer exact match by terminalId (process ID) when available
          if (agent.terminalId !== null && closedPid !== undefined) {
            matched = closedPid === agent.terminalId;
          }
          // Fallback: exact match by terminal name
          if (!matched) {
            matched = terminal.name === agentTerminalName(agent.name);
          }
          if (matched) {
            const agentId = agent.id;
            agentManager.updateStatus(agentId, 'done');
            sendWorldUpdate();
            setTimeout(() => {
              const current = agentManager.getById(agentId);
              if (current && current.status === 'done') {
                agentManager.updateStatus(agentId, 'idle');
                sendWorldUpdate();
              }
            }, 3000);
          }
        }
      });
    })
  );

  // Slow-tick counter for periodic checks (friendship, proactive care)
  let slowTickCounter = 0;

  function tickAll(): void {
    creatureManager.tick(TICK_INTERVAL);
    agentManager.tick();
    sendWorldUpdate();
    throttledStatusBarUpdate();

    // Slow tick: run expensive checks every ~10 seconds
    slowTickCounter++;
    if (slowTickCounter >= 50) {
      slowTickCounter = 0;
      updateFriendships();       // Feature D
      checkProactiveSuggestions(); // Feature E
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
        saveState();
        sendWorldUpdate();
      }
    })
  );

  function findOrCreateClaudeTerminal(): { terminal: vscode.Terminal; isNew: boolean } {
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
