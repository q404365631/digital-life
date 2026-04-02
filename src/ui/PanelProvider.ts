import * as vscode from 'vscode';
import { ExtToWebMessage, WebToExtMessage } from '../types';

export class PanelProvider implements vscode.WebviewViewProvider {
  private view: vscode.WebviewView | null = null;
  private onMessageCallback: ((message: WebToExtMessage) => void) | null = null;
  private onVisibilityChangeCallback: ((visible: boolean) => void) | null = null;

  constructor(
    private readonly extensionUri: vscode.Uri
  ) {}

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this.view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview'),
        vscode.Uri.joinPath(this.extensionUri, 'dist', 'sprites'),
      ],
    };

    webviewView.webview.html = this.getHtml(webviewView.webview);

    webviewView.webview.onDidReceiveMessage((message: WebToExtMessage) => {
      if (this.onMessageCallback) {
        this.onMessageCallback(message);
      }
    });

    webviewView.onDidChangeVisibility(() => {
      if (this.onVisibilityChangeCallback) {
        this.onVisibilityChangeCallback(webviewView.visible);
      }
    });
  }

  get isVisible(): boolean {
    return this.view?.visible ?? false;
  }

  onMessage(callback: (message: WebToExtMessage) => void): void {
    this.onMessageCallback = callback;
  }

  onVisibilityChange(callback: (visible: boolean) => void): void {
    this.onVisibilityChangeCallback = callback;
  }

  postMessage(message: ExtToWebMessage): void {
    if (this.view) {
      void this.view.webview.postMessage(message);
    }
  }

  reload(): void {
    if (this.view) {
      this.view.webview.html = this.getHtml(this.view.webview);
    }
  }

  private getHtml(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview', 'main.js')
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview', 'styles.css')
    );
    const nonce = getNonce();

    const creatureSprites: Record<string, string> = {};
    const species = ['dot', 'puff', 'chomp', 'blob', 'pip', 'wisp'];
    for (const s of species) {
      creatureSprites[s] = webview.asWebviewUri(
        vscode.Uri.joinPath(this.extensionUri, 'dist', 'sprites', `creature_${s}.png`)
      ).toString();
    }

    const agentSprites: Record<string, string> = {};
    for (let i = 0; i < 5; i++) {
      // Idle
      agentSprites[String(i)] = webview.asWebviewUri(
        vscode.Uri.joinPath(this.extensionUri, 'dist', 'sprites', `agent_${i}.png`)
      ).toString();
      // Walk frames
      for (let f = 0; f < 4; f++) {
        agentSprites[`${i}_f${f}`] = webview.asWebviewUri(
          vscode.Uri.joinPath(this.extensionUri, 'dist', 'sprites', `agent_${i}_f${f}.png`)
        ).toString();
      }
    }

    // Sit frames
    const sitIndices = [0, 1, 2, 3, 4];
    for (const idx of sitIndices) {
      agentSprites[`${idx}_sit`] = webview.asWebviewUri(
        vscode.Uri.joinPath(this.extensionUri, 'dist', 'sprites', `agent_${idx}_sit.png`)
      ).toString();
    }

    // Background images
    const bgSprites: Record<string, string> = {};
    for (let i = 0; i < 3; i++) {
      bgSprites[String(i)] = webview.asWebviewUri(
        vscode.Uri.joinPath(this.extensionUri, 'dist', 'sprites', `bg_room_${i}.png`)
      ).toString();
    }

    return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; img-src ${webview.cspSource};">
  <link rel="stylesheet" href="${styleUri}">
  <title>Digital Life</title>
</head>
<body>
  <script nonce="${nonce}">
    window.__SPRITES__ = {
      creatures: ${JSON.stringify(creatureSprites)},
      agents: ${JSON.stringify(agentSprites)},
      backgrounds: ${JSON.stringify(bgSprites)},
    };
  </script>
  <div id="app">
    <div id="canvas-wrapper">
      <canvas id="game-canvas" width="480" height="320"></canvas>
    </div>
    <div id="toolbar">
      <div id="toolbar-left">
        <span id="status-text">Lives: 0</span>
        <button id="btn-add-agent" class="tool-btn agent-btn" title="Add AI Agent">+ Agent</button>
      </div>
      <div id="toolbar-center">
        <button id="btn-feed" class="tool-btn" title="Feed">&#x1F35E; Feed</button>
        <button id="btn-diet" class="tool-btn" title="Diet - Split large files">&#x1F52A; Diet</button>
        <button id="btn-cure" class="tool-btn" title="Cure - Fix bugs">&#x1F48A; Cure</button>
        <button id="btn-wake" class="tool-btn" title="Wake - Review old files">&#x23F0; Wake</button>
        <button id="btn-room" class="tool-btn" title="Change Room">&#x1F3E0; Room 1</button>
        <button id="btn-lang" class="tool-btn" title="Language">&#x1F310; EN</button>
        <button id="btn-mute" class="tool-btn" title="Mute">&#x1F50A;</button>
        <button id="btn-delete" class="tool-btn" title="Delete selected" style="color:#EF5350;border-color:#EF5350;">&#x1F5D1;</button>
        <button id="btn-clear-all" class="tool-btn" title="Clear all creatures" style="color:#FF7043;border-color:#FF7043;">&#x1F9F9;</button>
      </div>
      <div id="toolbar-right">
        <span id="feed-mode-indicator" class="hidden"></span>
        <span id="edu-message" class="hidden"></span>
      </div>
    </div>
  </div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}

function getNonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
