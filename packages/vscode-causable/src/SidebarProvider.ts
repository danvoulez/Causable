import * as vscode from 'vscode';
import { ApiKeyService } from './services/ApiKeyService';

/**
 * Enhanced Provider for the Causable sidebar webview with filtering and detail view
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
        case 'copyToClipboard':
          await vscode.env.clipboard.writeText(data.text);
          vscode.window.showInformationMessage('Copied to clipboard!');
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
    // Enhanced inline React app with filtering and detail view
    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Causable Timeline</title>
        <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body {
                font-family: var(--vscode-font-family);
                font-size: var(--vscode-font-size);
                color: var(--vscode-foreground);
                background-color: var(--vscode-sideBar-background);
                padding: 16px;
                overflow: hidden;
            }
            .container { display: flex; flex-direction: column; height: calc(100vh - 32px); gap: 12px; }
            .header { flex-shrink: 0; }
            h1 { font-size: 16px; font-weight: 600; margin-bottom: 8px; }
            .status { display: flex; align-items: center; gap: 8px; font-size: 11px; 
                     color: var(--vscode-descriptionForeground); margin-bottom: 8px; }
            .status-dot { width: 8px; height: 8px; border-radius: 50%; 
                         background-color: var(--vscode-descriptionForeground); }
            .status-dot.connected { background-color: #4ade80; }
            .status-dot.connecting { background-color: #fbbf24; }
            .status-dot.error { background-color: #f87171; }
            .filters { display: flex; flex-direction: column; gap: 6px; padding: 8px;
                      background-color: var(--vscode-editor-background); 
                      border: 1px solid var(--vscode-panel-border); border-radius: 4px; font-size: 11px; }
            .filter-row { display: flex; gap: 6px; align-items: center; }
            .filter-row label { min-width: 70px; color: var(--vscode-descriptionForeground); }
            .filter-row input { flex: 1; background-color: var(--vscode-input-background);
                               color: var(--vscode-input-foreground); 
                               border: 1px solid var(--vscode-input-border);
                               padding: 4px 6px; border-radius: 2px; font-size: 11px; }
            .clear-filters { padding: 4px 8px; 
                            background-color: var(--vscode-button-secondaryBackground);
                            color: var(--vscode-button-secondaryForeground); border: none; 
                            border-radius: 2px; cursor: pointer; font-size: 11px; }
            .timeline { flex: 1; display: flex; flex-direction: column; gap: 6px; 
                       overflow-y: auto; padding-right: 4px; }
            .span-row { padding: 10px; background-color: var(--vscode-editor-background);
                       border: 1px solid var(--vscode-panel-border); border-radius: 3px;
                       cursor: pointer; transition: all 0.15s; flex-shrink: 0; }
            .span-row:hover { background-color: var(--vscode-list-hoverBackground);
                             border-color: var(--vscode-focusBorder); }
            .span-header { display: flex; align-items: center; gap: 6px; margin-bottom: 4px; }
            .span-type { font-size: 9px; padding: 2px 5px; border-radius: 2px;
                        background-color: var(--vscode-badge-background);
                        color: var(--vscode-badge-foreground); font-weight: 500; }
            .span-status { font-size: 9px; padding: 2px 5px; border-radius: 2px; font-weight: 500; }
            .span-status.complete { background-color: #10b98140; color: #4ade80; }
            .span-status.error { background-color: #f8717140; color: #f87171; }
            .span-status.active { background-color: #3b82f640; color: #60a5fa; }
            .span-time { font-size: 10px; color: var(--vscode-descriptionForeground); margin-left: auto; }
            .span-content { font-size: 12px; line-height: 1.4; }
            .span-who { font-weight: 600; color: var(--vscode-textLink-foreground); }
            .span-id { font-size: 9px; color: var(--vscode-descriptionForeground); 
                      font-family: monospace; margin-top: 4px; }
            .detail-pane { position: fixed; top: 0; right: 0; bottom: 0; left: 0;
                          background-color: var(--vscode-sideBar-background); z-index: 1000;
                          display: none; flex-direction: column; padding: 16px; }
            .detail-pane.visible { display: flex; }
            .detail-header { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
            .detail-title { font-size: 14px; font-weight: 600; flex: 1; }
            .detail-close { background: none; border: none; color: var(--vscode-foreground);
                           cursor: pointer; font-size: 18px; padding: 4px 8px; }
            .detail-actions { display: flex; gap: 6px; margin-bottom: 12px; }
            .detail-button { padding: 4px 10px; background-color: var(--vscode-button-background);
                            color: var(--vscode-button-foreground); border: none; 
                            border-radius: 2px; cursor: pointer; font-size: 11px; }
            .detail-content { flex: 1; overflow-y: auto; 
                             background-color: var(--vscode-editor-background);
                             border: 1px solid var(--vscode-panel-border); 
                             border-radius: 3px; padding: 12px; }
            .json-view { font-family: monospace; font-size: 11px; white-space: pre-wrap; 
                        word-break: break-word; }
            .empty-state { text-align: center; padding: 32px; 
                          color: var(--vscode-descriptionForeground); font-size: 12px; }
            .error-message { padding: 10px; 
                            background-color: var(--vscode-inputValidation-errorBackground);
                            color: var(--vscode-inputValidation-errorForeground);
                            border: 1px solid var(--vscode-inputValidation-errorBorder);
                            border-radius: 3px; font-size: 11px; }
        </style>
    </head>
    <body>
        <div id="root"></div>
        <script>
            const vscode = acquireVsCodeApi();
            
            class CausableApp {
                constructor() {
                    this.state = {
                        status: 'disconnected', spans: [], filteredSpans: [], selectedSpan: null,
                        apiKey: null, apiUrl: null, error: null,
                        filters: { entity_type: '', status: '', trace_id: '' }
                    };
                    this.eventSource = null;
                    this.init();
                }
                
                async init() {
                    vscode.postMessage({ type: 'getApiKey' });
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
                        this.state.error = 'API URL not configured. Use Causable: Set API URL command.';
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
                        };
                        this.eventSource.onmessage = (event) => {
                            try {
                                const data = JSON.parse(event.data);
                                if (data.type === 'connected') return;
                                this.state.spans.unshift(data);
                                if (this.state.spans.length > 200) this.state.spans = this.state.spans.slice(0, 200);
                                this.applyFilters();
                                this.render();
                            } catch (err) {
                                vscode.postMessage({ type: 'error', message: 'Parse error: ' + err.message });
                            }
                        };
                        this.eventSource.onerror = () => {
                            this.state.status = 'error';
                            this.state.error = 'Connection lost. Retrying...';
                            this.render();
                            if (this.eventSource) this.eventSource.close();
                            setTimeout(() => this.connect(), 5000);
                        };
                    } catch (err) {
                        this.state.status = 'error';
                        this.state.error = err.message;
                        this.render();
                    }
                }
                
                applyFilters() {
                    let filtered = [...this.state.spans];
                    const { entity_type, status, trace_id } = this.state.filters;
                    if (entity_type) filtered = filtered.filter(s => 
                        s.entity_type && s.entity_type.toLowerCase().includes(entity_type.toLowerCase()));
                    if (status) filtered = filtered.filter(s => 
                        s.status && s.status.toLowerCase().includes(status.toLowerCase()));
                    if (trace_id) filtered = filtered.filter(s => 
                        s.trace_id && s.trace_id.toLowerCase().includes(trace_id.toLowerCase()));
                    this.state.filteredSpans = filtered;
                }
                
                handleFilterChange(field, value) {
                    this.state.filters[field] = value;
                    this.applyFilters();
                    this.render();
                }
                
                clearFilters() {
                    this.state.filters = { entity_type: '', status: '', trace_id: '' };
                    this.applyFilters();
                    this.render();
                }
                
                selectSpan(span) { this.state.selectedSpan = span; this.render(); }
                closeDetail() { this.state.selectedSpan = null; this.render(); }
                copyJSON() {
                    if (this.state.selectedSpan) {
                        vscode.postMessage({ type: 'copyToClipboard', 
                            text: JSON.stringify(this.state.selectedSpan, null, 2) });
                    }
                }
                copyTraceId() {
                    if (this.state.selectedSpan?.trace_id) {
                        vscode.postMessage({ type: 'copyToClipboard', 
                            text: this.state.selectedSpan.trace_id });
                    }
                }
                filterByTrace() {
                    if (this.state.selectedSpan?.trace_id) {
                        this.state.filters.trace_id = this.state.selectedSpan.trace_id;
                        this.closeDetail();
                        this.applyFilters();
                        this.render();
                    }
                }
                
                formatTime(timestamp) {
                    const date = new Date(timestamp);
                    const diff = new Date() - date;
                    if (diff < 60000) return 'just now';
                    if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
                    if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
                    return date.toLocaleDateString();
                }
                
                render() {
                    const root = document.getElementById('root');
                    const statusClass = this.state.status;
                    const statusText = this.state.status.charAt(0).toUpperCase() + this.state.status.slice(1);
                    const displaySpans = this.state.filteredSpans.length > 0 ? 
                        this.state.filteredSpans : this.state.spans;
                    
                    let content = '';
                    if (this.state.error) {
                        content = \`<div class="error-message">\${this.state.error}</div>\`;
                    } else if (displaySpans.length === 0 && this.state.status === 'connected') {
                        content = '<div class="empty-state">Waiting for spans...</div>';
                    } else if (displaySpans.length === 0) {
                        content = '<div class="empty-state">Connecting...</div>';
                    } else {
                        const hasFilters = Object.values(this.state.filters).some(v => v);
                        content = \`
                            <div class="filters">
                                <div class="filter-row">
                                    <label>Type:</label>
                                    <input type="text" id="filter-entity-type" placeholder="function, execution..." 
                                           value="\${this.state.filters.entity_type}">
                                </div>
                                <div class="filter-row">
                                    <label>Status:</label>
                                    <input type="text" id="filter-status" placeholder="active, complete..." 
                                           value="\${this.state.filters.status}">
                                </div>
                                <div class="filter-row">
                                    <label>Trace ID:</label>
                                    <input type="text" id="filter-trace-id" placeholder="trace..." 
                                           value="\${this.state.filters.trace_id}">
                                </div>
                                \${hasFilters ? '<button class="clear-filters" id="clear-filters-btn">Clear</button>' : ''}
                            </div>
                            <div class="timeline">
                        \` + displaySpans.map((span, idx) => \`
                                <div class="span-row" data-index="\${idx}">
                                    <div class="span-header">
                                        <span class="span-type">\${span.entity_type || 'unknown'}</span>
                                        \${span.status ? \`<span class="span-status \${span.status}">\${span.status}</span>\` : ''}
                                        <span class="span-time">\${this.formatTime(span.at)}</span>
                                    </div>
                                    <div class="span-content">
                                        <span class="span-who">\${span.who || 'unknown'}</span>
                                        \${span.did ? \` \${span.did}\` : ''}
                                        <strong>\${span.this || 'unknown'}</strong>
                                        \${span.duration_ms ? \` (\${span.duration_ms}ms)\` : ''}
                                    </div>
                                    <div class="span-id">\${(span.id || '').substring(0, 8)}...</div>
                                </div>
                            \`).join('') + '</div>';
                    }
                    
                    root.innerHTML = \`
                        <div class="container">
                            <div class="header">
                                <h1>Causable Timeline</h1>
                                <div class="status">
                                    <span class="status-dot \${statusClass}"></span>
                                    <span>\${statusText} • \${this.state.spans.length} spans</span>
                                </div>
                            </div>
                            \${content}
                        </div>
                        <div class="detail-pane\${this.state.selectedSpan ? ' visible' : ''}">
                            \${this.state.selectedSpan ? \`
                                <div class="detail-header">
                                    <div class="detail-title">Span Details</div>
                                    <button class="detail-close" id="close-detail">✕</button>
                                </div>
                                <div class="detail-actions">
                                    <button class="detail-button" id="copy-json">Copy JSON</button>
                                    \${this.state.selectedSpan.trace_id ? 
                                        '<button class="detail-button" id="copy-trace">Copy Trace ID</button>' + 
                                        '<button class="detail-button" id="filter-trace">Filter by Trace</button>' 
                                        : ''}
                                </div>
                                <div class="detail-content">
                                    <pre class="json-view">\${JSON.stringify(this.state.selectedSpan, null, 2)}</pre>
                                </div>
                            \` : ''}
                        </div>
                    \`;
                    
                    setTimeout(() => {
                        document.querySelectorAll('.span-row').forEach((el, idx) => {
                            el.addEventListener('click', () => this.selectSpan(displaySpans[idx]));
                        });
                        const f1 = document.getElementById('filter-entity-type');
                        if (f1) f1.addEventListener('input', (e) => 
                            this.handleFilterChange('entity_type', e.target.value));
                        const f2 = document.getElementById('filter-status');
                        if (f2) f2.addEventListener('input', (e) => 
                            this.handleFilterChange('status', e.target.value));
                        const f3 = document.getElementById('filter-trace-id');
                        if (f3) f3.addEventListener('input', (e) => 
                            this.handleFilterChange('trace_id', e.target.value));
                        const clearBtn = document.getElementById('clear-filters-btn');
                        if (clearBtn) clearBtn.addEventListener('click', () => this.clearFilters());
                        const closeBtn = document.getElementById('close-detail');
                        if (closeBtn) closeBtn.addEventListener('click', () => this.closeDetail());
                        const copyBtn = document.getElementById('copy-json');
                        if (copyBtn) copyBtn.addEventListener('click', () => this.copyJSON());
                        const copyTraceBtn = document.getElementById('copy-trace');
                        if (copyTraceBtn) copyTraceBtn.addEventListener('click', () => this.copyTraceId());
                        const filterTraceBtn = document.getElementById('filter-trace');
                        if (filterTraceBtn) filterTraceBtn.addEventListener('click', () => this.filterByTrace());
                    }, 0);
                }
            }
            
            new CausableApp();
        </script>
    </body>
    </html>`;
  }
}
