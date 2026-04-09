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

  /** Return focus to the webview after a terminal switch */
  focusWebview(): void {
    if (this.view) {
      this.view.show(false);
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

  /** Read an MP3 file and return raw base64 (no data URI prefix — decoded in AudioContext) */
  private toBase64(filePath: string): string {
    try {
      return fs.readFileSync(filePath).toString('base64');
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

    // Sound assets as raw base64 (decoded to AudioBuffer in SoundEngine)
    // Mapping by the Dragon Quest Development Team (堀井雄二)
    const soundsDir = path.join(this.extensionUri.fsPath, 'assets', 'sounds');
    const soundMap: Record<string, string> = {
      // ── Core actions ──
      feed:       this.toBase64(path.join(soundsDir, 'mouse-doubleclick.mp3')),
      pet:        this.toBase64(path.join(soundsDir, 'mouse-click.mp3')),
      hatch:      this.toBase64(path.join(soundsDir, '8bit-jump3.mp3')),
      commit:     this.toBase64(path.join(soundsDir, 'correct9.mp3')),
      levelUp:    this.toBase64(path.join(soundsDir, '8bit-jump.mp3')),
      death:      this.toBase64(path.join(soundsDir, 'wrong3.mp3')),
      heal:       this.toBase64(path.join(soundsDir, 'complete6.mp3')),
      speech:     this.toBase64(path.join(soundsDir, '8bit-dodge.mp3')),
      suggestion: this.toBase64(path.join(soundsDir, '8bit-alert1.mp3')),
      approve:    this.toBase64(path.join(soundsDir, 'text-scroll-long.mp3')),
      morning:    this.toBase64(path.join(soundsDir, 'power-on.mp3')),
      error:      this.toBase64(path.join(soundsDir, 'error1.mp3')),
      friendship: this.toBase64(path.join(soundsDir, 'quiz3.mp3')),
      firstRun:   this.toBase64(path.join(soundsDir, 'door-open2.mp3')),
      cancel:     this.toBase64(path.join(soundsDir, '8bit-alert3.mp3')),
      agentSpawn: this.toBase64(path.join(soundsDir, 'robot-drive1.mp3')),
      selectAgent:    this.toBase64(path.join(soundsDir, 'select9.mp3')),
      saveSpark:      this.toBase64(path.join(soundsDir, 'decide7.mp3')),

      // ── Per-species click sounds (each creature has a unique voice) ──
      selectDot:   this.toBase64(path.join(soundsDir, 'puff1.mp3')),
      selectPuff:  this.toBase64(path.join(soundsDir, 'cat2.mp3')),
      selectBlob:  this.toBase64(path.join(soundsDir, 'drop-single.mp3')),
      selectPip:   this.toBase64(path.join(soundsDir, 'puff2.mp3')),
      selectWisp:  this.toBase64(path.join(soundsDir, 'typing-mechanical1.mp3')),
      selectChomp: this.toBase64(path.join(soundsDir, 'puff3.mp3')),

      // ── Weather ambience ──
      rainAmbient: this.toBase64(path.join(soundsDir, 'rain-loop.mp3')),
      thunder:     this.toBase64(path.join(soundsDir, 'thunder1.mp3')),
    };

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
    window.__SOUNDS__ = ${JSON.stringify(soundMap)};
  </script>
  <div id="app">
    <div id="canvas-wrapper">
      <canvas id="game-canvas" width="480" height="320"></canvas>
    </div>
    <div id="toolbar">
      <div id="toolbar-left">
        <span id="status-text"></span>
      </div>
      <div id="toolbar-center">
        <button id="btn-feed"      class="tool-btn" title="Feed">Feed</button>
        <button id="btn-care"      class="tool-btn" title="Care">Care</button>
        <button id="btn-add-agent" class="tool-btn" title="Helper">+ Helper</button>
        <button id="btn-switch-agent" class="tool-btn" title="Switch Agent">🔄</button>
        <button id="btn-screenshot" class="tool-btn" title="Screenshot">\u{1F4F7}</button>
        <button id="btn-lang"      class="tool-btn" title="Language">EN</button>
        <button id="btn-mute"      class="tool-btn" title="Sound">Sound</button>
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
