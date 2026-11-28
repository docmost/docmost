import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { EnvironmentService } from '../environment/environment.service';
import { proxyFetch } from '../../common/proxy-fetch';
import {
  LINK_PREVIEW_IFRAMELY_FETCH,
  LINK_PREVIEW_IFRAMELY_TIMEOUT_MS,
  LINK_PREVIEW_USER_AGENT,
} from './link-preview.constants';
import { IframelyResponse, IframelyResult } from './link-preview.types';
import {
  isIframelyAccountError,
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
    const query = new URLSearchParams({ url });
    const apiKey = this.environmentService.getIframelyApiKey();
    if (apiKey) query.set('api_key', apiKey);

    const response = await this.fetchFn(`${base}/iframely?${query}`, {
      headers: {
        accept: 'application/json',
        'user-agent': LINK_PREVIEW_USER_AGENT,
      },
      signal: AbortSignal.timeout(LINK_PREVIEW_IFRAMELY_TIMEOUT_MS),
    });

    if (!response.ok) {
      this.logger.debug(`Iframely answered with HTTP ${response.status}`);
      return null;
    }

    let body: IframelyResponse;
    try {
      body = await response.json();
    } catch {
      this.logger.warn('Iframely returned a reply that is not JSON');
      return null;
    }

    if (typeof body?.code === 'string' || body?.error) {
      const code = typeof body.code === 'string' ? body.code : 'unknown';
      if (isIframelyAccountError(code)) {
        this.logger.warn(`Iframely rejected the request: ${code}`);
      } else {
        this.logger.debug(`Iframely could not preview the link: ${code}`);
      }
      return null;
    }

    const reached = body.url ?? body.meta?.canonical;
    if (reached && isSignInUrl(reached) && !isSignInUrl(url)) return null;

    return {
      preview: parseIframelyPreview(body, url),
      reportedUrl: body.url,
    };
  }
}
