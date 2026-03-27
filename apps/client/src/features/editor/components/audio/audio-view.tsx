import { NodeViewProps, NodeViewWrapper } from "@tiptap/react";
import { Group, Loader, Text } from "@mantine/core";
import { useMemo } from "react";
import { getFileUrl } from "@/lib/config.ts";
import classes from "./audio-view.module.css";
import { useTranslation } from "react-i18next";

export default function AudioView(props: NodeViewProps) {
  const { t } = useTranslation();
  const { editor, node } = props;
  const { src, placeholder } = node.attrs;

  const previewSrc = useMemo(() => {
    editor.storage.shared.audioPreviews =
      editor.storage.shared.audioPreviews || {};

    if (placeholder?.id) {
      return editor.storage.shared.audioPreviews[placeholder.id];
    }

    return null;
  }, [placeholder, editor]);

  return (
    <NodeViewWrapper data-drag-handle>
      <div className={classes.audioWrapper}>
        {src && (
          <audio
            className={classes.audio}
            preload="metadata"
            controls
            src={getFileUrl(src)}
          />
        )}
        {!src && previewSrc && (
          <Group pos="relative" w="100%">
            <audio
              className={classes.audio}
              preload="metadata"
              controls
              src={previewSrc}
            />
            <Loader size={20} pos="absolute" top={6} right={6} />
          </Group>
        )}
        {!src && !previewSrc && (
          <Group justify="center" wrap="nowrap" gap="xs" maw="100%" px="md" h={54}>
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
