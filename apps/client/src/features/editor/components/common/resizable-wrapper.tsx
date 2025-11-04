import React, { ReactNode, useCallback, useEffect, useRef, useState } from "react";
import clsx from "clsx";
import classes from "./resizable-wrapper.module.css";

interface ResizableWrapperProps {
  children: ReactNode;
  initialHeight?: number;
  initialWidth?: string;
  minHeight?: number;
  maxHeight?: number;
  minWidth?: string;
  maxWidth?: string;
  onResize?: (height: number, width?: string) => void;
  isEditable?: boolean;
  className?: string;
  showHandles?: "always" | "hover";
  direction?: "vertical" | "horizontal" | "both";
}

export const ResizableWrapper: React.FC<ResizableWrapperProps> = ({
  children,
  initialHeight = 480,
  initialWidth = "100%",
  minHeight = 200,
  maxHeight = 1200,
  minWidth = "20%",
  maxWidth = "100%",
  onResize,
  isEditable = true,
  className,
  showHandles = "hover",
  direction = "vertical",
}) => {
  const [resizeParams, setResizeParams] = useState<{
    initialHeight: number;
    initialWidth: string;
    initialClientY: number;
    initialClientX: number;
    direction: "vertical" | "horizontal";
  } | null>(null);
  const [currentHeight, setCurrentHeight] = useState(initialHeight);
  const [currentWidth, setCurrentWidth] = useState<string>(initialWidth);
  const [isHovered, setIsHovered] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!resizeParams) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!wrapperRef.current) return;

      if (resizeParams.direction === "vertical" && (direction === "vertical" || direction === "both")) {
        const deltaY = e.clientY - resizeParams.initialClientY;
        const newHeight = Math.min(
          Math.max(resizeParams.initialHeight + deltaY, minHeight),
          maxHeight
        );
        setCurrentHeight(newHeight);
        wrapperRef.current.style.height = `${newHeight}px`;
      }
      
      if (resizeParams.direction === "horizontal" && (direction === "horizontal" || direction === "both")) {
        const deltaX = e.clientX - resizeParams.initialClientX;
        const parentWidth = wrapperRef.current.parentElement?.offsetWidth || 800;
        
        const minWidthPixels = typeof minWidth === "string" && minWidth.endsWith("%") 
          ? (parentWidth * parseFloat(minWidth)) / 100
          : typeof minWidth === "number" ? minWidth : 160;
        
        const maxWidthPixels = typeof maxWidth === "string" && maxWidth.endsWith("%") 
          ? (parentWidth * parseFloat(maxWidth)) / 100
          : typeof maxWidth === "number" ? maxWidth : parentWidth;
        
        const initialPercentage = parseFloat(resizeParams.initialWidth);
        const initialPixelWidth = (parentWidth * initialPercentage) / 100;
        const newPixelWidth = Math.min(
          Math.max(initialPixelWidth + deltaX, minWidthPixels),
          maxWidthPixels
        );
        const newWidth = `${Math.round((newPixelWidth / parentWidth) * 100)}%`;
        
        
        setCurrentWidth(newWidth);
        wrapperRef.current.style.width = newWidth;
      }
    };

    const handleMouseUp = () => {
      if (onResize) {

        onResize(currentHeight, currentWidth);
      }
      setResizeParams(null);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [resizeParams, currentHeight, currentWidth, minHeight, maxHeight, minWidth, maxWidth, direction, onResize]);

  const handleVerticalResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    setResizeParams({
      initialHeight: currentHeight,
      initialWidth: currentWidth,
      initialClientY: e.clientY,
      initialClientX: e.clientX,
      direction: "vertical",
    });

    document.body.style.cursor = "ns-resize";
    document.body.style.userSelect = "none";
  }, [currentHeight, currentWidth]);

  const handleHorizontalResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    setResizeParams({
      initialHeight: currentHeight,
      initialWidth: currentWidth,
      initialClientY: e.clientY,
      initialClientX: e.clientX,
      direction: "horizontal",
    });

    document.body.style.cursor = "ew-resize";
    document.body.style.userSelect = "none";
  }, [currentHeight, currentWidth]);

  const shouldShowHandles = 
    isEditable && 
    (showHandles === "always" || (showHandles === "hover" && (isHovered || resizeParams)));

  return (
    <div
      ref={wrapperRef}
      className={clsx(classes.wrapper, className, {
        [classes.resizing]: !!resizeParams,
      })}
      style={{ 
        height: `${currentHeight}px`,
        width: currentWidth,
        maxWidth: "100%",
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {children}
      {!!resizeParams && <div className={classes.overlay} />}
      
      {/* Vertical resize handle */}
      {shouldShowHandles && (direction === "vertical" || direction === "both") && (
        <div
          className={classes.resizeHandleBottom}
          onMouseDown={handleVerticalResizeStart}
        >
          <div className={classes.resizeBar} />
        </div>
      )}
      
      {/* Horizontal resize handle */}
      {shouldShowHandles && (direction === "horizontal" || direction === "both") && (
        <div
          className={classes.resizeHandleRight}
          onMouseDown={handleHorizontalResizeStart}
        >
          <div className={classes.resizeBarVertical} />
        </div>
      )}
    </div>
  );
};