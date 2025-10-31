import * as vscode from 'vscode';
import { ApiKeyService } from './services/ApiKeyService';

/**
 * Provider for the Causable sidebar webview
 * Implements basic scaffold with "Hello, Causable" message
 * (Full SSE streaming and React app will be added in PR-103)
 */
export class SidebarProvider implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly _apiKeyService: ApiKeyService
  ) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
  }

  public refresh() {
    if (this._view) {
      this._view.webview.html = this._getHtmlForWebview(this._view.webview);
    }
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    // Basic HTML5 boilerplate with simple "Hello, Causable" message
    // As per PR-102 requirements: minimal scaffold, not the full React app yet
    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Causable Timeline</title>
        <style>
            body {
                font-family: var(--vscode-font-family);
                font-size: var(--vscode-font-size);
                color: var(--vscode-foreground);
                background-color: var(--vscode-sideBar-background);
                padding: 20px;
                margin: 0;
            }
            #root {
                display: flex;
                align-items: center;
                justify-content: center;
                height: calc(100vh - 40px);
            }
            .message {
                font-size: 24px;
                font-weight: 600;
                color: var(--vscode-textLink-foreground);
            }
        </style>
    </head>
    <body>
        <div id="root"></div>
        <script>
            // Simple script to render "Hello, Causable" message
            const root = document.getElementById('root');
            const messageDiv = document.createElement('div');
            messageDiv.className = 'message';
            messageDiv.textContent = 'Hello, Causable';
            root.appendChild(messageDiv);
        </script>
    </body>
    </html>`;
  }
}
