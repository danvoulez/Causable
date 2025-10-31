import * as vscode from 'vscode';
import { ApiKeyService } from './services/ApiKeyService';
import { Span } from '@causable/sdk';

/**
 * Provider for the Causable sidebar webview
 * Loads the React application and handles message passing between
 * the extension host and the webview for API configuration
 */
export class SidebarProvider implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;
  private readonly STORAGE_KEY_SPANS = 'causable.cachedSpans';
  private readonly STORAGE_KEY_CONNECTION = 'causable.lastConnectionState';

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly _apiKeyService: ApiKeyService,
    private readonly _statusBarItem: vscode.StatusBarItem,
    private readonly _context: vscode.ExtensionContext
  ) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
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
        case 'getApiConfig': {
          // Send API configuration to the webview
          const apiKey = await this._apiKeyService.getApiKey();
          const apiUrl = await this._apiKeyService.getApiUrl();
          
          webviewView.webview.postMessage({
            type: 'apiConfig',
            apiKey: apiKey || '',
            apiUrl: apiUrl,
          });
          
          // Send cached spans if available
          const cachedSpans = await this._getCachedSpans();
          if (cachedSpans && cachedSpans.length > 0) {
            webviewView.webview.postMessage({
              type: 'cachedSpans',
              spans: cachedSpans,
            });
          }
          break;
        }
        
        case 'copyToClipboard': {
          // Copy text to clipboard
          if (message.text) {
            await vscode.env.clipboard.writeText(message.text);
            vscode.window.showInformationMessage('Copied to clipboard!');
          }
          break;
        }
        
        case 'updateConnectionState': {
          // Update status bar based on connection state
          this._updateStatusBar(message.state);
          // Persist connection state
          await this._context.workspaceState.update(this.STORAGE_KEY_CONNECTION, message.state);
          break;
        }
        
        case 'persistSpans': {
          // Persist spans to workspace state
          if (message.spans) {
            await this._cacheSpans(message.spans);
          }
          break;
        }
        
        case 'showError': {
          // Show error message to user
          if (message.error) {
            const errorMessage = this._formatErrorMessage(message.error);
            const action = await vscode.window.showErrorMessage(
              errorMessage,
              'Configure API',
              'Retry'
            );
            
            if (action === 'Configure API') {
              await vscode.commands.executeCommand('causable.setApiUrl');
              await vscode.commands.executeCommand('causable.setApiKey');
            } else if (action === 'Retry') {
              webviewView.webview.postMessage({ type: 'retry' });
            }
          }
          break;
        }
      }
    });
  }

  private _formatErrorMessage(error: any): string {
    if (typeof error === 'string') {
      return `Causable Error: ${error}`;
    }
    
    if (error.status === 401) {
      return 'Causable: Invalid API key. Please update your credentials.';
    }
    
    if (error.status === 429) {
      return 'Causable: Rate limit exceeded. Please try again later.';
    }
    
    if (error.message) {
      return `Causable: ${error.message}`;
    }
    
    return 'Causable: An unknown error occurred. Check the console for details.';
  }

  private async _getCachedSpans(): Promise<Span[] | undefined> {
    return this._context.workspaceState.get<Span[]>(this.STORAGE_KEY_SPANS);
  }

  private async _cacheSpans(spans: Span[]): Promise<void> {
    // Only cache the most recent 100 spans to avoid excessive storage usage
    const spansToCache = spans.slice(0, 100);
    await this._context.workspaceState.update(this.STORAGE_KEY_SPANS, spansToCache);
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

  public sendMessage(message: any): void {
    if (this._view) {
      this._view.webview.postMessage(message);
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
