import { Span, SpanFilter } from './types';

/**
 * Client for interacting with the Causable Cloud API
 */
export class CausableClient {
  private baseUrl: string;
  private apiKey?: string;

  constructor(baseUrl: string, apiKey?: string) {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.apiKey = apiKey;
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
  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }
    
    return headers;
  }

  /**
   * Fetch spans from the REST API
   */
  async fetchSpans(filter?: SpanFilter): Promise<Span[]> {
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
      throw new Error(`Failed to fetch spans: ${response.statusText}`);
    }
    
    return response.json();
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
      throw new Error(`Failed to create span: ${response.statusText}`);
    }
    
    return response.json();
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
