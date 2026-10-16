import {
  ProviderApiError,
  TokenInvalidError,
  UnfurlForbiddenError,
} from '../registry/integration-provider.interface';
import { proxyFetch } from '../../../common/proxy-fetch';

export const INTEGRATION_HTTP_TIMEOUT_MS = 10_000;

// Far above any unfurl or token response we read.
export const MAX_PROVIDER_RESPONSE_BYTES = 2 * 1024 * 1024;

// Enough of the body to log why a provider refused ("insufficient scope", ...).
const MAX_ERROR_BODY_CHARS = 300;

// Buffers the body into a new Response, giving up as soon as it passes the cap.
export async function readCappedResponse(
  providerName: string,
  response: Response,
): Promise<Response> {
  const tooLarge = () =>
    new ProviderApiError(providerName, 502, 'response too large');

  if (
    Number(response.headers.get('content-length')) > MAX_PROVIDER_RESPONSE_BYTES
  ) {
    void response.body?.cancel().catch(() => undefined);
    throw tooLarge();
  }

  const chunks: Uint8Array[] = [];
  let received = 0;
  if (response.body) {
    const reader = response.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > MAX_PROVIDER_RESPONSE_BYTES) {
        void reader.cancel().catch(() => undefined);
        throw tooLarge();
      }
      chunks.push(value);
    }
  }

  return new Response(received > 0 ? Buffer.concat(chunks) : null, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}

async function readErrorBody(
  providerName: string,
  response: Response,
): Promise<string> {
  try {
    const capped = await readCappedResponse(providerName, response);
    const text = await capped.text();
    return text.replace(/\s+/g, ' ').trim().slice(0, MAX_ERROR_BODY_CHARS);
  } catch {
    return '';
  }
}

export async function providerApiFetch(
  providerName: string,
  url: string,
  init: RequestInit = {},
): Promise<Response> {
  const response = await proxyFetch(url, {
    ...init,
    redirect: 'manual',
    signal: AbortSignal.timeout(INTEGRATION_HTTP_TIMEOUT_MS),
  });

  // Don't follow redirects: a 3xx could hop to an internal address.
  if (response.status >= 300 && response.status < 400) {
    throw new ProviderApiError(providerName, 502, 'unexpected redirect');
  }

  if (response.status === 401) {
    // Azure DevOps puts its TF error code only in x-tfs-serviceerror.
    const reasonHeaders = ['www-authenticate', 'x-tfs-serviceerror']
      .map((name) => response.headers.get(name)?.slice(0, MAX_ERROR_BODY_CHARS))
      .filter(Boolean);
    throw new TokenInvalidError(
      [
        `${providerName} API error: 401 Unauthorized`,
        await readErrorBody(providerName, response),
        ...reasonHeaders,
      ]
        .filter(Boolean)
        .join(' '),
    );
  }
  if (!response.ok) {
    const body = await readErrorBody(providerName, response);

    // GitHub also uses 403 for secondary rate limits, which stay real errors.
    const rateLimited =
      response.headers.get('retry-after') !== null ||
      response.headers.get('x-ratelimit-remaining') === '0';
    if (response.status === 403 && !rateLimited) {
      throw new UnfurlForbiddenError(
        `${providerName} API error: 403 ${body}`.trimEnd(),
      );
    }

    throw new ProviderApiError(
      providerName,
      response.status,
      `${response.statusText} ${body}`.trim(),
    );
  }
  return readCappedResponse(providerName, response);
}
