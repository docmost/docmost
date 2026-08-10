import {
  ProviderApiError,
  TokenInvalidError,
  UnfurlForbiddenError,
} from '../registry/integration-provider.interface';
import { proxyFetch } from '../../../common/proxy-fetch';

export const INTEGRATION_HTTP_TIMEOUT_MS = 10_000;

// Providers explain refusals in the response body ("insufficient scope",
// "not allowed", ...); without it a 403 is undiagnosable from the logs.
const MAX_ERROR_BODY_CHARS = 300;

async function readErrorBody(response: Response): Promise<string> {
  try {
    const text = await response.text();
    return text.replace(/\s+/g, ' ').trim().slice(0, MAX_ERROR_BODY_CHARS);
  } catch {
    return '';
  }
}

// Bounds every provider call and maps 401 to TokenInvalidError so callers can retire the connection.
export async function providerApiFetch(
  providerName: string,
  url: string,
  init: RequestInit = {},
): Promise<Response> {
  const response = await proxyFetch(url, {
    ...init,
    signal: AbortSignal.timeout(INTEGRATION_HTTP_TIMEOUT_MS),
  });

  if (response.status === 401) {
    throw new TokenInvalidError(
      `${providerName} API error: 401 Unauthorized ${await readErrorBody(response)}`.trimEnd(),
    );
  }
  if (!response.ok) {
    const body = await readErrorBody(response);

    // 403 normally means the viewer simply can't reach that resource, which is
    // an expected "no card" outcome. GitHub also spends 403 on secondary rate
    // limits, so quota signals stay a real error an operator can see.
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
  return response;
}
