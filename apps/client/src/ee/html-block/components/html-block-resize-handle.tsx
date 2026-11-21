import React, { RefObject, useEffect, useRef, useState } from "react";
import { clampHtmlBlockFixedHeight } from "@/ee/html-block/utils/html-block-height";
import classes from "./html-block-view.module.css";

type HtmlBlockResizeHandleProps = {
  targetRef: RefObject<HTMLElement | null>;
  height: number;
  onResize: (height: number) => void;
};

export function HtmlBlockResizeHandle({
  targetRef,
  height,
  onResize,
}: HtmlBlockResizeHandleProps) {
  const [resizing, setResizing] = useState(false);
  const stopDragRef = useRef<(() => void) | null>(null);

  useEffect(() => () => stopDragRef.current?.(), []);

  const handleMouseDown = (event: React.MouseEvent) => {
    const target = targetRef.current;
    if (event.button !== 0 || !target) return;
    event.preventDefault();
    event.stopPropagation();

    const startY = event.clientY;
    let nextHeight = height;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      nextHeight = clampHtmlBlockFixedHeight(
        height + moveEvent.clientY - startY,
      );
      target.style.height = `${nextHeight}px`;
    };

    const stopDrag = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      stopDragRef.current = null;
    };

    const handleMouseUp = () => {
      stopDrag();
      setResizing(false);
      if (nextHeight !== height) onResize(nextHeight);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.body.style.cursor = "ns-resize";
    document.body.style.userSelect = "none";
    stopDragRef.current = stopDrag;
    setResizing(true);
  };

  return (
    <>
      {resizing && <div className={classes.resizeOverlay} />}
      <div
        className={classes.resizeHandle}
        data-resizing={resizing || undefined}
        contentEditable={false}
        aria-hidden
        onMouseDown={handleMouseDown}
      >
        <div className={classes.resizeBar} />
      </div>
    </>
  );
}
