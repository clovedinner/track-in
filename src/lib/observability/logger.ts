type LogContext = Record<string, unknown>;
type LogLevel = "error" | "info" | "warn";

const sensitiveKeyPattern = /(authorization|cookie|password|secret|signature|token|api[-_]?key)/i;
const clickIdKeyPattern = /(^|[_-])cid$|click[_-]?id/i;
const redactedValue = "[REDACTED]";

function sanitizeValue(value: unknown, key?: string): unknown {
  if ((key !== undefined && sensitiveKeyPattern.test(key)) || (key !== undefined && clickIdKeyPattern.test(key))) {
    return redactedValue;
  }

  if (typeof value === "string") {
    try {
      const url = new URL(value);
      url.search = "";
      return url.toString();
    } catch {
      return value;
    }
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item));
  }

  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([objectKey, objectValue]) => [
        objectKey,
        sanitizeValue(objectValue, objectKey),
      ]),
    );
  }

  return value;
}

function writeLog(level: LogLevel, event: string, context: LogContext = {}): void {
  const entry = {
    context: sanitizeValue(context),
    event,
    level,
    timestamp: new Date().toISOString(),
  };
  const serializedEntry = JSON.stringify(entry);

  if (level === "error") {
    console.error(serializedEntry);
    return;
  }

  if (level === "warn") {
    console.warn(serializedEntry);
    return;
  }

  console.info(serializedEntry);
}

export const logger = {
  error(event: string, context?: LogContext): void {
    writeLog("error", event, context);
  },
  info(event: string, context?: LogContext): void {
    writeLog("info", event, context);
  },
  warn(event: string, context?: LogContext): void {
    writeLog("warn", event, context);
  },
};
