export type SecurityHeader = { name: string; value: string };

export function resolveFrameHeader(
  iframeEmbedAllowed: boolean,
  allowedOrigins: string[],
): SecurityHeader | null {
  if (!iframeEmbedAllowed) {
    return { name: 'X-Frame-Options', value: 'SAMEORIGIN' };
  }

  if (allowedOrigins.length === 0) {
    return null;
  }

  return {
    name: 'Content-Security-Policy',
    value: `frame-ancestors 'self' ${allowedOrigins.join(' ')}`,
  };
}

// Deny OAuth consent in iframe
export const OAUTH_CONSENT_PATH = '/oauth/consent';

export function resolveFrameHeadersForPath(
  path: string,
  configuredHeader: SecurityHeader | null,
): SecurityHeader[] {
  if (path === OAUTH_CONSENT_PATH || path.startsWith(`${OAUTH_CONSENT_PATH}/`)) {
    return [
      { name: 'X-Frame-Options', value: 'DENY' },
      { name: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
    ];
  }
  return configuredHeader ? [configuredHeader] : [];
}
