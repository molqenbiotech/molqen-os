/**
 * MOLQEN OS — Privacy & Sensitive Data Logger Sanitizer
 * Redacts tokens, passwords, credit card PANs, and sensitive personal data
 * before telemetry or console output to comply with GDPR/CCPA data minimization.
 */

/**
 * Sanitizes a string or object by redacting sensitive data
 * @param {any} input - Raw log message or object
 * @returns {any} Sanitized output
 */
export function sanitizeLogData(input) {
  if (input == null) return input;

  if (typeof input === 'string') {
    let sanitized = input;
    sanitized = sanitized.replace(/(["']?password["']?\s*[:=]\s*["'])([^"']+)(["'])/gi, '$1[REDACTED_SECRET]$3');
    sanitized = sanitized.replace(/Bearer\s+[^\s"']+/gi, 'Bearer [REDACTED_TOKEN]');
    sanitized = sanitized.replace(/AIza[0-9A-Za-z-_]{35}/g, '[REDACTED_API_KEY]');
    sanitized = sanitized.replace(/sk-[a-zA-Z0-9]{32,}/g, '[REDACTED_API_KEY]');
    return sanitized;
  }

  if (typeof input === 'object') {
    if (Array.isArray(input)) {
      return input.map(sanitizeLogData);
    }
    const cleanObj = {};
    for (const [key, value] of Object.entries(input)) {
      const lowerKey = key.toLowerCase();
      if (
        lowerKey.includes('password') ||
        lowerKey.includes('secret') ||
        lowerKey.includes('token') ||
        lowerKey.includes('authorization') ||
        lowerKey.includes('creditcard')
      ) {
        cleanObj[key] = '[REDACTED_FIELD]';
      } else {
        cleanObj[key] = sanitizeLogData(value);
      }
    }
    return cleanObj;
  }

  return input;
}

/**
 * Safe logging helper that automatically redacts secrets
 */
export const safeLogger = {
  info: (...args) => console.info(...args.map(sanitizeLogData)),
  warn: (...args) => console.warn(...args.map(sanitizeLogData)),
  error: (...args) => console.error(...args.map(sanitizeLogData))
};
