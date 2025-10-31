import * as vscode from 'vscode';
import { ApiKeyService } from './services/ApiKeyService';

/**
 * Provider for the Causable sidebar webview
 * Loads the React application and handles message passing between
 * the extension host and the webview for API configuration
 */
export class SidebarProvider implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly _apiKeyService: ApiKeyService,
    private readonly _statusBarItem: vscode.StatusBarItem
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

    // Handle messages from the webview
    webviewView.webview.onDidReceiveMessage(async (message) => {
      switch (message.type) {
        case 'getApiConfig':
          // Send API configuration to the webview
          const apiKey = await this._apiKeyService.getApiKey();
          const apiUrl = await this._apiKeyService.getApiUrl();
          
          webviewView.webview.postMessage({
            type: 'apiConfig',
            apiKey: apiKey || '',
            apiUrl: apiUrl,
          });
          break;
        
        case 'copyToClipboard':
          // Copy text to clipboard
          if (message.text) {
            await vscode.env.clipboard.writeText(message.text);
            vscode.window.showInformationMessage('Copied to clipboard!');
          }
          break;
        
        case 'updateConnectionState':
          // Update status bar based on connection state
          this._updateStatusBar(message.state);
          break;
      }
    });
  }

  private _updateStatusBar(state: string) {
    switch (state) {
      case 'connected':
        this._statusBarItem.text = '$(circle-filled) Causable';
        this._statusBarItem.tooltip = 'Causable: Live';
        break;
      case 'connecting':
        this._statusBarItem.text = '$(sync~spin) Causable';
        this._statusBarItem.tooltip = 'Causable: Connecting...';
        break;
      case 'error':
        this._statusBarItem.text = '$(error) Causable';
        this._statusBarItem.tooltip = 'Causable: Error';
        break;
      case 'disconnected':
      default:
        this._statusBarItem.text = '$(circle-outline) Causable';
        this._statusBarItem.tooltip = 'Causable: Disconnected';
        break;
    }
  }

  public refresh() {
    if (this._view) {
      this._view.webview.html = this._getHtmlForWebview(this._view.webview);
    }
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    // Get the URI for the webview script
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'out', 'webview.js')
    );

    // Use a nonce to whitelist which scripts can be run
    const nonce = getNonce();

    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}'; connect-src *;">
        <title>Causable Timeline</title>
        <style>
            body {
                margin: 0;
                padding: 0;
                overflow-x: hidden;
            }
        </style>
    </head>
    <body>
        <div id="root"></div>
        <script nonce="${nonce}" src="${scriptUri}"></script>
    </body>
    </html>`;
  }
}

function getNonce() {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
