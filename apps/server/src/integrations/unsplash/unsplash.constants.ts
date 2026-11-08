export const UNSPLASH_API_URL = 'https://api.unsplash.com';
export const UNSPLASH_API_HOST = 'api.unsplash.com';
export const UNSPLASH_IMAGE_HOST = 'images.unsplash.com';
export const UNSPLASH_PHOTO_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
export const UNSPLASH_USERNAME_PATTERN = /^[A-Za-z0-9_.-]{1,64}$/;
export const UNSPLASH_COLOR_PATTERN = /^#[0-9a-f]{6}$/i;

export const UNSPLASH_PER_PAGE = 24;
export const UNSPLASH_MAX_PAGE = 50;
export const UNSPLASH_MAX_QUERY_LENGTH = 100;
export const UNSPLASH_DEFAULT_TOPIC = 'wallpapers';
export const UNSPLASH_COVER_IMAGE_PARAMS = 'w=2560&q=80&auto=format&fit=max';

export const UNSPLASH_REQUEST_TIMEOUT_MS = 10_000;
export const UNSPLASH_CACHE_PREFIX = 'unsplash:';
export const UNSPLASH_LIST_TTL_MS = 30 * 60_000;
export const UNSPLASH_PHOTO_TTL_MS = 60 * 60_000;
export const UNSPLASH_COVER_LIMIT = 30;
export const UNSPLASH_COVER_WINDOW_MS = 60_000;

export const UNSPLASH_RATE_LIMIT_MESSAGE =
  'Unsplash rate limit reached. Try again later.';
export const UNSPLASH_UNAVAILABLE_MESSAGE = 'Unsplash is unavailable';
export const UNSPLASH_DISABLED_MESSAGE = 'Unsplash is not enabled';
