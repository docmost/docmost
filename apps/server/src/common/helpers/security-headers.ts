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
