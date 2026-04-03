import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { ExtToWebMessage, WebToExtMessage } from '../types';

export class PanelProvider implements vscode.WebviewViewProvider {
  private view: vscode.WebviewView | null = null;
  private onMessageCallback: ((message: WebToExtMessage) => void) | null = null;
  private onVisibilityChangeCallback: ((visible: boolean) => void) | null = null;
  private listenerDisposables: vscode.Disposable[] = [];

  constructor(
    private readonly extensionUri: vscode.Uri
  ) {}

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    for (const d of this.listenerDisposables) {
      d.dispose();
    }
    this.listenerDisposables = [];

    this.view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
    };

    webviewView.webview.html = this.getHtml(webviewView.webview);

    this.listenerDisposables.push(
      webviewView.webview.onDidReceiveMessage((message: WebToExtMessage) => {
        if (this.onMessageCallback) {
          this.onMessageCallback(message);
        }
      })
    );

    this.listenerDisposables.push(
      webviewView.onDidChangeVisibility(() => {
        if (this.onVisibilityChangeCallback) {
          this.onVisibilityChangeCallback(webviewView.visible);
        }
      })
    );
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

  /** Read a PNG file and return as data:image/png;base64,... URI */
  private toDataUri(filePath: string): string {
    try {
      const data = fs.readFileSync(filePath);
      return `data:image/png;base64,${data.toString('base64')}`;
    } catch {
      return '';
    }
  }

  private getHtml(_webview: vscode.Webview): string {
    const spritesDir = path.join(this.extensionUri.fsPath, 'dist', 'sprites');

    // Read JS/CSS from disk and inline them to eliminate caching
    const jsPath = path.join(this.extensionUri.fsPath, 'dist', 'webview', 'main.js');
    const cssPath = path.join(this.extensionUri.fsPath, 'dist', 'webview', 'styles.css');

    let inlineJs = '';
    let inlineCss = '';
    try { inlineJs = fs.readFileSync(jsPath, 'utf8'); } catch { /* */ }
    try { inlineCss = fs.readFileSync(cssPath, 'utf8'); } catch { /* */ }

    const nonce = getNonce();

    // Creature sprites as Base64 data URIs (sheet + actions)
    const creatureSprites: Record<string, { sheet: string; actions: string }> = {};
    const species = ['dot', 'puff', 'chomp', 'blob', 'pip', 'wisp'];
    for (const s of species) {
      creatureSprites[s] = {
        sheet: this.toDataUri(path.join(spritesDir, `creature_${s}_sheet.png`)),
        actions: this.toDataUri(path.join(spritesDir, `creature_${s}_actions.png`)),
      };
    }

    // Agent sprites as Base64 data URIs (3 agents only)
    const agentSprites: Record<string, { sheet: string; actions: string }> = {};
    for (let i = 0; i < 3; i++) {
      agentSprites[String(i)] = {
        sheet: this.toDataUri(path.join(spritesDir, `agent_${i}_sheet.png`)),
        actions: this.toDataUri(path.join(spritesDir, `agent_${i}_actions.png`)),
      };
    }

    return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}'; img-src data:;">
  <style nonce="${nonce}">${inlineCss}</style>
  <title>Digital Life</title>
</head>
<body>
  <script nonce="${nonce}">
    window.__SPRITES__ = {
      creatures: ${JSON.stringify(creatureSprites)},
      agents: ${JSON.stringify(agentSprites)},
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
  <script nonce="${nonce}">${inlineJs}</script>
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
