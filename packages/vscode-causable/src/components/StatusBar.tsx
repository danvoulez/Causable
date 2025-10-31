import React from 'react';
import { ConnectionState } from '@causable/sdk';

interface StatusBarProps {
  connectionState: ConnectionState;
}

/**
 * Status indicator component for the timeline
 * Shows connection state with visual indicator
 */
export const StatusBar: React.FC<StatusBarProps> = ({ connectionState }) => {
  const getStatusInfo = (): { icon: string; color: string; text: string } => {
    switch (connectionState) {
      case 'connected':
        return { icon: '●', color: '#4caf50', text: 'Live' };
      case 'connecting':
        return { icon: '◐', color: '#ff9800', text: 'Connecting...' };
      case 'error':
        return { icon: '●', color: '#f44336', text: 'Error' };
      case 'disconnected':
      default:
        return { icon: '○', color: '#9e9e9e', text: 'Disconnected' };
    }
  };

  const status = getStatusInfo();

  return (
    <div className="status-bar">
      <span className="status-indicator" style={{ color: status.color }}>
        {status.icon}
      </span>
      <span className="status-text">Causable: {status.text}</span>

      <style>{`
        .status-bar {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
        }

        .status-indicator {
          font-size: 14px;
          line-height: 1;
        }

        .status-text {
          font-weight: 500;
          color: var(--vscode-foreground);
        }
      `}</style>
    </div>
  );
};
