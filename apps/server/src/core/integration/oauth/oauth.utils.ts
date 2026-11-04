export const COMPLETION_FALLBACK_REDIRECT =
  '/settings/account/connections?error=oauth_failed';

export function nonceCookieName(type: string): string {
  return `integration_oauth_${type}`;
}
