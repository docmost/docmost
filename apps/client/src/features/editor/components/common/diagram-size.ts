export type DiagramSize = { width: number; height: number };

// the resize handles do not let a diagram get narrower than this
const MIN_WIDTH = 24;

// The size of the drawing a saved diagram holds, from the width and height its SVG states or else its viewBox.
export function drawingSize(svg: string): DiagramSize | null {
  const root = new DOMParser().parseFromString(svg, "image/svg+xml")
    .documentElement;

  // an imported diagram is a placeholder around a picture until the editor first saves it
  const drawn = Array.from(root.children).some(
    (child) => child.localName !== "image",
  );
  if (!drawn) return null;

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

  // an empty drawing is saved one pixel wide, which no zoom can be read from
  return width > 1 && height > 0 ? { width, height } : null;
}

// How far a resized diagram is zoomed: its node width over the width of its drawing.
export function diagramZoom(
  width: unknown,
  drawing: DiagramSize | null,
): number | null {
  if (typeof width !== "number" || width <= 0 || !drawing) return null;
  return width / drawing.width;
}

// The node size that shows a drawing at the given zoom.
export function diagramSizeAt(
  zoom: number | null,
  drawing: DiagramSize | null,
): DiagramSize | null {
  if (zoom === null || !drawing) return null;

  const width = Math.max(MIN_WIDTH, Math.round(zoom * drawing.width));
  return {
    width,
    height: Math.round((width * drawing.height) / drawing.width),
  };
}
