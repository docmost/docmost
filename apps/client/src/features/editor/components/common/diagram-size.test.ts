import { describe, expect, it } from "vitest";
import { rescaleDiagram, svgSize } from "./diagram-size";

describe("svgSize", () => {
  it("reads a width and height given in pixels", () => {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="441px" height="61px" viewBox="-0.5 -0.5 441 61"><g/></svg>';

    expect(svgSize(svg)).toEqual({ width: 441, height: 61 });
  });

  it("reads a width and height given as plain numbers", () => {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 1200 800"></svg>';

    expect(svgSize(svg)).toEqual({ width: 600, height: 400 });
  });

  it("falls back to the viewBox when the width is a percentage", () => {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="100%" viewBox="0 0 300 150"></svg>';

    expect(svgSize(svg)).toEqual({ width: 300, height: 150 });
  });

  it("returns nothing for an SVG that states no size", () => {
    expect(svgSize('<svg xmlns="http://www.w3.org/2000/svg"></svg>')).toBeNull();
  });

  it("returns nothing for text that is not an SVG", () => {
    expect(svgSize("not an svg")).toBeNull();
  });
});

describe("rescaleDiagram", () => {
  const drawing = { width: 441, height: 61 };

  it("widens a resized diagram by as much as its drawing got wider", () => {
    expect(rescaleDiagram(571, drawing, { width: 761, height: 61 })).toEqual({
      width: 985,
      height: 79,
    });
  });

  it("narrows a resized diagram when shapes were removed", () => {
    expect(rescaleDiagram(571, drawing, { width: 121, height: 61 })).toEqual({
      width: 157,
      height: 79,
    });
  });

  it("keeps the width when the drawing only got taller", () => {
    expect(rescaleDiagram(571, drawing, { width: 441, height: 201 })).toEqual({
      width: 571,
      height: 260,
    });
  });

  it("leaves a diagram that was never resized alone", () => {
    expect(rescaleDiagram(null, drawing, { width: 761, height: 61 })).toBeNull();
  });

  it("leaves a percentage width alone", () => {
    expect(
      rescaleDiagram("100%", drawing, { width: 761, height: 61 }),
    ).toBeNull();
  });

  it("changes nothing when the old drawing size is unknown", () => {
    expect(rescaleDiagram(571, null, { width: 761, height: 61 })).toBeNull();
  });

  it("changes nothing when the new drawing size is unknown", () => {
    expect(rescaleDiagram(571, drawing, null)).toBeNull();
  });
});
