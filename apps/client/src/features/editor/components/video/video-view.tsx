import { NodeViewProps, NodeViewWrapper } from "@tiptap/react";
import { Group, Loader, Text } from "@mantine/core";
import { useMemo } from "react";
import { getFileUrl } from "@/lib/config.ts";
import clsx from "clsx";
import classes from "./video-view.module.css";

export default function VideoView(props: NodeViewProps) {
  const { editor, node, selected } = props;
  const { src, width, align, aspectRatio, placeholder } = node.attrs;
  const alignClass = useMemo(() => {
    if (align === "left") return "alignLeft";
    if (align === "right") return "alignRight";
    if (align === "center") return "alignCenter";
    return "alignCenter";
  }, [align]);
  const previewSrc = useMemo(() => {
    editor.storage.shared.videoPreviews =
      editor.storage.shared.videoPreviews || {};

    if (placeholder?.id) {
      return editor.storage.shared.videoPreviews[placeholder.id];
    }

    return null;
  }, [placeholder, editor]);

  return (
    <NodeViewWrapper data-drag-handle>
      <div
        className={clsx(
          selected && "ProseMirror-selectednode",
          classes.videoWrapper,
          alignClass,
        )}
        style={{
          aspectRatio: aspectRatio ? aspectRatio : src ? undefined : "16 / 9",
          width,
        }}
      >
        {src && (
          <video
            className={classes.video}
            preload="metadata"
            controls
            src={getFileUrl(src)}
          />
        )}
        {!src && previewSrc && (
          <Group pos="relative" h="100%" w="100%">
            <video
              className={classes.video}
              preload="metadata"
              controls
              src={previewSrc}
            />
            <Loader size={20} pos="absolute" top={6} right={6} />
          </Group>
        )}
        {!src && !previewSrc && (
          <Group justify="space-between" wrap="nowrap">
            <Loader size={20} />
            <Text component="span" size="md" truncate="end">
              Uploading{placeholder?.name ? ` ${placeholder?.name}` : ""}...
            </Text>
          </Group>
        )}
      </div>
    </NodeViewWrapper>
  );
}
