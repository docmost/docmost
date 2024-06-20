import { NodeViewProps, NodeViewWrapper } from "@tiptap/react";
import { useMemo } from "react";
import { Image } from "@mantine/core";
import { getBackendUrl } from "@/lib/config.ts";

export default function ImageView(props: NodeViewProps) {
  const { node, selected } = props;
  const { src, width, align } = node.attrs;

  const flexJustifyContent = useMemo(() => {
    if (align === "center") return "center";
    if (align === "right") return "flex-end";
    return "flex-start";
  }, [align]);

  return (
    <NodeViewWrapper
      style={{
        position: "relative",
        display: "flex",
        justifyContent: flexJustifyContent,
      }}
    >
      <Image
        radius="md"
        src={getBackendUrl() + src}
        fit="contain"
        w={width}
        className={selected && "ProseMirror-selectednode"}
      />
    </NodeViewWrapper>
  );
}
