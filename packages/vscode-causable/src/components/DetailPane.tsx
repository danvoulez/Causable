import React from 'react';
import { Span } from '@causable/sdk';

interface DetailPaneProps {
  span: Span | null;
  onClose: () => void;
  onFilterByTraceId?: (traceId: string) => void;
}

/**
 * Detail pane for displaying full span JSON
 * Includes action buttons for copying and filtering
 */
export const DetailPane: React.FC<DetailPaneProps> = ({ 
  span, 
  onClose,
  onFilterByTraceId 
}) => {
  if (!span) {
    return null;
  }

  const handleCopyJson = () => {
    const jsonString = JSON.stringify(span, null, 2);
    
    // Use VS Code API to copy to clipboard
    if (typeof acquireVsCodeApi !== 'undefined') {
      const vscode = acquireVsCodeApi();
      vscode.postMessage({
        type: 'copyToClipboard',
        text: jsonString,
      });
    }
  };

  const handleCopyTraceId = () => {
    if (span.trace_id) {
      if (typeof acquireVsCodeApi !== 'undefined') {
        const vscode = acquireVsCodeApi();
        vscode.postMessage({
          type: 'copyToClipboard',
          text: span.trace_id,
        });
      }
    }
  };

  const handleFilterByTraceId = () => {
    if (span.trace_id && onFilterByTraceId) {
      onFilterByTraceId(span.trace_id);
      onClose();
    }
  };

  // Format JSON with syntax highlighting
  const formatJson = (obj: any): string => {
    return JSON.stringify(obj, null, 2);
  };

  return (
    <div className="detail-pane">
      <div className="detail-pane-header">
        <h3>Span Details</h3>
        <button 
          className="close-btn" 
          onClick={onClose}
          title="Close detail pane"
          aria-label="Close"
        >
          ✕
        </button>
      </div>

      <div className="detail-pane-actions">
        <button className="action-btn" onClick={handleCopyJson}>
          Copy JSON
        </button>
        {span.trace_id && (
          <>
            <button className="action-btn" onClick={handleCopyTraceId}>
              Copy Trace ID
            </button>
            {onFilterByTraceId && (
              <button className="action-btn" onClick={handleFilterByTraceId}>
                Filter by Trace ID
              </button>
            )}
          </>
        )}
      </div>

      <div className="detail-pane-content">
        <pre className="json-viewer">
          <code>{formatJson(span)}</code>
        </pre>
      </div>

      <style>{`
        .detail-pane {
          position: fixed;
          top: 0;
          right: 0;
          bottom: 0;
          width: 50%;
          max-width: 600px;
          min-width: 400px;
          background: var(--vscode-sideBar-background);
          border-left: 1px solid var(--vscode-panel-border);
          display: flex;
          flex-direction: column;
          z-index: 100;
          box-shadow: -2px 0 8px rgba(0, 0, 0, 0.2);
        }

        .detail-pane-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px;
          border-bottom: 1px solid var(--vscode-panel-border);
          background: var(--vscode-editor-background);
        }

        .detail-pane-header h3 {
          margin: 0;
          font-size: 16px;
          font-weight: 600;
          color: var(--vscode-foreground);
        }

        .close-btn {
          background: transparent;
          border: none;
          color: var(--vscode-foreground);
          font-size: 20px;
          cursor: pointer;
          padding: 4px 8px;
          border-radius: 4px;
          line-height: 1;
        }

        .close-btn:hover {
          background: var(--vscode-toolbar-hoverBackground);
        }

        .detail-pane-actions {
          display: flex;
          gap: 8px;
          padding: 12px 16px;
          border-bottom: 1px solid var(--vscode-panel-border);
          background: var(--vscode-editor-background);
          flex-wrap: wrap;
        }

        .action-btn {
          padding: 6px 12px;
          font-size: 12px;
          font-weight: 500;
          background: var(--vscode-button-background);
          color: var(--vscode-button-foreground);
          border: none;
          border-radius: 2px;
          cursor: pointer;
        }

        .action-btn:hover {
          background: var(--vscode-button-hoverBackground);
        }

        .action-btn:active {
          opacity: 0.8;
        }

        .detail-pane-content {
          flex: 1;
          overflow: auto;
          padding: 16px;
        }

        .json-viewer {
          margin: 0;
          padding: 16px;
          background: var(--vscode-textCodeBlock-background);
          border: 1px solid var(--vscode-panel-border);
          border-radius: 4px;
          overflow-x: auto;
          font-family: var(--vscode-editor-font-family);
          font-size: 12px;
          line-height: 1.6;
          color: var(--vscode-editor-foreground);
        }

        .json-viewer code {
          font-family: inherit;
        }

        @media (max-width: 800px) {
          .detail-pane {
            width: 100%;
            max-width: none;
            min-width: 0;
          }
        }
      `}</style>
    </div>
  );
};

// Type declaration for VS Code API
declare function acquireVsCodeApi(): {
  postMessage: (message: any) => void;
  setState: (state: any) => void;
  getState: () => any;
};
