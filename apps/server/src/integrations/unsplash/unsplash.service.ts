import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { EnvironmentService } from '../environment/environment.service';
import { proxyFetch } from '../../common/proxy-fetch';
import {
  UNSPLASH_API_URL,
  UNSPLASH_CACHE_PREFIX,
  UNSPLASH_COVER_LIMIT,
  UNSPLASH_COVER_WINDOW_MS,
  UNSPLASH_DEFAULT_TOPIC,
  UNSPLASH_DISABLED_MESSAGE,
  UNSPLASH_LIST_TTL_MS,
  UNSPLASH_MAX_PAGE,
  UNSPLASH_PER_PAGE,
  UNSPLASH_PHOTO_ID_PATTERN,
  UNSPLASH_PHOTO_TTL_MS,
  UNSPLASH_RATE_LIMIT_MESSAGE,
  UNSPLASH_REQUEST_TIMEOUT_MS,
  UNSPLASH_UNAVAILABLE_MESSAGE,
} from './unsplash.constants';
import {
  UnsplashCover,
  UnsplashCoverBudget,
  UnsplashPhotoList,
  UnsplashPhotoPage,
  UnsplashPhotoRecord,
} from './unsplash.types';
import {
  discardBody,
  isRateLimited,
  normalizeQuery,
  toPhotoRecord,
  toPhotoRecords,
  toPublicPhoto,
} from './unsplash.utils';

@Injectable()
export class UnsplashService {
  private readonly logger = new Logger(UnsplashService.name);

