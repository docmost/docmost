import { NodeViewProps, NodeViewWrapper } from "@tiptap/react";
import { useMemo } from "react";
import { Image } from "@mantine/core";
import { getSharedFileUrl } from "@/lib/config.ts";

export default function SharedImageView(props: NodeViewProps) {
  const { node } = props;
  const { src, width, align, title } = node.attrs;

  const alignClass = useMemo(() => {
    if (align === "left") return "alignLeft";
    if (align === "right") return "alignRight";
    if (align === "center") return "alignCenter";
    return "alignCenter";
  }, [align]);

  return (
    <NodeViewWrapper>
      <Image
        radius="md"
        fit="contain"
        w={width}
        src={getSharedFileUrl(src)}
        alt={title}
        className={alignClass}
      />
    </NodeViewWrapper>
  );
}
