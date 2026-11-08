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
import {
  UNSPLASH_API_URL,
  UNSPLASH_CACHE_PREFIX,
  UNSPLASH_DEFAULT_TOPIC,
  UNSPLASH_DISABLED_MESSAGE,
  UNSPLASH_LIST_TTL_MS,
  UNSPLASH_PER_PAGE,
  UNSPLASH_PHOTO_ID_PATTERN,
  UNSPLASH_PHOTO_TTL_MS,
  UNSPLASH_RATE_LIMIT_MESSAGE,
  UNSPLASH_REQUEST_TIMEOUT_MS,
  UNSPLASH_UNAVAILABLE_MESSAGE,
} from './unsplash.constants';
import {
  UnsplashCover,
  UnsplashPhotoList,
  UnsplashPhotoRecord,
} from './unsplash.types';
import {
  isRateLimited,
  normalizeQuery,
  toPhotoRecord,
  toPhotoRecords,
  toPublicPhoto,
} from './unsplash.utils';

type PhotoPage = { photos: UnsplashPhotoRecord[]; hasMore: boolean };

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

    // a chosen photo is usually one just listed, so it needs no lookup
    await Promise.all(photos.map((photo) => this.cachePhoto(photo)));

    const result = { items: photos.map(toPublicPhoto), hasMore };
    await this.cacheManager.set(cacheKey, result, UNSPLASH_LIST_TTL_MS);
    return result;
  }

  async getCover(photoId: string): Promise<UnsplashCover> {
    this.assertEnabled();
    if (!UNSPLASH_PHOTO_ID_PATTERN.test(photoId)) {
      throw new BadRequestException('Invalid cover photo');
    }

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

  private async searchPhotos(query: string, page: number): Promise<PhotoPage> {
    const response = await this.request(
      this.buildUrl('/search/photos', {
        query,
        page,
        per_page: UNSPLASH_PER_PAGE,
        orientation: 'landscape',
        content_filter: 'high',
      }),
    );
    const body = (await response.json()) as {
      total_pages?: number;
      results?: unknown;
    };

    return {
      photos: toPhotoRecords(body?.results),
      hasMore: page < Number(body?.total_pages ?? 0),
    };
  }

  private async listTopicPhotos(page: number): Promise<PhotoPage> {
    const response = await this.request(
      this.buildUrl(`/topics/${UNSPLASH_DEFAULT_TOPIC}/photos`, {
        page,
        per_page: UNSPLASH_PER_PAGE,
        orientation: 'landscape',
      }),
    );
    const results = await response.json();
    const total = Number(response.headers.get('x-total'));
    const hasMore =
      total > 0
        ? page * UNSPLASH_PER_PAGE < total
        : Array.isArray(results) && results.length === UNSPLASH_PER_PAGE;

    return { photos: toPhotoRecords(results), hasMore };
  }

  private async fetchPhoto(photoId: string): Promise<UnsplashPhotoRecord> {
    const response = await this.request(this.buildUrl(`/photos/${photoId}`));
    const photo = toPhotoRecord(await response.json());
    if (!photo) {
      throw new ServiceUnavailableException(UNSPLASH_UNAVAILABLE_MESSAGE);
    }
    await this.cachePhoto(photo);
    return photo;
  }

  // Unsplash asks apps to report each photo a user picks
  private async trackDownload(photo: UnsplashPhotoRecord): Promise<void> {
    try {
      await this.request(photo.downloadLocation);
    } catch (err) {
      this.logger.warn(
        `Failed to report Unsplash download for ${photo.id}: ${(err as Error).message}`,
      );
    }
  }

  private async request(url: string): Promise<Response> {
    let response: Response;
    try {
      response = await fetch(url, {
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
    if (response.status === 404) {
      throw new NotFoundException('Photo not found');
    }

    this.logger.warn(`Unsplash responded with status ${response.status}`);
    throw new ServiceUnavailableException(UNSPLASH_UNAVAILABLE_MESSAGE);
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
