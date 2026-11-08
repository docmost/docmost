import { CoverPreset } from "@/features/page-cover/page-cover.types.ts";

const assets = import.meta.glob<string>("./assets/*.webp", {
  eager: true,
  import: "default",
});

function imagePreset(
  kind: "gradient" | "texture",
  name: string,
  label: string,
): CoverPreset {
  return {
    id: `${kind}-${name}`,
    kind,
    label,
    src: assets[`./assets/${kind}-${name}.webp`],
    thumb: assets[`./assets/${kind}-${name}-thumb.webp`],
  };
}

export const COVER_PRESET_PREFIX = "preset:";

export const COVER_COLOR_PRESETS: CoverPreset[] = [
  { id: "color-red", kind: "color", label: "Red", color: "#d6645a" },
  { id: "color-orange", kind: "color", label: "Orange", color: "#e08a4f" },
  { id: "color-yellow", kind: "color", label: "Yellow", color: "#ebbd59" },
  { id: "color-green", kind: "color", label: "Green", color: "#5e9a6d" },
  { id: "color-teal", kind: "color", label: "Teal", color: "#3d8f96" },
  { id: "color-blue", kind: "color", label: "Blue", color: "#4a7bc4" },
  { id: "color-purple", kind: "color", label: "Purple", color: "#7d66b5" },
  { id: "color-graphite", kind: "color", label: "Graphite", color: "#3b4048" },
];

export const COVER_GRADIENT_PRESETS: CoverPreset[] = [
  imagePreset("gradient", "aurora", "Aurora"),
  imagePreset("gradient", "sunset", "Sunset"),
  imagePreset("gradient", "sky", "Sky"),
  imagePreset("gradient", "dune", "Dune"),
  imagePreset("gradient", "forest", "Forest"),
  imagePreset("gradient", "dusk", "Dusk"),
  imagePreset("gradient", "berry", "Berry"),
  imagePreset("gradient", "slate", "Slate"),
];

export const COVER_TEXTURE_PRESETS: CoverPreset[] = [
  imagePreset("texture", "paper", "Paper"),
  imagePreset("texture", "linen", "Linen"),
  imagePreset("texture", "marbled", "Marbled"),
  imagePreset("texture", "terrazzo", "Terrazzo"),
  imagePreset("texture", "topography", "Topography"),
  imagePreset("texture", "blueprint", "Blueprint"),
  imagePreset("texture", "concrete", "Concrete"),
  imagePreset("texture", "waves", "Waves"),
];

export const COVER_PRESETS: CoverPreset[] = [
  ...COVER_COLOR_PRESETS,
  ...COVER_GRADIENT_PRESETS,
  ...COVER_TEXTURE_PRESETS,
];

// the server tokenizes uploaded covers on public pages with ?jwt=
export const COVER_FILE_PATTERN =
  /^\/api\/files\/(public\/)?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[^/?#]+(\?jwt=[\w.-]+)?$/i;

export const COVER_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

export const COVER_FILE_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/png": "png",
};

export const DEFAULT_COVER_POSITION = 50;
export const COVER_MAX_DIMENSION = 2560;
export const COVER_COMPRESS_THRESHOLD = 1.5 * 1024 * 1024;
export const COVER_JPEG_QUALITY = 0.85;
