export const COVER_PRESET_PATTERN = /^preset:[a-z0-9-]{1,64}$/;

export const COVER_FILE_PATTERN =
  /^\/api\/files\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/[^/?#]+$/i;

export const COVER_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
];
