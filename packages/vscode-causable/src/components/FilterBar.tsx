import React from 'react';

interface FilterBarProps {
  traceIdFilter: string;
  entityTypeFilter: string;
  statusFilter: string;
  onTraceIdChange: (value: string) => void;
  onEntityTypeChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onClearFilters: () => void;
}

/**
 * Sticky filter bar at the top of the timeline view
 * Provides filtering by trace ID, entity type, and status
 */
export const FilterBar: React.FC<FilterBarProps> = ({
  traceIdFilter,
  entityTypeFilter,
  statusFilter,
  onTraceIdChange,
  onEntityTypeChange,
  onStatusChange,
  onClearFilters,
}) => {
  const hasActiveFilters = traceIdFilter || entityTypeFilter || statusFilter;

  return (
    <div className="filter-bar">
      <div className="filter-row">
        <div className="filter-group">
          <label htmlFor="trace-id-filter">Trace ID</label>
          <input
            id="trace-id-filter"
            type="text"
            placeholder="Filter by trace ID..."
            value={traceIdFilter}
            onChange={(e) => onTraceIdChange(e.target.value)}
          />
        </div>

        <div className="filter-group">
          <label htmlFor="entity-type-filter">Entity Type</label>
          <input
            id="entity-type-filter"
            type="text"
            placeholder="Filter by type..."
            value={entityTypeFilter}
            onChange={(e) => onEntityTypeChange(e.target.value)}
          />
        </div>

        <div className="filter-group">
          <label htmlFor="status-filter">Status</label>
          <input
            id="status-filter"
            type="text"
            placeholder="Filter by status..."
            value={statusFilter}
            onChange={(e) => onStatusChange(e.target.value)}
          />
        </div>

        {hasActiveFilters && (
          <button
            className="clear-filters-btn"
            onClick={onClearFilters}
            title="Clear all filters"
          >
            Clear
          </button>
        )}
      </div>

      <style>{`
        .filter-bar {
          position: sticky;
          top: 0;
          z-index: 10;
          background: var(--vscode-sideBar-background);
          border-bottom: 1px solid var(--vscode-panel-border);
          padding: 12px;
          margin: -16px -16px 16px -16px;
        }

        .filter-row {
          display: flex;
          gap: 12px;
          align-items: flex-end;
          flex-wrap: wrap;
        }

        .filter-group {
          flex: 1;
          min-width: 150px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .filter-group label {
          font-size: 11px;
          font-weight: 600;
          color: var(--vscode-foreground);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .filter-group input {
          padding: 6px 8px;
          font-size: 13px;
          font-family: var(--vscode-font-family);
          color: var(--vscode-input-foreground);
          background: var(--vscode-input-background);
          border: 1px solid var(--vscode-input-border);
          border-radius: 2px;
          outline: none;
        }

        .filter-group input:focus {
          border-color: var(--vscode-focusBorder);
          outline: 1px solid var(--vscode-focusBorder);
          outline-offset: -1px;
        }

        .filter-group input::placeholder {
          color: var(--vscode-input-placeholderForeground);
        }

        .clear-filters-btn {
          padding: 6px 12px;
          font-size: 12px;
          font-weight: 500;
          background: var(--vscode-button-secondaryBackground);
          color: var(--vscode-button-secondaryForeground);
          border: none;
          border-radius: 2px;
          cursor: pointer;
          white-space: nowrap;
          align-self: flex-end;
        }

        .clear-filters-btn:hover {
          background: var(--vscode-button-secondaryHoverBackground);
        }

        .clear-filters-btn:active {
          opacity: 0.8;
        }
      `}</style>
    </div>
  );
};
