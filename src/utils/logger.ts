const LOG_PREFIX = '[generic-rag]';

type LogArgs = unknown[];

function tag(scope?: string) {
  return scope ? `${LOG_PREFIX}[${scope}]` : LOG_PREFIX;
}

/** A console logger that prefixes every message with `[generic-rag]`. */
export interface Logger {
  debug: (...args: LogArgs) => void;
  info: (...args: LogArgs) => void;
  warn: (...args: LogArgs) => void;
  error: (...args: LogArgs) => void;
}

/**
 * Creates a {@link Logger}, optionally scoped as `[generic-rag][scope]`.
 * @param scope - Optional namespace appended to the log prefix.
 * @returns A logger with `debug`/`info`/`warn`/`error` methods.
 */
export function createLogger(scope?: string): Logger {
  const prefix = tag(scope);
  return {
    debug: (...args) => console.debug(prefix, ...args),
    info: (...args) => console.info(prefix, ...args),
    warn: (...args) => console.warn(prefix, ...args),
    error: (...args) => console.error(prefix, ...args),
  };
}

/** The default, unscoped {@link Logger}. */
export const logger = createLogger();
