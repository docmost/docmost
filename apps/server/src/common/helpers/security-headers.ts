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

/**
 * Returns the Content-Security-Policy value to use for an attachment response.
 *
 * PDFs are rendered inside an <iframe> by the browser's built-in PDF viewer.
 * That viewer loads resources via blob: URLs and browser-internal origins,
 * which `default-src 'self'` would block — causing an empty frame (issue #2347).
 * For PDF attachments we therefore omit `default-src` while keeping the
 * `base-uri` and `object-src` restrictions.
 *
 * All other file types receive the stricter policy that limits sub-resource
 * loading to same-origin.
 */
export function resolveAttachmentCsp(fileExt: string): string {
  if (fileExt === '.pdf') {
    return "base-uri 'none'; object-src 'none';";
  }
  return "base-uri 'none'; object-src 'self'; default-src 'self';";
}
