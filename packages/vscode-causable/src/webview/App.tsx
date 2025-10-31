import React from 'react';
import { useTimelineStream } from '../hooks/useTimelineStream';
import { ConnectionState } from '@causable/sdk';

const App: React.FC = () => {
  const { connectionState, spans, error, reconnect } = useTimelineStream();

  const getConnectionIndicator = (state: ConnectionState): { icon: string; color: string; text: string } => {
    switch (state) {
      case 'connected':
        return { icon: '●', color: '#4caf50', text: 'Connected' };
      case 'connecting':
        return { icon: '◐', color: '#ff9800', text: 'Connecting...' };
      case 'error':
        return { icon: '●', color: '#f44336', text: 'Error' };
      case 'disconnected':
      default:
        return { icon: '○', color: '#9e9e9e', text: 'Disconnected' };
    }
  };

  const indicator = getConnectionIndicator(connectionState);

  return (
    <div className="app">
      <div className="header">
        <h2>Causable Ledger Timeline</h2>
        <div className="status">
          <span className="status-indicator" style={{ color: indicator.color }}>
            {indicator.icon}
          </span>
          <span className="status-text">{indicator.text}</span>
          {(connectionState === 'error' || connectionState === 'disconnected') && (
            <button className="reconnect-btn" onClick={reconnect}>
              Reconnect
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="error-message">
          <strong>Error:</strong> {error}
        </div>
      )}

      {connectionState === 'disconnected' && !error && (
        <div className="info-message">
          Configure your API key and URL to start receiving timeline updates.
          <br />
          <br />
          Run: <code>Causable: Set API Key</code> and <code>Causable: Set API URL</code>
        </div>
      )}

      <div className="timeline">
        <h3>Recent Spans ({spans.length})</h3>
        {spans.length === 0 && connectionState === 'connected' && (
          <div className="empty-state">
            Connected and waiting for spans...
            <br />
            <small>New spans will appear here in real-time.</small>
          </div>
        )}
        <div className="spans-list">
          {spans.map((span, index) => (
            <div key={`${span.id}-${index}`} className="span-item">
              <div className="span-header">
                <span className="span-type">{span.entity_type}</span>
                <span className="span-time">
                  {new Date(span.at).toLocaleTimeString()}
                </span>
              </div>
              <div className="span-content">
                <div className="span-triple">
                  <strong>{span.who}</strong>
                  {span.did && <span> {span.did}</span>}
                  <span> {span.this}</span>
                </div>
                {span.name && <div className="span-name">{span.name}</div>}
                {span.description && (
                  <div className="span-description">{span.description}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        .app {
          padding: 16px;
          font-family: var(--vscode-font-family);
          color: var(--vscode-foreground);
          font-size: var(--vscode-font-size);
        }

        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
          padding-bottom: 12px;
          border-bottom: 1px solid var(--vscode-panel-border);
        }

        h2 {
          margin: 0;
          font-size: 18px;
          font-weight: 600;
        }

        h3 {
          margin: 0 0 12px 0;
          font-size: 14px;
          font-weight: 600;
          color: var(--vscode-descriptionForeground);
        }

        .status {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .status-indicator {
          font-size: 16px;
          line-height: 1;
        }

        .status-text {
          font-size: 12px;
          font-weight: 500;
        }

        .reconnect-btn {
          padding: 4px 12px;
          font-size: 11px;
          background: var(--vscode-button-background);
          color: var(--vscode-button-foreground);
          border: none;
          border-radius: 2px;
          cursor: pointer;
        }

        .reconnect-btn:hover {
          background: var(--vscode-button-hoverBackground);
        }

        .error-message {
          padding: 12px;
          margin-bottom: 16px;
          background: var(--vscode-inputValidation-errorBackground);
          border: 1px solid var(--vscode-inputValidation-errorBorder);
          border-radius: 4px;
          font-size: 12px;
        }

        .info-message {
          padding: 12px;
          margin-bottom: 16px;
          background: var(--vscode-inputValidation-infoBackground);
          border: 1px solid var(--vscode-inputValidation-infoBorder);
          border-radius: 4px;
          font-size: 12px;
          line-height: 1.5;
        }

        .info-message code {
          background: var(--vscode-textCodeBlock-background);
          padding: 2px 6px;
          border-radius: 3px;
          font-family: var(--vscode-editor-font-family);
          font-size: 11px;
        }

        .timeline {
          margin-top: 16px;
        }

        .empty-state {
          padding: 32px;
          text-align: center;
          color: var(--vscode-descriptionForeground);
          font-size: 12px;
        }

        .empty-state small {
          font-size: 11px;
          opacity: 0.7;
        }

        .spans-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .span-item {
          padding: 12px;
          background: var(--vscode-editor-background);
          border: 1px solid var(--vscode-panel-border);
          border-radius: 4px;
          font-size: 12px;
        }

        .span-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }

        .span-type {
          font-weight: 600;
          color: var(--vscode-textLink-foreground);
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .span-time {
          font-size: 11px;
          color: var(--vscode-descriptionForeground);
          font-family: var(--vscode-editor-font-family);
        }

        .span-content {
          line-height: 1.5;
        }

        .span-triple {
          margin-bottom: 4px;
        }

        .span-name {
          font-weight: 500;
          margin-top: 4px;
        }

        .span-description {
          color: var(--vscode-descriptionForeground);
          margin-top: 4px;
          font-size: 11px;
        }
      `}</style>
    </div>
  );
};

export default App;
