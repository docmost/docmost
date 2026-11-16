import { describe, expect, it } from "vitest";
import { diagramSizeAt, diagramZoom, drawingSize } from "./diagram-size";

const svg = (attrs: string, content = "<defs/><g><rect/></g>") =>
  `<svg xmlns="http://www.w3.org/2000/svg" ${attrs}>${content}</svg>`;

describe("drawingSize", () => {
  it("reads a width and height given in pixels", () => {
    expect(
      drawingSize(svg('width="441px" height="61px" viewBox="-0.5 -0.5 441 61"')),
    ).toEqual({ width: 441, height: 61 });
  });

  it("reads a width and height given as plain numbers", () => {
    expect(
      drawingSize(svg('width="600" height="400" viewBox="0 0 1200 800"')),
    ).toEqual({ width: 600, height: 400 });
  });

  it("falls back to the viewBox when the width is a percentage", () => {
    expect(drawingSize(svg('width="100%" viewBox="0 0 300 150"'))).toEqual({
      width: 300,
      height: 150,
    });
  });

  it("returns nothing for an SVG that states no size", () => {
    expect(drawingSize(svg(""))).toBeNull();
  });

  it("returns nothing for text that is not an SVG", () => {
    expect(drawingSize("not an svg")).toBeNull();
  });

  it("returns nothing for an import placeholder that only wraps a picture", () => {
    const picture =
      '<image href="data:image/png;base64,AAAA" width="100%" height="100%"/>';

    expect(
      drawingSize(
        svg('width="600" height="400" viewBox="0 0 600 400"', picture),
      ),
    ).toBeNull();
  });

  it("returns nothing for an import placeholder with no picture", () => {
    expect(
      drawingSize(svg('width="600" height="400" viewBox="0 0 600 400"', "")),
    ).toBeNull();
  });

  it("returns nothing for an empty drawing", () => {
    expect(
      drawingSize(
        svg('width="1px" height="1px" viewBox="-0.5 -0.5 1 1"', "<defs/><g/>"),
      ),
    ).toBeNull();
  });
});

describe("diagramZoom", () => {
  const drawing = { width: 441, height: 61 };

  it("is the node width over the width of its drawing", () => {
    expect(diagramZoom(882, drawing)).toBe(2);
  });

  it("is nothing for a diagram that was never resized", () => {
    expect(diagramZoom(null, drawing)).toBeNull();
  });

  it("is nothing for a percentage width", () => {
    expect(diagramZoom("100%", drawing)).toBeNull();
  });

  it("is nothing when the size of the drawing is unknown", () => {
    expect(diagramZoom(882, null)).toBeNull();
  });
});

describe("diagramSizeAt", () => {
  const zoom = 571 / 441;

  it("widens the diagram by as much as its drawing got wider", () => {
    expect(diagramSizeAt(zoom, { width: 761, height: 61 })).toEqual({
      width: 985,
      height: 79,
    });
  });

  it("narrows the diagram when shapes were removed", () => {
    expect(diagramSizeAt(zoom, { width: 121, height: 61 })).toEqual({
      width: 157,
      height: 79,
    });
  });

  it("keeps the width when the drawing only got taller", () => {
    expect(diagramSizeAt(zoom, { width: 441, height: 201 })).toEqual({
      width: 571,
      height: 260,
    });
  });

  it("stops at the width the resize handles stop at", () => {
    expect(diagramSizeAt(24 / 2000, { width: 40, height: 40 })).toEqual({
      width: 24,
      height: 24,
    });
  });

  it("is nothing without a zoom", () => {
    expect(diagramSizeAt(null, { width: 761, height: 61 })).toBeNull();
  });

  it("is nothing when the size of the drawing is unknown", () => {
    expect(diagramSizeAt(zoom, null)).toBeNull();
  });
});
