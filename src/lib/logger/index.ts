import pino, { type Logger } from "pino";
import { PINO_REDACT_PATHS } from "./redact";
import { getRequestContext } from "./request-context";

const LOG_LEVEL = (process.env.LOG_LEVEL ?? "info").toLowerCase() as pino.Level;
const VALID_LEVELS: pino.Level[] = [
  "trace",
  "debug",
  "info",
  "warn",
  "error",
  "fatal",
];
const level = VALID_LEVELS.includes(LOG_LEVEL) ? LOG_LEVEL : "info";

/**
 * Central Pino logger instance. Writes structured JSON to stdout (LOG-001, LOG-002).
 * Level is controlled by LOG_LEVEL env (default info); production should use info (LOG-006).
 */
const baseLogger = pino({
  level,
  formatters: {
    level: (label) => ({ level: label }),
  },
  redact: {
    paths: PINO_REDACT_PATHS,
    censor: "[REDACTED]",
  },
});

export type { Logger };

export type LoggerContext = {
  requestId?: string;
  userId?: string | null;
};

/**
 * Returns a child logger that includes requestId and userId in every log line when provided.
 * If context is not passed, reads from AsyncLocalStorage (request context set by runWithRequestContext).
 *
 * @param context - Optional { requestId, userId }; when omitted, uses current request context
 * @returns Child logger with bindings for requestId and userId
 */
export function getLogger(context?: LoggerContext): Logger {
  const ctx = context ?? getRequestContext();

  const bindings: Record<string, string | undefined> = {};

  if (ctx?.requestId) {
    bindings.requestId = ctx.requestId;
  }
  if (ctx?.userId !== undefined && ctx?.userId !== null) {
    bindings.userId = ctx.userId;
  }

  if (Object.keys(bindings).length === 0) {
    return baseLogger;
  }

  return baseLogger.child(bindings);
}

export { redactMetadata, SENSITIVE_KEYS } from "./redact";
export {
  getRequestContext,
  generateRequestId,
  runWithRequestContext,
  type RequestContext,
} from "./request-context";
