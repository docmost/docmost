import loadImage from "blueimp-load-image";
import { getFileUrl } from "@/lib/config.ts";
import {
  COVER_COMPRESS_THRESHOLD,
  COVER_FILE_EXTENSIONS,
  COVER_FILE_PATTERN,
  COVER_GRADIENT_PRESETS,
  COVER_JPEG_QUALITY,
  COVER_MAX_DIMENSION,
  COVER_PRESET_PREFIX,
  COVER_PRESETS,
  COVER_RANDOM_GRADIENT_IDS,
} from "@/features/page-cover/page-cover.constants.ts";
import {
  CoverPreset,
  ResolvedCover,
} from "@/features/page-cover/page-cover.types.ts";

type Size = { width: number; height: number };

const presetsById = new Map(COVER_PRESETS.map((preset) => [preset.id, preset]));

export function getCoverPreset(
  coverPhoto: string | null | undefined,
): CoverPreset | undefined {
  if (!coverPhoto?.startsWith(COVER_PRESET_PREFIX)) return undefined;
  return presetsById.get(coverPhoto.slice(COVER_PRESET_PREFIX.length));
}

export function toCoverValue(preset: CoverPreset): string {
  return COVER_PRESET_PREFIX + preset.id;
}

export function resolveCover(
  coverPhoto: string | null | undefined,
): ResolvedCover | null {
  if (!coverPhoto) return null;

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
  const position = startPosition - (deltaY / overflow) * 100;
  return Math.min(100, Math.max(0, position));
}

export function getCoverOutputType(
  file: { type: string; size: number },
  downscaled: boolean,
  hasAlpha: () => boolean,
): "original" | "image/webp" | "image/jpeg" {
  if (file.type === "image/gif") return "original";
  if (!downscaled && file.size <= COVER_COMPRESS_THRESHOLD) return "original";

  const mayHaveAlpha = file.type === "image/png" || file.type === "image/webp";
  return mayHaveAlpha && hasAlpha() ? "image/webp" : "image/jpeg";
}

export function pickSmallerCoverFile(
  original: File,
  encoded: File,
  downscaled: boolean,
): File {
  if (downscaled) return encoded;
  return encoded.size < original.size ? encoded : original;
}

function canvasHasAlpha(canvas: HTMLCanvasElement): boolean {
  const ctx = canvas.getContext("2d");
  if (!ctx) return false;
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < 255) return true;
  }
  return false;
}

function canvasToFile(
  canvas: HTMLCanvasElement,
  type: string,
  baseName: string,
): Promise<File> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Failed to compress image"));
          return;
        }
        // browsers that can't encode webp hand back a png
        const extension = COVER_FILE_EXTENSIONS[blob.type] ?? "png";
        resolve(new File([blob], `${baseName}.${extension}`, { type: blob.type }));
      },
      type,
      COVER_JPEG_QUALITY,
    );
  });
}

export async function compressCoverImage(file: File): Promise<File> {
  if (file.type === "image/gif") return file;

  const { image, originalWidth, originalHeight } = await loadImage(file, {
    maxWidth: COVER_MAX_DIMENSION,
    maxHeight: COVER_MAX_DIMENSION,
    canvas: true,
    orientation: true,
    imageSmoothingQuality: "high",
  });
  const canvas = image as HTMLCanvasElement;
  const downscaled =
    Math.max(canvas.width, canvas.height) <
    Math.max(originalWidth, originalHeight);

  const outputType = getCoverOutputType(file, downscaled, () =>
    canvasHasAlpha(canvas),
  );
  if (outputType === "original") return file;

  const baseName = file.name.replace(/\.[^.]+$/, "") || "cover";
  const encoded = await canvasToFile(canvas, outputType, baseName);
  return pickSmallerCoverFile(file, encoded, downscaled);
}
