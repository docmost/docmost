import {
  UNSPLASH_API_HOST,
  UNSPLASH_COLOR_PATTERN,
  UNSPLASH_COVER_IMAGE_PARAMS,
  UNSPLASH_IMAGE_HOST,
  UNSPLASH_PHOTO_ID_PATTERN,
  UNSPLASH_USERNAME_PATTERN,
} from './unsplash.constants';
import {
  UnsplashApiPhoto,
  UnsplashPhoto,
  UnsplashPhotoRecord,
} from './unsplash.types';

export function isHttpsUrlOnHost(value: unknown, host: string): value is string {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === host;
  } catch {
    return false;
  }
}

export function withImageParams(rawUrl: string, params: string): string {
  return `${rawUrl}${rawUrl.includes('?') ? '&' : '?'}${params}`;
}

export function normalizeQuery(query: string): string {
  return query.trim().replace(/\s+/g, ' ').toLowerCase();
}

function cleanText(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null;
  return value.trim().slice(0, maxLength) || null;
}

export function toPhotoRecord(value: unknown): UnsplashPhotoRecord | null {
  const photo = value as Partial<UnsplashApiPhoto> | null;
  if (!photo || typeof photo !== 'object') return null;
  if (photo.premium || photo.plus) return null;
  if (typeof photo.id !== 'string' || !UNSPLASH_PHOTO_ID_PATTERN.test(photo.id)) {
    return null;
  }

  const username = photo.user?.username;
  if (typeof username !== 'string' || !UNSPLASH_USERNAME_PATTERN.test(username)) {
    return null;
  }

  const { raw, small } = photo.urls ?? ({} as UnsplashApiPhoto['urls']);
  const downloadLocation = photo.links?.download_location;
  if (
    !isHttpsUrlOnHost(raw, UNSPLASH_IMAGE_HOST) ||
    !isHttpsUrlOnHost(small, UNSPLASH_IMAGE_HOST) ||
    !isHttpsUrlOnHost(downloadLocation, UNSPLASH_API_HOST)
  ) {
    return null;
  }

  const color =
    typeof photo.color === 'string' && UNSPLASH_COLOR_PATTERN.test(photo.color)
      ? photo.color
      : null;

  return {
    id: photo.id,
    description: cleanText(photo.alt_description || photo.description, 200),
    color,
    thumbUrl: small,
    coverUrl: withImageParams(raw, UNSPLASH_COVER_IMAGE_PARAMS),
    authorName: cleanText(photo.user?.name, 100) ?? username,
    authorUsername: username,
    downloadLocation,
  };
}

export function toPhotoRecords(values: unknown): UnsplashPhotoRecord[] {
  if (!Array.isArray(values)) return [];
  return values.map(toPhotoRecord).filter(Boolean);
}

export function toPublicPhoto(record: UnsplashPhotoRecord): UnsplashPhoto {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { downloadLocation, ...photo } = record;
  return photo;
}

// frees the connection when the body is not needed
export async function discardBody(response: Response): Promise<void> {
  await response.body?.cancel().catch(() => undefined);
}

export async function isRateLimited(response: Response): Promise<boolean> {
  if (response.status === 429) return true;
  if (response.status !== 403) return false;
  if (response.headers.get('x-ratelimit-remaining') === '0') return true;
  const body = await response.text().catch(() => '');
  return /rate limit/i.test(body);
}
