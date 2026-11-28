import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { EnvironmentService } from '../environment/environment.service';
import { proxyFetch } from '../../common/proxy-fetch';
import {
  LINK_PREVIEW_IFRAMELY_FETCH,
  LINK_PREVIEW_IFRAMELY_TIMEOUT_MS,
  LINK_PREVIEW_USER_AGENT,
} from './link-preview.constants';
import { IframelyResult } from './link-preview.types';
import {
  describeIframelyOrigin,
  getIframelyErrorCode,
  isIframelyAccountOrServiceError,
  isIframelyReply,
  isSignInUrl,
  parseIframelyPreview,
} from './link-preview.utils';

@Injectable()
export class IframelyClient {
  private readonly logger = new Logger(IframelyClient.name);
  private readonly fetchFn: typeof fetch;

  constructor(
    private readonly environmentService: EnvironmentService,
    @Optional() @Inject(LINK_PREVIEW_IFRAMELY_FETCH) fetchFn?: typeof fetch,
  ) {
    this.fetchFn = fetchFn ?? proxyFetch;
  }

  async getPreview(url: string): Promise<IframelyResult | null> {
    const base = this.environmentService.getIframelyUrl().replace(/\/+$/, '');
    const origin = describeIframelyOrigin(base);
    const query = new URLSearchParams({ url });
    const apiKey = this.environmentService.getIframelyApiKey();
    if (apiKey) query.set('api_key', apiKey);

    let response: Response;
    let text: string;
    try {
      response = await this.fetchFn(`${base}/iframely?${query}`, {
        headers: {
          accept: 'application/json',
          'user-agent': LINK_PREVIEW_USER_AGENT,
        },
        signal: AbortSignal.timeout(LINK_PREVIEW_IFRAMELY_TIMEOUT_MS),
      });
      text = await response.text();
    } catch (err) {
      this.logRequestFailure(origin, err);
      return null;
    }

    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      body = undefined;
    }

    const errorCode = getIframelyErrorCode(body);
    if (errorCode) {
      if (isIframelyAccountOrServiceError(errorCode)) {
        this.logger.warn(
          `Iframely at ${origin} returned an error: ${errorCode}`,
        );
      } else {
        this.logger.debug(`Iframely could not preview the link: ${errorCode}`);
      }
      return null;
    }
    if (!response.ok) {
      this.logger.warn(
        `Iframely at ${origin} answered HTTP ${response.status}`,
      );
      return null;
    }
    if (!isIframelyReply(body)) {
      this.logger.warn(`Iframely at ${origin} did not send an Iframely reply`);
      return null;
    }

    const reportedUrl = body.url ?? body.meta?.canonical;
    if (reportedUrl && isSignInUrl(reportedUrl) && !isSignInUrl(url)) {
      return null;
    }

    return { preview: parseIframelyPreview(body, url), reportedUrl };
  }

  // Error messages can hold the request URL, which carries the API key.
  private logRequestFailure(origin: string, err: unknown): void {
    const { name, cause } = (err ?? {}) as Error & {
      cause?: { code?: unknown };
    };
    if (name === 'TimeoutError') {
      this.logger.warn(
        `Request to Iframely at ${origin} timed out after ${LINK_PREVIEW_IFRAMELY_TIMEOUT_MS / 1000} s`,
      );
      return;
    }
    const code = typeof cause?.code === 'string' ? ` (${cause.code})` : '';
    this.logger.warn(
      `Request to Iframely at ${origin} failed: ${name ?? 'unknown error'}${code}`,
    );
  }
}
