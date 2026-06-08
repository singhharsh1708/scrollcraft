type LogLevel = "info" | "warn" | "error";

interface LogPayload {
  [key: string]: unknown;
}

function log(level: LogLevel, message: string, payload?: LogPayload) {
  const entry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...payload,
  };

  if (process.env.NODE_ENV === "production") {
    // Structured JSON — queryable in Vercel/Datadog/etc.
    console[level](JSON.stringify(entry));
  } else {
    const { timestamp, ...rest } = entry;
    console[level](`[${timestamp}] ${level.toUpperCase()} ${message}`, Object.keys(rest).length ? rest : "");
  }
}

export const logger = {
  info: (message: string, payload?: LogPayload) => log("info", message, payload),
  warn: (message: string, payload?: LogPayload) => log("warn", message, payload),
  error: (message: string, payload?: LogPayload) => log("error", message, payload),
};
