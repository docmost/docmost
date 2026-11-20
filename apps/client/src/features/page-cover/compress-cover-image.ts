import loadImage from "blueimp-load-image";
import {
  COVER_COMPRESS_THRESHOLD,
  COVER_MAX_BYTES,
  COVER_MAX_DIMENSION,
  COVER_QUALITY_STEPS,
  COVER_SCALE_STEPS,
  COVER_TYPE_EXTENSIONS,
} from "@/features/page-cover/page-cover.constants.ts";

export function getCoverOutputType(
  file: { type: string; size: number },
  downscaled: boolean,
  hasAlpha: () => boolean,
): "original" | "image/webp" | "image/jpeg" {
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

// the server derives the stored type from the extension
export function withCoverExtension(file: File): File {
  const extensions = COVER_TYPE_EXTENSIONS[file.type];
  const match = file.name.match(/^(.*)\.([^.]+)$/);
  const baseName = match?.[1] || file.name || "cover";
  const extension = match?.[2]?.toLowerCase();
  if (!extensions || (extension && extensions.includes(extension))) {
    return file;
  }
  return new File([file], `${baseName}.${extensions[0]}`, { type: file.type });
}

// quality goes down before size, so the cover stays as sharp as it can
export async function encodeWithinLimit(
  encode: (scale: number, quality: number) => Promise<File>,
  maxBytes = COVER_MAX_BYTES,
): Promise<File | null> {
  for (const scale of COVER_SCALE_STEPS) {
    for (const quality of COVER_QUALITY_STEPS) {
      const file = await encode(scale, quality);
      if (file.size <= maxBytes) return file;
      // png ignores the quality setting
      if (file.type === "image/png") break;
    }
  }
  return null;
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

function scaleCanvas(canvas: HTMLCanvasElement, scale: number): HTMLCanvasElement {
  if (scale === 1) return canvas;
  const scaled = document.createElement("canvas");
  scaled.width = Math.round(canvas.width * scale);
  scaled.height = Math.round(canvas.height * scale);
  const ctx = scaled.getContext("2d");
  if (ctx) {
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(canvas, 0, 0, scaled.width, scaled.height);
  }
  return scaled;
}

function canvasToFile(
  canvas: HTMLCanvasElement,
  type: string,
  baseName: string,
  quality: number,
): Promise<File> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Failed to compress image"));
          return;
        }
        // browsers that can't encode webp hand back a png
        const extension = COVER_TYPE_EXTENSIONS[blob.type]?.[0] ?? "png";
        resolve(
          new File([blob], `${baseName}.${extension}`, { type: blob.type }),
        );
      },
      type,
      quality,
    );
  });
}

export async function compressCoverImage(file: File): Promise<File | null> {
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
  if (outputType === "original") return withCoverExtension(file);

  const baseName = file.name.replace(/\.[^.]+$/, "") || "cover";
  const scaled = new Map<number, HTMLCanvasElement>();
  const encoded = await encodeWithinLimit((scale, quality) => {
    if (!scaled.has(scale)) scaled.set(scale, scaleCanvas(canvas, scale));
    return canvasToFile(scaled.get(scale), outputType, baseName, quality);
  });
  if (!encoded) return null;
  return withCoverExtension(pickSmallerCoverFile(file, encoded, downscaled));
}
