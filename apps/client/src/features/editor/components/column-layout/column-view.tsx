import { ActionIcon } from "@mantine/core";
import { IconGripVertical } from "@tabler/icons-react";
import { NodeViewProps, mergeAttributes } from "@tiptap/core";
import { NodeViewContent, NodeViewWrapper } from "@tiptap/react";
import { useEffect, useRef } from "react";

export default function ColumnView(props: NodeViewProps) {
  const { node, HTMLAttributes } = props;
  const { class: classNameProp, style: styleProp } = node.attrs;

  const ref = useRef<HTMLDivElement>(null);

  const wrapperClass = (xs: number, md: number, lg: number) => {
    const wrapper = ref.current?.closest(".react-renderer.node-column");
    if (wrapper instanceof HTMLElement) {
      const keep = ["react-renderer", "node-column"];

      for (let i = wrapper.classList.length - 1; i >= 0; i--) {
        const cls = wrapper.classList[i];
        if (!keep.includes(cls)) {
          wrapper.classList.remove(cls);
        }
      }

      wrapper.classList.add("col-xs-" + xs);
      wrapper.classList.add("col-md-" + md);
      wrapper.classList.add("col-lg-" + lg);
    }
  };

  useEffect(() => {
    wrapperClass(props.node.attrs.xs, props.node.attrs.md, props.node.attrs.lg);
  }, [node.attrs]);

  return (
    <NodeViewWrapper
      {...mergeAttributes(HTMLAttributes, {
        class: classNameProp,
        style: styleProp,
      })}
      ref={ref}
    >
      <ActionIcon
        className="column-drag-handle"
        variant="default"
        size="sm"
        data-drag-handle
        contentEditable={false}
      >
        <IconGripVertical
          style={{ width: "70%", height: "70%" }}
          stroke={1.5}
        />
      </ActionIcon>

      <NodeViewContent />
    </NodeViewWrapper>
  );
}
