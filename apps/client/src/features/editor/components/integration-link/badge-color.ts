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
