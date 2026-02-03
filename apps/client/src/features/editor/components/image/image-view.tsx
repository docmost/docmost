import { NodeViewProps, NodeViewWrapper } from "@tiptap/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Image as MantineImage, TextInput } from "@mantine/core";
import { getFileUrl } from "@/lib/config.ts";
import clsx from "clsx";
import classes from "./image-view.module.css";

export default function ImageView(props: NodeViewProps) {
  const { node, selected, updateAttributes, editor } = props;
  const { src, width, title, caption } = node.attrs;
  const [hovered, setHovered] = useState(false);
  const [resizing, setResizing] = useState(false);
  const [currentWidth, setCurrentWidth] = useState<number | string>(width || "100%");

  const resizeRef = useRef<{
    startX: number;
    startWidth: number;
    direction: number;
  } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  const isEditable = editor.isEditable;
  const showPlaceholder = isEditable && (selected || hovered);
  const hasCaption = !!caption;

  useEffect(() => {
    setCurrentWidth(width || "100%");
  }, [width]);

  const onMouseDown = (
    e: React.MouseEvent,
    direction: number
  ) => {
    if (!isEditable || !containerRef.current) return;
    e.preventDefault();
    e.stopPropagation();

    const startWidth = containerRef.current.offsetWidth;

    resizeRef.current = {
      startX: e.clientX,
      startWidth,
      direction,
    };
    setResizing(true);

    document.body.style.cursor = "ew-resize";
    document.body.style.userSelect = "none";
  };

  useEffect(() => {
    if (!resizing) return;

    const onMouseMove = (e: MouseEvent) => {
      if (!resizeRef.current) return;

      const { startX, startWidth, direction } = resizeRef.current;
      const uniqueDelta = (e.clientX - startX) * direction;

      // Calculate new width
      // We assume aspect ratio is maintained by height: auto
      const newWidth = Math.max(50, startWidth + uniqueDelta);

      // Update local state for smooth resizing
      setCurrentWidth(`${newWidth}px`);
    };

    const onMouseUp = () => {
      setResizing(false);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";

      if (resizeRef.current) {
        // Commit the final width change
        // We use the last calculated width from the ref or derive it
        // Ideally we should have been tracking it in a ref if updates are slow, 
        // but setState is usually fast enough for mouseup commit.
        // Let's grab the actual DOM width if possible or trust currentWidth

        // Better: parse currentWidth if it is in px
        if (typeof currentWidth === 'string' && currentWidth.endsWith('px')) {
          updateAttributes({ width: currentWidth });
        }
      }
      resizeRef.current = null;
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);

    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
  }, [resizing, currentWidth, updateAttributes]);

  return (
    <NodeViewWrapper
      as="span"
      className={clsx(classes.imageWrapper, {
        [classes.selected]: selected,
        "ProseMirror-selectednode": selected // Keep this for tiptap selection styles
      })}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: currentWidth,
        display: "inline-block",
        verticalAlign: "top"
      }}
      ref={containerRef}
    >
      <img
        src={getFileUrl(src)}
        alt={title}
        className={classes.image}
        style={{
          width: "100%",
          height: "auto",
          display: "block",
          borderRadius: "var(--mantine-radius-md)",
          objectFit: "contain"
        }}
      />

      {/* Visual resize handles */}
      {isEditable && (selected || hovered || resizing) && (
        <>
          <div
            className={clsx(classes.resizeHandle, classes.resizeHandleNw)}
            onMouseDown={(e) => onMouseDown(e, -1)}
          />
          <div
            className={clsx(classes.resizeHandle, classes.resizeHandleNe)}
            onMouseDown={(e) => onMouseDown(e, 1)}
          />
          <div
            className={clsx(classes.resizeHandle, classes.resizeHandleSw)}
            onMouseDown={(e) => onMouseDown(e, -1)}
          />
          <div
            className={clsx(classes.resizeHandle, classes.resizeHandleSe)}
            onMouseDown={(e) => onMouseDown(e, 1)}
          />
        </>
      )}

      {/* Caption Input */}
      <TextInput
        variant="unstyled"
        placeholder="Add a caption..."
        value={caption || ""}
        onChange={(e) => updateAttributes({ caption: e.target.value })}
        styles={{
          input: {
            textAlign: "center",
            color: "var(--mantine-color-dimmed)",
            fontSize: "var(--mantine-font-size-sm)",
            marginTop: "4px",
            padding: 0,
            minHeight: 0,
            height: "auto",
            opacity: hasCaption || showPlaceholder ? 1 : 0,
            transition: "opacity 0.2s ease-in-out",
            pointerEvents: isEditable ? "auto" : "none",
            width: "100%", // Caption takes full width of the resized container
          },
          root: {
            width: "100%"
          }
        }}
        readOnly={!isEditable}
      />
    </NodeViewWrapper>
  );
}
