import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { RedisService } from '@nestjs-labs/nestjs-ioredis';
import type { Redis } from 'ioredis';
import { createHash } from 'crypto';
import { isIP } from 'net';
import { Resolver } from 'node:dns/promises';
import { fetch as undiciFetch } from 'undici';
import { OutboundUrlError } from '../outbound/outbound-url.guard';
import { OutboundAgentFactory } from '../outbound/outbound-agent.factory';
import { EnvironmentService } from '../environment/environment.service';
import {
  LINK_PREVIEW_ACCEPT,
  LINK_PREVIEW_CACHE_PREFIX,
  LINK_PREVIEW_CACHE_TTL,
  LINK_PREVIEW_DNS_TIMEOUT_MS,
  LINK_PREVIEW_ERROR_CACHE_TTL,
  LINK_PREVIEW_FETCH,
  LINK_PREVIEW_MAX_BYTES,
  LINK_PREVIEW_MAX_REDIRECTS,
  LINK_PREVIEW_TIMEOUT_MS,
  LINK_PREVIEW_URL_MAX_LENGTH,
  LINK_PREVIEW_USER_AGENT,
} from './link-preview.constants';
import { LinkPreview, LinkPreviewHop } from './link-preview.types';
import {
  decodeHtml,
  getFileNameTitle,
  isSignInUrl,
  parseLinkPreview,
  readUntilHeadEnd,
} from './link-preview.utils';

@Injectable()
export class LinkPreviewService {
  private readonly logger = new Logger(LinkPreviewService.name);
  private readonly redis: Redis;
  private readonly fetchFn: typeof fetch;
  // c-ares resolver: unlike dns.lookup it stays off the libuv threadpool and honours a timeout
  private readonly resolver = new Resolver({
    timeout: LINK_PREVIEW_DNS_TIMEOUT_MS,
    tries: 1,
  });

  constructor(
    private readonly agentFactory: OutboundAgentFactory,
    private readonly environmentService: EnvironmentService,
    private readonly redisService: RedisService,
    @Optional() @Inject(LINK_PREVIEW_FETCH) fetchFn?: typeof fetch,
  ) {
    this.redis = this.redisService.getOrThrow();
    this.fetchFn = fetchFn ?? (undiciFetch as unknown as typeof fetch);
  }

  async getPreview(
    url: string,
    options?: { refresh?: boolean },
  ): Promise<LinkPreview | null> {
    const parsed = this.parseHttpUrl(url);
    if (!parsed) return null;
    parsed.hash = '';

    const key =
      LINK_PREVIEW_CACHE_PREFIX +
      createHash('sha256').update(parsed.href).digest('hex');

    if (!options?.refresh) {
      const cached = await this.redis.get(key);
      if (cached !== null) return JSON.parse(cached);
    }

    // Cloud refuses plain http, so try the same address over https.
    if (parsed.protocol === 'http:' && this.environmentService.isCloud()) {
      parsed.protocol = 'https:';
    }
    const result = await this.fetchPreview(parsed.href);

    await this.redis.set(
      key,
      result ? JSON.stringify(result) : 'null',
      'EX',
      result ? LINK_PREVIEW_CACHE_TTL : LINK_PREVIEW_ERROR_CACHE_TTL,
    );
    return result;
  }

  private parseHttpUrl(url: string): URL | null {
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:'
        ? parsed
        : null;
    } catch {
      return null;
    }
  }

  private async fetchPreview(url: string): Promise<LinkPreview | null> {
    const signal = AbortSignal.timeout(LINK_PREVIEW_TIMEOUT_MS);
    let current = url;
    let redirected = false;

    try {
      for (let hop = 0; hop <= LINK_PREVIEW_MAX_REDIRECTS; hop++) {
        signal.throwIfAborted();
        const { response, release } = await this.openHop(current, signal);
        try {
          const location = response.headers.get('location');
          if (response.status >= 300 && response.status < 400 && location) {
            await this.discard(response);
            current = new URL(location, current).href;
            redirected = true;
            continue;
          }
          if (!response.ok) {
            this.logger.debug(
              `Link preview got HTTP ${response.status} from ${new URL(current).host}`,
            );
            await this.discard(response);
            return null;
          }
          // Only a redirect that adds the sign-in signal blocks, so pages about sign-in keep their preview.
          if (redirected && isSignInUrl(current) && !isSignInUrl(url)) {
            await this.discard(response);
            return null;
          }
          return await this.readPreview(response, current);
        } finally {
          await release();
        }
      }
      return null;
    } catch (err) {
      this.logFailure(new URL(current).host, err);
      return null;
    }
  }

  private async failOnDnsTimeout(url: string): Promise<void> {
    const { hostname } = new URL(url);
    if (isIP(hostname.replace(/^\[|\]$/g, ''))) return;
    const results = await Promise.allSettled([
      this.resolver.resolve4(hostname),
      this.resolver.resolve6(hostname),
    ]);
    const timedOut = results.some(
      (r) =>
        r.status === 'rejected' &&
        ['ETIMEOUT', 'ECANCELLED'].includes((r.reason as any)?.code),
    );
    if (timedOut) {
      const err = new Error('DNS lookup timed out');
      err.name = 'DnsTimeoutError';
      throw err;
    }
  }

  private async openHop(
    url: string,
    signal: AbortSignal,
  ): Promise<LinkPreviewHop> {
    const init = {
      redirect: 'manual' as const,
      signal,
      headers: {
        accept: LINK_PREVIEW_ACCEPT,
        'user-agent': LINK_PREVIEW_USER_AGENT,
      },
    };

    await this.failOnDnsTimeout(url);

    const lease = await this.agentFactory.lease(url, undefined, {
      viaProxy: true,
      publicOnly: true,
    });
    try {
      const response = await this.fetchFn(url, {
        ...init,
        dispatcher: lease.dispatcher,
      } as RequestInit);
      return { response, release: lease.release };
    } catch (err) {
      await lease.release();
      throw err;
    }
  }

  private async readPreview(
    response: Response,
    finalUrl: string,
  ): Promise<LinkPreview> {
    const contentType = response.headers.get('content-type');
    const type = (contentType ?? '').toLowerCase();

    if (type.startsWith('image/')) {
      await this.discard(response);
      const title = getFileNameTitle(finalUrl);
      return finalUrl.length > LINK_PREVIEW_URL_MAX_LENGTH
        ? { title }
        : { title, image: finalUrl };
    }
    if (!type.includes('html')) {
      await this.discard(response);
      return { title: getFileNameTitle(finalUrl) };
    }

    const bytes = await readUntilHeadEnd(response.body, LINK_PREVIEW_MAX_BYTES);
    return parseLinkPreview(decodeHtml(bytes, contentType), finalUrl);
  }

  private async discard(response: Response): Promise<void> {
    await response.body?.cancel().catch(() => undefined);
  }

  private logFailure(host: string, err: unknown): void {
    const { name, message, cause } = (err ?? {}) as Error & {
      cause?: { code?: string };
    };
    if (err instanceof OutboundUrlError) {
      this.logger.debug(`Link preview refused for ${host}: ${message}`);
    } else if (name === 'DnsTimeoutError') {
      this.logger.debug(`DNS timed out for ${host}`);
    } else if (name === 'TimeoutError' || name === 'AbortError') {
      this.logger.debug(`Link preview timed out for ${host}`);
    } else {
      this.logger.warn(
        `Link preview failed for ${host}: ${message ?? String(err)}${cause?.code ? ` (${cause.code})` : ''}`,
      );
    }
  }
}
