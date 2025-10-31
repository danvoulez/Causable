// Structured logging utilities
// Produces JSON-formatted logs for easier parsing by monitoring tools

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogContext {
  [key: string]: any;
}

export interface StructuredLog {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
}

/**
 * Structured logger that outputs JSON
 */
export class Logger {
  private service: string;
  private minLevel: LogLevel;
  
  private levelPriority: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  };

  constructor(service: string, minLevel: LogLevel = "info") {
    this.service = service;
    this.minLevel = minLevel;
  }

  private shouldLog(level: LogLevel): boolean {
    return this.levelPriority[level] >= this.levelPriority[this.minLevel];
  }

  private log(level: LogLevel, message: string, context?: LogContext): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const logEntry: StructuredLog & { service: string } = {
      timestamp: new Date().toISOString(),
      level,
      message,
      service: this.service,
      ...(context && { context }),
    };

    const output = JSON.stringify(logEntry);
    
    // Use console.error for warn/error to ensure they go to stderr
    if (level === "error" || level === "warn") {
      console.error(output);
    } else {
      console.log(output);
    }
  }

  debug(message: string, context?: LogContext): void {
    this.log("debug", message, context);
  }

  info(message: string, context?: LogContext): void {
    this.log("info", message, context);
  }

  warn(message: string, context?: LogContext): void {
    this.log("warn", message, context);
  }

  error(message: string, context?: LogContext): void {
    this.log("error", message, context);
  }
}

/**
 * Request logging middleware
 * Logs all incoming requests with timing information
 */
export function createRequestLogger(logger: Logger) {
  return async function requestLogger(
    req: Request,
    handler: (req: Request) => Promise<Response>
  ): Promise<Response> {
    const startTime = Date.now();
    const url = new URL(req.url);
    
    logger.info("Incoming request", {
      method: req.method,
      path: url.pathname,
      query: url.search,
    });

    try {
      const response = await handler(req);
      const duration = Date.now() - startTime;
      
      logger.info("Request completed", {
        method: req.method,
        path: url.pathname,
        status: response.status,
        durationMs: duration,
      });
      
      return response;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      logger.error("Request failed", {
        method: req.method,
        path: url.pathname,
        error: error instanceof Error ? error.message : String(error),
        durationMs: duration,
      });
      
      throw error;
    }
  };
}
