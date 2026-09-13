/**
 * Production Structured Logger
 *
 * Provides safe, structured JSON telemetry in production environments.
 * Automatically scrubs sensitive tokens, passwords, and authorization headers.
 */

type LogLevel = 'info' | 'warn' | 'error';

interface LogPayload {
  timestamp: string;
  level: LogLevel;
  message: string;
  [key: string]: unknown;
}

// Patterns of sensitive values to redact
const SENSITIVE_PATTERNS = [
  /Bearer\s+[A-Za-z0-9._~+/-]+=*/gi,
  /postgres(ql)?:\/\/[^:]+:([^@]+)@/gi,
  /"(CANVAS_TOKEN|VAPID_PRIVATE_KEY|DATABASE_URL|DIRECT_URL|CRON_SECRET)":\s*"[^"]+"/gi,
];

function sanitize(value: unknown): unknown {
  if (value === null || value === undefined) return value;

  if (typeof value === 'string') {
    let sanitized = value;
    // Redact Bearer tokens
    sanitized = sanitized.replace(/Bearer\s+[^\s"']+/gi, 'Bearer [REDACTED]');
    // Redact postgres connection credentials
    sanitized = sanitized.replace(
      /postgres(ql)?:\/\/([^:]+):([^@]+)@/gi,
      'postgres://$2:[REDACTED]@',
    );
    return sanitized;
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: sanitize(value.message),
      stack: process.env.NODE_ENV === 'development' ? value.stack : undefined,
    };
  }

  if (Array.isArray(value)) {
    return value.map(sanitize);
  }

  if (typeof value === 'object') {
    const cleanObj: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      const lowerKey = k.toLowerCase();
      if (
        lowerKey.includes('token') ||
        lowerKey.includes('secret') ||
        lowerKey.includes('password') ||
        lowerKey.includes('key') ||
        lowerKey.includes('auth')
      ) {
        cleanObj[k] = '[REDACTED]';
      } else {
        cleanObj[k] = sanitize(v);
      }
    }
    return cleanObj;
  }

  return value;
}

function output(level: LogLevel, message: string, meta?: Record<string, unknown>) {
  const payload: LogPayload = {
    timestamp: new Date().toISOString(),
    level,
    message: String(sanitize(message)),
  };

  if (meta) {
    for (const [key, val] of Object.entries(meta)) {
      payload[key] = sanitize(val);
    }
  }

  const formatted = JSON.stringify(payload);

  switch (level) {
    case 'info':
      console.info(formatted);
      break;
    case 'warn':
      console.warn(formatted);
      break;
    case 'error':
      console.error(formatted);
      break;
  }
}

export const logger = {
  info(message: string, meta?: Record<string, unknown>) {
    output('info', message, meta);
  },
  warn(message: string, meta?: Record<string, unknown>) {
    output('warn', message, meta);
  },
  error(message: string, meta?: Record<string, unknown>) {
    output('error', message, meta);
  },
};
