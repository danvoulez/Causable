// Authentication middleware for API key validation
// Validates Bearer token from Authorization header

export interface AuthConfig {
  apiKeys: Set<string>;
}

/**
 * Create authentication middleware
 * Checks for valid API key in Authorization header
 */
export function createAuthMiddleware(config: AuthConfig) {
  return function authMiddleware(req: Request): Response | null {
    const authHeader = req.headers.get("Authorization");
    
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing Authorization header" }),
        {
          status: 401,
          headers: {
            "Content-Type": "application/json",
            "WWW-Authenticate": 'Bearer realm="Causable API"',
          },
        }
      );
    }
    
    // Check for Bearer token format
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (!match) {
      return new Response(
        JSON.stringify({ error: "Invalid Authorization format. Expected: Bearer <token>" }),
        {
          status: 401,
          headers: {
            "Content-Type": "application/json",
            "WWW-Authenticate": 'Bearer realm="Causable API"',
          },
        }
      );
    }
    
    const token = match[1];
    
    // Validate API key
    if (!config.apiKeys.has(token)) {
      return new Response(
        JSON.stringify({ error: "Invalid API key" }),
        {
          status: 401,
          headers: {
            "Content-Type": "application/json",
            "WWW-Authenticate": 'Bearer realm="Causable API"',
          },
        }
      );
    }
    
    // Valid token - return null to allow request to proceed
    return null;
  };
}

/**
 * Load API keys from environment
 * Supports comma-separated list in CAUSABLE_API_KEYS env var
 */
export function loadApiKeys(): Set<string> {
  const apiKeysEnv = Deno.env.get("CAUSABLE_API_KEYS");
  
  if (!apiKeysEnv) {
    // For development: allow a default dev key if no keys are configured
    const isDev = Deno.env.get("DENO_ENV") === "development" || !Deno.env.get("DENO_ENV");
    if (isDev) {
      console.warn("⚠️  No API keys configured. Using development mode with key 'dev'");
      return new Set(["dev"]);
    }
    throw new Error("CAUSABLE_API_KEYS environment variable is required in production");
  }
  
  const keys = apiKeysEnv.split(",").map(k => k.trim()).filter(k => k.length > 0);
  
  if (keys.length === 0) {
    throw new Error("CAUSABLE_API_KEYS must contain at least one key");
  }
  
  console.log(`✅ Loaded ${keys.length} API key(s)`);
  return new Set(keys);
}
