import React from 'react';
import { Span } from '@causable/sdk';

interface SpanRowProps {
  span: Span;
  isSelected: boolean;
  onClick: () => void;
}

/**
 * Core UI atom - displays a single span in the timeline
 * Implements the semantic triple (who/did/this) with status indicator
 */
export const SpanRow: React.FC<SpanRowProps> = ({ span, isSelected, onClick }) => {
  // Get status color based on span status
  const getStatusColor = (status?: string): string => {
    if (!status) return '#9e9e9e'; // gray for no status
    
    switch (status.toLowerCase()) {
      case 'success':
      case 'completed':
      case 'done':
        return '#4caf50'; // green
      case 'pending':
      case 'running':
      case 'in_progress':
        return '#2196f3'; // blue
      case 'error':
      case 'failed':
        return '#f44336'; // red
      case 'warning':
        return '#ff9800'; // orange
      default:
        return '#9e9e9e'; // gray
    }
  };

  // Get color for duration bar
  const getDurationColor = (durationMs?: number): string => {
    if (!durationMs) return '#9e9e9e';
    
    if (durationMs < 100) return '#4caf50'; // green - fast
    if (durationMs < 500) return '#2196f3'; // blue - normal
    if (durationMs < 1000) return '#ff9800'; // orange - slow
    return '#f44336'; // red - very slow
  };

  // Calculate duration bar width (0-100%)
  const getDurationBarWidth = (durationMs?: number): number => {
    if (!durationMs) return 0;
    
    // Logarithmic scale: 10ms = 10%, 100ms = 50%, 1000ms = 90%, 10000ms = 100%
    const percentage = Math.min(100, (Math.log10(durationMs) / 4) * 100);
    return percentage;
  };

  // Format relative timestamp
  const getRelativeTime = (timestamp: string): string => {
    const now = Date.now();
    const then = new Date(timestamp).getTime();
    const diffMs = now - then;
    
    if (diffMs < 1000) return 'just now';
    if (diffMs < 60000) return `${Math.floor(diffMs / 1000)}s ago`;
    if (diffMs < 3600000) return `${Math.floor(diffMs / 60000)}m ago`;
    if (diffMs < 86400000) return `${Math.floor(diffMs / 3600000)}h ago`;
    return `${Math.floor(diffMs / 86400000)}d ago`;
  };

  const statusColor = getStatusColor(span.status);
  const relativeTime = getRelativeTime(span.at);
  const hasError = !!span.error;
  const hasDuration = span.duration_ms !== undefined && span.duration_ms !== null;
  const durationColor = getDurationColor(span.duration_ms);
  const durationBarWidth = getDurationBarWidth(span.duration_ms);

  return (
    <div
      className={`span-row ${isSelected ? 'selected' : ''}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <div className="span-row-header">
        <div className="span-row-left">
          <span 
            className="status-dot" 
            style={{ backgroundColor: statusColor }}
            title={span.status || 'No status'}
          />
          <span className="entity-type-badge">{span.entity_type}</span>
          {hasError && (
            <span className="error-indicator" title={span.error?.message || 'Error occurred'}>
              ⚠
            </span>
          )}
        </div>
        <span className="timestamp" title={new Date(span.at).toLocaleString()}>
          {relativeTime}
        </span>
      </div>
      
      <div className="span-row-content">
        <div className="semantic-triple">
          <span className="who">{span.who}</span>
          {span.did && <span className="did"> {span.did}</span>}
          <span className="this"> {span.this}</span>
        </div>
        
        {hasDuration && (
          <div className="duration-container">
            <div className="duration-bar-wrapper">
              <div 
                className="duration-bar" 
                style={{ 
                  width: `${durationBarWidth}%`,
                  backgroundColor: durationColor
                }}
              />
            </div>
            <span className="duration-text">{span.duration_ms}ms</span>
          </div>
        )}
      </div>

      <style>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(-8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .span-row {
          padding: 10px 12px;
          border: 1px solid var(--vscode-panel-border);
          border-radius: 4px;
          background: var(--vscode-editor-background);
          cursor: pointer;
          transition: all 0.15s ease;
          margin-bottom: 6px;
          animation: slideIn 0.2s ease-out;
        }

        .span-row:hover {
          background: var(--vscode-list-hoverBackground);
          border-color: var(--vscode-focusBorder);
          transform: translateX(2px);
        }

        .span-row.selected {
          background: var(--vscode-list-activeSelectionBackground);
          border-color: var(--vscode-focusBorder);
          box-shadow: 0 0 0 1px var(--vscode-focusBorder);
        }

        .span-row:focus {
          outline: 1px solid var(--vscode-focusBorder);
          outline-offset: -1px;
        }

        .span-row-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 6px;
        }

        .span-row-left {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          flex-shrink: 0;
          animation: pulse 2s ease-in-out infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }

        .entity-type-badge {
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: var(--vscode-textLink-foreground);
          background: var(--vscode-badge-background);
          padding: 2px 6px;
          border-radius: 3px;
        }

        .error-indicator {
          font-size: 14px;
          color: var(--vscode-errorForeground);
          cursor: help;
          transition: transform 0.1s ease;
        }

        .error-indicator:hover {
          transform: scale(1.2);
        }

        .timestamp {
          font-size: 11px;
          color: var(--vscode-descriptionForeground);
          font-family: var(--vscode-editor-font-family);
        }

        .span-row-content {
          font-size: 13px;
          line-height: 1.5;
        }

        .semantic-triple {
          margin-bottom: 4px;
        }

        .semantic-triple .who {
          font-weight: 600;
          color: var(--vscode-foreground);
        }

        .semantic-triple .did {
          color: var(--vscode-descriptionForeground);
          font-style: italic;
        }

        .semantic-triple .this {
          color: var(--vscode-foreground);
        }

        .duration-container {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 6px;
        }

        .duration-bar-wrapper {
          flex: 1;
          height: 4px;
          background: var(--vscode-panel-border);
          border-radius: 2px;
          overflow: hidden;
        }

        .duration-bar {
          height: 100%;
          transition: width 0.3s ease;
          border-radius: 2px;
        }

        .duration-text {
          font-size: 11px;
          color: var(--vscode-descriptionForeground);
          font-family: var(--vscode-editor-font-family);
          min-width: 50px;
          text-align: right;
        }
      `}</style>
    </div>
  );
};
