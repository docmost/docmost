export function nonceCookieName(type: string): string {
  return `integration_oauth_${type}`;
}
