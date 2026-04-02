import * as vscode from 'vscode';
import * as path from 'path';
import { PanelProvider } from './ui/PanelProvider';
import { MonitorManager } from './monitor/MonitorManager';
import { CreatureManager } from './creature/CreatureManager';
import { CreatureStorage } from './storage/CreatureStorage';
import { createInitialWorldState, updateWeather, setBugsInWorld, addGraveStone } from './world/WorldState';
import { getSpeciesForFile, SPECIES_DATA } from './creature/SpeciesData';
import { DNAAnalyzer, defaultDNA } from './creature/DNAAnalyzer';
import { WorldData, ExtToWebMessage, AgentType, CodingDNA, FileHealth, CreatureData } from './types';
import { MAX_CREATURES } from './constants';
import { AgentManager } from './agent/AgentManager';

const TICK_INTERVAL = 200; // ms

const AGENT_NAMES: Record<string, string> = {
  claude: 'Claude',
  cursor: 'Cursor',
  copilot: 'Copilot',
  custom: 'Agent',
};

const AGENT_TERMINAL_CMDS: Record<string, string> = {
  claude: 'claude',
  cursor: 'echo "Cursor AI is running in the editor"',
  copilot: 'echo "GitHub Copilot is running in the editor"',
  custom: '',
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
  if (savedState) {
    creatureManager.loadCreatures(savedState.creatures);
    worldState = savedState.world;
    if (savedState.agents) {
      agentManager.loadAgents(savedState.agents);
    }
  } else {
    worldState = createInitialWorldState();
  }

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

  // Monitor manager
  const monitorManager = new MonitorManager(workspacePath, {
    onFileCreated: (filePath: string) => {
      if (!spawnEnabled) {
        return;
      }
      const fileName = filePath.split('/').pop() ?? filePath.split('\\').pop() ?? 'unknown';
      const species = getSpeciesForFile(filePath);
      const speciesName = SPECIES_DATA[species].name;
      void promptForName(fileName, speciesName).then((name) => {
        const creature = creatureManager.spawnCreature(filePath, name, species, currentDNA);
        if (creature) {
          panelProvider.postMessage({ type: 'creatureBorn', creature });
          saveState();
        }
      });
    },
    onFileChanged: (_filePath: string) => {
      // Bug count is updated via onBugCountChanged
      // If any agent is running, briefly show generating status
      for (const agent of agentManager.getAll()) {
        if (agent.status === 'running') {
          agentManager.updateStatus(agent.id, 'generating');
          setTimeout(() => {
            agentManager.updateStatus(agent.id, 'running');
            sendWorldUpdate();
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
        panelProvider.postMessage({ type: 'creatureDied', creatureId: creature.id });
        sendWorldUpdate();
        saveState();
      }
    },
    onCommitDetected: (_sha: string) => {
      creatureManager.feedAll();
      creatureManager.commitBonus();
      worldState = updateWeather(worldState, 0);
      panelProvider.postMessage({ type: 'commitDetected' });
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
      creatureManager.updateFileHealth(filePath, health);
      sendWorldUpdate();
      saveState();
    },
  });

  // Handle messages from webview
  panelProvider.onMessage((message) => {
    switch (message.type) {
      case 'ready':
        sendWorldUpdate();
        break;
      case 'action':
        if (message.action === 'feed') {
          creatureManager.feed(message.targetId);
        } else if (message.action === 'pet') {
          creatureManager.pet(message.targetId);
        }
        sendWorldUpdate();
        saveState();
        break;
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
        break;
      }
      case 'nameCreature':
        creatureManager.renameCreature(message.creatureId, message.name);
        sendWorldUpdate();
        saveState();
        break;
      case 'moveCreature':
        creatureManager.moveCreature(message.creatureId, message.position);
        sendWorldUpdate();
        saveState();
        break;
      case 'addAgent': {
        void (async () => {
          const pick = await vscode.window.showQuickPick([
            { label: '\u26A1 Claude Code', description: 'Anthropic Claude', value: 'claude' as AgentType },
            { label: '\uD83D\uDDB1\uFE0F Cursor AI', description: 'Cursor Editor AI', value: 'cursor' as AgentType },
            { label: '\uD83E\uDD16 GitHub Copilot', description: 'GitHub Copilot', value: 'copilot' as AgentType },
            { label: '\u2699\uFE0F Custom Agent', description: 'Custom terminal command', value: 'custom' as AgentType },
          ], { placeHolder: 'Select AI Agent to add' });
          if (!pick) { return; }
          const agentType = pick.value;
          const agent = agentManager.addAgent(agentType, AGENT_NAMES[agentType] ?? 'Agent');
          const terminal = vscode.window.createTerminal({ name: agentTerminalName(agent.name) });
          terminal.show();
          const cmd = AGENT_TERMINAL_CMDS[agentType];
          if (cmd) {
            terminal.sendText(cmd);
          }
          agentManager.updateStatus(agent.id, 'running');
          sendWorldUpdate();
          saveState();
        })();
        break;
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
        break;
      }
      case 'deleteAgent': {
        agentManager.removeAgent(message.agentId);
        sendWorldUpdate();
        saveState();
        break;
      }
      case 'clearAllCreatures': {
        creatureManager.loadCreatures([]);
        sendWorldUpdate();
        saveState();
        break;
      }
      case 'stopAgent': {
        agentManager.stopAgent(message.agentId);
        sendWorldUpdate();
        break;
      }
      case 'moveAgent': {
        agentManager.moveAgent(message.agentId, message.position);
        saveState();
        break;
      }
      case 'moveAgentByKey': {
        agentManager.moveByKey(message.agentId, message.dx, message.dy);
        sendWorldUpdate();
        break;
      }
      case 'selectAgent': {
        agentManager.selectAgent(message.agentId);
        sendWorldUpdate();
        break;
      }
      case 'sitAgent': {
        agentManager.toggleSit(message.agentId);
        sendWorldUpdate();
        saveState();
        break;
      }
    }
  });

  // Terminal close handler for agents
  context.subscriptions.push(
    vscode.window.onDidCloseTerminal((terminal) => {
      for (const agent of agentManager.getAll()) {
        if (terminal.name === agentTerminalName(agent.name) || terminal.name.toLowerCase().includes(agent.name.toLowerCase())) {
          agentManager.updateStatus(agent.id, 'done');
          sendWorldUpdate();
          setTimeout(() => {
            agentManager.updateStatus(agent.id, 'idle');
            sendWorldUpdate();
          }, 3000);
        }
      }
    })
  );

  // Game loop (paused when panel is not visible)
  let tickTimer: ReturnType<typeof setInterval> | null = setInterval(() => {
    creatureManager.tick(TICK_INTERVAL);
    agentManager.tick();
    sendWorldUpdate();
  }, TICK_INTERVAL);

  function startTickTimer(): void {
    if (tickTimer !== null) {
      return;
    }
    tickTimer = setInterval(() => {
      creatureManager.tick(TICK_INTERVAL);
      agentManager.tick();
      sendWorldUpdate();
    }, TICK_INTERVAL);
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
      const files = await vscode.workspace.findFiles(
        '**/*.{ts,tsx,js,jsx,py,go,rs,java,rb,php,swift,kt,cs,c,cpp,h,vue,svelte}',
        '{**/node_modules/**,**/.git/**,**/dist/**,**/build/**,**/.next/**}'
      );

      const unadopted = files.filter(f => !creatureManager.hasCreatureForFile(f.fsPath));

      if (unadopted.length === 0) {
        void vscode.window.showInformationMessage('Digital Life: All source files already have creatures!');
        return;
      }

      interface AdoptQuickPickItem extends vscode.QuickPickItem {
        fsPath?: string;
        all: boolean;
      }

      const items: AdoptQuickPickItem[] = [
        {
          label: '$(checklist) Adopt all files',
          description: `${unadopted.length} files`,
          all: true,
        },
        ...unadopted.map(f => ({
          label: path.basename(f.fsPath),
          description: vscode.workspace.asRelativePath(f),
          fsPath: f.fsPath,
          all: false,
        })),
      ];

      const selected = await vscode.window.showQuickPick(items, {
        canPickMany: true,
        placeHolder: 'Select files to adopt as creatures',
      });

      if (!selected || selected.length === 0) {
        return;
      }

      const adoptAll = selected.some(item => item.all);
      const filesToAdopt = adoptAll
        ? unadopted.map(f => f.fsPath)
        : selected.filter(item => !item.all && item.fsPath).map(item => item.fsPath!);

      let adoptedCount = 0;
      for (const filePath of filesToAdopt) {
        if (creatureManager.getCount() >= MAX_CREATURES) {
          void vscode.window.showWarningMessage(
            `Digital Life: Reached maximum creature limit (${MAX_CREATURES}). Adopted ${adoptedCount} creatures.`
          );
          break;
        }

        const species = getSpeciesForFile(filePath);
        const fileName = path.basename(filePath);
        const name = fileName.replace(/\.[^.]+$/, '');
        const creature = creatureManager.spawnCreature(filePath, name, species, currentDNA);
        if (creature) {
          panelProvider.postMessage({ type: 'creatureBorn', creature });
          adoptedCount++;
        }
      }

      if (adoptedCount > 0) {
        saveState();
        sendWorldUpdate();
        void vscode.window.showInformationMessage(
          `Digital Life: Adopted ${adoptedCount} file(s) as creatures!`
        );
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
    const fileName = filePath.split('/').pop() ?? filePath;

    switch (action) {
      case 'diet':
        terminal.sendText(`${fileName}を200行以下になるようにリファクタリングしてください。関数を小さなモジュールに分割して、各ファイルは1つの責務だけを持つようにしてください。`);
        break;
      case 'cure':
        terminal.sendText(`${fileName}のコード品質を改善してください。console.logを全て削除、any型を適切な型に置き換え、TODOコメントを解決してください。`);
        break;
      case 'wake':
        terminal.sendText(`${fileName}をレビューしてください。不要なコードがあれば削除し、古いパターンがあれば最新のベストプラクティスに更新してください。`);
        break;
    }
  }

  function sendWorldUpdate(): void {
    const msg: ExtToWebMessage = {
      type: 'worldUpdate',
      creatures: creatureManager.getAll(),
      world: worldState,
      bugs: monitorManager.getBugCount(),
      agents: agentManager.getAll(),
    };
    panelProvider.postMessage(msg);
  }

  function saveState(): void {
    storage.save(
      creatureManager.getAll(),
      worldState,
      monitorManager.getState(),
      agentManager.getAll()
    );
  }

  async function promptForName(fileName: string, speciesName: string = 'creature'): Promise<string> {
    const name = await vscode.window.showInputBox({
      prompt: `A ${speciesName} is born from "${fileName}"! Give it a name:`,
      placeHolder: 'Name your creature...',
      value: fileName.replace(/\.[^.]+$/, ''),
    });
    return name ?? fileName.replace(/\.[^.]+$/, '');
  }
}

export function deactivate(): void {
  // Cleanup handled by subscriptions
}
