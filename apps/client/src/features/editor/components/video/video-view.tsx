import { NodeViewProps, NodeViewWrapper } from "@tiptap/react";
import { Group, Loader, Text } from "@mantine/core";
import { useMemo } from "react";
import { getFileUrl } from "@/lib/config.ts";
import clsx from "clsx";
import classes from "./video-view.module.css";
import { useTranslation } from "react-i18next";

export default function VideoView(props: NodeViewProps) {
  const { t } = useTranslation();
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
          <Group justify="center" wrap="nowrap" gap="xs" maw="100%" px="md">
            <Loader size={20} style={{ flexShrink: 0 }} />
            <Text component="span" size="sm" truncate="end">
              {placeholder?.name
                ? t("Uploading {{name}}", { name: placeholder.name })
                : t("Uploading file")}
            </Text>
          </Group>
        )}
      </div>
    </NodeViewWrapper>
  );
}
