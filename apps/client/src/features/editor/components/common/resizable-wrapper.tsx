import React, { ReactNode, useCallback, useEffect, useRef, useState } from "react";
import clsx from "clsx";
import classes from "./resizable-wrapper.module.css";

type Handle = "tl" | "tr" | "bl" | "br" | "bottom";

const HANDLE_SIGN: Record<Handle, { x: number; y: number }> = {
  br: { x: 1, y: 1 },
  bl: { x: -1, y: 1 },
  tr: { x: 1, y: -1 },
  tl: { x: -1, y: -1 },
  bottom: { x: 0, y: 1 },
};

const HANDLE_CURSOR: Record<Handle, string> = {
  br: "nwse-resize",
  tl: "nwse-resize",
  bl: "nesw-resize",
  tr: "nesw-resize",
  bottom: "ns-resize",
};

const CORNER_CLASSES: Record<string, string> = {
  tl: classes.cornerHandleTL,
  tr: classes.cornerHandleTR,
  bl: classes.cornerHandleBL,
  br: classes.cornerHandleBR,
};

interface ResizableWrapperProps {
  children: ReactNode;
  initialWidth?: number;
  initialHeight?: number;
  fitToContainer?: boolean;
  widthPercent?: number;
  minWidth?: number;
  maxWidth?: number;
  minHeight?: number;
  maxHeight?: number;
  onResize?: (width: number, height: number) => void;
  isEditable?: boolean;
  className?: string;
  selected?: boolean;
}

type DragState = {
  handle: Handle;
  startX: number;
  startY: number;
  startWidth: number;
  startHeight: number;
  maxWidth: number;
  moved: boolean;
};

function sizeStyle(
  width: number,
  height: number,
  fitToContainer: boolean,
  widthPercent?: number,
): React.CSSProperties {
  if (!fitToContainer) return { width: `${width}px`, height: `${height}px` };
  return {
    width: widthPercent ? `${widthPercent}%` : `${width}px`,
    maxWidth: "100%",
    height: "auto",
    aspectRatio: `${width} / ${height}`,
  };
}

function dragSize(start: number, delta: number, min: number, max: number) {
  // Keep the first drag smooth when the displayed size is outside the limits.
  return Math.min(Math.max(start, max), Math.max(Math.min(start, min), start + delta));
}

export const ResizableWrapper: React.FC<ResizableWrapperProps> = ({
  children,
  initialWidth = 640,
  initialHeight = 480,
  fitToContainer = false,
  widthPercent,
  minWidth = 200,
  maxWidth = 1200,
  minHeight = 200,
  maxHeight = 1200,
  onResize,
  isEditable = true,
  className,
  selected = false,
}) => {
  const [isResizing, setIsResizing] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const dragRef = useRef<DragState | null>(null);
  const onResizeRef = useRef(onResize);
  onResizeRef.current = onResize;
  const constraintsRef = useRef({ minWidth, minHeight, maxHeight, fitToContainer });
  constraintsRef.current = { minWidth, minHeight, maxHeight, fitToContainer };

  const handleMouseMove = useRef((e: MouseEvent) => {
    const drag = dragRef.current;
    if (!drag || !wrapperRef.current) return;

    const sign = HANDLE_SIGN[drag.handle];
    const { minWidth, minHeight, maxHeight, fitToContainer } = constraintsRef.current;
    const deltaX = (e.clientX - drag.startX) * sign.x;
    const deltaY = (e.clientY - drag.startY) * sign.y;
    const width = sign.x === 0
      ? drag.startWidth
      : dragSize(drag.startWidth, deltaX, minWidth, drag.maxWidth);
    const height = dragSize(drag.startHeight, deltaY, minHeight, maxHeight);
    if (!drag.moved && width === drag.startWidth && height === drag.startHeight) return;
    drag.moved = true;
    Object.assign(wrapperRef.current.style, sizeStyle(width, height, fitToContainer));
  }).current;

  const handleMouseUp = useRef(() => {
    const resized = dragRef.current?.moved;
    dragRef.current = null;
    setIsResizing(false);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);
    if (resized && wrapperRef.current) {
      const { width, height } = wrapperRef.current.getBoundingClientRect();
      onResizeRef.current?.(Math.round(width), Math.round(height));
    }
  }).current;

  const handleResizeStart = useCallback((e: React.MouseEvent, handle: Handle) => {
    e.preventDefault();
    e.stopPropagation();
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const { width, height } = wrapper.getBoundingClientRect();
    const containerWidth = fitToContainer && wrapper.parentElement
      ? wrapper.parentElement.getBoundingClientRect().width
      : maxWidth;
    dragRef.current = {
      handle,
      startX: e.clientX,
      startY: e.clientY,
      startWidth: width,
      startHeight: height,
      maxWidth: Math.min(maxWidth, containerWidth),
      moved: false,
    };
    setIsResizing(true);
    document.body.style.cursor = HANDLE_CURSOR[handle];
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }, [handleMouseMove, handleMouseUp, fitToContainer, maxWidth]);

  useEffect(() => {
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  const shouldShowHandles = isEditable && (isHovered || isResizing || selected);

  return (
    <div
      ref={wrapperRef}
      className={clsx(classes.wrapper, className, {
        [classes.resizing]: isResizing,
      })}
      style={sizeStyle(initialWidth, initialHeight, fitToContainer, widthPercent)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {children}
      {isResizing && <div className={classes.overlay} />}
      {shouldShowHandles && (
        <>
          {(["tl", "tr", "bl", "br"] as const).map((corner) => (
            <div
              key={corner}
              className={clsx(classes.cornerHandle, CORNER_CLASSES[corner])}
              onMouseDown={(e) => handleResizeStart(e, corner)}
            />
          ))}
          <div
            className={classes.resizeHandleBottom}
            onMouseDown={(e) => handleResizeStart(e, "bottom")}
          >
            <div className={classes.resizeBar} />
          </div>
        </>
      )}
    </div>
  );
};
