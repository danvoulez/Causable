// Rate limiting middleware
// Implements token bucket algorithm for request throttling

export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

/**
 * Simple in-memory rate limiter using token bucket algorithm
 * For production, consider using Redis or similar distributed store
 */
export class RateLimiter {
  private requests: Map<string, RateLimitEntry> = new Map();
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = config;
    
    // Clean up expired entries every minute
    setInterval(() => this.cleanup(), 60000);
  }

  /**
   * Check if a request should be allowed
   * Returns null if allowed, or a Response with 429 status if rate limited
   */
  check(identifier: string): Response | null {
    const now = Date.now();
    const entry = this.requests.get(identifier);

    if (!entry || now >= entry.resetTime) {
      // First request or window expired - allow and reset
      this.requests.set(identifier, {
        count: 1,
        resetTime: now + this.config.windowMs,
      });
      return null;
    }

    if (entry.count >= this.config.maxRequests) {
      // Rate limit exceeded
      const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
      return new Response(
        JSON.stringify({
          error: "Rate limit exceeded",
          retryAfter,
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": retryAfter.toString(),
            "X-RateLimit-Limit": this.config.maxRequests.toString(),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": entry.resetTime.toString(),
          },
        }
      );
    }

    // Increment counter and allow request
    entry.count++;
    this.requests.set(identifier, entry);
    return null;
  }

  /**
   * Get rate limit headers for a successful request
   */
  getHeaders(identifier: string): Record<string, string> {
    const entry = this.requests.get(identifier);
    if (!entry) {
      return {
        "X-RateLimit-Limit": this.config.maxRequests.toString(),
        "X-RateLimit-Remaining": this.config.maxRequests.toString(),
      };
    }

    const remaining = Math.max(0, this.config.maxRequests - entry.count);
    return {
      "X-RateLimit-Limit": this.config.maxRequests.toString(),
      "X-RateLimit-Remaining": remaining.toString(),
      "X-RateLimit-Reset": entry.resetTime.toString(),
    };
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.requests.entries()) {
      if (now >= entry.resetTime) {
        this.requests.delete(key);
      }
    }
  }
}

/**
 * Create rate limiting middleware
 */
export function createRateLimitMiddleware(limiter: RateLimiter) {
  return function rateLimitMiddleware(req: Request): Response | null {
    // Use IP address as identifier
    // In production, you might want to use API key or user ID
    const identifier = req.headers.get("x-forwarded-for") || 
                      req.headers.get("cf-connecting-ip") ||
                      "default";
    
    return limiter.check(identifier);
  };
}
