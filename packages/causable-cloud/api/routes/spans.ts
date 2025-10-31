// Spans REST endpoint - GET and POST
// Note: This is a mock implementation for the MVP
// In production, this would connect to PostgreSQL

interface Span {
  id: string;
  seq: number;
  entity_type: string;
  who: string;
  did?: string;
  this: string;
  at: string;
  status?: string;
  [key: string]: any;
}

// In-memory mock data for development
const mockSpans: Span[] = [
  {
    id: crypto.randomUUID(),
    seq: 0,
    entity_type: "function",
    who: "daniel",
    did: "defined",
    this: "hello_world",
    at: new Date().toISOString(),
    status: "active",
    name: "hello_world",
    description: "A simple hello world function",
  },
  {
    id: crypto.randomUUID(),
    seq: 0,
    entity_type: "execution",
    who: "edge:run_code",
    did: "executed",
    this: "run_code",
    at: new Date().toISOString(),
    status: "complete",
    duration_ms: 42,
  },
];

function corsHeaders(): Headers {
  return new Headers({
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Content-Type": "application/json",
  });
}

export async function handleSpans(req: Request): Promise<Response> {
  const url = new URL(req.url);
  
  if (req.method === "GET") {
    // Parse query parameters for filtering
    const entity_type = url.searchParams.get("entity_type");
    const status = url.searchParams.get("status");
    const limit = parseInt(url.searchParams.get("limit") || "50");
    
    let filtered = [...mockSpans];
    
    if (entity_type) {
      filtered = filtered.filter(s => s.entity_type === entity_type);
    }
    
    if (status) {
      filtered = filtered.filter(s => s.status === status);
    }
    
    filtered = filtered.slice(0, limit);
    
    return new Response(JSON.stringify(filtered), { headers: corsHeaders() });
  }
  
  if (req.method === "POST") {
    const body = await req.json();
    
    const newSpan: Span = {
      id: body.id || crypto.randomUUID(),
      seq: body.seq ?? 0,
      entity_type: body.entity_type || "unknown",
      who: body.who || "unknown",
      did: body.did,
      this: body.this || "unknown",
      at: body.at || new Date().toISOString(),
      ...body,
    };
    
    mockSpans.unshift(newSpan);
    
    // Notify SSE listeners (in production, this would use PostgreSQL NOTIFY)
    notifyListeners(newSpan);
    
    return new Response(JSON.stringify(newSpan), { headers: corsHeaders() });
  }
  
  return new Response("Method Not Allowed", { status: 405, headers: corsHeaders() });
}

// Global listeners for SSE
const listeners: Array<(span: Span) => void> = [];

export function addListener(callback: (span: Span) => void): void {
  listeners.push(callback);
}

export function removeListener(callback: (span: Span) => void): void {
  const index = listeners.indexOf(callback);
  if (index > -1) {
    listeners.splice(index, 1);
  }
}

function notifyListeners(span: Span): void {
  for (const listener of listeners) {
    try {
      listener(span);
    } catch (error) {
      console.error("Error notifying listener:", error);
    }
  }
}
