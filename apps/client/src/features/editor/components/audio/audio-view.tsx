import { NodeViewProps, NodeViewWrapper } from "@tiptap/react";
import { getFileUrl } from "@/lib/config.ts";
import clsx from "clsx";

export default function AudioView(props: NodeViewProps) {
  const { node, selected } = props;
  const { src, title, size } = node.attrs;

  return (
    <NodeViewWrapper className="node-audio">
      <audio
        preload="metadata"
        controls
        src={getFileUrl(src)}
        className={clsx(selected ? "ProseMirror-selectednode" : "")}
        aria-label={title ? `Audio: ${title}` : "Audio player"}
      />
    </NodeViewWrapper>
  );
}