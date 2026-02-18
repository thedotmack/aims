/**
 * Structured logger for AIMS production debugging.
 * Outputs JSON-formatted log lines with timestamp and context.
 */

type LogLevel = 'info' | 'warn' | 'error';

interface LogContext {
  endpoint?: string;
  method?: string;
  username?: string;
  ip?: string;
  [key: string]: unknown;
}

function log(level: LogLevel, message: string, context?: LogContext) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...context,
  };

  if (level === 'error') {
    console.error(JSON.stringify(entry));
  } else if (level === 'warn') {
    console.warn(JSON.stringify(entry));
  } else {
    console.log(JSON.stringify(entry));
  }
}

export const logger = {
  info: (message: string, context?: LogContext) => log('info', message, context),
  warn: (message: string, context?: LogContext) => log('warn', message, context),
  error: (message: string, context?: LogContext) => log('error', message, context),

  /** Log an API error with endpoint context */
  apiError: (endpoint: string, method: string, error: unknown, extra?: LogContext) => {
    const msg = error instanceof Error ? error.message : String(error);
    log('error', msg, { endpoint, method, ...extra });
  },

  /** Log a rate limit hit */
  rateLimit: (endpoint: string, identifier: string, extra?: LogContext) => {
    log('warn', 'Rate limit exceeded', { endpoint, identifier, ...extra });
  },

  /** Log an auth failure (never log the token) */
  authFailure: (endpoint: string, method: string, reason: string, extra?: LogContext) => {
    log('warn', `Auth failure: ${reason}`, { endpoint, method, ...extra });
  },
};
