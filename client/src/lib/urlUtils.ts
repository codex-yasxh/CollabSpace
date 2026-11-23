/**
 * Validates and sanitizes a redirect target URL.
 * Accepts only relative paths starting with a single '/' (e.g. '/d/123').
 * Rejects protocol-relative paths ('//evil.com'), backslash paths ('/\\evil.com' or '\\evil.com'),
 * and absolute URLs with schemes ('https://evil.com', 'javascript:alert(1)').
 * Falls back to default fallback ('/').
 */
export function sanitizeRedirectUrl(target: string | null | undefined, fallback: string = "/"): string {
  if (!target || typeof target !== "string") {
    return fallback;
  }
  const trimmed = target.trim();
  // Must start with exactly one forward slash
  if (!trimmed.startsWith("/")) {
    return fallback;
  }
  // Reject protocol-relative '//' or Windows/escaped backslash '/\' or '\\'
  if (trimmed.startsWith("//") || trimmed.startsWith("/\\") || trimmed.startsWith("\\")) {
    return fallback;
  }
  // Reject any explicit protocol scheme (e.g. 'http:', 'https:', 'javascript:')
  if (trimmed.includes("://") || /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) {
    return fallback;
  }
  return trimmed;
}
