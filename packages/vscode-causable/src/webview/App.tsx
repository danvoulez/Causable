import React from 'react';
import { useTimelineStream } from '../hooks/useTimelineStream';
import { TimelineView } from '../components/TimelineView';
import { StatusBar } from '../components/StatusBar';

const App: React.FC = () => {
  const { connectionState, spans, error, reconnect } = useTimelineStream();

  return (
    <div className="app">
      <div className="header">
        <h2>Causable Ledger Explorer</h2>
        <div className="status">
          <StatusBar connectionState={connectionState} />
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

      {connectionState !== 'disconnected' && (
        <TimelineView 
          spans={spans} 
          connectionState={connectionState}
        />
      )}

      <style>{`
        .app {
          padding: 16px;
          font-family: var(--vscode-font-family);
          color: var(--vscode-foreground);
          font-size: var(--vscode-font-size);
          height: 100vh;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
          padding-bottom: 12px;
          border-bottom: 1px solid var(--vscode-panel-border);
          flex-shrink: 0;
        }

        h2 {
          margin: 0;
          font-size: 18px;
          font-weight: 600;
        }

        .status {
          display: flex;
          align-items: center;
          gap: 8px;
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
          flex-shrink: 0;
        }

        .info-message {
          padding: 12px;
          margin-bottom: 16px;
          background: var(--vscode-inputValidation-infoBackground);
          border: 1px solid var(--vscode-inputValidation-infoBorder);
          border-radius: 4px;
          font-size: 12px;
          line-height: 1.5;
          flex-shrink: 0;
        }

        .info-message code {
          background: var(--vscode-textCodeBlock-background);
          padding: 2px 6px;
          border-radius: 3px;
          font-family: var(--vscode-editor-font-family);
          font-size: 11px;
        }
      `}</style>
    </div>
  );
};

export default App;
