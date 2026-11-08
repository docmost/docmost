import { getFileUrl } from "@/lib/config.ts";
import {
  COVER_FILE_PATTERN,
  COVER_GRADIENT_PRESETS,
  COVER_PRESET_PREFIX,
  COVER_PRESETS,
  COVER_RANDOM_GRADIENT_IDS,
  DEFAULT_COVER_POSITION,
} from "@/features/page-cover/page-cover.constants.ts";
import {
  CoverPreset,
  ResolvedCover,
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

  return null;
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
