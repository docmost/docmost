import loadImage from "blueimp-load-image";
import {
  COVER_COMPRESS_THRESHOLD,
  COVER_JPEG_QUALITY,
  COVER_MAX_DIMENSION,
  COVER_TYPE_EXTENSIONS,
} from "@/features/page-cover/page-cover.constants.ts";

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
        const extension = COVER_TYPE_EXTENSIONS[blob.type]?.[0] ?? "png";
        resolve(
          new File([blob], `${baseName}.${extension}`, { type: blob.type }),
        );
      },
      type,
      COVER_JPEG_QUALITY,
    );
  });
}

export async function compressCoverImage(file: File): Promise<File> {
  if (file.type === "image/gif") return withCoverExtension(file);

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
  const encoded = await canvasToFile(canvas, outputType, baseName);
  return withCoverExtension(pickSmallerCoverFile(file, encoded, downscaled));
}
