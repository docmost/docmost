import { CoverPreset } from "@/features/page-cover/page-cover.types.ts";

// as files, so the picker's thumbnails stay out of the page bundle
const assets = import.meta.glob<string>("./assets/*.webp", {
  eager: true,
  import: "default",
  query: "?no-inline",
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
  { id: "color-graphite", kind: "color", label: "Graphite", color: "#4b5563" },
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
  imagePreset("texture", "clouds", "Clouds"),
  imagePreset("texture", "northern-lights", "Northern lights"),
  imagePreset("texture", "linen", "Linen"),
  imagePreset("texture", "terrazzo", "Terrazzo"),
  imagePreset("texture", "graph", "Graph paper"),
  imagePreset("texture", "topography", "Topography"),
  imagePreset("texture", "blueprint", "Blueprint"),
  imagePreset("texture", "waves", "Waves"),
];

// "Add cover" picks from the quieter gradients only
export const COVER_RANDOM_GRADIENT_IDS = [
  "gradient-sky",
  "gradient-slate",
  "gradient-dusk",
  "gradient-aurora",
  "gradient-dune",
];

export const COVER_PRESETS: CoverPreset[] = [
  ...COVER_COLOR_PRESETS,
  ...COVER_GRADIENT_PRESETS,
  ...COVER_TEXTURE_PRESETS,
];

// the server tokenizes uploaded covers on public pages with ?jwt=
export const COVER_FILE_PATTERN =
  /^\/api\/files\/(public\/)?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/(?!\.\.?(?:\?|$))[^/?#\\]+(\?jwt=[\w.-]+)?$/i;

export const UNSPLASH_COVER_PREFIX = "unsplash:";
export const UNSPLASH_IMAGE_HOST = "images.unsplash.com";
export const UNSPLASH_USERNAME_PATTERN = /^[A-Za-z0-9_.-]{1,64}$/;
export const UNSPLASH_REFERRAL = "utm_source=docmost&utm_medium=referral";
export const UNSPLASH_HOME_URL = `https://unsplash.com/?${UNSPLASH_REFERRAL}`;
export const UNSPLASH_LICENSE_URL = `https://unsplash.com/license?${UNSPLASH_REFERRAL}`;
export const UNSPLASH_SEARCH_DEBOUNCE_MS = 400;
export const UNSPLASH_SKELETON_COUNT = 24;

// the first extension is the one written for converted files
export const COVER_TYPE_EXTENSIONS: Record<string, string[]> = {
  "image/jpeg": ["jpg", "jpeg"],
  "image/png": ["png"],
  "image/webp": ["webp"],
};

export const COVER_IMAGE_TYPES = Object.keys(COVER_TYPE_EXTENSIONS);

export const DEFAULT_COVER_POSITION = 50;
export const COVER_POSITION_STEP = 10;
export const COVER_FOCUS_REQUEST_TTL = 2000;
export const COVER_MAX_DIMENSION = 2560;
export const COVER_COMPRESS_THRESHOLD = 1.5 * 1024 * 1024;
export const COVER_MAX_BYTES = 5 * 1024 * 1024;
export const COVER_QUALITY_STEPS = [0.85, 0.7, 0.55, 0.4];
export const COVER_SCALE_STEPS = [1, 0.75, 0.5625, 0.421875];
