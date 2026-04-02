import * as vscode from 'vscode';
import { PanelProvider } from './ui/PanelProvider';
import { MonitorManager } from './monitor/MonitorManager';
import { CreatureManager } from './creature/CreatureManager';
import { CreatureStorage } from './storage/CreatureStorage';
import { createInitialWorldState, updateWeather, setBugsInWorld } from './world/WorldState';
import { getSpeciesForFile, SPECIES_DATA } from './creature/SpeciesData';
import { WorldData, ExtToWebMessage } from './types';

const TICK_INTERVAL = 200; // ms

export function activate(context: vscode.ExtensionContext): void {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    return;
  }

  const workspacePath = workspaceFolders[0].uri.fsPath;
  const storage = new CreatureStorage(context.globalState);
  const creatureManager = new CreatureManager();
  let worldState: WorldData;

  // Restore state
  const savedState = storage.load();
  if (savedState) {
    creatureManager.loadCreatures(savedState.creatures);
    worldState = savedState.world;
  } else {
    worldState = createInitialWorldState();
  }

  // Panel provider
  const panelProvider = new PanelProvider(context.extensionUri);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('digitalLife.mainView', panelProvider, {
      webviewOptions: { retainContextWhenHidden: true },
    })
  );

  // Monitor manager
  const monitorManager = new MonitorManager(workspacePath, {
    onFileCreated: (filePath: string) => {
      const fileName = filePath.split('/').pop() ?? filePath.split('\\').pop() ?? 'unknown';
      const species = getSpeciesForFile(filePath);
      const speciesName = SPECIES_DATA[species].name;
      void promptForName(fileName, speciesName).then((name) => {
        const creature = creatureManager.spawnCreature(filePath, name, species);
        if (creature) {
          panelProvider.postMessage({ type: 'creatureBorn', creature });
          saveState();
        }
      });
    },
    onFileChanged: (_filePath: string) => {
      // Bug count is updated via onBugCountChanged
    },
    onFileDeleted: (filePath: string) => {
      const creature = creatureManager.removeCreature(filePath);
      if (creature) {
        panelProvider.postMessage({ type: 'creatureDied', creatureId: creature.id });
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
    },
    onBugCountChanged: (count: number) => {
      worldState = setBugsInWorld(worldState, Math.min(count, 20));
      worldState = updateWeather(worldState, count);
      creatureManager.updateBugEffect(count > 0);
      panelProvider.postMessage({ type: 'bugCountChanged', count });
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
      case 'nameCreature':
        creatureManager.renameCreature(message.creatureId, message.name);
        sendWorldUpdate();
        saveState();
        break;
    }
  });

  // Game loop
  const tickTimer = setInterval(() => {
    creatureManager.tick(TICK_INTERVAL);
    sendWorldUpdate();
  }, TICK_INTERVAL);

  // Periodic save
  const saveTimer = setInterval(() => {
    saveState();
  }, 30000);

  // Start monitoring
  void monitorManager.start();

  // Cleanup
  context.subscriptions.push({
    dispose: () => {
      clearInterval(tickTimer);
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
      worldState = createInitialWorldState();
      sendWorldUpdate();
      void vscode.window.showInformationMessage('Digital Life: Reset complete.');
    })
  );

  function sendWorldUpdate(): void {
    const msg: ExtToWebMessage = {
      type: 'worldUpdate',
      creatures: creatureManager.getAll(),
      world: worldState,
      bugs: monitorManager.getBugCount(),
    };
    panelProvider.postMessage(msg);
  }

  function saveState(): void {
    storage.save(
      creatureManager.getAll(),
      worldState,
      monitorManager.getState()
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
