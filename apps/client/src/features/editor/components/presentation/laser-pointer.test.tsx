import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import LaserPointer from "./laser-pointer";

type PointerInit = MouseEventInit & { pointerType?: string };

function dispatchPointer(
  target: EventTarget,
  type: "pointermove" | "pointerout",
  init: PointerInit = {},
) {
  // jsdom has no PointerEvent
  const event = new MouseEvent(type, { bubbles: true, ...init });
  Object.defineProperty(event, "pointerType", {
    value: init.pointerType ?? "mouse",
  });
  target.dispatchEvent(event);
}

function renderLaserPointer(enabled = true) {
  const view = render(<LaserPointer enabled={enabled} />);
  return { ...view, dot: view.container.firstElementChild as HTMLElement };
}

describe("LaserPointer", () => {
  it("follows the pointer", () => {
    const { dot } = renderLaserPointer();

    dispatchPointer(window, "pointermove", { clientX: 120, clientY: 80 });

    expect(dot.style.transform).toBe("translate(120px, 80px)");
    expect(dot.style.visibility).toBe("visible");
  });

  it("stays hidden while disabled", () => {
    const { dot } = renderLaserPointer(false);

    dispatchPointer(window, "pointermove", { clientX: 120, clientY: 80 });

    expect(dot.hidden).toBe(true);
  });

  it("shows at the last pointer position once enabled", () => {
    const { dot, rerender } = renderLaserPointer(false);
    dispatchPointer(window, "pointermove", { clientX: 120, clientY: 80 });

    rerender(<LaserPointer enabled />);

    expect(dot.hidden).toBe(false);
    expect(dot.style.transform).toBe("translate(120px, 80px)");
  });

  it("hides for touch input", () => {
    const { dot } = renderLaserPointer();
    dispatchPointer(window, "pointermove", { clientX: 120, clientY: 80 });

    dispatchPointer(window, "pointermove", { pointerType: "touch" });

    expect(dot.style.visibility).toBe("hidden");
  });

  it("hides when the pointer leaves the window", () => {
    const { dot, container } = renderLaserPointer();
    dispatchPointer(window, "pointermove", { clientX: 120, clientY: 80 });

    dispatchPointer(container, "pointerout", { relatedTarget: null });

    expect(dot.style.visibility).toBe("hidden");
  });

  it("hides when the pointer moves over an embed", () => {
    const { dot, container } = renderLaserPointer();
    const embed = container.appendChild(document.createElement("iframe"));
    dispatchPointer(window, "pointermove", { clientX: 120, clientY: 80 });

    dispatchPointer(container, "pointerout", { relatedTarget: embed });

    expect(dot.style.visibility).toBe("hidden");
  });

  it("stays visible when the pointer moves onto another page element", () => {
    const { dot, container } = renderLaserPointer();
    const paragraph = container.appendChild(document.createElement("p"));
    dispatchPointer(window, "pointermove", { clientX: 120, clientY: 80 });

    dispatchPointer(container, "pointerout", { relatedTarget: paragraph });

    expect(dot.style.visibility).toBe("visible");
  });
});
