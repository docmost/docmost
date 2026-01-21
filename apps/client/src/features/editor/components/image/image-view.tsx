import { NodeViewProps, NodeViewWrapper } from "@tiptap/react";
import { useMemo, useState } from "react";
import { Image, TextInput } from "@mantine/core";
import { getFileUrl } from "@/lib/config.ts";
import clsx from "clsx";

export default function ImageView(props: NodeViewProps) {
  const { node, selected } = props;
  const { src, width, align, title, caption } = node.attrs;
  const [hovered, setHovered] = useState(false);

  const alignClass = useMemo(() => {
    if (align === "left") return "alignLeft";
    if (align === "right") return "alignRight";
    if (align === "center") return "alignCenter";
    return "alignCenter";
  }, [align]);

  const isEditable = props.editor.isEditable;
  const showPlaceholder = isEditable && (selected || hovered);
  const hasCaption = !!caption;

  return (
    <NodeViewWrapper
      data-drag-handle
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        className={alignClass}
        style={{ width: width || "100%", display: "block" }}
      >
        <Image
          radius="md"
          fit="contain"
          w="100%"
          src={getFileUrl(src)}
          alt={title}
          className={clsx(selected ? "ProseMirror-selectednode" : "")}
        />
        <TextInput
          variant="unstyled"
          placeholder="Add a caption..."
          value={caption || ""}
          onChange={(e) => props.updateAttributes({ caption: e.target.value })}
          styles={{
            input: {
              textAlign: "center",
              color: "var(--mantine-color-dimmed)",
              fontSize: "var(--mantine-font-size-sm)",
              padding: 0,
              minHeight: 0,
              height: "auto",
              opacity: hasCaption || showPlaceholder ? 1 : 0,
              transition: "opacity 0.2s ease-in-out",
              pointerEvents: isEditable ? "auto" : "none",
            },
          }}
          readOnly={!isEditable}
        />
      </div>
    </NodeViewWrapper>
  );
}
