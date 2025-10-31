import { Span, SpanFilter } from './types';
import { SpanSchema, SpanFilterSchema } from './validation';
import { z } from 'zod';

/**
 * Client for interacting with the Causable Cloud API
 */
export class CausableClient {
  private baseUrl: string;
  private apiKey?: string;
  private validateResponses: boolean;

  constructor(baseUrl: string, apiKey?: string, options?: { validateResponses?: boolean }) {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.apiKey = apiKey;
    this.validateResponses = options?.validateResponses ?? true;
  }

  /**
   * Set or update the API key
   */
  setApiKey(apiKey: string): void {
    this.apiKey = apiKey;
  }

  /**
   * Get headers for authenticated requests
   */
  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }
    
    return headers;
  }

  /**
   * Validate and parse a span response
   */
  private validateSpan(data: unknown): Span {
    if (!this.validateResponses) {
      return data as Span;
    }
    
    try {
      return SpanSchema.parse(data) as Span;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const issues = error.issues || [];
        console.error('Span validation failed:', issues);
        throw new Error(`Invalid span data received from API: ${issues.map((e: any) => e.message).join(', ')}`);
      }
      throw error;
    }
  }

  /**
   * Validate and parse an array of spans
   */
  private validateSpans(data: unknown): Span[] {
    if (!this.validateResponses) {
      return data as Span[];
    }
    
    if (!Array.isArray(data)) {
      throw new Error('Expected array of spans, got ' + typeof data);
    }
    
    return data.map((span, index) => {
      try {
        return this.validateSpan(span);
      } catch (error) {
        throw new Error(`Validation failed for span at index ${index}: ${error instanceof Error ? error.message : error}`);
      }
    });
  }

  /**
   * Fetch spans from the REST API
   */
  async fetchSpans(filter?: SpanFilter): Promise<Span[]> {
    // Validate filter
    if (filter && this.validateResponses) {
      try {
        SpanFilterSchema.parse(filter);
      } catch (error) {
        if (error instanceof z.ZodError) {
          const issues = error.issues || [];
          throw new Error(`Invalid filter: ${issues.map((e: any) => e.message).join(', ')}`);
        }
        throw error;
      }
    }
    
    const params = new URLSearchParams();
    
    if (filter?.entity_type) params.append('entity_type', filter.entity_type);
    if (filter?.status) params.append('status', filter.status);
    if (filter?.limit) params.append('limit', filter.limit.toString());
    
    const url = `${this.baseUrl}/api/spans?${params.toString()}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: this.getHeaders(),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch spans (${response.status}): ${errorText}`);
    }
    
    const data = await response.json();
    return this.validateSpans(data);
  }

  /**
   * Create a new span
   */
  async createSpan(span: Partial<Span>): Promise<Span> {
    const response = await fetch(`${this.baseUrl}/api/spans`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(span),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to create span (${response.status}): ${errorText}`);
    }
    
    const data = await response.json();
    return this.validateSpan(data);
  }

  /**
   * Get the SSE stream URL
   */
  getStreamUrl(): string {
    return `${this.baseUrl}/api/timeline/stream`;
  }

  /**
   * Create an EventSource for the timeline stream
   * Note: This is meant to be used in browser/webview context
   */
  createStreamConnection(): EventSource {
    const url = this.getStreamUrl();
    return new EventSource(url);
  }
}
