/**
 * Validates that a user-supplied URL uses an explicit safe web protocol (http or https).
 * Rejects javascript:, data:, file:, vbscript:, and malformed URLs.
 */
export function getSafeExternalUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.href;
    }
  } catch {
    return null;
  }

  return null;
}
