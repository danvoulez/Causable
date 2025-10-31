import React from 'react';
import { Span } from '@causable/sdk';
import ReactJson from 'react-json-view';
import '../webview/types'; // Import global type declarations

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
        <ReactJson
          src={span}
          theme="monokai"
          collapsed={2}
          collapseStringsAfterLength={50}
          displayDataTypes={false}
          displayObjectSize={true}
          enableClipboard={true}
          name="span"
          style={{
            backgroundColor: 'var(--vscode-editor-background)',
            fontSize: '12px',
            fontFamily: 'var(--vscode-editor-font-family)',
            padding: '16px',
            borderRadius: '4px',
          }}
        />
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
          animation: slideInRight 0.2s ease-out;
        }

        @keyframes slideInRight {
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(0);
          }
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
          transition: background 0.15s ease;
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
          transition: background 0.15s ease;
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
