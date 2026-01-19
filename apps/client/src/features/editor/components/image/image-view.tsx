import { NodeViewProps, NodeViewWrapper } from "@tiptap/react";
import { useMemo } from "react";
import { Image } from "@mantine/core";
import { getFileUrl } from "@/lib/config.ts";
import clsx from "clsx";
import classes from "./image-view.module.css";

export default function ImageView(props: NodeViewProps) {
  const { node, selected } = props;
  const { src, width, align, title, aspectRatio } = node.attrs;
  const alignClass = useMemo(() => {
    if (align === "left") return "alignLeft";
    if (align === "right") return "alignRight";
    if (align === "center") return "alignCenter";
    return "alignCenter";
  }, [align]);

  return (
    <NodeViewWrapper data-drag-handle>
      <div
        className={clsx(
          selected ? "ProseMirror-selectednode" : "",
          classes.imagePlaceholder,
          alignClass,
        )}
        style={{
          aspectRatio: aspectRatio ? aspectRatio : src ? undefined : "16 / 9",
          width,
        }}
      >
        {src && (
          <Image radius="md" fit="contain" src={getFileUrl(src)} alt={title} />
        )}
      </div>
    </NodeViewWrapper>
  );
}
