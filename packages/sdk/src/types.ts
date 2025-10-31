/**
 * Core Span interface matching the LogLineOS universal_registry schema
 * Based on the semantic ~70 columns philosophy
 */
export interface Span {
  // Identity
  id: string;
  seq: number;
  entity_type: string;
  
  // Semantic triple
  who: string;
  did?: string;
  this: string;
  
  // Timing
  at: string; // ISO 8601 timestamp
  when?: string; // Alias for 'at' (for backward compatibility)
  
  // Relationships
  parent_id?: string;
  related_to?: string[];
  
  // Access control
  owner_id?: string;
  tenant_id?: string;
  visibility?: 'private' | 'tenant' | 'public';
  
  // Lifecycle
  status?: string;
  is_deleted?: boolean;
  
  // Code & Execution
  name?: string;
  description?: string;
  code?: string;
  language?: string;
  runtime?: string;
  input?: any;
  output?: any;
  error?: {
    message?: string;
    [key: string]: any;
  };
  
  // Metrics
  duration_ms?: number;
  trace_id?: string;
  
  // Cryptographic proofs
  prev_hash?: string;
  curr_hash?: string;
  signature?: string;
  public_key?: string;
  
  // Extensibility
  metadata?: {
    [key: string]: any;
  };
}

/**
 * Filter options for querying spans
 */
export interface SpanFilter {
  entity_type?: string;
  status?: string;
  trace_id?: string;
  owner_id?: string;
  tenant_id?: string;
  visibility?: 'private' | 'tenant' | 'public';
  limit?: number;
}

/**
 * Connection state for SSE stream
 */
export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

/**
 * SSE event from the timeline stream
 */
export interface TimelineEvent {
  type: 'span' | 'error' | 'connected';
  data?: Span;
  error?: string;
}
