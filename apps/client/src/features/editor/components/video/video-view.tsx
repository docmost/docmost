import { NodeViewProps, NodeViewWrapper } from "@tiptap/react";
import { useMemo } from "react";
import { getFileUrl } from "@/lib/config.ts";

export default function VideoView(props: NodeViewProps) {
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
      <video
        preload="metadata"
        width={width}
        controls
        src={getFileUrl(src)}
        className={selected ? "ProseMirror-selectednode" : ""}
      />
    </NodeViewWrapper>
  );
}