  constructor(
    private readonly environmentService: EnvironmentService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  isEnabled(): boolean {
    return Boolean(this.environmentService.getUnsplashAccessKey());
  }

  async listPhotos(query: string, page: number): Promise<UnsplashPhotoList> {
    this.assertEnabled();
    const search = normalizeQuery(query);
    const cacheKey = `${UNSPLASH_CACHE_PREFIX}list:${page}:${search}`;
    const cached = await this.cacheManager.get<UnsplashPhotoList>(cacheKey);
    if (cached) return cached;

    const { photos, hasMore } = search
      ? await this.searchPhotos(search, page)
      : await this.listTopicPhotos(page);

    // only wallpapers are kept for picks, search results carry the search term in their addresses
    if (!search) {
      await Promise.all(photos.map((photo) => this.cachePhoto(photo)));
    }

    const result = {
      items: photos.map(toPublicPhoto),
      hasMore: hasMore && page < UNSPLASH_MAX_PAGE,
    };
    await this.cacheManager.set(cacheKey, result, UNSPLASH_LIST_TTL_MS);
    return result;
  }

  async getCover(photoId: string, userId: string): Promise<UnsplashCover> {
    this.assertEnabled();
    if (!UNSPLASH_PHOTO_ID_PATTERN.test(photoId)) {
      throw new BadRequestException('Invalid cover photo');
    }
    await this.takeCoverBudget(userId);

    const photo =
      (await this.cacheManager.get<UnsplashPhotoRecord>(
        this.photoCacheKey(photoId),
      )) ?? (await this.fetchPhoto(photoId));

    void this.trackDownload(photo);

    return {
      coverPhoto: photo.coverUrl,
      coverAttribution: {
        source: 'unsplash',
        photoId: photo.id,
        authorName: photo.authorName,
        authorUsername: photo.authorUsername,
      },
    };
  }

  private async searchPhotos(
    query: string,
    page: number,
  ): Promise<UnsplashPhotoPage> {
    const body = await this.requestJson<{
      total_pages?: number;
      results?: unknown;
    }>(
      this.buildUrl('/search/photos', {
        query,
        page,
        per_page: UNSPLASH_PER_PAGE,
        orientation: 'landscape',
        content_filter: 'high',
      }),
    );
    this.assertList(body?.results);

    return {
      photos: toPhotoRecords(body.results),
      hasMore: page < Number(body.total_pages ?? 0),
    };
  }

  private async listTopicPhotos(page: number): Promise<UnsplashPhotoPage> {
    let total = 0;
    const results = await this.requestJson<unknown>(
      this.buildUrl(`/topics/${UNSPLASH_DEFAULT_TOPIC}/photos`, {
        page,
        per_page: UNSPLASH_PER_PAGE,
        orientation: 'landscape',
      }),
      (response) => (total = Number(response.headers.get('x-total'))),
    );
    this.assertList(results);

    const hasMore =
      total > 0
        ? page * UNSPLASH_PER_PAGE < total
        : results.length === UNSPLASH_PER_PAGE;
    return { photos: toPhotoRecords(results), hasMore };
  }

  private async fetchPhoto(photoId: string): Promise<UnsplashPhotoRecord> {
    const photo = toPhotoRecord(
      await this.requestJson<unknown>(this.buildUrl(`/photos/${photoId}`)),
    );
    if (!photo) {
      throw new ServiceUnavailableException(UNSPLASH_UNAVAILABLE_MESSAGE);
    }
    await this.cachePhoto(photo);
    return photo;
  }

  // Unsplash asks apps to report each photo a user picks
  private async trackDownload(photo: UnsplashPhotoRecord): Promise<void> {
    try {
      await discardBody(await this.request(photo.downloadLocation));
    } catch (err) {
      this.logger.warn(
        `Failed to report Unsplash download for ${photo.id}: ${(err as Error).message}`,
      );
    }
  }

  // page updates have no throttle, so picking a photo has its own per-user limit
  private async takeCoverBudget(userId: string): Promise<void> {
    const key = `${UNSPLASH_CACHE_PREFIX}covers:${userId}`;
    const now = Date.now();
    const saved = await this.cacheManager.get<UnsplashCoverBudget>(key);
    const budget =
      saved && saved.resetAt > now
        ? saved
        : { used: 0, resetAt: now + UNSPLASH_COVER_WINDOW_MS };

    if (budget.used >= UNSPLASH_COVER_LIMIT) {
      throw new HttpException('Too many requests', HttpStatus.TOO_MANY_REQUESTS);
    }
    await this.cacheManager.set(
      key,
      { used: budget.used + 1, resetAt: budget.resetAt },
      budget.resetAt - now,
    );
  }

  private async requestJson<T>(
    url: string,
    onResponse?: (response: Response) => void,
  ): Promise<T> {
    const response = await this.request(url);
    onResponse?.(response);
    try {
      return (await response.json()) as T;
    } catch {
      this.logger.warn('Unsplash returned a response that is not JSON');
      throw new ServiceUnavailableException(UNSPLASH_UNAVAILABLE_MESSAGE);
    }
  }

  private async request(url: string): Promise<Response> {
    let response: Response;
    try {
      response = await proxyFetch(url, {
        headers: {
          Authorization: `Client-ID ${this.environmentService.getUnsplashAccessKey()}`,
          'Accept-Version': 'v1',
        },
        signal: AbortSignal.timeout(UNSPLASH_REQUEST_TIMEOUT_MS),
      });
    } catch (err) {
      this.logger.warn(`Unsplash request failed: ${(err as Error).message}`);
      throw new ServiceUnavailableException(UNSPLASH_UNAVAILABLE_MESSAGE);
    }

    if (response.ok) return response;
    if (await isRateLimited(response)) {
      throw new HttpException(
        UNSPLASH_RATE_LIMIT_MESSAGE,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    await discardBody(response);
    if (response.status === 404) {
      throw new NotFoundException('Photo not found');
    }

    this.logger.warn(`Unsplash responded with status ${response.status}`);
    throw new ServiceUnavailableException(UNSPLASH_UNAVAILABLE_MESSAGE);
  }

  // an unexpected answer must not be cached as an empty list
  private assertList(value: unknown): asserts value is unknown[] {
    if (!Array.isArray(value)) {
      this.logger.warn('Unsplash returned an unexpected list');
      throw new ServiceUnavailableException(UNSPLASH_UNAVAILABLE_MESSAGE);
    }
  }

  private buildUrl(
    path: string,
    params: Record<string, string | number> = {},
  ): string {
    const url = new URL(path, UNSPLASH_API_URL);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, String(value));
    }
    return url.toString();
  }

  private cachePhoto(photo: UnsplashPhotoRecord) {
    return this.cacheManager.set(
      this.photoCacheKey(photo.id),
      photo,
      UNSPLASH_PHOTO_TTL_MS,
    );
  }

  private photoCacheKey(photoId: string): string {
    return `${UNSPLASH_CACHE_PREFIX}photo:${photoId}`;
  }

  private assertEnabled(): void {
    if (!this.isEnabled()) {
      throw new BadRequestException(UNSPLASH_DISABLED_MESSAGE);
    }
  }
}
