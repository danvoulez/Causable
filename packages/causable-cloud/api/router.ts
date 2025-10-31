// API Router - Routes all requests
import { handleSpans } from "./routes/spans.ts";
import { handleStream } from "./routes/stream.ts";
import { createAuthMiddleware, loadApiKeys } from "./middleware/auth.ts";
import { createRateLimitMiddleware, RateLimiter } from "./middleware/ratelimit.ts";
import { Logger } from "./middleware/logger.ts";

// Initialize middleware
const logger = new Logger("causable-cloud", "info");
const apiKeys = loadApiKeys();
const authMiddleware = createAuthMiddleware({ apiKeys });
const rateLimiter = new RateLimiter({
  windowMs: 60000, // 1 minute
  maxRequests: 100, // 100 requests per minute
});
const rateLimitMiddleware = createRateLimitMiddleware(rateLimiter);

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
  const startTime = Date.now();
  
  // Handle OPTIONS (CORS preflight) - skip auth and rate limiting
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }
  
  try {
    // Apply rate limiting (before auth to prevent auth enumeration)
    const rateLimitResponse = rateLimitMiddleware(req);
    if (rateLimitResponse) {
      const headers = corsHeaders();
      for (const [key, value] of rateLimitResponse.headers.entries()) {
        headers.set(key, value);
      }
      return new Response(rateLimitResponse.body, {
        status: rateLimitResponse.status,
        headers,
      });
    }
    
    // Health check - no auth required
    if (url.pathname === "/" || url.pathname === "/health") {
      const headers = corsHeaders();
      headers.set("Content-Type", "application/json");
      logger.info("Health check", { method: req.method, path: url.pathname });
      return new Response(
        JSON.stringify({ status: "ok", service: "causable-cloud" }),
        { headers }
      );
    }
    
    // Apply authentication to all API routes
    const authResponse = authMiddleware(req);
    if (authResponse) {
      const headers = corsHeaders();
      for (const [key, value] of authResponse.headers.entries()) {
        headers.set(key, value);
      }
      logger.warn("Authentication failed", { 
        method: req.method, 
        path: url.pathname,
        reason: "Invalid or missing API key"
      });
      return new Response(authResponse.body, {
        status: authResponse.status,
        headers,
      });
    }
    
    logger.info("Request authenticated", { method: req.method, path: url.pathname });
    
    // Route to handlers
    if (url.pathname === "/api/spans") {
      const response = await handleSpans(req);
      const duration = Date.now() - startTime;
      logger.info("Request completed", { 
        method: req.method, 
        path: url.pathname,
        status: response.status,
        durationMs: duration
      });
      return response;
    }
    
    if (url.pathname === "/api/timeline/stream") {
      logger.info("SSE stream connection initiated", { method: req.method, path: url.pathname });
      return await handleStream(req);
    }
    
    // 404
    logger.warn("Route not found", { method: req.method, path: url.pathname });
    return new Response("Not Found", { status: 404, headers: corsHeaders() });
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error("Request error", {
      method: req.method,
      path: url.pathname,
      error: error instanceof Error ? error.message : String(error),
      durationMs: duration
    });
    const headers = corsHeaders();
    headers.set("Content-Type", "application/json");
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal Server Error" }),
      { status: 500, headers }
    );
  }
}
