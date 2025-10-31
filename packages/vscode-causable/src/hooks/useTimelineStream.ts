import { useState, useEffect, useCallback, useRef } from 'react';
import { Span, ConnectionState } from '@causable/sdk';

interface UseTimelineStreamResult {
  connectionState: ConnectionState;
  spans: Span[];
  error: string | null;
  reconnect: () => void;
}

interface ApiConfig {
  apiUrl: string;
  apiKey: string;
}

/**
 * Custom React hook for managing the real-time SSE connection to the timeline stream.
 * Handles connection lifecycle, message parsing, error handling, and auto-reconnection.
 */
export function useTimelineStream(): UseTimelineStreamResult {
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [spans, setSpans] = useState<Span[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [apiConfig, setApiConfig] = useState<ApiConfig | null>(null);
  
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const reconnectAttemptsRef = useRef<number>(0);
  const vscodeApiRef = useRef(acquireVsCodeApi());

  // Request API configuration from the extension host
  useEffect(() => {
    const vscode = vscodeApiRef.current;
    
    // Set up message listener
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      
      if (message.type === 'apiConfig') {
        console.log('Received API config:', { url: message.apiUrl, hasKey: !!message.apiKey });
        setApiConfig({
          apiUrl: message.apiUrl,
          apiKey: message.apiKey,
        });
      }
    };
    
    window.addEventListener('message', handleMessage);
    
    // Request initial config
    vscode.postMessage({ type: 'getApiConfig' });
    
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  const connect = useCallback(() => {
    if (!apiConfig || !apiConfig.apiKey || !apiConfig.apiUrl) {
      console.log('Cannot connect: missing API config', apiConfig);
      setConnectionState('disconnected');
      setError('API key or URL not configured. Please run "Causable: Set API Key" command.');
      return;
    }

    // Clean up existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    // Clear any pending reconnection
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    setConnectionState('connecting');
    setError(null);
    console.log('Connecting to timeline stream...', apiConfig.apiUrl);

    try {
      const url = `${apiConfig.apiUrl}/api/timeline/stream`;
      const eventSource = new EventSource(url);
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        console.log('✅ SSE connection established');
        setConnectionState('connected');
        setError(null);
        reconnectAttemptsRef.current = 0;
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('📡 Received SSE event:', data);

          // Handle different event types
          if (data.type === 'connected') {
            console.log('Connection confirmed:', data.message);
          } else if (data.type === 'error') {
            console.error('Server error:', data.error);
            setError(data.error);
          } else {
            // Assume it's a span
            console.log('📊 New span received:', data);
            setSpans((prevSpans) => [data, ...prevSpans]);
          }
        } catch (err) {
          console.error('Error parsing SSE message:', err, event.data);
        }
      };

      eventSource.onerror = (event) => {
        console.error('SSE connection error:', event);
        setConnectionState('error');
        setError('Connection to timeline stream failed');
        
        // Close the connection
        if (eventSourceRef.current) {
          eventSourceRef.current.close();
          eventSourceRef.current = null;
        }

        // Implement exponential backoff for reconnection
        reconnectAttemptsRef.current += 1;
        const backoffDelay = Math.min(30000, 1000 * Math.pow(2, reconnectAttemptsRef.current - 1));
        
        console.log(`Will attempt to reconnect in ${backoffDelay}ms (attempt ${reconnectAttemptsRef.current})...`);
        
        reconnectTimeoutRef.current = window.setTimeout(() => {
          console.log('Attempting to reconnect...');
          connect();
        }, backoffDelay);
      };
    } catch (err) {
      console.error('Error creating EventSource:', err);
      setConnectionState('error');
      setError(err instanceof Error ? err.message : 'Failed to create connection');
    }
  }, [apiConfig]);

  // Connect when apiConfig is available
  useEffect(() => {
    if (apiConfig) {
      connect();
    }

    // Cleanup on unmount
    return () => {
      if (eventSourceRef.current) {
        console.log('Closing SSE connection on unmount');
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiConfig]);

  const reconnect = useCallback(() => {
    console.log('Manual reconnection requested');
    reconnectAttemptsRef.current = 0;
    connect();
  }, [connect]);

  return {
    connectionState,
    spans,
    error,
    reconnect,
  };
}

// Type declaration for VS Code API
declare function acquireVsCodeApi(): {
  postMessage: (message: any) => void;
  setState: (state: any) => void;
  getState: () => any;
};
