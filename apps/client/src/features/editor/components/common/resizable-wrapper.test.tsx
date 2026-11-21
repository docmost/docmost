import { fireEvent, render } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { ResizableWrapper } from "./resizable-wrapper";
import classes from "./resizable-wrapper.module.css";

it("resizes a relative embed from its displayed dimensions within the column", () => {
  const onResize = vi.fn();
  const { container } = render(
    <ResizableWrapper
      initialWidth={853}
      initialHeight={480}
      widthPercent={80}
      fitToContainer
      selected
      onResize={onResize}
    >
      <iframe title="Video" />
    </ResizableWrapper>,
  );
  const frame = container.firstElementChild as HTMLElement;
  const corner = frame.querySelector(`.${classes.cornerHandleBR}`)!;
  vi.spyOn(container, "getBoundingClientRect").mockReturnValue(
    new DOMRect(0, 0, 400, 500),
  );
  const bounds = vi
    .spyOn(frame, "getBoundingClientRect")
    .mockReturnValue(new DOMRect(0, 0, 320, 180));

  expect(frame.style.width).toBe("80%");
  fireEvent.mouseDown(corner, { clientX: 320, clientY: 180 });
  fireEvent.mouseUp(document);
  expect(onResize).not.toHaveBeenCalled();
  expect(frame.style.width).toBe("80%");

  fireEvent.mouseDown(corner, { clientX: 320, clientY: 180 });
  fireEvent.mouseMove(document, { clientX: 340, clientY: 185 });
  expect(frame.style.width).toBe("340px");
  expect(frame.style.aspectRatio).toBe("340 / 185");
  fireEvent.mouseMove(document, { clientX: 450, clientY: 185 });
  expect(frame.style.width).toBe("400px");
  bounds.mockReturnValue(new DOMRect(0, 0, 400, 185));
  fireEvent.mouseUp(document);
  expect(onResize).toHaveBeenCalledExactlyOnceWith(400, 185);
});
