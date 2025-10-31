import React, { useState, useMemo } from 'react';
import { Span } from '@causable/sdk';
import { SpanRow } from './SpanRow';
import { FilterBar } from './FilterBar';
import { DetailPane } from './DetailPane';

interface TimelineViewProps {
  spans: Span[];
  connectionState: 'disconnected' | 'connecting' | 'connected' | 'error';
}

/**
 * Main timeline view component with filtering
 * Manages selected span and filter state
 */
export const TimelineView: React.FC<TimelineViewProps> = ({ 
  spans,
  connectionState 
}) => {
  const [selectedSpan, setSelectedSpan] = useState<Span | null>(null);
  const [traceIdFilter, setTraceIdFilter] = useState('');
  const [entityTypeFilter, setEntityTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Filter spans based on current filter values
  const filteredSpans = useMemo(() => {
    return spans.filter((span) => {
      // Filter by trace ID
      if (traceIdFilter && span.trace_id) {
        if (!span.trace_id.toLowerCase().includes(traceIdFilter.toLowerCase())) {
          return false;
        }
      } else if (traceIdFilter) {
        return false; // No trace_id but filter is active
      }

      // Filter by entity type
      if (entityTypeFilter) {
        if (!span.entity_type.toLowerCase().includes(entityTypeFilter.toLowerCase())) {
          return false;
        }
      }

      // Filter by status
      if (statusFilter && span.status) {
        if (!span.status.toLowerCase().includes(statusFilter.toLowerCase())) {
          return false;
        }
      } else if (statusFilter) {
        return false; // No status but filter is active
      }

      return true;
    });
  }, [spans, traceIdFilter, entityTypeFilter, statusFilter]);

  const handleClearFilters = () => {
    setTraceIdFilter('');
    setEntityTypeFilter('');
    setStatusFilter('');
  };

  const handleFilterByTraceId = (traceId: string) => {
    setTraceIdFilter(traceId);
  };

  return (
    <div className="timeline-view">
      <FilterBar
        traceIdFilter={traceIdFilter}
        entityTypeFilter={entityTypeFilter}
        statusFilter={statusFilter}
        onTraceIdChange={setTraceIdFilter}
        onEntityTypeChange={setEntityTypeFilter}
        onStatusChange={setStatusFilter}
        onClearFilters={handleClearFilters}
      />

      <div className="timeline-header">
        <h3>Timeline ({filteredSpans.length} spans)</h3>
      </div>

      {filteredSpans.length === 0 && connectionState === 'connected' && (
        <div className="empty-state">
          {traceIdFilter || entityTypeFilter || statusFilter ? (
            <>
              No spans match the current filters.
              <br />
              <button className="text-btn" onClick={handleClearFilters}>
                Clear filters
              </button>
            </>
          ) : (
            <>
              Connected and waiting for spans...
              <br />
              <small>New spans will appear here in real-time.</small>
            </>
          )}
        </div>
      )}

      {filteredSpans.length > 0 && (
        <div className="timeline-list">
          {filteredSpans.map((span, index) => (
            <SpanRow
              key={`${span.id}-${index}`}
              span={span}
              isSelected={selectedSpan?.id === span.id}
              onClick={() => setSelectedSpan(span)}
            />
          ))}
        </div>
      )}

      {selectedSpan && (
        <DetailPane
          span={selectedSpan}
          onClose={() => setSelectedSpan(null)}
          onFilterByTraceId={handleFilterByTraceId}
        />
      )}

      <style>{`
        .timeline-view {
          display: flex;
          flex-direction: column;
          height: 100%;
          position: relative;
        }

        .timeline-header {
          padding: 0 0 12px 0;
        }

        .timeline-header h3 {
          margin: 0;
          font-size: 14px;
          font-weight: 600;
          color: var(--vscode-descriptionForeground);
        }

        .timeline-list {
          flex: 1;
          overflow-y: auto;
          overflow-x: hidden;
          padding-right: 8px;
        }

        /* Custom scrollbar for VS Code */
        .timeline-list::-webkit-scrollbar {
          width: 10px;
        }

        .timeline-list::-webkit-scrollbar-track {
          background: var(--vscode-scrollbarSlider-background);
        }

        .timeline-list::-webkit-scrollbar-thumb {
          background: var(--vscode-scrollbarSlider-hoverBackground);
          border-radius: 5px;
        }

        .timeline-list::-webkit-scrollbar-thumb:hover {
          background: var(--vscode-scrollbarSlider-activeBackground);
        }

        .empty-state {
          padding: 48px 32px;
          text-align: center;
          color: var(--vscode-descriptionForeground);
          font-size: 13px;
          line-height: 1.6;
        }

        .empty-state small {
          font-size: 11px;
          opacity: 0.8;
        }

        .text-btn {
          background: none;
          border: none;
          color: var(--vscode-textLink-foreground);
          text-decoration: underline;
          cursor: pointer;
          font-size: inherit;
          padding: 0;
          margin-top: 8px;
        }

        .text-btn:hover {
          color: var(--vscode-textLink-activeForeground);
        }
      `}</style>
    </div>
  );
};
