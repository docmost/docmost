type LabelColor = {
  bg: string;
  fg: string;
  dot: string;
};

const LABEL_PALETTE: Record<string, LabelColor> = {
  slate: { bg: "#eef1f5", fg: "#3b475a", dot: "#6b7a90" },
  blue: { bg: "#e6f0ff", fg: "#1e4fbf", dot: "#3b82f6" },
  green: { bg: "#e3f5ea", fg: "#1f7a47", dot: "#22a05a" },
  amber: { bg: "#fbf0d9", fg: "#8a5a00", dot: "#d99c1f" },
  red: { bg: "#fde6e6", fg: "#a02b2b", dot: "#dc4a4a" },
  purple: { bg: "#efe9fb", fg: "#5a3aa8", dot: "#8b6bd9" },
  pink: { bg: "#fce6ee", fg: "#a8336d", dot: "#dc6699" },
  teal: { bg: "#daf1ee", fg: "#1f6f6a", dot: "#2fa39a" },
};

const PALETTE_KEYS = Object.keys(LABEL_PALETTE);

const DARK_PALETTE: Record<string, LabelColor> = {
  slate: { bg: "#2a3140", fg: "#c8d3e3", dot: "#7e8da8" },
  blue: { bg: "#152a52", fg: "#a9c4ff", dot: "#5b9aff" },
  green: { bg: "#143b27", fg: "#9ce3b8", dot: "#3ec97c" },
  amber: { bg: "#3d2c0e", fg: "#f5cf85", dot: "#e6b34a" },
  red: { bg: "#401a1a", fg: "#f1a8a8", dot: "#e26565" },
  purple: { bg: "#2a1f4d", fg: "#c8b4f4", dot: "#a48ce6" },
  pink: { bg: "#3c1a2a", fg: "#f3a9c9", dot: "#e07ab0" },
  teal: { bg: "#103633", fg: "#92d5cf", dot: "#48b8af" },
};

function hashName(name: string): number {
  // Per-char accumulation with 31. Note: 31 ≡ -1 (mod 8), so the low bits of
  // this hash are highly correlated across short strings — `% 8` would cluster.
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (Math.imul(h, 31) + name.charCodeAt(i)) | 0;
  }
  // Murmur3 fmix32 finalizer — avalanches high bits into low bits so the
  // subsequent `% palette.length` (small power of two) is well-distributed.
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

export function getLabelColor(
  name: string,
  scheme: "light" | "dark" = "light",
): LabelColor {
  const key = PALETTE_KEYS[hashName(name) % PALETTE_KEYS.length];
  const palette = scheme === "dark" ? DARK_PALETTE : LABEL_PALETTE;
  return palette[key];
}
