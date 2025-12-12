import { NodeViewProps, NodeViewWrapper } from "@tiptap/react";
import { useEffect, useMemo, useRef } from "react";
import { Image } from "@mantine/core";
import { getFileUrl } from "@/lib/config.ts";
import clsx from "clsx";

export default function ImageView(props: NodeViewProps) {
  const ref = useRef<HTMLDivElement>(null);

  const { node, selected } = props;
  const { src, width, align, title } = node.attrs;

  const alignClass = useMemo(() => {
    if (align === "left") return "alignLeft";
    if (align === "right") return "alignRight";
    if (align === "center") return "alignCenter";
    return "alignCenter";
  }, [align]);

  useEffect(() => {
    const wrapper = ref.current?.closest(".react-renderer.node-image");
    if (wrapper instanceof HTMLElement) {
      wrapper.removeAttribute("style");

      if (align === "floatLeft" || align === "floatRight") {
        let float: string;
        let padding: string;
        const p = 10;

        if (align === "floatLeft"){
          float = "left";
          padding = `0 ${p}px 0 0`;
        }
        if (align === "floatRight"){
          float = "right";
          padding = `0 0 0 ${p}px`;
        }

        Object.assign(wrapper.style, {
          float: float,
          width: width,
          padding: padding,
        });
      }
    }
  }, [align, width]);

  return (
    <NodeViewWrapper data-drag-handle ref={ref}>
      <Image
        radius="md"
        fit="contain"
        w={(align==="floatLeft" || align==="floatRight") ? "100%" : width}
        src={getFileUrl(src)}
        alt={title}
        className={clsx(selected ? "ProseMirror-selectednode" : "", alignClass)}
      />
    </NodeViewWrapper>
  );
}
