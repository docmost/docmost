import { NodeViewProps, NodeViewWrapper } from "@tiptap/react";
import { useMemo } from "react";
import { Image, TextInput } from "@mantine/core";
import { getFileUrl } from "@/lib/config.ts";
import clsx from "clsx";

export default function ImageView(props: NodeViewProps) {
  const { node, selected } = props;
  const { src, width, align, title } = node.attrs;

  const alignClass = useMemo(() => {
    if (align === "left") return "alignLeft";
    if (align === "right") return "alignRight";
    if (align === "center") return "alignCenter";
    return "alignCenter";
  }, [align]);

  return (
    <NodeViewWrapper data-drag-handle>
      <Image
        radius="md"
        fit="contain"
        w={width}
        src={getFileUrl(src)}
        alt={title}
        className={clsx(selected ? "ProseMirror-selectednode" : "", alignClass)}
      />
      <TextInput
        variant="unstyled"
        placeholder="Add a caption..."
        value={node.attrs.caption || ""}
        onChange={(e) => props.updateAttributes({ caption: e.target.value })}
        styles={{
          input: {
            textAlign: align || "center",
            color: "var(--mantine-color-dimmed)",
            fontSize: "var(--mantine-font-size-sm)",
            padding: 0,
            opacity: !props.editor.isEditable && !node.attrs.caption ? 0 : 1,
          },
        }}
        readOnly={!props.editor.isEditable}
      />
    </NodeViewWrapper>
  );
}
