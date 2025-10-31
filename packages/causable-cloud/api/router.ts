// API Router - Routes all requests
import { handleSpans } from "./routes/spans.ts";
import { handleStream } from "./routes/stream.ts";

// CORS headers
function corsHeaders(): Headers {
  return new Headers({
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  });
}

export async function router(req: Request): Promise<Response> {
  const url = new URL(req.url);
  
  // Handle OPTIONS (CORS preflight)
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }
  
  try {
    // Route to handlers
    if (url.pathname === "/api/spans") {
      return await handleSpans(req);
    }
    
    if (url.pathname === "/api/timeline/stream") {
      return await handleStream(req);
    }
    
    // Health check
    if (url.pathname === "/" || url.pathname === "/health") {
      const headers = corsHeaders();
      headers.set("Content-Type", "application/json");
      return new Response(
        JSON.stringify({ status: "ok", service: "causable-cloud" }),
        { headers }
      );
    }
    
    // 404
    return new Response("Not Found", { status: 404, headers: corsHeaders() });
  } catch (error) {
    console.error("Request error:", error);
    const headers = corsHeaders();
    headers.set("Content-Type", "application/json");
    return new Response(
      JSON.stringify({ error: error.message || "Internal Server Error" }),
      { status: 500, headers }
    );
  }
}
