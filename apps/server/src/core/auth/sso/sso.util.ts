/**
 * Server-side mirror of the client's `safeRedirectPath`. Only same-origin,
 * scheme-less absolute paths survive, so a `?redirect=` value can never send a
 * user to another site after they sign in.
 */
export function safeRedirectPath(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  if (input.length === 0 || input.length > 2048) return null;
  if (/[\s\\]|\p{C}/u.test(input)) return null;
  if (!input.startsWith('/') || input.startsWith('//')) return null;
  if (input.toLowerCase().includes('://')) return null;
  if (/^\/[a-z][a-z0-9+\-.]*:/i.test(input)) return null;
  return input;
}
