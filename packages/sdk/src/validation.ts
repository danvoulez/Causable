// Validation schemas for Causable types using Zod
import { z } from 'zod';

/**
 * Span schema for runtime validation
 */
export const SpanSchema = z.object({
  // Identity
  id: z.string().uuid(),
  seq: z.number().int().min(0),
  entity_type: z.string().min(1),
  
  // Semantic triple
  who: z.string().min(1),
  did: z.string().optional(),
  this: z.string().min(1),
  
  // Timing
  at: z.string().datetime(),
  when: z.string().datetime().optional(), // Alias for backward compatibility
  
  // Relationships
  parent_id: z.string().uuid().optional(),
  related_to: z.array(z.string()).optional(),
  
  // Access control
  owner_id: z.string().optional(),
  tenant_id: z.string().optional(),
  visibility: z.enum(['private', 'tenant', 'public']).optional(),
  
  // Lifecycle
  status: z.string().optional(),
  is_deleted: z.boolean().optional(),
  
  // Code & Execution
  name: z.string().optional(),
  description: z.string().optional(),
  code: z.string().optional(),
  language: z.string().optional(),
  runtime: z.string().optional(),
  input: z.any().optional(),
  output: z.any().optional(),
  error: z.object({
    message: z.string().optional(),
  }).passthrough().optional(),
  
  // Metrics
  duration_ms: z.number().min(0).optional(),
  trace_id: z.string().optional(),
  
  // Cryptographic proofs
  prev_hash: z.string().optional(),
  curr_hash: z.string().optional(),
  signature: z.string().optional(),
  public_key: z.string().optional(),
  
  // Extensibility
  metadata: z.record(z.string(), z.any()).optional(),
}).passthrough(); // Allow additional fields for forward compatibility

/**
 * Partial span schema for creation (fewer required fields)
 */
export const CreateSpanSchema = SpanSchema.partial({
  id: true,
  seq: true,
  at: true,
}).required({
  entity_type: true,
  who: true,
  this: true,
});

/**
 * Span filter schema
 */
export const SpanFilterSchema = z.object({
  entity_type: z.string().optional(),
  status: z.string().optional(),
  trace_id: z.string().optional(),
  owner_id: z.string().optional(),
  tenant_id: z.string().optional(),
  visibility: z.enum(['private', 'tenant', 'public']).optional(),
  limit: z.number().int().min(1).max(1000).optional(),
}).strict();

// Export inferred types for use in TypeScript
export type ValidatedSpan = z.infer<typeof SpanSchema>;
export type ValidatedCreateSpan = z.infer<typeof CreateSpanSchema>;
export type ValidatedSpanFilter = z.infer<typeof SpanFilterSchema>;
