import { getFileUrl } from "@/lib/config.ts";
import {
  COVER_FILE_PATTERN,
  COVER_GRADIENT_PRESETS,
  COVER_PRESET_PREFIX,
  COVER_PRESETS,
  COVER_RANDOM_GRADIENT_IDS,
  DEFAULT_COVER_POSITION,
  UNSPLASH_COVER_PREFIX,
  UNSPLASH_IMAGE_HOST,
  UNSPLASH_REFERRAL,
  UNSPLASH_USERNAME_PATTERN,
} from "@/features/page-cover/page-cover.constants.ts";
import {
  CoverAttribution,
  CoverPreset,
  ResolvedCover,
  UnsplashPhoto,
  UnsplashPhotoList,
} from "@/features/page-cover/page-cover.types.ts";

type Size = { width: number; height: number };

const presetsById = new Map(COVER_PRESETS.map((preset) => [preset.id, preset]));

// cover values can arrive from other clients over the socket unchecked
export function getCoverPreset(coverPhoto: unknown): CoverPreset | undefined {
  if (typeof coverPhoto !== "string") return undefined;
  if (!coverPhoto.startsWith(COVER_PRESET_PREFIX)) return undefined;
  return presetsById.get(coverPhoto.slice(COVER_PRESET_PREFIX.length));
}

export function toCoverValue(preset: CoverPreset): string {
  return COVER_PRESET_PREFIX + preset.id;
}

export function toUnsplashCoverValue(photoId: string): string {
  return UNSPLASH_COVER_PREFIX + photoId;
}

function isUnsplashImageUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.host === UNSPLASH_IMAGE_HOST &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}

export function resolveCover(coverPhoto: unknown): ResolvedCover | null {
  if (typeof coverPhoto !== "string" || !coverPhoto) return null;

  const preset = getCoverPreset(coverPhoto);
  if (preset) {
    return preset.kind === "color"
      ? { kind: "color", color: preset.color }
      : { kind: "image", src: preset.src };
  }

  if (COVER_FILE_PATTERN.test(coverPhoto)) {
    return { kind: "image", src: getFileUrl(coverPhoto) };
  }

  if (isUnsplashImageUrl(coverPhoto)) {
    return { kind: "image", src: coverPhoto };
  }

  return null;
}

export function getCoverAttribution(value: unknown): CoverAttribution | null {
  if (!value || typeof value !== "object") return null;
  const credit = value as Partial<CoverAttribution>;
  if (credit.source !== "unsplash" || typeof credit.photoId !== "string") {
    return null;
  }
  if (typeof credit.authorName !== "string" || !credit.authorName.trim()) {
    return null;
  }
  if (
    typeof credit.authorUsername !== "string" ||
    !UNSPLASH_USERNAME_PATTERN.test(credit.authorUsername)
  ) {
    return null;
  }

  return {
    source: "unsplash",
    photoId: credit.photoId,
    authorName: credit.authorName,
    authorUsername: credit.authorUsername,
  };
}

// a credit only shows next to the photo it belongs to
export function getCoverCredit(
  coverPhoto: unknown,
  attribution: unknown,
): CoverAttribution | null {
  if (typeof coverPhoto !== "string" || !isUnsplashImageUrl(coverPhoto)) {
    return null;
  }
  return getCoverAttribution(attribution);
}

type CoverValue = { coverPhoto?: unknown; coverAttribution?: unknown };

export function isSameUnsplashPhoto(
  shown: CoverValue | undefined,
  saved: CoverValue,
): boolean {
  const savedId = getCoverCredit(saved.coverPhoto, saved.coverAttribution)?.photoId;
  const shownId = getCoverCredit(shown?.coverPhoto, shown?.coverAttribution)?.photoId;
  return Boolean(savedId) && shownId === savedId;
}

export function getUnsplashProfileUrl(username: string): string {
  return `https://unsplash.com/@${encodeURIComponent(username)}?${UNSPLASH_REFERRAL}`;
}

// the feed can shift between page loads and repeat a photo on the next page
export function mergeUnsplashPages(pages: UnsplashPhotoList[]): UnsplashPhoto[] {
  const photos = new Map<string, UnsplashPhoto>();
  for (const photo of pages.flatMap((page) => page.items)) {
    if (!photos.has(photo.id)) photos.set(photo.id, photo);
  }
  return [...photos.values()];
}

export function toCssUrl(src: string): string {
  return `url("${src.replace(/["\\]/g, "\\$&")}")`;
}

export function isUploadedCover(coverPhoto: unknown): coverPhoto is string {
  return typeof coverPhoto === "string" && COVER_FILE_PATTERN.test(coverPhoto);
}

export function getCoverPosition(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_COVER_POSITION;
  }
  return Math.min(100, Math.max(0, value));
}

export function pickRandomGradient(currentCover?: string | null): CoverPreset {
  const options = COVER_GRADIENT_PRESETS.filter(
    (preset) =>
      COVER_RANDOM_GRADIENT_IDS.includes(preset.id) &&
      toCoverValue(preset) !== currentCover,
  );
  return options[Math.floor(Math.random() * options.length)];
}

export function getCoverOverflow(natural: Size, box: Size): number {
  if (!natural.width || !natural.height) return 0;
  const scale = Math.max(box.width / natural.width, box.height / natural.height);
  return Math.max(0, natural.height * scale - box.height);
}

export function getCoverPositionAfterDrag(
  startPosition: number,
  deltaY: number,
  overflow: number,
): number {
  if (overflow <= 0) return startPosition;
  return getCoverPosition(startPosition - (deltaY / overflow) * 100);
}
