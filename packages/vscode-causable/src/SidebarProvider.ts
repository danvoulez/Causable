import * as vscode from 'vscode';
import { ApiKeyService } from './services/ApiKeyService';

/**
 * Provider for the Causable sidebar webview
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

    // Handle messages from the webview
    webviewView.webview.onDidReceiveMessage(async (data) => {
      switch (data.type) {
        case 'getApiKey':
          const apiKey = await this._apiKeyService.getApiKey();
          const apiUrl = await this._apiKeyService.getApiUrl();
          webviewView.webview.postMessage({
            type: 'apiKeyResponse',
            apiKey,
            apiUrl,
          });
          break;
        case 'log':
          console.log('Webview:', data.message);
          break;
        case 'error':
          console.error('Webview error:', data.message);
          break;
      }
    });
  }

  public refresh() {
    if (this._view) {
      this._view.webview.html = this._getHtmlForWebview(this._view.webview);
    }
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    // Use a simple inline React app for the webview
    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Causable Timeline</title>
        <style>
            * {
                box-sizing: border-box;
                margin: 0;
                padding: 0;
            }
            body {
                font-family: var(--vscode-font-family);
                font-size: var(--vscode-font-size);
                color: var(--vscode-foreground);
                background-color: var(--vscode-sideBar-background);
                padding: 16px;
            }
            .container {
                display: flex;
                flex-direction: column;
                gap: 16px;
            }
            .header {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }
            h1 {
                font-size: 18px;
                font-weight: 600;
            }
            .status {
                display: flex;
                align-items: center;
                gap: 8px;
                font-size: 12px;
                color: var(--vscode-descriptionForeground);
            }
            .status-dot {
                width: 8px;
                height: 8px;
                border-radius: 50%;
                background-color: var(--vscode-descriptionForeground);
            }
            .status-dot.connected {
                background-color: #4ade80;
            }
            .status-dot.connecting {
                background-color: #fbbf24;
            }
            .status-dot.error {
                background-color: #f87171;
            }
            .timeline {
                display: flex;
                flex-direction: column;
                gap: 8px;
                max-height: calc(100vh - 200px);
                overflow-y: auto;
            }
            .span-row {
                padding: 12px;
                background-color: var(--vscode-editor-background);
                border: 1px solid var(--vscode-panel-border);
                border-radius: 4px;
                cursor: pointer;
                transition: background-color 0.2s;
            }
            .span-row:hover {
                background-color: var(--vscode-list-hoverBackground);
            }
            .span-header {
                display: flex;
                align-items: center;
                gap: 8px;
                margin-bottom: 4px;
            }
            .span-type {
                font-size: 10px;
                padding: 2px 6px;
                border-radius: 3px;
                background-color: var(--vscode-badge-background);
                color: var(--vscode-badge-foreground);
            }
            .span-time {
                font-size: 11px;
                color: var(--vscode-descriptionForeground);
                margin-left: auto;
            }
            .span-content {
                font-size: 13px;
            }
            .span-who {
                font-weight: 600;
            }
            .empty-state {
                text-align: center;
                padding: 32px;
                color: var(--vscode-descriptionForeground);
            }
            .error-message {
                padding: 12px;
                background-color: var(--vscode-inputValidation-errorBackground);
                color: var(--vscode-inputValidation-errorForeground);
                border: 1px solid var(--vscode-inputValidation-errorBorder);
                border-radius: 4px;
            }
        </style>
    </head>
    <body>
        <div id="root"></div>
        <script>
            const vscode = acquireVsCodeApi();
            
            class CausableApp {
                constructor() {
                    this.state = {
                        status: 'disconnected',
                        spans: [],
                        apiKey: null,
                        apiUrl: null,
                        error: null,
                    };
                    this.eventSource = null;
                    this.init();
                }
                
                async init() {
                    // Request API key from extension
                    vscode.postMessage({ type: 'getApiKey' });
                    
                    // Listen for messages from extension
                    window.addEventListener('message', (event) => {
                        const message = event.data;
                        if (message.type === 'apiKeyResponse') {
                            this.state.apiKey = message.apiKey;
                            this.state.apiUrl = message.apiUrl;
                            this.render();
                            this.connect();
                        }
                    });
                    
                    this.render();
                }
                
                connect() {
                    if (!this.state.apiUrl) {
                        this.state.error = 'API URL not configured';
                        this.render();
                        return;
                    }
                    
                    this.state.status = 'connecting';
                    this.state.error = null;
                    this.render();
                    
                    try {
                        const streamUrl = this.state.apiUrl + '/api/timeline/stream';
                        this.eventSource = new EventSource(streamUrl);
                        
                        this.eventSource.onopen = () => {
                            this.state.status = 'connected';
                            this.render();
                            vscode.postMessage({ type: 'log', message: 'Connected to timeline stream' });
                        };
                        
                        this.eventSource.onmessage = (event) => {
                            try {
                                const data = JSON.parse(event.data);
                                if (data.type === 'connected') {
                                    return; // Ignore connection message
                                }
                                // Add new span to the beginning of the list
                                this.state.spans.unshift(data);
                                // Keep only the last 100 spans
                                if (this.state.spans.length > 100) {
                                    this.state.spans = this.state.spans.slice(0, 100);
                                }
                                this.render();
                            } catch (err) {
                                vscode.postMessage({ type: 'error', message: 'Failed to parse span: ' + err.message });
                            }
                        };
                        
                        this.eventSource.onerror = (error) => {
                            this.state.status = 'error';
                            this.state.error = 'Connection lost. Retrying...';
                            this.render();
                            vscode.postMessage({ type: 'error', message: 'SSE connection error' });
                            
                            // Close and retry after 5 seconds
                            if (this.eventSource) {
                                this.eventSource.close();
                            }
                            setTimeout(() => this.connect(), 5000);
                        };
                    } catch (err) {
                        this.state.status = 'error';
                        this.state.error = err.message;
                        this.render();
                    }
                }
                
                formatTime(timestamp) {
                    const date = new Date(timestamp);
                    const now = new Date();
                    const diff = now - date;
                    
                    if (diff < 60000) return 'just now';
                    if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
                    if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
                    return date.toLocaleDateString();
                }
                
                render() {
                    const root = document.getElementById('root');
                    
                    let statusClass = this.state.status;
                    let statusText = this.state.status.charAt(0).toUpperCase() + this.state.status.slice(1);
                    
                    let content = '';
                    
                    if (this.state.error) {
                        content = \`<div class="error-message">\${this.state.error}</div>\`;
                    } else if (this.state.spans.length === 0) {
                        content = '<div class="empty-state">Waiting for spans...</div>';
                    } else {
                        content = '<div class="timeline">' + 
                            this.state.spans.map(span => \`
                                <div class="span-row">
                                    <div class="span-header">
                                        <span class="span-type">\${span.entity_type || 'unknown'}</span>
                                        <span class="span-time">\${this.formatTime(span.at)}</span>
                                    </div>
                                    <div class="span-content">
                                        <span class="span-who">\${span.who || 'unknown'}</span>
                                        \${span.did ? \` \${span.did}\` : ''}
                                        <strong>\${span.this || 'unknown'}</strong>
                                    </div>
                                </div>
                            \`).join('') +
                        '</div>';
                    }
                    
                    root.innerHTML = \`
                        <div class="container">
                            <div class="header">
                                <h1>Causable Timeline</h1>
                                <div class="status">
                                    <span class="status-dot \${statusClass}"></span>
                                    <span>\${statusText}</span>
                                </div>
                            </div>
                            \${content}
                        </div>
                    \`;
                }
            }
            
            // Initialize the app
            new CausableApp();
        </script>
    </body>
    </html>`;
  }
}
