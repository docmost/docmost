export type DiagramSize = { width: number; height: number };

// The size an SVG asks to be drawn at, from its width and height or else its viewBox.
export function svgSize(svg: string): DiagramSize | null {
  const root = new DOMParser().parseFromString(svg, "image/svg+xml")
    .documentElement;
  const length = (name: string) => {
    const value = root.getAttribute(name) ?? "";
    return value.trim().endsWith("%") ? NaN : parseFloat(value);
  };

  let width = length("width");
  let height = length("height");
  if (!(width > 0 && height > 0)) {
    const viewBox = (root.getAttribute("viewBox") ?? "").trim().split(/[\s,]+/);
    width = parseFloat(viewBox[2]);
    height = parseFloat(viewBox[3]);
  }

  return width > 0 && height > 0 ? { width, height } : null;
}

// The node size that keeps a resized diagram at its zoom once its drawing has a new size.
export function rescaleDiagram(
  width: unknown,
  before: DiagramSize | null,
  after: DiagramSize | null,
): DiagramSize | null {
  if (typeof width !== "number" || !before || !after) return null;

  const scaled = Math.round((width * after.width) / before.width);
  return {
    width: scaled,
    height: Math.round((scaled * after.height) / after.width),
  };
}
