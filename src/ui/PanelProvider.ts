import * as vscode from 'vscode';
import { ExtToWebMessage, WebToExtMessage } from '../types';

export class PanelProvider implements vscode.WebviewViewProvider {
  private view: vscode.WebviewView | null = null;
  private onMessageCallback: ((message: WebToExtMessage) => void) | null = null;

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
      ],
    };

    webviewView.webview.html = this.getHtml(webviewView.webview);

    webviewView.webview.onDidReceiveMessage((message: WebToExtMessage) => {
      if (this.onMessageCallback) {
        this.onMessageCallback(message);
      }
    });
  }

  onMessage(callback: (message: WebToExtMessage) => void): void {
    this.onMessageCallback = callback;
  }

  postMessage(message: ExtToWebMessage): void {
    if (this.view) {
      void this.view.webview.postMessage(message);
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

    return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <link rel="stylesheet" href="${styleUri}">
  <title>Digital Life</title>
</head>
<body>
  <div id="game-container">
    <canvas id="game-canvas" width="480" height="320"></canvas>
    <div id="ui-overlay">
      <div id="creature-count">0</div>
      <div id="goal-text">GOAL: CARE FOR THEM</div>
      <div id="action-panel">
        <button id="btn-pet" class="action-btn" title="Pet">&#x1F90D;</button>
        <button id="btn-feed" class="action-btn" title="Feed">&#x1F35E;</button>
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
