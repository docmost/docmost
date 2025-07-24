import React, { ReactNode, useCallback, useEffect, useRef, useState } from "react";
import clsx from "clsx";
import classes from "./resizable-wrapper.module.css";

interface ResizableWrapperProps {
  children: ReactNode;
  initialHeight?: number;
  minHeight?: number;
  maxHeight?: number;
  onResize?: (height: number) => void;
  isEditable?: boolean;
  className?: string;
  showHandles?: "always" | "hover";
  direction?: "vertical" | "horizontal" | "both";
}

export const ResizableWrapper: React.FC<ResizableWrapperProps> = ({
  children,
  initialHeight = 480,
  minHeight = 200,
  maxHeight = 1200,
  onResize,
  isEditable = true,
  className,
  showHandles = "hover",
  direction = "vertical",
}) => {
  const [resizeParams, setResizeParams] = useState<{
    initialSize: number;
    initialClientY: number;
    initialClientX: number;
  } | null>(null);
  const [currentHeight, setCurrentHeight] = useState(initialHeight);
  const [isHovered, setIsHovered] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!resizeParams) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!wrapperRef.current) return;

      if (direction === "vertical" || direction === "both") {
        const deltaY = e.clientY - resizeParams.initialClientY;
        const newHeight = Math.min(
          Math.max(resizeParams.initialSize + deltaY, minHeight),
          maxHeight
        );
        setCurrentHeight(newHeight);
        wrapperRef.current.style.height = `${newHeight}px`;
      }
    };

    const handleMouseUp = () => {
      setResizeParams(null);
      if (onResize && currentHeight !== initialHeight) {
        onResize(currentHeight);
      }
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [resizeParams, currentHeight, initialHeight, onResize, minHeight, maxHeight, direction]);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    setResizeParams({
      initialSize: currentHeight,
      initialClientY: e.clientY,
      initialClientX: e.clientX,
    });

    document.body.style.cursor = "ns-resize";
    document.body.style.userSelect = "none";
  }, [currentHeight]);

  const shouldShowHandles = 
    isEditable && 
    (showHandles === "always" || (showHandles === "hover" && (isHovered || resizeParams)));

  return (
    <div
      ref={wrapperRef}
      className={clsx(classes.wrapper, className, {
        [classes.resizing]: !!resizeParams,
      })}
      style={{ height: currentHeight }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {children}
      {!!resizeParams && <div className={classes.overlay} />}
      {shouldShowHandles && direction === "vertical" && (
        <div
          className={classes.resizeHandleBottom}
          onMouseDown={handleResizeStart}
        >
          <div className={classes.resizeBar} />
        </div>
      )}
    </div>
  );
};