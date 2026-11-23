export const COVER_PRESET_PATTERN = /^preset:[a-z0-9-]{1,64}$/;

export const COVER_UNSPLASH_PREFIX = 'unsplash:';

export const COVER_FILE_PATTERN =
  /^\/api\/files\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/[^/?#]+$/i;

export const COVER_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export const COVER_MAX_BYTES = 5 * 1024 * 1024;

// long enough for the open cover picker to still restore a replaced upload
export const COVER_CLEANUP_DELAY_MS = 60 * 60 * 1000;
export const COVER_CLEANUP_JOB_PREFIX = 'cover-cleanup-';
