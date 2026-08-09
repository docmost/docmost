// Light-scheme text per hue, measured to pass 4.5:1 on the light-variant
// badge background; hexes are darkened .9 shades for hues whose scale
// never gets dark enough.
const BADGE_TEXT_LIGHT: Record<string, string> = {
  dark: "var(--mantine-color-dark-9)",
  gray: "var(--mantine-color-gray-9)",
  red: "var(--mantine-color-red-9)",
  pink: "var(--mantine-color-pink-9)",
  grape: "var(--mantine-color-grape-9)",
  violet: "var(--mantine-color-violet-9)",
  indigo: "var(--mantine-color-indigo-9)",
  blue: "var(--mantine-color-blue-9)",
  cyan: "var(--mantine-color-cyan-9)",
  teal: "var(--mantine-color-teal-9)",
  green: "#277c38",
  lime: "#4e7e0b",
  yellow: "#ad5900",
  orange: "#c3410e",
};

export function badgeTextColor(color?: string): string | undefined {
  if (!color) return undefined;
  const light = BADGE_TEXT_LIGHT[color];
  if (!light) return undefined;
  // Dark scheme keeps Mantine's own light-variant text.
  return `light-dark(${light}, var(--mantine-color-${color}-light-color))`;
}

export function toBadgeColor(raw?: string): string {
  if (!raw) return "gray";
  const hex = raw.toLowerCase().replace("#", "");
  if (/^[0-9a-f]{6}$/.test(hex)) {
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2 / 255;
    if (max - min < 30) return l > 0.6 ? "gray" : "dark";
    if (r > g && r > b) return g > 160 ? "orange" : "red";
    if (g > r && g > b) return r > 160 ? "lime" : "green";
    if (b > r && b > g) return r > 100 ? "violet" : "blue";
    if (r > 200 && g > 200) return "yellow";
    if (r > 200 && b > 200) return "pink";
    if (g > 200 && b > 200) return "cyan";
    return "gray";
  }
  return raw;
}
